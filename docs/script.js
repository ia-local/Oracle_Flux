// Les constantes DOM
const sourcesListEl = document.getElementById('sources-list');
const articlesListEl = document.getElementById('articles-list');
const addSourceForm = document.getElementById('add-source-form');
const refreshArticlesBtn = document.getElementById('refresh-articles');
const aiForm = document.getElementById('ai-form');
const aiResponseEl = document.getElementById('ai-response');


// ==========================================================
// ⚙️ FONCTIONS GÉNÉRIQUES (API INTERACTION)
// ==========================================================

/**
 * Envoie une requête au back-end et gère la réponse JSON.
 * @param {string} url - L'endpoint de l'API.
 * @param {string} method - Méthode HTTP (GET, POST, PUT, DELETE).
 * @param {object} [data=null] - Données à envoyer dans le corps (pour POST/PUT).
 * @returns {Promise<object>} Les données parsées ou une erreur.
 */
async function apiFetch(url, method = 'GET', data = null) {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(url, options);
        
        if (response.status === 204) { // No Content
            return {};
        }

        const json = await response.json();

        if (!response.ok) {
            throw new Error(json.error || `Erreur HTTP: ${response.status}`);
        }

        return json;
    } catch (error) {
        console.error(`Erreur ${method} sur ${url}:`, error.message);
        alert(`Erreur: ${error.message}`);
        throw error;
    }
}


// ==========================================================
// 📝 LOGIQUE CRUD (SOURCES)
// ==========================================================

/** Affiche la liste des sources dans le DOM. */
function renderSources(sources) {
    sourcesListEl.innerHTML = ''; // Nettoyer la liste
    if (sources.length === 0) {
        sourcesListEl.innerHTML = '<p>Aucune source RSS ajoutée. Utilisez le formulaire ci-dessus.</p>';
        return;
    }

    sources.forEach(source => {
        const div = document.createElement('div');
        div.className = 'source-item';
        div.dataset.id = source.id;
        div.dataset.name = source.name; // Ajout des data-* pour faciliter la modification
        div.dataset.url = source.url;
        
        div.innerHTML = `
            <span><strong>${source.name}</strong>: <a href="${source.url}" target="_blank">${source.url.substring(0, 50)}...</a></span>
            <div>
                <button class="edit-btn">Modifier</button>  <button class="delete-btn">Supprimer</button>
            </div>
        `;
        sourcesListEl.appendChild(div);
    });
}

/** Charge toutes les sources depuis le back-end et les affiche. */
async function loadSources() {
    try {
        const sources = await apiFetch('/api/sources');
        renderSources(sources);
    } catch (e) {
        sourcesListEl.innerHTML = '<p class="error">Impossible de charger les sources.</p>';
    }
}

/** Gère la soumission du formulaire d'ajout de source (CREATE). */
addSourceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('source-name').value.trim();
    const url = document.getElementById('source-url').value.trim();
    
    await apiFetch('/api/sources', 'POST', { name, url });
    
    addSourceForm.reset();
    await loadSources(); // Recharger la liste après l'ajout
});

/** Gère la suppression d'une source (DELETE). */
sourcesListEl.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-btn')) {
        const sourceItem = e.target.closest('.source-item');
        const id = sourceItem.dataset.id;
        
        if (confirm(`Êtes-vous sûr de vouloir supprimer la source ID ${id} ?`)) {
            await apiFetch(`/api/sources/${id}`, 'DELETE');
            await loadSources(); // Recharger la liste après la suppression
        }
    }
    else if (e.target.classList.contains('edit-btn')) {
        // --- Gérer l'ouverture de la modale (READ pour UPDATE) ---
        editSourceId.value = sourceItem.dataset.id;
        editSourceName.value = sourceItem.dataset.name;
        editSourceUrl.value = sourceItem.dataset.url;
        editModal.style.display = 'block'; // Afficher la modale
    }
    
});

// --- Gérer la fermeture de la modale ---
cancelEditBtn.addEventListener('click', () => {
    editModal.style.display = 'none';
});
// --- Gérer la soumission du formulaire d'édition (UPDATE) ---
editSourceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = editSourceId.value;
    const name = editSourceName.value.trim();
    const url = editSourceUrl.value.trim();
    
    await apiFetch(`/api/sources/${id}`, 'PUT', { name, url });
    
    editModal.style.display = 'none'; // Cacher la modale
    await loadSources(); // Recharger la liste après la modification
});
// ----------------------------------------------------------
// 📡 LOGIQUE DE FLUX RSS (ARTICLES)
// ----------------------------------------------------------

