// server.js - Oracle Flux Backend (CORRIGÉ)

// --- 1. Importations des modules ---
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises'; 
import Groq from 'groq-sdk';  
import https from 'https';
import http from 'http';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs'; 
import cors from 'cors'; 
import { URL } from 'url';

// --- 2. Configuration de base et Middlewares ---
const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ⬅️ ATTENTION : Vérifiez que 'docs' est bien le dossier qui contient index.html
const publicPath = join(__dirname, 'docs'); 
const SOURCE_FILE = join(__dirname, 'source_list.json');

// Middlewares
app.use(express.static(publicPath));
app.use(express.json());
app.use(cors());

// Configuration Swagger
const swaggerDocument = YAML.load(join(__dirname, 'swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Initialisation Groq
if (!process.env.GROQ_API_KEY) {
    console.error("ERREUR: La variable d'environnement GROQ_API_KEY n'est pas définie.");
}
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });


// --- 3. Fonctions Utilitaires (CRUD sur source_list.json) ---

async function readSources() {
    try {
        const data = await fs.readFile(SOURCE_FILE, 'utf-8');
        const sources = JSON.parse(data);
        if (!Array.isArray(sources)) { throw new Error("Fichier de source mal formaté."); }
        return sources;
    } catch (error) {
        if (error.code === 'ENOENT') { 
            console.log(`[INIT] ${SOURCE_FILE} n'existe pas. Création d'un fichier vide.`); 
            await fs.writeFile(SOURCE_FILE, '[]', 'utf-8');
            return []; 
        }
        console.error("Erreur de lecture/parsing du fichier source:", error);
        throw new Error("Impossible de lire ou de parser les sources RSS.");
    }
}

async function writeSources(sources) {
    try {
        await fs.writeFile(SOURCE_FILE, JSON.stringify(sources, null, 4), 'utf-8');
    } catch (error) {
        console.error("Erreur d'écriture du fichier source:", error);
        throw new Error("Impossible de sauvegarder les sources RSS.");
    }
}


// --- 4. Intégration Groq (Oracle Flux) ---

async function getGroqResponse(prompt) {
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [{
                role: 'system',
                name: 'Oracle Flux',
                content: `
                    Vous êtes l'AGI Oracle_Flux, un Gestionnaire de Flux RSS expert. Votre tâche est d'analyser les requêtes de l'utilisateur et de générer une réponse au format JSON pour les commandes de gestion de sources, OU de générer une analyse textuelle pour les requêtes d'information.

                    Si la requête demande d'AJOUTER, de SUPPRIMER ou de RECHERCHER une source RSS, répondez UNIQUEMENT avec un bloc JSON valide au format suivant :

                    {
                        "action": "add" | "delete" | "search",
                        "name": "Nom de la source (si 'add' ou 'delete' par nom)",
                        "url": "URL du flux RSS (si 'add' ou 'delete' par URL)",
                        "keywords": "mots-clés pour la recherche (si 'search')"
                    }

                    Pour toute autre question (résumé, analyse de tendance, questions générales), répondez avec une analyse textuelle simple. NE renvoyez PAS de JSON pour les questions d'analyse.
                `,
            }, {
                role: 'user',
                content: prompt,
            }],
            model: 'llama-3.1-8b-instant', 
            temperature: 0.5,
            max_tokens: 1024,
        });
        return chatCompletion.choices[0].message.content;

    } catch (error) {
        console.error("Erreur lors de l'appel à Groq:", error);
        return "Désolé, une erreur est survenue lors de la communication avec le modèle IA Oracle Flux.";
    }
}


// --- 5. Fonction RSS (Parsing Natif) ---

function extractTagContent(xmlContent, tagName) {
    // Rend le contenu XML et les noms de balise insensibles à la casse pour la recherche
    const regex = new RegExp(`<${tagName}[^>]*?>([\\s\\S]*?)</${tagName}>`, 'i');
    const match = xmlContent.match(regex);

    if (match && match[1]) {
        // Retourne le contenu et le nettoie des balises HTML résiduelles
        return match[1].replace(/<\/?\w+>/g, '').trim(); 
    }
    
    return null;
}

function fetchRssXml(url) {
    return new Promise((resolve, reject) => {
        const urlParsed = new URL(url); 
        const client = urlParsed.protocol === 'https:' ? https : http;
        client.get(url, (res) => {
            let data = '';
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchRssXml(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) { return reject(new Error(`Statut HTTP ${res.statusCode} pour ${url}`)); }
            
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => { resolve(data); });
        }).on('error', (err) => { reject(err); });
    });
}

async function fetchAllRssFeeds() {
    const sources = await readSources();
    const articles = [];
    
    const fetchPromises = sources.map(async (source) => {
        try {
            const xmlContent = await fetchRssXml(source.url);
            
            const itemRegex = /<item>([\s\S]*?)<\/item>|<entry>([\s\S]*?)<\/entry>/gi;
            let match;

            while ((match = itemRegex.exec(xmlContent)) !== null) {
                const itemXml = match[1] || match[2]; 
                if (!itemXml) continue;
                
                const title = extractTagContent(itemXml, 'title');
                const link = extractTagContent(itemXml, 'link');
                const date = extractTagContent(itemXml, 'pubdate') || extractTagContent(itemXml, 'updated') || new Date().toISOString();
                const snippet = extractTagContent(itemXml, 'description') || extractTagContent(itemXml, 'summary');

                if (title && link) { 
                    articles.push({
                        sourceName: source.name, sourceId: source.id, title: title, link: link, date: date,
                        snippet: snippet ? snippet.substring(0, 150) : 'Pas de résumé.', 
                    });
                }
            }
        } catch (error) {
            console.warn(`⚠️ Erreur de réseau ou de parsing pour ${source.name}: ${error.message}`);
        }
    });

    await Promise.all(fetchPromises);
    articles.sort((a, b) => new Date(b.date) - new Date(a.date));
    if (articles.length === 0 && sources.length > 0) { console.warn("ATTENTION: Aucune donnée RSS n'a pu être extraite."); }
    
    return articles;
}


