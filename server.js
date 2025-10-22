// server.js

// --- 1. Importations des modules ---
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises'; // Utilisation des promesses pour async/await
import Groq from 'groq-sdk';  // Pour l'intégration de l'IA
// import https from 'https'; // NON UTILISÉ : pour l'instant, on simule le parsing RSS
import https from 'https'; // ⬅️ AJOUTÉ : Importation de HTTPS pour les requêtes sécurisées
import http from 'http';   // ⬅️ AJOUTÉ : Importation de HTTP pour les requêtes non sécurisées

import swaggerUi from 'swagger-ui-express'; // ⬅️ NOUVEAU
import YAML from 'yamljs';                // ⬅️ NOUVEAU



// --- 2. Configuration de base et Middlewares ---
const app = express();
const PORT = process.env.PORT || 3000;

// Utilisation d'ES Modules, on doit définir __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Chemin vers les fichiers statiques et le fichier de sources
const publicPath = join(__dirname, 'public');
const SOURCE_FILE = join(__dirname, 'source_list.json');

// Middlewares
app.use(express.static(publicPath));
app.use(express.json()); // Pour parser le JSON dans les requêtes (CRUD)
// --- 2. Configuration Swagger ---
const swaggerDocument = YAML.load(join(__dirname, 'swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
// ⬅️ NOUVEAU : Le portail de documentation sera accessible via http://localhost:3000/api-docs

// --- 3. Fonctions Utilitaires (CRUD sur source_list.json) ---

/** Lit le fichier JSON et retourne la liste des sources RSS. */
async function readSources() {
    try {
        const data = await fs.readFile(SOURCE_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') { // Fichier non trouvé
            console.log(`Le fichier ${SOURCE_FILE} n'existe pas. Création d'une liste vide.`);
            return [];
        }
        console.error("Erreur de lecture du fichier source:", error);
        throw new Error("Impossible de lire les sources RSS.");
    }
}

/** Écrit la liste des sources dans le fichier JSON. */
async function writeSources(sources) {
    try {
        await fs.writeFile(SOURCE_FILE, JSON.stringify(sources, null, 4), 'utf-8');
    } catch (error) {
        console.error("Erreur d'écriture du fichier source:", error);
        throw new Error("Impossible de sauvegarder les sources RSS.");
    }
}


// --- 4. Intégration Groq SDK ---

// Assurez-vous d'avoir votre clé API Groq définie dans une variable d'environnement (GROQ_API_KEY)
if (!process.env.GROQ_API_KEY) {
    console.error("ERREUR: La variable d'environnement GROQ_API_KEY n'est pas définie.");
    // En production, il serait judicieux de quitter ici : process.exit(1);
}

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

/**
 * Fonction pour interroger le modèle Llama 3.1 8B Instant (IA)
 * @param {string} prompt Le texte d'entrée de l'utilisateur.
 * @returns {Promise<string>} La réponse du modèle.
 */
async function getGroqResponse(prompt) {
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
{
                role: 'system',
                name: 'Oracle Flux',
                content: `
                    Vous êtes l'AGI Oracle_Flux un Gestionnaire de Flux RSS. Votre tâche est d'analyser les requêtes de l'utilisateur et de générer une réponse au format JSON pour les commandes de gestion de sources, OU de générer une analyse textuelle pour les requêtes d'information.

                    Si la requête demande d'AJOUTER, de SUPPRIMER ou de RECHERCHER une source RSS, répondez UNIQUEMENT avec un bloc JSON valide au format suivant :

                    {
                        "action": "add" | "delete" | "search",
                        "name": "Nom de la source (si 'add' ou 'delete' par nom)",
                        "url": "URL du flux RSS (si 'add' ou 'delete' par URL)",
                        "keywords": "mots-clés pour la recherche (si 'search')"
                    }

                    Pour toute autre question (résumé, analyse de tendance, questions générales), répondez avec une analyse textuelle simple. NE renvoyez PAS de JSON pour les questions d'analyse.
                `,
            },
                {
                    role: 'user',
                    content: prompt,
                }
            ],
            model: 'llama-3.1-8b-instant', // Utilisation du modèle spécifié
            temperature: 0.5,
            max_tokens: 1024,
        });

        return chatCompletion.choices[0].message.content;

    } catch (error) {
        console.error("Erreur lors de l'appel à Groq:", error);
        return "Désolé, une erreur est survenue lors de la communication avec le modèle IA.";
    }
}

