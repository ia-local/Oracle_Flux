// public/script.js - Oracle Flux Frontend

// --- Constantes DOM (CORRIGÉES : TOUTES DÉCLARÉES EN PREMIER) ---
const sourcesListEl = document.getElementById('sources-list');
const articlesListEl = document.getElementById('articles-list');
const addSourceForm = document.getElementById('add-source-form');
const refreshArticlesBtn = document.getElementById('refresh-articles');
const aiForm = document.getElementById('ai-form');
const aiResponseEl = document.getElementById('ai-response');

// Constantes DOM pour la Modale d'Édition (UPDATE)
const editModal = document.getElementById('edit-modal');
const editSourceForm = document.getElementById('edit-source-form');
const cancelEditBtn = document.getElementById('cancel-edit');
const editSourceId = document.getElementById('edit-source-id');
const editSourceName = document.getElementById('edit-source-name');
const editSourceUrl = document.getElementById('edit-source-url');


// ==========================================================
// ⚙️ FONCTIONS GÉNÉRIQUES (API INTERACTION)
// ==========================================================

async function apiFetch(url, method = 'GET', data = null) {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (data) { options.body = JSON.stringify(data); }

    try {
        const response = await fetch(url, options);
        if (response.status === 204) { return {}; }
        const json = await response.json();
        if (!response.ok) { throw new Error(json.error || `Erreur HTTP: ${response.status}`); }
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

function renderSources(sources) {
    sourcesListEl.innerHTML = '';
    if (sources.length === 0) {
        sourcesListEl.innerHTML = '<p>Aucune source RSS ajoutée. Utilisez le formulaire ci-dessus.</p>';
        return;
    }
    sources.forEach(source => {
        const div = document.createElement('div');
        div.className = 'source-item';
        div.dataset.id = source.id;
        div.dataset.name = source.name;
        div.dataset.url = source.url;
        
        div.innerHTML = `
            <span><strong>${source.name}</strong>: <a href="${source.url}" target="_blank">${source.url.substring(0, 50)}...</a></span>
            <div>
                <button class="edit-btn">Modifier</button>
                <button class="delete-btn">Supprimer</button>
            </div>
        `;
        sourcesListEl.appendChild(div);
    });
}
async function loadSources() {
    try {
        const sources = await apiFetch('/api/sources');
        renderSources(sources);
    } catch (e) {
        sourcesListEl.innerHTML = '<p class="error">Impossible de charger les sources.</p>';
    }
}

// CREATE
addSourceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('source-name').value.trim();
    const url = document.getElementById('source-url').value.trim();
    await apiFetch('/api/sources', 'POST', { name, url });
    addSourceForm.reset();
    await loadSources();
});

// DELETE & Affichage Modale UPDATE
sourcesListEl.addEventListener('click', async (e) => {
    const sourceItem = e.target.closest('.source-item');
    if (!sourceItem) return;

    const id = sourceItem.dataset.id;
    
    if (e.target.classList.contains('delete-btn')) {
        if (confirm(`Êtes-vous sûr de vouloir supprimer la source ID ${id} ?`)) {
            await apiFetch(`/api/sources/${id}`, 'DELETE');
            await loadSources();
        }
    } else if (e.target.classList.contains('edit-btn')) {
        editSourceId.value = id;
        editSourceName.value = sourceItem.dataset.name;
        editSourceUrl.value = sourceItem.dataset.url;
        editModal.style.display = 'block';
    }
});

// Fermeture Modale
cancelEditBtn.addEventListener('click', () => {
    editModal.style.display = 'none';
});

// UPDATE
editSourceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = editSourceId.value;
    const name = editSourceName.value.trim();
    const url = editSourceUrl.value.trim();
    
    await apiFetch(`/api/sources/${id}`, 'PUT', { name, url });
    
    editModal.style.display = 'none';
    await loadSources();
});


// ==========================================================
// 📡 LOGIQUE DE FLUX RSS (ARTICLES)
// ==========================================================

function renderArticles(articles) {
    articlesListEl.innerHTML = '';
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

async function loadArticles() {
    articlesListEl.innerHTML = '<p class="loading-message">Chargement et parsing des flux en cours...</p>'; 
    
    try {
        const articles = await apiFetch('/api/articles');
        renderArticles(articles);
    } catch (e) {
        // Cette erreur est souvent la conséquence d'un échec du parsing natif côté serveur
        articlesListEl.innerHTML = '<p class="error">Erreur de chargement des articles. Vérifiez la console Node.js pour les erreurs de parsing.</p>';
    }
}

refreshArticlesBtn.addEventListener('click', loadArticles);


// ==========================================================
// 🧠 LOGIQUE GROQ IA (Oracle Flux)
// ==========================================================

function buildArticlesSummary() { /* ... (Logique complète) ... */ }

aiForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    let userPrompt = document.getElementById('ai-prompt').value.trim();
    
    if (!userPrompt) {
        userPrompt = "Veuillez analyser les articles suivants et identifier la tendance principale ou le sujet le plus récurrent. Si aucun article n'est listé, ignorez cette requête.";
    }

    const articlesSummary = buildArticlesSummary();
    const fullPrompt = `${userPrompt}\n\n${articlesSummary}`;
    
    aiResponseEl.innerHTML = '<span>🧠 Oracle Flux analyse...</span>';
    
    try {
        const result = await apiFetch('/api/ai/manage', 'POST', { prompt: fullPrompt });
        
        if (result.success) {
            aiResponseEl.innerHTML = `<span style="color:#2ecc71; font-weight:bold;">✅ Succès :</span> ${result.success}`;
            loadSources();
        } else if (result.analysis) {
            const formattedResponse = result.analysis.replace(/\n/g, '<br>');
            aiResponseEl.innerHTML = `<strong>Réponse de l'IA :</strong><br>${formattedResponse}`;
        }
    } catch (e) {
        aiResponseEl.innerHTML = `<span class="error">Erreur de l'assistant IA. ${e.message}</span>`;
    }
});


// ==========================================================
// 🚀 INITIALISATION
// ==========================================================

loadSources();
loadArticles();