/** Affiche les articles dans le DOM. */
function renderArticles(articles) {
    articlesListEl.innerHTML = ''; // <-- Nettoie le message "Aucun article trouvé..."
    
    // Si la liste est vide (soit pas de source, soit parsing échoué)
    if (articles.length === 0) {
        articlesListEl.innerHTML = '<p>Aucun article trouvé. Ajoutez des sources ou actualisez.</p>';
        return;
    }

    articles.forEach(article => {
        const div = document.createElement('div');
        div.className = 'article-item';
        const date = article.date ? new Date(article.date).toLocaleDateString('fr-FR') : 'Date inconnue';
        
        div.innerHTML = `
            <div>
                <h3><a href="${article.link}" target="_blank">${article.title}</a></h3>
                <p>
                    <small>Source: ${article.sourceName} | Publié le ${date}</small><br>
                    ${article.snippet}
                </p>
            </div>
        `;
        articlesListEl.appendChild(div);
    });
}

/** Charge tous les articles RSS depuis le back-end. */
async function loadArticles() {
    // 📝 Affiche le message de chargement immédiatement
    articlesListEl.innerHTML = '<p class="loading-message">Chargement et parsing des flux en cours...</p>'; 
    
    try {
        // 📡 Interroge l'endpoint du serveur : /api/articles
        const articles = await apiFetch('/api/articles');
        // 📡 Interrogation de l'API de notre serveur
        // 📝 Affiche les résultats ou le message "Aucun article trouvé" si articles est vide
        renderArticles(articles);
        
    } catch (e) {
        // En cas d'erreur réseau ou serveur
        articlesListEl.innerHTML = '<p class="error">Erreur de chargement des articles. Vérifiez le serveur et vos URLs sources. (Détails en console)</p>';
    }
}

// Événement pour le bouton d'actualisation
refreshArticlesBtn.addEventListener('click', loadArticles);
// Événement pour le bouton d'actualisation

// ==========================================================
// 🧠 LOGIQUE GROQ IA
// ==========================================================

/** Gère la soumission du prompt à l'IA. */
// public/script.js (Section Logique GROQ IA)

aiForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    let userPrompt = document.getElementById('ai-prompt').value.trim();
    
    // 🧠 Si l'utilisateur a juste cliqué sans prompt, on lui demande un résumé.
    if (!userPrompt) {
        userPrompt = "Veuillez analyser les articles suivants et identifier la tendance principale ou le sujet le plus récurrent. Si aucun article n'est listé, ignorez cette requête.";
    }

    const articlesSummary = buildArticlesSummary();
    const fullPrompt = `${userPrompt}\n\n${articlesSummary}`;
    
    aiResponseEl.innerHTML = '<span>🧠 Analyse/Gestion par Groq en cours...</span>';
    
    try {
        // 📡 Appel du nouvel endpoint de gestion
        const result = await apiFetch('/api/ai/manage', 'POST', { prompt: fullPrompt });
        
        // 📝 Si c'est une commande CRUD, mettre à jour la liste des sources
        if (result.success) {
            aiResponseEl.innerHTML = `<span style="color:#2ecc71; font-weight:bold;">✅ Succès :</span> ${result.success}`;
            loadSources(); // Recharger la liste des sources après une modification
        } 
        // 📝 Si c'est une analyse textuelle
        else if (result.analysis) {
            const formattedResponse = result.analysis.replace(/\n/g, '<br>');
            aiResponseEl.innerHTML = `<strong>Réponse de l'IA :</strong><br>${formattedResponse}`;
        }
    } catch (e) {
        aiResponseEl.innerHTML = `<span class="error">Erreur de l'assistant IA. Assurez-vous que la clé GROQ est valide.</span>`;
    }
});

// ... (Reste du script.js)

// public/script.js (Section Logique GROQ IA)

/**
 * Construit un résumé textuel des articles affichés pour le prompt de l'IA.
 * @returns {string} Le résumé des articles.
 */
function buildArticlesSummary() {
    const articleElements = articlesListEl.querySelectorAll('.article-item');
    let summary = "\n--- Articles à analyser ---\n";
    let count = 0;
    
    // Limite à 5 articles pour ne pas dépasser le contexte du modèle IA
    articleElements.forEach((item, index) => {
        if (index < 5) {
            const title = item.querySelector('h3 a').textContent;
            const source = item.querySelector('small').textContent.split('|')[0].replace('Source:', '').trim();
            summary += `[${index + 1}] Titre: "${title}" (Source: ${source})\n`;
            count++;
        }
    });

    if (count === 0) {
        return "Aucun article disponible pour l'analyse.";
    }
    return summary;
}

// ... (Le code du aiForm.addEventListener sera modifié ci-dessous)
// ==========================================================
// 🚀 INITIALISATION
// ==========================================================

// Charger la liste des sources au démarrage
loadSources();

// Charger les articles au démarrage
loadArticles();