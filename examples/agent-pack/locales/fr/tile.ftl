# Copyright (c) 2026 Tilefold
# Released under the MIT License.
#
# Agent Pack (example tile): French strings.

tile-name = Agent Pack (exemple)
tile-description = Ajoute à vos propres agents n’importe quel agent de code IA : saisissez son nom et sa commande, ou choisissez-en un tout prêt comme Grok Build, Kimi CLI ou Mistral Vibe. Tilefold vous montre chacun d’abord et ne l’ajoute que si vous confirmez.
cmd-add-own = Agent Pack : Ajouter votre propre agent…
cmd-add-grok = Agent Pack : Ajouter Grok Build
cmd-add-kimi = Agent Pack : Ajouter Kimi CLI
cmd-add-vibe = Agent Pack : Ajouter Mistral Vibe
cmd-add-qwen = Agent Pack : Ajouter Qwen Code
cmd-add-aider = Agent Pack : Ajouter Aider
cmd-add-goose = Agent Pack : Ajouter Goose
cmd-add-crush = Agent Pack : Ajouter Crush
toast-added = { $name } a été ajouté à vos propres agents (Réglages → Agents).
toast-exists = { $name } fait déjà partie de vos agents.
toast-declined = { $name } n’a pas été ajouté.
toast-full = Vous avez déjà 20 agents à vous ; retirez-en un d’abord dans Réglages → Agents.
toast-refused = Tilefold n’a pas pu garder { $name }.
toast-failed = Impossible de proposer l’agent ({ $reason }).
toast-needs-tilefold = Ajouter des agents depuis une tile demande un Tilefold plus récent.
panel-title = Agent Pack
own-section = Ajouter votre propre agent
own-name-field = Nom de l’agent
own-name-placeholder = Nom, puis Entrée (p. ex. Gemini pour le travail)
own-command-field = Commande
own-command-placeholder = Commande, puis Entrée (p. ex. gemini --model pro)
own-name-now = Nom : { $name }
own-name-unset = Nom : pas encore défini
own-command-now = Commande : { $command }
own-command-unset = Commande : pas encore définie
own-clear = Vide son contexte avec : { $how }
own-clear-none = rien
own-clear-hint = Cliquez pour passer de /clear à /new puis à rien
own-add = Ajouter cet agent…
own-add-hint = Saisissez d’abord un nom et une commande
own-start-over = Recommencer
own-problem-name-empty = Saisissez un nom pour l’agent.
own-problem-name = Le nom fait au plus 60 caractères, sur une seule ligne.
own-problem-command-empty = Saisissez la commande qui lance l’agent.
own-problem-command-long = La commande peut avoir au plus 16 mots après le programme.
own-problem-command-chars = N’utilisez que des lettres, des chiffres et . _ , : = @ % + / ~ - dans la commande.
ready-section = Tout prêts
ready-hint = Cliquez pour ajouter cet agent
