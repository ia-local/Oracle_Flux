// public/script.js - Oracle Flux Frontend (Multi-View)

// --- Constantes DOM Générales et Articles ---
const sourcesListEl = document.getElementById('sources-list');
const articlesListEl = document.getElementById('articles-list');
const refreshArticlesBtn = document.getElementById('refresh-articles');

// --- Constantes CRUD & Modale ---
const addSourceForm = document.getElementById('add-source-form');
let editModalInstance = null; 
const editSourceForm = document.getElementById('edit-source-form');
const editSourceId = document.getElementById('edit-source-id');
const editSourceName = document.getElementById('edit-source-name');
const editSourceUrl = document.getElementById('edit-source-url');
const cancelEditBtn = document.getElementById('cancel-edit');

// --- Constantes Création Manuelle ---
const createArticleForm = document.getElementById('create-article-form');
const createArticleMessageEl = document.getElementById('create-article-message');

// --- Constantes Filtre ---
const articleSearchInput = document.getElementById('article-search');
const filterSecteurSelect = document.getElementById('filter-secteur');
const filterCategorieSelect = document.getElementById('filter-categorie');

// --- Constantes IA (Dashboard) ---
const aiFormDashboard = document.getElementById('ai-form-dashboard');
const aiResponseDashboardEl = document.getElementById('ai-response-dashboard');

// --- Global Data & Chart ---
let sourceChartInstance = null;
let allLoadedArticles = []; // Articles visibles + Manuels persistés
let allSourcesData = []; // Données de source (secteur/catégorie)


// ==========================================================
// ⚙️ FONCTIONS GÉNÉRIQUES (API INTERACTION & UTILS)
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

// ----------------------------------------------------------
// 📝 LOGIQUE CRUD & VUES (Rendu et Initialisation)
// ----------------------------------------------------------

function renderSources(sources) {
    sourcesListEl.innerHTML = '';
    if (sources.length === 0) { sourcesListEl.innerHTML = '<p class="text-muted">Aucune source RSS ajoutée.</p>'; return; }

    sources.forEach(source => {
        const div = document.createElement('div');
        div.className = 'source-item list-group-item';
        div.dataset.id = source.id;
        div.dataset.name = source.name;
        div.dataset.url = source.url;
        
        div.innerHTML = `
            <span><strong>${source.name}</strong>: <a href="${source.url}" target="_blank">${source.url.substring(0, 40)}...</a></span>
            <div>
                <button class="btn btn-sm btn-primary edit-btn">Modifier</button>
                <button class="btn btn-sm btn-danger delete-btn">Supprimer</button>
            </div>
        `;
        sourcesListEl.appendChild(div);
    });
}

async function loadSources() {
    try {
        const sources = await apiFetch('/api/sources');
        allSourcesData = sources;
        renderSources(sources);
        populateFilterOptions(sources);
    } catch (e) {
        sourcesListEl.innerHTML = '<p class="error">Impossible de charger les sources.</p>';
    }
}

function createArticleHtml(article) {
    const div = document.createElement('div');
    div.className = 'article-item'; 
    div.dataset.title = article.title;
    
    const date = article.date ? new Date(article.date).toLocaleDateString('fr-FR') : 'Date inconnue';
    const manualBadge = article.isManual ? '<span class="badge bg-danger ms-2">Manuel</span>' : '';

    div.innerHTML = `
        <div>
            <h3><a href="${article.link}" target="_blank" onclick="event.stopPropagation()">${article.title}</a>${manualBadge}</h3>
            <p>
                <small class="text-muted">Source: ${article.sourceName} | Publié le ${date}</small><br>
                ${article.snippet}
            </p>
        </div>
    `;
    return div;
}

function renderArticles(articlesToRender) {
    articlesListEl.innerHTML = '';
    
    const finalArticles = articlesToRender && articlesToRender.length > 0 ? articlesToRender : []; 
    
    if (finalArticles.length === 0) { 
        articlesListEl.innerHTML = '<p class="text-muted">Aucun article trouvé. Ajoutez des sources ou modifiez vos filtres.</p>'; 
        return; 
    }

    finalArticles.forEach(article => { 
        articlesListEl.appendChild(createArticleHtml(article));
    });
}

function updateArticleDisplay() {
    const searchTerm = articleSearchInput ? articleSearchInput.value : '';
    const selectedSecteur = filterSecteurSelect ? filterSecteurSelect.value : '';
    const selectedCategorie = filterCategorieSelect ? filterCategorieSelect.value : '';

    if (typeof applyAllFilters !== 'function') {
        console.warn("La fonction applyAllFilters (filtre.js) n'est pas chargée. Affichage non filtré.");
        renderArticles(allLoadedArticles);
        return;
    }
    
    const filteredList = applyAllFilters(
        allLoadedArticles, 
        searchTerm, 
        selectedSecteur, 
        selectedCategorie
    );
    
    renderArticles(filteredList);
}

