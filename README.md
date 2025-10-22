# Oracle_Flux
Gestionnaire de Flux
# 📰 Assistant de Gestion de Flux RSS Intelligent (Groq/Node.js)

Ce projet est un gestionnaire de flux RSS minimaliste construit avec Node.js (Express), utilisant HTML/CSS/JavaScript pur pour le front-end. Il intègre l'intelligence artificielle (Groq SDK) pour l'analyse de contenu et l'exécution de commandes de gestion (CRUD) par langage naturel.

## 🚀 Fonctionnalités Clés

* **CRUD de Sources RSS :** Ajout, lecture et suppression des URLs de flux stockées dans `source_list.json`.
* **Parsing Natif :** Récupération et conversion des flux RSS (XML) en JSON en utilisant uniquement les modules natifs Node.js (`http(s)`).
* **Assistant IA Groq :**
    * **Analyse de Contenu :** Résume et identifie les tendances des articles affichés.
    * **Gestion par Commande :** Exécute des actions CRUD (Ajouter/Supprimer une source) basées sur des requêtes en langage naturel.
* **Documentation :** Interface de documentation Swagger/OpenAPI intégrée.

## 🛠️ Stack Technique

* **Backend :** Node.js, Express.js
* **IA :** Groq SDK (`llama-3.1-8b-instant`)
* **Frontend :** HTML, CSS, JavaScript pur (vanilla)
* **Base de données :** Fichier plat `source_list.json`
* **Documentation :** Swagger UI (via `swagger-ui-express`)

## 📦 Installation et Lancement

### Prérequis

* Node.js (version LTS recommandée)
* Clé API Groq (disponible sur la console GroqCloud)

### Étapes

1.  **Cloner le dépôt :**
    ```bash
    git clone [URL_DE_VOTRE_DEPOT]
    cd [votre-repo]
    ```

2.  **Installer les dépendances :**
    ```bash
    npm install express groq-sdk swagger-ui-express yamljs
    # Note: Pas besoin de rss-parser, le parsing est natif.
    ```

3.  **Configurer la Clé API :**
    Définissez votre clé API Groq comme variable d'environnement.
    ```bash
    # Sous Linux/macOS
    export GROQ_API_KEY="VOTRE_CLE_API_GROQ"

    # Sous Windows (CMD)
    set GROQ_API_KEY="VOTRE_CLE_API_GROQ"
    ```

4.  **Initialiser le fichier de sources :**
    Créez un fichier `source_list.json` vide ou avec des sources d'exemple à la racine :
    ```json
    [
        { "id": 1, "name": "Actualités Tech", "url": "URL_RSS_ICI" }
    ]
    ```

5.  **Lancer le serveur :**
    ```bash
    node server.js
    ```
    Le serveur démarrera sur `http://localhost:3000`.

## 🖥️ Utilisation

| Lien | Description |
| :--- | :--- |
| **Interface Web** | `http://localhost:3000/` | Accès au gestionnaire front-end. |
| **Documentation API** | `http://localhost:3000/api-docs` | Documentation interactive Swagger/OpenAPI. |

### Interaction avec l'IA

Utilisez la section "Assistant IA Groq" sur l'interface web :

| Type de Requête | Exemple de Commande | Résultat |
| :--- | :--- | :--- |
| **Gestion** (`action: add`) | "Ajoute le flux 'Futura Sciences' à l'adresse https://www.futura-sciences.com/rss/actualites.xml" | Le flux est ajouté à `source_list.json`. |
| **Gestion** (`action: delete`) | "Supprime la source nommée 'Actualités Tech'." | La source est retirée de `source_list.json`. |
| **Analyse** (Texte libre) | "Analyse les 5 premiers articles et dis-moi s'il y a une urgence météorologique." | L'IA renvoie un résumé textuel des tendances.

## ⚠️ Remarques sur le Parsing RSS

Ce projet utilise une méthode de *parsing* XML **native et manuelle** par manipulation de chaînes de caractères. Cette méthode est **fragile** et peut échouer si le formatage XML des flux RSS est inhabituel. Pour une robustesse en production, il est fortement recommandé d'utiliser une librairie spécialisée telle que `rss-parser`.