// server.js (Nouvel Endpoint de Gestion IA)

app.post('/api/ai/manage', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: "Un 'prompt' est requis." });
    }
    
    try {
        // 1. Obtenir la réponse de l'IA (texte ou JSON)
        const iaResponseText = await getGroqResponse(prompt);
        
        // 2. Tenter de parser la réponse comme JSON (pour les commandes CRUD)
        let iaCommand;
        try {
            iaCommand = JSON.parse(iaResponseText.trim());
        } catch (e) {
            // Si le parsing échoue, ce n'est pas une commande CRUD mais une analyse textuelle simple
            return res.json({ analysis: iaResponseText }); 
        }

        // 3. Traiter la commande IA (si JSON valide)
        if (iaCommand && iaCommand.action) {
            
            if (iaCommand.action === 'add' && iaCommand.name && iaCommand.url) {
                // --- AJOUTER UN FLUX ---
                const sources = await readSources();
                const newId = sources.length > 0 ? Math.max(...sources.map(s => s.id)) + 1 : 1;
                const newSource = { id: newId, name: iaCommand.name, url: iaCommand.url };
                
                sources.push(newSource);
                await writeSources(sources);
                
                return res.json({ success: `Source RSS '${iaCommand.name}' ajoutée avec succès.`, source: newSource });

            } else if (iaCommand.action === 'delete' && (iaCommand.name || iaCommand.url)) {
                // --- SUPPRIMER UN FLUX ---
                let sources = await readSources();
                const initialLength = sources.length;
                
                sources = sources.filter(s => 
                    (iaCommand.name && s.name !== iaCommand.name) &&
                    (iaCommand.url && s.url !== iaCommand.url)
                );
                
                if (sources.length === initialLength) {
                    return res.status(404).json({ error: "Source non trouvée pour la suppression." });
                }
                
                await writeSources(sources);
                return res.json({ success: "Source supprimée avec succès." });
            }
            // ... (Ajouter la logique 'search' ou d'autres actions ici)
        }

        // Si l'IA a retourné un JSON mais avec une action non gérée
        return res.status(400).json({ error: "Commande IA non valide ou incomplète." });

    } catch (error) {
        console.error("Erreur de gestion IA:", error);
        res.status(500).json({ error: "Erreur interne lors du traitement de la commande IA." });
    }
});
// --- 5. Fonction RSS (Parsing Natif) ---

/** Fonction rudimentaire et native pour extraire une valeur entre deux balises XML. */
function extractTagContent(xmlContent, tagName) {
    const startTag = `<${tagName}>`;
    const endTag = `</${tagName}>`;
    
    const startIndex = xmlContent.indexOf(startTag);
    if (startIndex === -1) return null;
    
    const endIndex = xmlContent.indexOf(endTag, startIndex + startTag.length);
    if (endIndex === -1) return null;
    
    return xmlContent.substring(startIndex + startTag.length, endIndex).trim();
}

/** Effectue la requête HTTP et récupère le contenu RSS (XML). */
function fetchRssXml(url) {
    return new Promise((resolve, reject) => {
        // Utilise http ou https en fonction de l'URL
        const client = url.startsWith('https') ? https : http; // <-- CORRIGÉ : utilise les modules importés

        client.get(url, (res) => {
            let data = '';

            // Gérer les redirections
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchRssXml(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                 return reject(new Error(`Statut HTTP ${res.statusCode} pour ${url}`));
            }
            
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => { resolve(data); });

        }).on('error', (err) => { reject(err); });
    });
}


/** Télécharge et parse TOUS les flux RSS de la liste des sources (version native). */
async function fetchAllRssFeeds() {
    const sources = await readSources();
    const articles = [];
    
    const fetchPromises = sources.map(async (source) => {
        try {
            const xmlContent = await fetchRssXml(source.url);
            const itemRegex = /<item>([\s\S]*?)<\/item>/g;
            let match;

            while ((match = itemRegex.exec(xmlContent)) !== null) {
                const itemXml = match[1];
                
                const title = extractTagContent(itemXml, 'title');
                const link = extractTagContent(itemXml, 'link');
                const date = extractTagContent(itemXml, 'pubDate') || new Date().toISOString();
                const snippet = extractTagContent(itemXml, 'description');

                if (title && link) {
                    articles.push({
                        sourceName: source.name,
                        sourceId: source.id,
                        title: title,
                        link: link,
                        date: date,
                        snippet: snippet ? snippet.replace(/<[^>]*>?/gm, '').trim().substring(0, 150) : 'Pas de résumé.', 
                    });
                }
            }
        } catch (error) {
            console.warn(`⚠️ Erreur de réseau ou de parsing pour ${source.name}: ${error.message}`);
        }
    });

    await Promise.all(fetchPromises);
    articles.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (articles.length === 0 && sources.length > 0) {
         console.warn("ATTENTION: Aucune donnée RSS n'a pu être extraite. Vérifiez le format XML de vos flux.");
    }
    
    return articles;
}


