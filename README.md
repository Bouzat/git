# 🎮 Esports Manager — CEO Edition

Un jeu de gestion façon *Football Manager*, mais pour l'esport. Vous êtes le **CEO** d'un club esport multi-jeux.

## Lancer le jeu

Aucune installation : ouvrez `index.html` dans un navigateur (double-clic), ou servez le dossier :

```bash
python3 -m http.server 8000   # puis http://localhost:8000
```

La partie est sauvegardée automatiquement dans le navigateur (localStorage) à chaque semaine, compressée (environ 12 fois plus petite) pour tenir sous la limite de 5 Mo des navigateurs.

## Deux modes de jeu

- **🚀 Créer un club** : partez de zéro avec 250 k€ sur une **petite scène (tier 3)** du jeu de votre choix. Recrutez des amateurs, montez de division en division.
- **👔 Reprendre un club** : prenez les commandes d'une organisation réelle (T1, G2, Karmine Corp, Vitality, Fnatic, NAVI, Team Liquid, Falcons, FURIA…) avec ses effectifs, son budget et des attentes élevées.

## 25 jeux (les 24 titres de l'EWC 2026 + StarCraft II) et le circuit Valorant Game Changers

League of Legends · Counter-Strike 2 · Valorant · Dota 2 · Rocket League · Overwatch 2 · Rainbow Six Siege · Call of Duty: Black Ops 7 · Call of Duty: Warzone · Mobile Legends · Honor of Kings · Crossfire · Fortnite · Apex Legends · PUBG · PUBG Mobile · Free Fire · Teamfight Tactics · Trackmania · EA Sports FC · Street Fighter 6 · Tekken 8 · Fatal Fury · Échecs · StarCraft II

Pour les jeux ajoutés, seuls les échecs (Carlsen, Nakamura, Firouzja, Gukesh…) et Tekken 8 (Arslan Ash, Knee…) ont de vrais joueurs ; les autres scènes sont peuplées de clubs et joueurs inventés.

Chaque jeu a 3 tiers (ex. CS2 : Majors/BLAST/IEM → ESL Challenger/CCT → ESEA/FACEIT). Les 2 premiers de chaque tier montent, les 2 derniers descendent. On peut aussi acheter une place plus haut quand le club est assez connu.

**Fortnite est un circuit ouvert** : un seul classement FNCS pour tous les duos (pros et amateurs), sans divisions. Chaque club a un statut recalculé en fin de saison d'après son classement : **Élite** (top 20), **Pro** (top 80) ou **Open**. Ce statut fixe les invitations aux grands tournois, l'accès aux cash cups, les sponsors et les frais. Un nouveau club entre en statut Open. Comme la vraie FNCS, le format alterne : **duos les années paires (2026), trios les années impaires (2027)**. Les clubs de l'IA complètent leurs équipes, mais le vôtre doit recruter son troisième joueur. Dans les classements, un duo d'organisation s'affiche avec le nom du club, par exemple « XSET (Clix & Rapid) ».

Trois formats de compétition :
- **Équipes** : séries BO3 en saison régulière, playoffs avec demies BO3 et finale BO5.
- **Battle royale** (Fortnite, Apex, PUBG) : lobbies complets (50 duos = 100 joueurs sur Fortnite, 20 trios sur Apex, 16 squads sur PUBG), points de placement + éliminations, grande finale du top 8.
- **1 contre 1** (EA FC, SF6, StarCraft II).

## Académies

