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
- **Mercato** : 697 joueurs pros réels rangés dans leurs équipes, des pros indépendants (FGC, StarCraft, Fortnite…) et des milliers d'agents libres générés. Les stars refusent les clubs trop modestes.
- **Joueurs** : note, potentiel, âge, forme, moral, salaire, contrat. Les jeunes progressent, les vétérans déclinent.
- **Finances** : sponsors, merch/stream, cashprizes, salaires, frais de fonctionnement selon le tier.
- **Infrastructures** : Gaming House, staff de coaching, cellule d'analyse, studio de contenu, académie.
- **Sponsors négociables** : du kebab du coin à Red Bull, avec contre-offres.
- **Événements**, polémiques, créateurs de contenu, bootcamps, investisseurs…
- **Conseil d'administration** : un objectif par saison. Confiance à 0 % ou dettes trop lourdes = licenciement.

## Données

- **697 joueurs réels.** Les effectifs de la plupart des grandes équipes ont été recoupés dans la presse esport 2026 (Worlds, LEC/LCK/LPL, Major de Cologne, EWC, VCT Champions, TI 2026, RLCS, OWCS, CDL, PGS, FNCS, Capcom Cup, FC Pro). Ils sont marqués « ✓ 2026 » dans la fiche du club ; les autres (« ≈ non vérifié ») viennent de mes connaissances et peuvent être dépassés.
- **Âges** : réels quand ils ont pu être vérifiés (sources 2026 pour une partie des joueurs Fortnite, années de naissance connues pour les stars) ; sinon l'âge est estimé et affiché avec un « ~ ».
- **Potentiel** : marge de progression selon l'âge (un joueur de 25 ans ou plus a atteint son plafond), affichée par votre staff avec une marge d'erreur qui diminue avec le niveau du coaching.
- Tout est modifiable dans `js/data.js` (format joueur : `[pseudo, nationalité, note, âge]`).

## Tournois à cashprize

En plus des ligues, chaque jeu a son calendrier de grands tournois (onglet **Tournois**) : First Stand, MSI et Worlds en LoL ; IEM, BLAST, les deux Majors et l'EWC en CS2 ; Masters et Champions en Valorant ; The International, DreamLeague et l'EWC en Dota 2 ; FNCS Majors et Global Championship en Fortnite ; Capcom Cup et EVO en SF6… plus des cash cups pour les petites scènes. Les tournois sur invitation prennent les meilleures équipes du tier 1, les opens accueillent tous les clubs des tiers admis. Le club garde 50 % des gains.

## Contrats et négociation (façon FM)

Chaque signature, transfert ou prolongation se négocie avec le joueur et son agent :
- **Statut promis** (Star, Titulaire, Rotation, Remplaçant, Espoir) : si vous promettez une place de titulaire et laissez le joueur sur le banc, son moral s'effondre.
- **Salaire, durée, prime à la signature, commission de l'agent, prime par victoire.**
- **Part du cashprize** reversée au joueur : le club ne garde que le reste des gains de ligue et de tournoi.
- **Clause libératoire** : les stars et les ambitieux en exigent une ; un club plus prestigieux peut alors racheter le joueur à ce prix. Vous pouvez aussi payer la clause d'un joueur adverse, son club ne peut pas refuser.
- **Personnalité** (Calme, Loyal, Ambitieux, Mercenaire, Exigeant, Jeune talent) : elle change les demandes et la **patience**. Une offre insultante fait fondre la patience ; à zéro, le joueur claque la porte et refuse de vous parler pendant 4 semaines.

## Sponsors

Les offres arrivent au fil des semaines, et vous pouvez démarcher des marques depuis l'onglet Finances (une fois par semaine). Chaque offre se négocie : contre-proposez un montant et une durée, la marque se rapproche de votre demande jusqu'à son plafond secret, mais elle peut rompre si vous êtes trop gourmand ou si les discussions s'éternisent.

## Structure

```
index.html      page du jeu
css/style.css   styles
js/data.js      jeux, clubs, joueurs réels
js/engine.js    simulation (matchs, économie, mercato, saisons)
js/ui.js        interface
```
