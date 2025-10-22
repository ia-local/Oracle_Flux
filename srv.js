// server.js

// --- 1. Importations des modules ---
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises'; // Pour les opérations de fichiers asynchrones (CRUD)
import Groq from 'groq-sdk';  // Pour l'intégration de l'IA
import Parser from 'rss-parser'; // Pour le parsing des flux RSS

// --- 2. Configuration de base ---
const app = express();
const PORT = process.env.PORT || 3000;
const SOURCE_FILE = join(dirname(fileURLToPath(import.meta.url)), 'source_list.json');
const rssParser = new Parser({
    // Configuration optionnelle pour renommer ou mapper des champs
    customFields: {
        item: [['pubDate', 'publicationDate']]
    }
});

// Vérification de la clé API Groq
if (!process.env.GROQ_API_KEY) {
    console.error("ERREUR: La variable d'environnement GROQ_API_KEY n'est pas définie.");
    // En production, il serait judicieux de quitter ici
}
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

// --- 3. Middlewares ---
// Servir les fichiers statiques (HTML, CSS, JS) du dossier 'public'
app.use(express.static(join(dirname(fileURLToPath(import.meta.url)), 'public')));
// Parser les requêtes JSON (pour le CRUD en POST/PUT)
app.use(express.json());

// --- 4. Fonctions Utilitaires (CRUD sur source_list.json) ---

/** Lit le fichier JSON et retourne la liste des sources. */
async function readSources() {
    try {
        const data = await fs.readFile(SOURCE_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return []; // Fichier non trouvé, retourne une liste vide
        }
        console.error("Erreur de lecture du fichier source:", error);
        throw new Error("Impossible de lire les sources RSS.");
    }
}

/** Écrit la liste des sources dans le fichier JSON. */
async function writeSources(sources) {
    try {
        // Sauvegarde avec indentation pour la lisibilité
        await fs.writeFile(SOURCE_FILE, JSON.stringify(sources, null, 4), 'utf-8');
    } catch (error) {
        console.error("Erreur d'écriture du fichier source:", error);
        throw new Error("Impossible de sauvegarder les sources RSS.");
    }
}

// --- 5. Fonctions Logiques (Parsing RSS) ---

/** Télécharge et parse tous les flux RSS de la liste des sources. */
async function fetchAllRssFeeds() {
    const sources = await readSources();
    const articles = [];

    // Utilisation de Promise.all pour charger les flux en parallèle (plus rapide)
    const fetchPromises = sources.map(async (source) => {
        try {
            const feed = await rssParser.parseURL(source.url);
            
            // Mapper les articles pour inclure la source d'origine
            feed.items.forEach(item => {
                articles.push({
                    sourceName: source.name,
                    sourceId: source.id,
                    title: item.title,
                    link: item.link,
                    date: item.publicationDate || item.isoDate, // Utilise la date standard ou ISO
                    snippet: item.contentSnippet || item.summary || 'Pas de résumé disponible.'
                });
            });
        } catch (error) {
            console.warn(`⚠️ Erreur lors du chargement du flux ${source.name} (${source.url}): ${error.message}`);
        }
    });

    await Promise.all(fetchPromises);
    
    // Trier les articles par date (du plus récent au plus ancien)
    articles.sort((a, b) => new Date(b.date) - new Date(a.date));

    return articles;
}

// --- 6. Endpoints de l'API REST (CRUD + RSS) ---

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
        // Génération d'un ID simple
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
        res.status(204).send(); // 204 No Content pour une suppression réussie
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ----------------------
// Endpoint RSS : Récupérer et retourner tous les articles
app.get('/api/articles', async (req, res) => {
    try {
        const articles = await fetchAllRssFeeds();
        res.json(articles);
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération des flux RSS.', details: error.message });
    }
});

// ----------------------
// Endpoint IA : Interroger le modèle Groq pour analyser ou résumer
app.post('/api/ai/analyze', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: "Un 'prompt' est requis dans le corps de la requête." });
    }
    
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                // Rôle System: Définit la personnalité de l'IA (notre charte)
                {
                    role: 'system',
                    content: "Vous êtes un Assistant Gestionnaire de Flux RSS expert. Votre rôle est d'analyser ou de résumer des articles ou des listes d'articles fournis par l'utilisateur. Répondez de manière concise, technique et pertinente au contexte RSS/web."
                },
                // Rôle User: Le prompt actuel de l'utilisateur
                {
                    role: 'user',
                    content: prompt,
                }
            ],
            model: 'llama-3.1-8b-instant',
            temperature: 0.5,
            max_tokens: 1024,
        });

        res.json({ analysis: chatCompletion.choices[0].message.content });

    } catch (error) {
        console.error("Erreur lors de l'appel à Groq:", error);
        res.status(500).json({ error: "Erreur de l'IA, veuillez vérifier la clé API ou le service." });
    }
});


// --- 7. Démarrage du serveur ---

app.listen(PORT, () => {
    console.log(`\n🚀 Serveur Express démarré sur http://localhost:${PORT}`);
    console.log(`-------------------------------------------------`);
    console.log(`  Fichiers statiques : ${join(dirname(fileURLToPath(import.meta.url)), 'public')}`);
    console.log(`  API Sources (CRUD) : /api/sources`);
    console.log(`  API Articles (RSS) : /api/articles`);
    console.log(`  API IA (Groq)      : /api/ai/analyze (POST)`);
    console.log(`-------------------------------------------------`);
});