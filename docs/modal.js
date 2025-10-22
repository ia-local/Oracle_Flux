// modal.js - Module pour la gestion de la modale de détail d'article

console.log("🛠️ Module modal.js chargé. (Article Detail Handler)");

// Constantes DOM pour la Modale Article (déclarées globalement ici pour l'accessibilité)
const detailModalElement = document.getElementById('article-detail-modal');
const detailTitleEl = document.getElementById('article-detail-title');
const detailContentEl = document.getElementById('article-detail-content');
const originalLinkEl = document.getElementById('article-original-link');

let articleDetailModal = null; 

document.addEventListener('DOMContentLoaded', () => {
    // Initialisation de l'instance Bootstrap Modal après le chargement du DOM
    if (detailModalElement && typeof bootstrap !== 'undefined') {
        articleDetailModal = new bootstrap.Modal(detailModalElement);
    }
});

/**
 * Affiche la modale avec les détails complets et le JSON brut de l'article.
 * @param {Object} article L'objet article complet (enrichi avec secteur/catégorie).
 */
function showArticleDetail(article) {
    if (!articleDetailModal) {
        console.error("L'instance de la modale Bootstrap n'est pas initialisée.");
        return;
    }

    // --- 1. Préparation des données ---
    const articleDate = article.date
        ? new Date(article.date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'Date inconnue';
    
    const isManual = article.isManual ? 'Oui' : 'Non';
    const sectorBadge = article.sourceSecteur ? `<span class="badge bg-primary me-2">${article.sourceSecteur}</span>` : '';
    const categoryBadge = article.sourceCategorie ? `<span class="badge bg-info">${article.sourceCategorie}</span>` : '';

    // --- 2. Mise à jour des éléments ---
    detailTitleEl.textContent = article.title || "Détail de l'article";
    originalLinkEl.href = article.link || '#';

    // --- 3. Construction du contenu HTML ---
    let contentHTML = `
        <h6>Informations Clés</h6>
        <table class="table table-sm table-striped">
            <tbody>
                <tr>
                    <th scope="row" class="w-25">Source</th>
                    <td>${article.sourceName || 'N/A'} (ID: ${article.sourceId})</td>
                </tr>
                <tr>
                    <th scope="row">Classification</th>
                    <td>${sectorBadge}${categoryBadge}</td>
                </tr>
                <tr>
                    <th scope="row">Publié le</th>
                    <td>${articleDate}</td>
                </tr>
                <tr>
                    <th scope="row">Article Manuel</th>
                    <td>${isManual}</td>
                </tr>
            </tbody>
        </table>
        
        <h6>Extrait / Résumé</h6>
        <p class="alert alert-light">${article.snippet || 'Pas de résumé disponible.'}</p>
        
        <h6>Données JSON Brutes (Pour Analyse Détaillée par l'IA)</h6>
        <pre class="bg-light p-2 border rounded small" style="max-height: 200px; overflow-y: scroll;">${JSON.stringify(article, null, 2)}</pre>
    `;
    
    detailContentEl.innerHTML = contentHTML;

    // --- 4. Affichage ---
    articleDetailModal.show();
}