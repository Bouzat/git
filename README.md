# 🎮 Esports Manager — CEO Edition

Un jeu de gestion façon *Football Manager*, mais pour l'esport. Vous êtes le **CEO** d'un club esport multi-jeux.

## Lancer le jeu

Aucune installation : ouvrez `index.html` dans un navigateur (double-clic), ou servez le dossier :

```bash
python3 -m http.server 8000   # puis http://localhost:8000
```

La partie est sauvegardée automatiquement dans le navigateur (localStorage) à chaque semaine.

## Deux modes de jeu

- **🚀 Créer un club** : partez de zéro avec 250 k€ sur une **petite scène (tier 3)** du jeu de votre choix. Recrutez des amateurs, montez de division en division.
- **👔 Reprendre un club** : prenez les commandes d'une organisation réelle (T1, G2, Karmine Corp, Vitality, Fnatic, NAVI, Team Liquid, Falcons, FURIA…) avec ses effectifs, son budget et des attentes élevées.

## 15 jeux, 3 tiers, 45 circuits

League of Legends · Counter-Strike 2 · Valorant · Dota 2 · Rocket League · Overwatch 2 · Rainbow Six Siege · Call of Duty · Mobile Legends · Fortnite · Apex Legends · PUBG · EA Sports FC · Street Fighter 6 · StarCraft II

Chaque jeu a 3 tiers (ex. CS2 : Majors/BLAST/IEM → ESL Challenger/CCT → ESEA/FACEIT). Les 2 premiers de chaque tier montent, les 2 derniers descendent. On peut aussi acheter une place plus haut quand le club est assez connu.

Trois formats de compétition :
- **Équipes** : séries BO3 en saison régulière, playoffs avec demies BO3 et finale BO5.
- **Battle royale** (Fortnite, Apex, PUBG) : lobbies complets (50 duos = 100 joueurs sur Fortnite, 20 trios sur Apex, 16 squads sur PUBG), points de placement + éliminations, grande finale du top 8.
- **1 contre 1** (EA FC, SF6, StarCraft II).

## Ce que vous gérez

- **Effectifs** : titulaires / remplaçants, prolongations, ventes, libérations, ouverture et fermeture de divisions.
- **Mercato** : 700+ joueurs pros réels rangés dans leurs équipes, des pros indépendants (FGC, StarCraft, Fortnite…) et des milliers d'agents libres générés. Les stars refusent les clubs trop modestes.
- **Joueurs** : note, potentiel, âge, forme, moral, salaire, contrat. Les jeunes progressent, les vétérans déclinent.
- **Finances** : sponsors, merch/stream, cashprizes, salaires, frais de fonctionnement selon le tier.
- **Infrastructures** : Gaming House, staff de coaching, cellule d'analyse, studio de contenu, académie.
- **Événements** : sponsors (du kebab du coin à Red Bull), polémiques, créateurs de contenu, bootcamps, investisseurs…
- **Conseil d'administration** : un objectif par saison. Confiance à 0 % ou dettes trop lourdes = licenciement.

## Données

Les effectifs ont été établis de mémoire (scène ≈ 2025-26) : ils sont **approximatifs** et certains sont sûrement dépassés.
Tout est modifiable dans `js/data.js` (format joueur : `[pseudo, nationalité, note, âge]`).

## Structure

```
index.html      page du jeu
css/style.css   styles
js/data.js      jeux, clubs, joueurs réels
js/engine.js    simulation (matchs, économie, mercato, saisons)
js/ui.js        interface
```
