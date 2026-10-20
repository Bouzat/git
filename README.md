# 🎮 Esports Manager — CEO Edition

Un jeu de gestion façon *Football Manager*, mais pour l'esport. Vous êtes le **CEO** d'un club esport multi-jeux.

## Lancer le jeu

Aucune installation : ouvrez `index.html` dans un navigateur (double-clic), ou servez le dossier :

```bash
python3 -m http.server 8000   # puis http://localhost:8000
```

La partie est sauvegardée automatiquement dans le navigateur (localStorage) à chaque semaine.

## Deux modes de jeu

- **🚀 Créer un club** : partez de zéro avec 2 M€, choisissez nom, tag, couleur, pays et votre première division.
- **👔 Reprendre un club** : prenez les commandes d'un club réel (T1, G2, Karmine Corp, Vitality, Fnatic, NAVI, Team Liquid, Falcons, Sentinels…) avec ses effectifs, son budget et des attentes élevées.

## 15 jeux

League of Legends · Counter-Strike 2 · Valorant · Dota 2 · Rocket League · Overwatch 2 · Rainbow Six Siege · Call of Duty · Apex Legends · Fortnite · EA Sports FC · Street Fighter 6 · StarCraft II · Mobile Legends · PUBG

Chaque jeu a son propre circuit (taille d'équipe, rôles, cashprize, frais d'entrée), avec saison régulière puis playoffs (demies BO3, finale BO5).

## Ce que vous gérez

- **Effectifs** : titulaires / remplaçants, prolongations, ventes, libérations, ouverture et fermeture de divisions.
- **Mercato** : ~310 joueurs pros réels (Faker, ZywOo, donk, Vatira, Zen, aspas, Serral, MenaRD, Peterbot…) + des centaines de talents générés. Offres de transfert aux clubs ou signature d'agents libres.
- **Joueurs** : note, potentiel, âge, forme, moral, salaire, contrat. Les jeunes progressent, les vétérans déclinent et prennent leur retraite.
- **Finances** : sponsors, merch/stream, cashprizes, salaires, frais de fonctionnement.
- **Infrastructures** : Gaming House, staff de coaching, cellule d'analyse, studio de contenu, académie.
- **Événements** : offres de sponsors, polémiques, streamers, bootcamps, investisseurs, demandes d'augmentation…
- **Conseil d'administration** : un objectif par saison. Confiance à 0 % ou dette > 1,5 M€ = licenciement.

## Données

Les effectifs (saison 2025-26) sont **approximatifs** : l'esport bouge vite. Tout est modifiable dans `js/data.js`
(format joueur : `[pseudo, nationalité, note, âge]`).

## Structure

```
index.html      page du jeu
css/style.css   styles
js/data.js      jeux, clubs, joueurs réels
js/engine.js    simulation (matchs, économie, mercato, saisons)
js/ui.js        interface
```