// --- 6. Endpoints de l'API REST (CRUD) ---

// READ (Chargement des sources)
app.get('/api/sources', async (req, res) => {
    try {
        // ⬅️ C'est cette fonction qui charge source_list.json
        const sources = await readSources(); 
        res.json(sources);
    } catch (error) {
        // En cas d'erreur de lecture/parsing du JSON
        res.status(500).json({ error: error.message || "Erreur interne du serveur lors de la lecture des sources." });
    }
});

// CREATE
app.post('/api/sources', async (req, res) => {
    try {
        const { name, url, secteur, categorie } = req.body;
        if (!name || !url) { return res.status(400).json({ error: "Le nom et l'URL sont requis." }); }
        const sources = await readSources();
        const newId = sources.length > 0 ? Math.max(...sources.map(s => s.id)) + 1 : 1;
        
        // Ajout des nouveaux champs secteur/catégorie
        const newSource = { 
            id: newId, 
            name, 
            url, 
            secteur: secteur || "Non classé", 
            categorie: categorie || "Non classé" 
        };
        
        sources.push(newSource);
        await writeSources(sources);
        res.status(201).json(newSource);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE
app.put('/api/sources/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { name, url, secteur, categorie } = req.body;
        let sources = await readSources();
        const index = sources.findIndex(s => s.id === id);

        if (index === -1) { return res.status(404).json({ error: "Source non trouvée." }); }

        sources[index].name = name || sources[index].name;
        sources[index].url = url || sources[index].url;
        sources[index].secteur = secteur || sources[index].secteur;
        sources[index].categorie = categorie || sources[index].categorie;

        await writeSources(sources);
        res.json(sources[index]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE
app.delete('/api/sources/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        let sources = await readSources();
        const initialLength = sources.length;
        
        sources = sources.filter(s => s.id !== id);

        if (sources.length === initialLength) { return res.status(404).json({ error: "Source non trouvée." }); }

        await writeSources(sources);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- 7. Endpoints RSS et IA ---

// Endpoint RSS
app.get('/api/articles', async (req, res) => {
    try {
        const articles = await fetchAllRssFeeds();
        res.json(articles);
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération des flux RSS.', details: error.message });
    }
});

// Endpoint IA (Gestion et Analyse)
app.post('/api/ai/manage', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) { return res.status(400).json({ error: "Un 'prompt' est requis." }); }
    
    try {
        const iaResponseText = await getGroqResponse(prompt);
        
        let iaCommand = null;
        
        // Logique Robuste de Parsing JSON
        const jsonMatch = iaResponseText.match(/```json\s*([\s\S]*?)\s*```|{([\s\S]*?)}/);

        if (jsonMatch) {
            const jsonString = (jsonMatch[1] || jsonMatch[2]);
            try {
                iaCommand = JSON.parse(`{${jsonString}}`);
            } catch (e) {
                console.warn(`[Oracle Flux] Échec du parsing JSON. Traité comme analyse textuelle.`);
            }
        }
        
        if (iaCommand && iaCommand.action) {
            
            // Logique AJOUT (ADD)
            if (iaCommand.action === 'add' && iaCommand.name && iaCommand.url) {
                const sources = await readSources();
                const newId = sources.length > 0 ? Math.max(...sources.map(s => s.id)) + 1 : 1;
                const newSource = { 
                    id: newId, 
                    name: iaCommand.name, 
                    url: iaCommand.url,
                    secteur: iaCommand.secteur || "Non classé",
                    categorie: iaCommand.categorie || "Non classé"
                };
                sources.push(newSource);
                await writeSources(sources);
                return res.json({ success: `Source RSS '${iaCommand.name}' ajoutée.`, source: newSource });

            // Logique SUPPRESSION (DELETE)
            } else if (iaCommand.action === 'delete' && (iaCommand.name || iaCommand.url)) {
                let sources = await readSources();
                const initialLength = sources.length;
                sources = sources.filter(s => 
                    (iaCommand.name && s.name !== iaCommand.name) &&
                    (iaCommand.url && s.url !== iaCommand.url)
                );
                if (sources.length === initialLength) { return res.status(404).json({ error: "Source non trouvée pour la suppression." }); }
                await writeSources(sources);
                return res.json({ success: "Source supprimée." });
            }
            
            return res.status(400).json({ error: "Commande IA non valide ou incomplète." });
        }
        
        // Si ce n'est pas une commande JSON, ou si le parsing a échoué (analyse textuelle)
        return res.json({ analysis: iaResponseText }); 

    } catch (error) {
        console.error("Erreur de gestion IA:", error);
        res.status(500).json({ error: "Erreur interne lors du traitement de la commande IA." });
    }
});


// --- 8. Démarrage du serveur ---
app.listen(PORT, () => {
    console.log(`\n🚀 Serveur Oracle Flux démarré sur http://localhost:${PORT}`);
    console.log(`-------------------------------------------------`);
    console.log(`  Interface Web      : http://localhost:${PORT}/`);
    console.log(`  Documentation API  : http://localhost:${PORT}/api-docs`);
    console.log(`-------------------------------------------------`);
});