Dans les jeux en équipe (LoL, CS2, Valorant, Dota 2, CoD, R6, Overwatch, Rocket League, MLBB, Honor of Kings…), un club dont l'équipe première joue au moins en tier 2 peut créer une **académie** (il faut l'infrastructure « Académie »). C'est une seconde équipe, « Nom du club Academy », qui joue sa propre ligue à partir du tier 3 avec des jeunes de 16 à 19 ans à fort potentiel et à petits salaires.
- Les jeunes qui y jouent progressent plus vite, d'autant plus que l'infrastructure « Académie » est développée. La pépite annuelle du centre de formation y signe directement.
- Un bouton fait passer un joueur de l'académie à l'équipe première (« ↑ Équipe première ») ou l'inverse (« ↓ Académie »), sans toucher à son contrat. Un titulaire envoyé à l'académie le prend mal.
- L'académie ne monte jamais dans la division de l'équipe première. Si l'équipe première descend dans sa division, l'académie est rétrogradée, ou dissoute s'il n'y a plus de division en dessous (ses joueurs rejoignent alors l'équipe première).
- Ses gains vont au club, ses salaires et ses frais (réduits) aussi. La composition est automatique.

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

Les effectifs Valorant (48 équipes, octobre 2026) viennent de **vlr.gg**, les duos Fortnite (210 duos, 119 organisations) d'**esportsearnings.com** et des portails joueurs et équipes de **Liquipedia** (pays et équipe actuelle de chaque joueur, toutes régions, fichiers `tools/sources/liquipedia_fortnite_*.tsv`, licence CC-BY-SA), et les âges réels de **Wikidata**, via les outils du dossier `tools/` :

```bash
python3 tools/fetch_vlr.py data/vlr_teams.json      # classements et effectifs Valorant
python3 tools/fetch_esportsearnings.py 534-fortnite data/ee_fortnite.json 2026 "fncs|fortnite|reload"   # Fortnite : pays, âges, duos
sh tools/fetch_wikidata.sh data/wd_players.csv       # dates de naissance des joueurs pros
python3 tools/build_live.py data js/data_live.js     # génère js/data_live.js
```


- **697 joueurs réels.** Les effectifs de la plupart des grandes équipes ont été recoupés dans la presse esport 2026 (Worlds, LEC/LCK/LPL, Major de Cologne, EWC, VCT Champions, TI 2026, RLCS, OWCS, CDL, PGS, FNCS, Capcom Cup, FC Pro). Ils sont marqués « ✓ 2026 » dans la fiche du club ; les autres (« ≈ non vérifié ») viennent de mes connaissances et peuvent être dépassés.
- **Divisions des clubs** : chaque organisation a toutes ses divisions réelles 2026 (ex. Falcons : 18 jeux, Vitality avec Bigetron, Karmine Corp en TFT et Trackmania). Quand l'effectif réel d'une division est introuvable, ses joueurs sont inventés et la division est marquée « * » (pointillés).
- **Âges** : réels quand ils ont pu être vérifiés (sources 2026 pour une partie des joueurs Fortnite, années de naissance connues pour les stars) ; sinon l'âge est estimé et affiché avec un « ~ ».
- **Potentiel** : marge de progression selon l'âge (un joueur de 25 ans ou plus a atteint son plafond), affichée par votre staff avec une marge d'erreur qui diminue avec le niveau du coaching.
- Tout est modifiable dans `js/data.js` (format joueur : `[pseudo, nationalité, note, âge]`).

## Calendrier

L'onglet **Calendrier** montre la saison semaine par semaine : tous vos matchs de ligue (adversaire, puis résultat), les playoffs, les tournois auxquels vous êtes inscrit et la fenêtre de l'EWC. Filtres : vos matchs et tournois, tous les tournois de vos jeux, ou tous les tournois du monde.

## Tournois à cashprize

En plus des ligues, chaque jeu a son calendrier de grands tournois (onglet **Tournois**) : First Stand, MSI et Worlds en LoL ; IEM, BLAST, les deux Majors et l'EWC en CS2 ; Masters et Champions en Valorant ; The International, DreamLeague et l'EWC en Dota 2 ; FNCS Majors et Global Championship en Fortnite ; Capcom Cup et EVO en SF6… plus des cash cups pour les petites scènes. Les tournois sur invitation prennent les meilleures équipes du tier 1, les opens accueillent tous les clubs des tiers admis. Le club garde 50 % des gains.

**Valorant** compte 262 équipes. Il y a les 48 de VLR (octobre 2026), puis 214 équipes Challengers, académies, universités et équipes régionales (Europe, Turquie, CIS, Amériques, Brésil, Japon, Corée, Asie du Sud-Est, Chine, Inde, Océanie…), tirées de la Google Sheet de l'utilisateur (portails joueurs et effectifs Liquipedia, dans `tools/sources/valorant/`). Plus de 1 500 vrais joueurs sans équipe sont agents libres. Le tier 1 réunit 16 équipes et le tier 2 en réunit 32.

**Rocket League** compte 250 équipes dans toutes les régions RLCS (Europe, Amérique du Nord, Amérique du Sud, Moyen-Orient & Afrique, Asie-Pacifique, Océanie), tirées de la Google Sheet de l'utilisateur (portails joueurs et effectifs Liquipedia, dans `tools/sources/rocketleague/`). Les effectifs déjà vérifiés (Falcons, Karmine Corp, Vitality, NRG) sont conservés. Environ 1 450 vrais joueurs sans équipe sont agents libres. Le tier 1 réunit 16 équipes et le tier 2 en réunit 32.

Le **calendrier Rocket League** est la vraie saison RLCS 2026 (`tools/sources/rocketleague_tournois.csv`), qui se répète chaque saison (2027, 2028…) : Kick-Off Weekend, Boston Major et Paris Major précédés de leurs 6 Opens régionaux dans chaque région (EU, NA, SAM, MENA, OCE, APAC, SSA), EWC, Championnat du monde, CRL (universitaire), Saudi eLeague et tournois B-Tier (SwitzerLAN, Prime eLeague, Rival Rush…). Cela fait 67 tournois avec leurs vraies dotations. Les Opens sont ouverts à toutes les équipes de la région. Les résultats 2024-2025 forment le palmarès réel.

**Valorant Game Changers** est un circuit à part, séparé de la VCT. Il a ses propres ligues (12 équipes en tier 1, 24 en tier 2), son mercato, ses séries régionales et le Game Changers Championship. Ses 47 équipes (205 joueuses) sont rattachées à leur organisation et gardent leur nom : Karmine Corp GC, G2 Gozen, Team Liquid Brazil, Shopify Rebellion Gold, MIBR GC, FURIA Female, SEN Otters, Gen.G GC… Un club peut donc avoir à la fois une équipe VCT et une équipe Game Changers. Le palmarès réel du Championship (2022-2025) est attribué dès le début.

**Valorant** utilise le vrai calendrier (fichier `tools/sources/valorant/tournois.csv`, tiré d'une Google Sheet d'après Liquipedia). On y trouve les Kickoffs, Stages 1 et 2 de chaque ligue VCT, les Masters (Santiago, Londres), l'EWC, Champions, les Ascensions et Threshold, la China Evolution Series, l'EMEA Clash, Project Blender, Red Bull Home Ground, SOOP League, Saudi eLeague, etc. C'est la dernière édition de chaque compétition, avec ses dotations et son nombre d'équipes. Les compétitions régionales sont réservées aux équipes de la région (Europe/Moyen-Orient, Amériques, Pacifique, Chine). Le palmarès réel 2021-2025 (127 titres) est attribué aux clubs dès le début de la partie.

## Contrats et négociation (façon FM)

Chaque signature, transfert ou prolongation se négocie avec le joueur et son agent :
- **Statut promis** (Star, Titulaire, Rotation, Remplaçant, Espoir) : si vous promettez une place de titulaire et laissez le joueur sur le banc, son moral s'effondre.
- **Salaire, durée, prime à la signature, commission de l'agent, prime par victoire.**
- **Part du cashprize** reversée au joueur : le club ne garde que le reste des gains de ligue et de tournoi.
- **Clause libératoire** : les stars et les ambitieux en exigent une ; un club plus prestigieux peut alors racheter le joueur à ce prix. Vous pouvez aussi payer la clause d'un joueur adverse, son club ne peut pas refuser.
- **Région de jeu** (Europe, Amérique du Nord, Amérique du Sud, Moyen-Orient & Afrique, Asie, Océanie) : vous pouvez demander à un joueur de jouer dans une autre région que la sienne (ex. Peterbot en Europe). Certains refusent net, les autres réclament un meilleur salaire pour s'installer, puis passent 8 semaines d'adaptation (performances en baisse). Règlement : tous les titulaires d'une équipe sont inscrits dans la même région.
- **Personnalité** (Calme, Loyal, Ambitieux, Mercenaire, Exigeant, Jeune talent) : elle change les demandes et la **patience**. Une offre insultante fait fondre la patience ; à zéro, le joueur claque la porte et refuse de vous parler pendant 4 semaines.

## Esports World Cup et petits tournois

- **EWC** (semaines 7 à 10) : un tournoi par jeu avec les dotations 2026, et le **Club Championship** : chaque top 8 rapporte des points au club, il faut un top 8 dans au moins 2 jeux pour être classé, et 24 clubs se partagent 30 M€ (7 M€ pour le champion).
- **Petits tournois générés chaque saison** pour tous les jeux : cash cups et LAN ouvertes (FACEIT, ESEA, DreamHack Open, Gamers Assembly… en CS2, chaque semaine) et circuits tier 2 (CCT, NODWIN Clutch Series, European Pro League, Skyesports…). De quoi faire grandir un nouveau club.

## Sponsors

Les offres arrivent au fil des semaines, et vous pouvez démarcher des marques depuis l'onglet Finances (une fois par semaine). Chaque offre se négocie : contre-proposez un montant et une durée, la marque se rapproche de votre demande jusqu'à son plafond secret, mais elle peut rompre si vous êtes trop gourmand ou si les discussions s'éternisent.

## Structure

```
index.html      page du jeu
css/style.css   styles
js/data.js      jeux, clubs, joueurs réels
js/data_live.js effectifs et âges récupérés automatiquement (généré)
tools/          scripts de récupération des données
js/engine.js    simulation (matchs, économie, mercato, saisons)
js/ui.js        interface
```