// --- 6. Endpoints de l'API REST (CRUD + RSS + IA) ---

// ----------------------
// R (Read) : Récupérer la liste des sources
app.get('/api/sources', async (req, res) => {
    try {
        const sources = await readSources();
        res.json(sources);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ----------------------
// C (Create) : Ajouter une nouvelle source
app.post('/api/sources', async (req, res) => {
    try {
        const { name, url } = req.body;
        if (!name || !url) {
            return res.status(400).json({ error: "Le nom et l'URL sont requis." });
        }

        const sources = await readSources();
        const newId = sources.length > 0 ? Math.max(...sources.map(s => s.id)) + 1 : 1;
        const newSource = { id: newId, name, url };
        
        sources.push(newSource);
        await writeSources(sources);

        res.status(201).json(newSource);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ----------------------
// U (Update) : Mettre à jour une source existante
app.put('/api/sources/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { name, url } = req.body;
        
        let sources = await readSources();
        const index = sources.findIndex(s => s.id === id);

        if (index === -1) {
            return res.status(404).json({ error: "Source non trouvée." });
        }

        // Mise à jour (permet de modifier le nom, l'URL ou les deux)
        sources[index].name = name || sources[index].name;
        sources[index].url = url || sources[index].url;

        await writeSources(sources);
        res.json(sources[index]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ----------------------
// D (Delete) : Supprimer une source
app.delete('/api/sources/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        let sources = await readSources();
        const initialLength = sources.length;
        
        // Filtrer la source à supprimer
        sources = sources.filter(s => s.id !== id);

        if (sources.length === initialLength) {
            return res.status(404).json({ error: "Source non trouvée." });
        }

        await writeSources(sources);
        res.status(204).send(); // 204 No Content
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ----------------------
// Endpoint RSS : Récupérer et retourner tous les articles (SIMULÉ)
app.get('/api/articles', async (req, res) => {
    try {
        const articles = await fetchAllRssFeeds();
        res.json(articles);
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération des flux RSS (Vérifiez la logique de parsing).', details: error.message });
    }
});

// ----------------------
// Endpoint IA : Interroger le modèle Groq
app.post('/api/ai/analyze', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: "Un 'prompt' est requis dans le corps de la requête." });
    }
    
    try {
        const responseContent = await getGroqResponse(prompt);
        res.json({ analysis: responseContent });

    } catch (error) {
        res.status(500).json({ error: "Erreur de l'IA.", details: error.message });
    }
});
// Endpoint RSS : Récupérer et retourner tous les articles
// ⚠️ CORRIGÉ : Un seul endpoint /api/articles final est conservé.
app.get('/api/articles', async (req, res) => {
    try {
        const articles = await fetchAllRssFeeds();
        res.json(articles);
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération des flux RSS.', details: error.message });
    }
});



// --- Test d'un endpoint simple ---
app.get('/api/status', (req, res) => {
    res.json({ status: 'running', message: 'API opérationnelle' });
});


// --- 7. Démarrage du serveur ---

app.listen(PORT, () => {
    console.log(`\n🚀 Serveur Express démarré sur http://localhost:${PORT}`);
    console.log(`-------------------------------------------------`);
    console.log(`  Fichiers statiques : ${publicPath}`);
    console.log(`  API Sources (CRUD) : /api/sources (GET, POST, PUT, DELETE)`);
    console.log(`  API Articles (RSS) : /api/articles (GET) -> ⚠️ Actuellement SIMULÉE`);
    console.log(`  API IA (Groq)      : /api/ai/analyze (POST)`);
    console.log(`-------------------------------------------------`);
    console.log(`\n🚀 Documentation démarré sur swagger http://localhost:${PORT}/api-docs/`);
});