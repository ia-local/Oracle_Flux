// filtre.js - Logique modulaire pour le filtrage et la recherche

console.log("🛠️ Module filtre.js chargé. (applyAllFilters disponible)");

/**
 * Applique tous les filtres (recherche textuelle, secteur, et catégorie) aux articles.
 * Cette fonction est appelée par script.js.
 * * @param {Array<Object>} articles La liste complète des articles (allLoadedArticles).
 * @param {string} searchTerm La chaîne de caractères à rechercher.
 * @param {string} selectedSecteur Le secteur sélectionné (ou vide).
 * @param {string} selectedCategorie La catégorie sélectionnée (ou vide).
 * @returns {Array<Object>} Le tableau d'articles filtré.
 */
function applyAllFilters(articles, searchTerm, selectedSecteur, selectedCategorie) {
    let filteredList = articles;

    // 1. FILTRAGE PAR SECTEUR (Vérifie la clé 'sourceSecteur' ajoutée par script.js)
    if (selectedSecteur && selectedSecteur.trim() !== '') {
        const lowerSecteur = selectedSecteur.toLowerCase();
        filteredList = filteredList.filter(article => 
            article.sourceSecteur && article.sourceSecteur.toLowerCase() === lowerSecteur
        );
    }

    // 2. FILTRAGE PAR CATÉGORIE (Vérifie la clé 'sourceCategorie' ajoutée par script.js)
    if (selectedCategorie && selectedCategorie.trim() !== '') {
        const lowerCategorie = selectedCategorie.toLowerCase();
        filteredList = filteredList.filter(article => 
            article.sourceCategorie && article.sourceCategorie.toLowerCase() === lowerCategorie
        );
    }

    // 3. FILTRAGE PAR RECHERCHE TEXTUELLE (Titre, Source, Snippet)
    if (searchTerm && searchTerm.trim() !== '') {
        const lowerCaseSearch = searchTerm.toLowerCase().trim();

        filteredList = filteredList.filter(article => {
            const matchesTitle = article.title.toLowerCase().includes(lowerCaseSearch);
            const matchesSource = article.sourceName.toLowerCase().includes(lowerCaseSearch);
            const matchesSnippet = article.snippet.toLowerCase().includes(lowerCaseSearch);

            return matchesTitle || matchesSource || matchesSnippet;
        });
    }

    // Mise à jour de l'état du module dans l'aside (si implémenté dans script.js)
    const statusEl = document.getElementById('filtre-status');
    if (statusEl) {
        if (searchTerm || selectedSecteur || selectedCategorie) {
            statusEl.textContent = 'Activé';
            statusEl.classList.replace('text-muted', 'text-success');
        } else {
            statusEl.textContent = 'Désactivé';
            statusEl.classList.replace('text-success', 'text-muted');
        }
    }


    return filteredList;
}