function populateFilterOptions(sources) {
    if (!filterSecteurSelect || !filterCategorieSelect) return;

    const secteurs = [...new Set(sources.map(s => s.secteur).filter(s => s))];
    const categories = [...new Set(sources.map(s => s.categorie).filter(c => c))];

    filterSecteurSelect.innerHTML = '<option value="">-- Filtrer par Secteur --</option>';
    secteurs.sort().forEach(secteur => {
        filterSecteurSelect.innerHTML += `<option value="${secteur}">${secteur}</option>`;
    });

    filterCategorieSelect.innerHTML = '<option value="">-- Filtrer par Catégorie --</option>';
    categories.sort().forEach(categorie => {
        filterCategorieSelect.innerHTML += `<option value="${categorie}">${categorie}</option>`;
    });
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
        if (editModalInstance) editModalInstance.show();
    }
});

// Fermeture Modale
cancelEditBtn.addEventListener('click', () => {
    if (editModalInstance) editModalInstance.hide();
});

// UPDATE
editSourceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = editSourceId.value;
    const name = editSourceName.value.trim();
    const url = editSourceUrl.value.trim();
    
    await apiFetch(`/api/sources/${id}`, 'PUT', { name, url });
    
    if (editModalInstance) editModalInstance.hide();
    await loadSources();
});


// ==========================================================
// 💾 GESTION LOCALSTORAGE (Articles Manuels)
// ==========================================================

// public/script.js (Section 💾 GESTION LOCALSTORAGE)

const STORAGE_KEY = 'oracle_flux_manual_articles';
const HISTORY_KEY = 'oracle_flux_history_articles'; // ⬅️ NOUVEAU

/** Charge les articles RSS mis en cache depuis le localStorage. */
function loadHistoryArticles() {
    try {
        const data = localStorage.getItem(HISTORY_KEY);
        // S'assurer que les articles du cache ne sont PAS des manuels
        return data ? JSON.parse(data).filter(a => !a.isManual) : [];
    } catch (e) {
        console.error("Erreur de lecture du cache historique:", e);
        return [];
    }
}

/** Sauvegarde la liste des articles RSS chargés avec succès dans le cache. */
function saveHistoryArticles(articles) {
    try {
        // Stocke uniquement les articles provenant des flux (isManual: false ou non défini)
        const rssArticles = articles.filter(a => !a.isManual);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(rssArticles));
    } catch (e) {
        console.error("Erreur d'écriture du cache historique:", e);
    }
}
function loadManualArticles() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data).filter(a => a && a.isManual) : [];
    } catch (e) {
        console.error("Erreur de lecture du localStorage:", e);
        return [];
    }
}

function saveManualArticles(articles) {
    try {
        const manualArticles = articles.filter(a => a.isManual);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(manualArticles));
    } catch (e) {
        console.error("Erreur d'écriture dans le localStorage:", e);
    }
}

// ==========================================================
// 📡 LOGIQUE DE FLUX RSS & CHART.JS
// ==========================================================

async function loadArticles() {
    articlesListEl.innerHTML = '<p class="loading-message text-info">Chargement et parsing des flux en cours...</p>'; 
    
    try {
        const rssArticles = await apiFetch('/api/articles');
        const persistedManualArticles = loadManualArticles();
        
        const mergedArticles = rssArticles.concat(persistedManualArticles);
        
        const enrichedArticles = mergedArticles.map(article => {
            if (article.isManual) return article;
            
            const source = allSourcesData.find(s => s.id === article.sourceId);
            return {
                ...article,
                sourceSecteur: source ? source.secteur : 'Inconnu',
                sourceCategorie: source ? source.categorie : 'Inconnu'
            };
        });

        allLoadedArticles = enrichedArticles; 
        
        updateArticleDisplay();
        renderSourceChart(allLoadedArticles);
    } catch (e) {
        articlesListEl.innerHTML = '<p class="error">Erreur de chargement des articles. Vérifiez la console Node.js pour les erreurs de parsing.</p>';
        renderSourceChart([]);
    }
}

refreshArticlesBtn.addEventListener('click', loadArticles);

function renderSourceChart(articles) {
    const ctx = document.getElementById('sourceChart').getContext('2d');
    const sourceCounts = {};
    articles.forEach(article => {
        const sourceName = article.sourceName || 'Inconnu';
        sourceCounts[sourceName] = (sourceCounts[sourceName] || 0) + 1;
    });

    const labels = Object.keys(sourceCounts);
    const data = Object.values(sourceCounts);

    const colors = labels.map(() => `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.6)`);
    const borderColors = labels.map((color) => color.replace('0.6', '1'));

    if (sourceChartInstance) {
        sourceChartInstance.destroy();
    }

    sourceChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{ data: data, backgroundColor: colors, borderColor: borderColors, borderWidth: 1 }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Distribution des Articles par Source' }
            }
        },
    });
}


// ==========================================================
// ✍️ LOGIQUE DE CRÉATION D'ARTICLE MANUEL
// ==========================================================

createArticleForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const source = document.getElementById('new-article-source').value.trim();
    const title = document.getElementById('new-article-title').value.trim();
    const link = document.getElementById('new-article-link').value.trim();
    const snippet = document.getElementById('new-article-snippet').value.trim();
    
    const newArticle = {
        sourceName: source, sourceId: 'MANUAL', title: title, link: link,
        date: new Date().toISOString(), snippet: snippet.substring(0, 150), isManual: true
    };
    
    allLoadedArticles.unshift(newArticle);
    saveManualArticles(allLoadedArticles);
    
    updateArticleDisplay();
    renderSourceChart(allLoadedArticles);

    createArticleMessageEl.innerHTML = '<div class="alert alert-success">Article manuel ajouté avec succès.</div>';
    createArticleForm.reset();
});

// ==========================================================
// 🧠 LOGIQUE GROQ IA (Double Interface)
// ==========================================================

function buildArticlesSummary() {
    let summary = "\n--- Articles à analyser ---\n";
    if (allLoadedArticles.length === 0) return "Aucun article disponible pour l'analyse.";
    
    allLoadedArticles.slice(0, 5).forEach((article, index) => {
        summary += `[${index + 1}] Titre: "${article.title}" (Source: ${article.sourceName})\n`;
    });
    return summary;
}

function setupAiForm(formId, responseId) {
    const form = document.getElementById(formId);
    const responseEl = document.getElementById(responseId);
    const promptElement = form ? form.querySelector('textarea') : null; 
    const promptId = promptElement ? promptElement.id : null; 

    if (!form || !responseEl || !promptId) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        let userPrompt = document.getElementById(promptId).value.trim();
        
        if (!userPrompt) {
            userPrompt = "Veuillez analyser les articles suivants et identifier la tendance principale ou le sujet le plus récurrent. Si aucun article n'est listé, ignorez cette requête.";
        }
    
        const articlesSummary = buildArticlesSummary();
        const fullPrompt = `${userPrompt}\n\n${articlesSummary}`;
        
        responseEl.innerHTML = '<span>🧠 Oracle Flux analyse...</span>';
        
        try {
            const result = await apiFetch('/api/ai/manage', 'POST', { prompt: fullPrompt });
            
            if (result.success) {
                responseEl.innerHTML = `<span class="alert alert-success d-block">✅ Succès : ${result.success}</span>`;
                loadSources();
            } else if (result.analysis) {
                const formattedResponse = result.analysis.replace(/\n/g, '<br>');
                responseEl.innerHTML = `<strong>Réponse de l'IA :</strong><br>${formattedResponse}`;
            }
        } catch (e) {
            responseEl.innerHTML = `<span class="alert alert-danger d-block">Erreur de l'assistant IA. ${e.message}</span>`;
        }
    });
}


// ==========================================================
// 🚀 INITIALISATION DU DOM (Point d'entrée final)
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Initialiser l'instance de la modale Bootstrap
    const editModalEl = document.getElementById('edit-modal');
    if (editModalEl) {
        editModalInstance = new bootstrap.Modal(editModalEl);
    }
    
    // 2. Gestionnaire de clic pour la Modale Article Detail
    articlesListEl.addEventListener('click', (e) => {
        const articleItem = e.target.closest('.article-item');
        // Vérifie si le clic est sur un article et pas sur le lien <a>
        if (!articleItem || e.target.tagName === 'A') {
            return;
        }

        const articleTitle = articleItem.querySelector('h3 a').textContent;
        const selectedArticle = allLoadedArticles.find(a => a.title === articleTitle);

        if (selectedArticle && typeof showArticleDetail === 'function') {
            // Utilise la fonction du module modal.js
            showArticleDetail(selectedArticle); 
        } else {
            // Affiche un avertissement si modal.js n'est pas chargé
            console.warn("Article non trouvé ou fonction showArticleDetail (modal.js) non chargée.");
        }
    });

    // 3. Appliquer la logique IA aux deux formulaires
    setupAiForm('ai-form-dashboard', 'ai-response-dashboard');
    
    // 4. Charger les données initiales (Doit être après setupAiForm car il utilise loadSources)
    loadSources();
    loadArticles(); 

    // 5. Gestion des Événements de Filtre/Tri
    if (articleSearchInput) {
        articleSearchInput.addEventListener('input', updateArticleDisplay);
    }
    if (filterSecteurSelect) {
        filterSecteurSelect.addEventListener('change', updateArticleDisplay);
    }
    if (filterCategorieSelect) {
        filterCategorieSelect.addEventListener('change', updateArticleDisplay);
    }
    
    // 6. Gestion des écouteurs d'onglets pour le rafraîchissement
    const dashboardTab = document.getElementById('dashboard-tab');
    const sourcesTab = document.getElementById('sources-tab');
    const articlesTab = document.getElementById('articles-tab');
    
    if (dashboardTab) dashboardTab.addEventListener('shown.bs.tab', loadArticles);
    if (sourcesTab) sourcesTab.addEventListener('shown.bs.tab', loadSources);
    if (articlesTab) articlesTab.addEventListener('shown.bs.tab', loadArticles);
});