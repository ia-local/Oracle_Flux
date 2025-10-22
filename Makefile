# Cela rend les clés API disponibles pour nos commandes.
ifneq (,$(wildcard ./.env))
    include .env
    export
endif

# --- CONNECTEUR 1: Versionning depuis package.json ---
# Récupère dynamiquement la version actuelle de l'application.
VERSION := $(shell node -p "require('./package.json').version")

# --- MESSAGES standards (inchangés) ---
serveur_MSG="✨ Lancement du serveur..."
update_MSG="✨ Préparation de la mise à jour..."
notify_MSG="🚀 Envoi de la notification Telegram..."
build_MSG="🔧 Synchronisation des données commandes Telegram..."

# --- CONNECTEUR 2: Commandes de versionning Git ---
# Ces commandes automatisent la mise à jour de la version et les commits associés.

# `make patch` -> v1.0.0 devient v1.0.1
patch:
	@npm version patch -m "Upgrade to %s"
	@make notify msg="✅ Nouvelle version PATCH **$(VERSION)** publiée."

# `make minor` -> v1.0.1 devient v1.1.0
minor:
	@npm version minor -m "Upgrade to %s"
	@make notify msg="📈 Nouvelle version MINEURE **$(VERSION)** publiée avec de nouvelles fonctionnalités."

# `make major` -> v1.1.0 devient v2.0.0
major:
	@npm version major -m "Upgrade to %s"
	@make notify msg="🎉 NOUVELLE VERSION MAJEURE **$(VERSION)** publiée ! Des changements importants ont été apportés."

# --- CONNECTEUR 3: Cible de notification Telegram ---
# Envoie un message au groupe d'organisateurs en utilisant l'API Telegram via curl.
# Utilise les variables chargées depuis le fichier .env.
notify:
	@echo "${notify_MSG}"
	@curl -s -X POST https://api.telegram.org/bot$(TELEGRAM_API_KEY)/sendMessage \
	-d chat_id=$(ORGANIZER_GROUP_ID_CHAT) \
	-d text="$(msg)" \
	-d parse_mode="Markdown" > /dev/null

# --- CONNECTEUR 4: Synchronisation Frontend/Backend ---
# Exécute un script Node.js pour générer les données Telegram pour le frontend.
build-js:
	@echo "${build_MSG}"
	@node build/session_messages.js

# --- Commandes de Workflow Mises à Jour ---
serveur:
	@echo "${serveur_MSG}"
	@node serveur.js

# La commande 'update' va maintenant synchroniser les données avant de commiter.
update:
	@echo "${update_MSG}"
	@git add .
	@git commit -m "update synchronisation et modifications générales"
	@git push
	@echo "✨ Mise à jour terminée et poussée sur GitHub."

# Les autres commandes (dev, focus, etc.) peuvent rester les mêmes
# ...


COMMANDE1_MSG="✨ Menu ✨"

menu:
	@echo "Welcom To cycliq Economical system."
	@echo"",
	@echo"╔═════════════════════════════════════╗     ╔═════════════════════════════════════════════════════════════════════╗";
	@echo"╠═══════════ ✨ Pi Console ═══════════╣     ║  [💫] [💬] [📚] [🌌] [✨] [⚡️] [💰] [🌴] [📱] [📡]              [🛰]║",
	@echo"║                                     ║     ╠═════════════════════════════════════════════════════════════════════╣"
	@echo"║                                     ║     ║                                                                     ║"
	@echo"║                                     ║     ║                                                                     ║"
	@echo"║                                     ║     ║                                                                     ║"
	@echo"║                                     ║     ║                                                                     ║"
	@echo"║                                     ║     ║                                                                     ║"
	@echo"║                                     ║     ║                                                                     ║"
	@echo"║                                     ║     ║                                                                     ║"
	@echo"║                                     ║     ║                                                                     ║"
	@echo"║                                     ║     ║                                                                     ║"
	@echo"║                                     ║     ║                                                                     ║"
	@echo"║                                     ║     ║                                                                     ║"
	@echo"║                                     ║     ║                                                                     ║"
	@echo"║                                     ║     ║                                                                     ║"
	@echo"║                                     ║     ║                                                                     ║"
	@echo"║                                     ║     ║                                                                     ║"
	@echo"║                                     ║     ║                                                                     ║"
	@echo"║                                     ║     ║                                                                     ║"
	@echo"║                                     ║     ║                                                                     ║"
	@echo"║                                     ║     ║                                                                     ║"
	@echo"╠═════════════════════════════════════╣     ╠═════════════════════════════════════════════════════════════════════╣"
	@echo"║(∏)                                  ║     ║[💻.📱]:/<                                                        /%>║"
	@echo"╚═════════════════════════════════════╝     ╚═════════════════════════════════════════════════════════════════════╝"	
	@echo""

brainstorm:
	@echo "✨ Initialisation de la session de brainstorming✨"
	@node groq.js
	@echo "✨ Session terminée✨"

update_MSG="✨ Mise en état du dossier sur github✨"
dev:
	@echo "${dev_MSG}"
	@git add .
	@git commit -m "dev mode"
	@git push
	@echo "✨ Mise à jour terminée✨"

focus:
	@echo "${focus_MSG}"
	@git add .
	@git commit -m "dev mode focus"
	@git push
	@echo "✨ Mise à jour terminée✨"

debug:
	@echo "${debug_MSG}"
	@git add .
	@git commit -m "dev mode focus"
	@git push
	@echo "✨ Mise à jour terminée✨"