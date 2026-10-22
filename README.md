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

Pour les jeux ajoutés, les échecs (Carlsen, Nakamura, Firouzja, Gukesh…), Tekken 8 (Arslan Ash, Knee…) et **Warzone** ont de vrais joueurs. Warzone se joue en trios, avec les équipes du World Series of Warzone 2025 et de l'EWC 2025 : Team Vision (Fifakill, Echo1867, Lenun), Twisted Minds (Aydan, Almond, zSmit), Gentle Mates (HalloW, Gromalok, Enkeo), Team Falcons (Biffle, Shifty, Hisoka), Team BDS, ROC, ESC Champenois, ONIC, Raven eSports, 100 Thieves et le trio indépendant de Stukex. Les autres scènes sont peuplées de clubs et joueurs inventés.

**Ligues régionales et tiers.** Comme dans la réalité, chaque jeu a ses ligues par région, sur 3 tiers. Les équipes réelles sont placées dans la ligue de leur région, les meilleures en tier 1 :
- **LoL** : LEC, LCK, LPL, LCS, CBLOL, LCP en tier 1 ; EMEA Masters et ligues régionales, LCK CL, LDL, NACL, Circuito Desafiante… en tier 2 ; Open Tour en tier 3.
- **Valorant** : VCT EMEA, Americas, Pacific et China (12 équipes) ; Challengers de chaque région (16) ; Premier.
- **Valorant Game Changers** (EMEA, Amérique du Nord, Brésil/Amérique du Sud, Pacifique), **Rocket League** (RLCS Europe, Amérique du Nord, Amérique du Sud, MENA, Océanie, Asie-Pacifique), **Overwatch** (OWCS EMEA, NA, Asie), **Rainbow Six** (European League, NA League, Brasileirão, Asia-Pacific League).
- **Fortnite** : une FNCS par région.
- Les jeux sans ligues régionales (CS2, Dota 2, CoD, jeux de combat, échecs…) gardent un classement mondial.

Les 2 premiers de chaque ligue montent dans le tier au-dessus de leur région, les 2 derniers descendent.

**Choisir sa ligue nationale.** Quand le tier 2 est découpé en ligues nationales (LoL : LFL, Prime League, SuperLiga…), on choisit sa ligue dans l'onglet Effectifs (menu « Ligue nationale visée »), depuis la page de la ligue dans Compétitions, ou en achetant directement une place en tier 2. En tier 3, c'est la ligue où le club arrive à sa montée ; en tier 2, le changement est immédiat tant qu'aucun match de la saison n'est joué, sinon il se fait à la fin de la saison (le club échange sa place avec le club le plus faible de la ligue voulue).

**League of Legends** utilise les fichiers de l'utilisateur (Google Sheet d'après Liquipedia, dans `tools/sources/lol/`) : 313 équipes et 1 450 joueurs, avec leur pays, venus du portail des joueurs. Les tiers par région :
- **Europe** : LEC en tier 1. En tier 2, chaque ligue nationale (ERL) joue séparément : LFL, Prime League, LVP SuperLiga, Rift Legends (Ultraliga), TCL, Esports Balkan League, Road of Legends (Elite Series), Hitpoint Masters, Hellenic Legends League, LIT, LPLOL, NLC, Arabian League. Les deuxièmes divisions et les académies sont en tier 3.
- **Corée** : LCK, LCK CL, LCK Academy.
- **Chine** : LPL, LDL.
- **Amérique du Nord** : LCS ; NACL et Liga Regional Norte ; ligues universitaires et amateurs.
- **Amérique du Sud** : CBLOL ; Circuito Desafiante et Liga Regional Sur.
- **Pacifique** : LCP ; VCS, PCS, LJL et LTS.

Dans une ligue nationale, le dernier descend, et les meilleurs du tier 3 montent, de préférence dans la ligue de leur pays. Le calendrier LoL suit le vrai : First Stand, MSI, EWC, Worlds, EMEA Masters, Asia Masters, KeSPA Cup, Demacia Cup, Americas Cup, et des coupes comme Nexus Tour, Gamers Assembly ou Kanji Cup. Environ 900 vrais joueurs sans équipe sont agents libres.

**Ligues fermées (franchises)** : LEC, LCK, LPL, LCS, CBLOL et LCP en LoL, les quatre ligues VCT en Valorant et la CDL en Call of Duty n'ont ni montée ni relégation. Pour y entrer, il faut racheter la place d'un club (bouton « 🔒 Franchise » dans les Effectifs ou dans le classement de la ligue). Seuls les clubs modestes vendent, de 2,5 M€ (CBLOL) à 12 M€ (LEC) et 25 M€ (CDL) selon la ligue et le prestige du vendeur. Pendant la saison de ligue, la place change de mains à la fin de la saison ; sinon tout de suite. Votre équipe monte avec ses joueurs et le vendeur prend votre ancienne place. On peut aussi acheter une place plus haut quand le club est assez connu.

**Fortnite est un circuit ouvert**, joué par région : chaque région a sa FNCS, sans divisions. Chaque équipe a un statut recalculé en fin de saison d'après son classement dans sa région : **Élite** (top 10 %), **Pro** (top 40 %) ou **Open**. Ce statut fixe les invitations aux grands tournois, l'accès aux cash cups, les sponsors et les frais. Un nouveau club entre en statut Open. Comme la vraie FNCS, le format alterne : **duos les années paires (2026), trios les années impaires (2027)**. Dans les classements, un duo d'organisation s'affiche avec le nom du club, par exemple « XSET (Clix & Rapid) ».

**Plusieurs duos/trios Fortnite, sans banc.** Chaque joueur Fortnite du club joue dans un duo (ou trio), et le club peut en aligner autant qu'il veut. Chaque équipe joue dans la FNCS de sa région : un duo américain en Amérique du Nord, un duo européen en Europe. Dans l'onglet Effectifs, vous choisissez qui joue avec qui (« Changer d'équipe… »), ou vous isolez un joueur dans un nouveau duo. Un joueur seul se trouve un partenaire hors du club, un agent libre de sa région et de son niveau (marqué d'un *). Vous ne le payez pas. Reprendre une organisation comme Solary donne tous ses duos.

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
- **Finances** : chaque euro passe par un grand livre (catégorie, jeu, détail) : sponsors, merch et streaming, cashprizes (part du club), ventes, salaires et frais de chaque section, primes, commissions d'agents, déplacements en LAN… L'onglet affiche le compte de résultat de la saison, le résultat par jeu et les 60 dernières opérations, filtrables par jeu.
- **Budget mercato par section** : en début de saison, comme dans FM, vous répartissez votre budget de transferts entre vos jeux et fixez une masse salariale maximale pour chacun. Une signature qui dépasse l'enveloppe ou le plafond du jeu est refusée, et les ventes renflouent l'enveloppe. La répartition se modifie à tout moment.
- **Image du club et fans** : les sponsors sont éthiques, classiques ou controversés (paris, crypto, casinos). Les controversés paient environ deux fois plus, mais l'image du club baisse : les victoires attirent moins de fans, les défaites en font partir plus, et des fans partent chaque semaine. Une bonne image fait l'inverse. Après chaque match, un récapitulatif montre combien de fans le club a gagnés ou perdus et pourquoi. Les ordres de grandeur sont réalistes : environ +0,1 % de fans pour une victoire en ligue majeure, quelques pourcents pour un titre.
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

## Calendrier réel et jours de match

La saison suit l'année réelle, semaine par semaine (dates affichées : « 12-18 janv. 2026 ») :
- **Split 1** de mi-janvier à fin mars, puis **split 2** d'avril à mi-juin : 22 journées de ligue en matchs aller-retour.
- **Esports World Cup** en juillet-août.
- **Playoffs** des ligues en septembre.
- Championnats du monde et grands tournois jusqu'à mi-décembre, à leurs vraies dates (les Majors RLCS, le VCT et les Masters viennent des calendriers fournis).

L'onglet **Calendrier** regroupe les semaines par mois. Il montre vos matchs de ligue, les playoffs et les tournois, et on peut **s'inscrire à un tournoi ou le décliner** : décliner évite les frais de déplacement en LAN et repose vos joueurs.

**Jour de match** : quand votre club joue, le bouton « 🎮 Jour de match » liste vos rencontres de la semaine. Vous les lancez une par une (résultat, fans gagnés et gains après chaque match), ou vous simulez toute la semaine d'un coup, ce qui est pratique avec beaucoup de jeux. « ⏭ Prochain match » passe directement les semaines sans match.

**Messagerie façon FM** : catégories (résultats, mercato et contrats, sponsors et finances, conseil, vie du club, actualités), filtre par jeu (combinable avec les catégories), recherche, volet de lecture avec raccourcis (mercato, classement…). Chaque semaine, un compte rendu des résultats par jeu y arrive.

## Tournois à cashprize

En plus des ligues, chaque jeu a son calendrier de grands tournois (onglet **Tournois**) : First Stand, MSI et Worlds en LoL ; IEM, BLAST, les deux Majors et l'EWC en CS2 ; Masters et Champions en Valorant ; The International, DreamLeague et l'EWC en Dota 2 ; FNCS Majors et Global Championship en Fortnite ; Capcom Cup et EVO en SF6… plus des cash cups pour les petites scènes. Les tournois sur invitation prennent les meilleures équipes du tier 1, les opens accueillent tous les clubs des tiers admis. Le club garde 50 % des gains.

**Valorant** compte 262 équipes. Il y a les 48 de VLR (octobre 2026), puis 214 équipes Challengers, académies, universités et équipes régionales (Europe, Turquie, CIS, Amériques, Brésil, Japon, Corée, Asie du Sud-Est, Chine, Inde, Océanie…), tirées de la Google Sheet de l'utilisateur (portails joueurs et effectifs Liquipedia, dans `tools/sources/valorant/`). Plus de 1 500 vrais joueurs sans équipe sont agents libres. Les équipes sont réparties dans les ligues VCT de leur région.

**Rocket League** compte 250 équipes dans toutes les régions RLCS (Europe, Amérique du Nord, Amérique du Sud, Moyen-Orient & Afrique, Asie-Pacifique, Océanie), tirées de la Google Sheet de l'utilisateur (portails joueurs et effectifs Liquipedia, dans `tools/sources/rocketleague/`). Les effectifs déjà vérifiés (Falcons, Karmine Corp, Vitality, NRG) sont conservés. Environ 1 450 vrais joueurs sans équipe sont agents libres. Les équipes jouent dans la ligue RLCS de leur région.

Le **calendrier Rocket League** est la vraie saison RLCS 2026 (`tools/sources/rocketleague_tournois.csv`), qui se répète chaque saison (2027, 2028…) : Kick-Off Weekend, Boston Major et Paris Major précédés de leurs 6 Opens régionaux dans chaque région (EU, NA, SAM, MENA, OCE, APAC, SSA), EWC, Championnat du monde, CRL (universitaire), Saudi eLeague et tournois B-Tier (SwitzerLAN, Prime eLeague, Rival Rush…). Cela fait 67 tournois avec leurs vraies dotations. Les Opens sont ouverts à toutes les équipes de la région. Les résultats 2024-2025 forment le palmarès réel.

**Valorant Game Changers** est un circuit à part, séparé de la VCT. Il a ses propres ligues régionales, son mercato, ses séries régionales et le Game Changers Championship. Ses 47 équipes (205 joueuses) sont rattachées à leur organisation et gardent leur nom : Karmine Corp GC, G2 Gozen, Team Liquid Brazil, Shopify Rebellion Gold, MIBR GC, FURIA Female, SEN Otters, Gen.G GC… Un club peut donc avoir à la fois une équipe VCT et une équipe Game Changers. Le palmarès réel du Championship (2022-2025) est attribué dès le début.

**Valorant** utilise le vrai calendrier (fichier `tools/sources/valorant/tournois.csv`, tiré d'une Google Sheet d'après Liquipedia). On y trouve les Kickoffs, Stages 1 et 2 de chaque ligue VCT, les Masters (Santiago, Londres), l'EWC, Champions, les Ascensions et Threshold, la China Evolution Series, l'EMEA Clash, Project Blender, Red Bull Home Ground, SOOP League, Saudi eLeague, etc. C'est la dernière édition de chaque compétition, avec ses dotations et son nombre d'équipes. Les compétitions régionales sont réservées aux équipes de la région (Europe/Moyen-Orient, Amériques, Pacifique, Chine). Le palmarès réel 2021-2025 (127 titres) est attribué aux clubs dès le début de la partie.

## Notes de match, progression et discussions (façon FM)

- Chaque joueur reçoit une **note sur 10** à chaque match : son niveau face à l'adversaire, le résultat, une part de hasard, un bonus pour le MVP. Les notes de vos joueurs s'affichent après chaque match, et l'effectif montre la moyenne de la saison et les 5 derniers matchs.
- **Progression** : les jeunes progressent d'autant plus vite qu'ils jouent, qu'ils ont de bonnes notes et que le staff de coaching est bon ; à 25 ans et plus, la progression est quasi nulle. Un jeune qui brille peut même dépasser son potentiel estimé.
- **Discussions** (💬) : félicitez un joueur, encouragez-le, exigez mieux (risqué selon sa personnalité), promettez-lui une place, mettez-le sur la liste des transferts (des clubs feront des offres), renégociez ou résiliez son contrat. Le tableau de bord liste les joueurs en difficulté et en forme. Les **réunions d'équipe** (féliciter, rassurer, mettre la pression, rester concentrés) aident quand les résultats ne suivent pas.
- **Matchs en direct** : un match lancé au jour de match se déroule manche par manche (ou partie par partie en battle royale) avec un fil d'actions, pour le suspense. On peut accélérer ou passer au résultat.
- **Recherche** : le champ du menu trouve une équipe ou un joueur.
- **Tableaux triables** : dans tous les tableaux (sponsors, effectifs, classements, grand livre, tournois…), un clic sur un en-tête trie la colonne et un second clic inverse l'ordre. Le tri reste en place quand on change d'onglet.

## Staff, caractères, carrières (façon FM)

- **Entraîneurs** (onglet 🧑‍🏫 Staff) : un par jeu, noté sur 20 en tactique (niveau en match), motivation (moral), formation des jeunes (progression des moins de 22 ans) et gestion des egos (atténue les tensions). Les meilleurs joueurs qui prennent leur retraite se reconvertissent parfois en entraîneurs (rain, Tokido, brTT…), avec des notes tirées de leur niveau et de leur caractère. Les clubs de l'IA ont aussi leurs entraîneurs fictifs (de niveau raisonnable, liés au prestige du club), qui comptent dans le niveau de leurs équipes. On peut en recruter un en poste : on verse une indemnité à son club, puis il accepte ou refuse selon le prestige des deux clubs, le tier, le salaire et la durée proposés, et son attachement à son club. Le club qui le perd en engage un autre.
- **Notoriété et budget expliqués** : la notoriété est affichée sur 100 partout. Un clic sur « Notoriété ⓘ » (barre du haut) détaille ses effets : note maximale des joueurs prêts à discuter au mercato pour chaque jeu, marques accessibles, divisions, salaires, et comment la faire monter. Un clic sur « Budget ⓘ » explique l'argent disponible, le solde de la semaine, la prévision de mi-décembre, les enveloppes mercato par jeu et le seuil de dette. Le mercato rappelle aussi le seuil de note des joueurs intéressés.
- **Périodes de mercato** : chaque jeu a ses fenêtres de transferts calées sur son vrai calendrier (LoL : intersaison après les Worlds à la mi-novembre, pause entre les splits et fenêtre d'été ; Valorant : intersaison après Champions ; Dota 2 : après The International ; CoD : après les Champs ; R6 : après le Six Invitational…). Hors fenêtre, impossible de racheter un joueur sous contrat (seuls les agents libres et les indépendants signent), et vos joueurs sur la liste des transferts ne reçoivent pas d'offres. CS2, les battle royale et les jeux en solo n'ont pas de fenêtre réglementée. À chaque ouverture, une animation « MERCATO TIME ! » liste vos sections concernées et les jeux où c'est le bon moment pour ouvrir une nouvelle section. Le mercato affiche l'état de chaque fenêtre, le calendrier les semaines de mercato, et « Toutes les dates de mercato » le détail par jeu.
- **Ne pas rater le mercato** : les fenêtres durent plusieurs semaines et l'intersaison continue d'une saison à l'autre (LoL : de mi-novembre à début février). La barre du haut affiche le nombre de semaines de mercato restantes (clic : aller au mercato), « Prochain match » s'arrête à chaque ouverture et à la dernière semaine, et avant de passer la dernière semaine une fenêtre prévient que le mercato se ferme.
- **Liste des transferts** (Mercato → 📋 Liste des transferts) : « Vendre » met le joueur sur la liste à un prix que vous fixez, avec une estimation de l'intérêt des clubs. Rien n'est garanti : un club ne fait une offre que si le joueur le renforce, s'il en a le budget, si le prix est raisonnable et si le mercato du jeu est ouvert. Il peut n'y avoir aucune offre. Comme dans Football Manager, il faut répondre à chaque offre avant de passer à la semaine suivante (le bouton devient « 📨 Offres à traiter ») : accepter, refuser ou faire une contre-proposition (le club accepte, monte une dernière fois ou se retire). L'onglet montre aussi les joueurs mis en vente par les clubs de l'IA, à leur prix affiché.
- **Ce que vous pouvez dépenser** : en haut du mercato, pour chaque section, l'achat maximum possible (enveloppe mercato restante, limitée par l'argent en caisse ; elle couvre indemnité, prime de signature et commission de l'agent) et le salaire maximum qu'on peut encore offrir (marge sur la masse salariale du jeu). Les coûts et salaires trop élevés sont en rouge, le filtre « Dans mon budget » tient compte des deux, et la même info est rappelée dans les offres et les négociations.
- **Filtre de coût libre** : au mercato, on tape un coût minimum et un coût maximum (ex. « 20k », « 150 000 », « 1,5M ») au lieu de choisir une tranche.
- **Périodes de mercato** : chaque jeu a ses fenêtres de transferts calées sur son vrai calendrier (LoL : intersaison après les Worlds à la mi-novembre, pause entre les splits et fenêtre d'été ; Valorant : intersaison après Champions ; Dota 2 : après The International ; CoD : après les Champs ; R6 : après le Six Invitational…). Hors fenêtre, impossible de racheter un joueur sous contrat (seuls les agents libres et les indépendants signent), et vos joueurs sur la liste des transferts ne reçoivent pas doffres.
- **Caractères et entente** : chaque joueur a un caractère (Leader, Boute-en-train, Discret, Mentor, Perfectionniste, Tête brûlée, Solitaire, Toxique). Deux leaders se marchent dessus, un toxique pourrit l'ambiance, un mentor fait grandir les jeunes, la même nationalité rapproche. L'entente des titulaires change le niveau de l'équipe de ±3 %.
- **Fiche joueur** (clic sur un nom) : palmarès personnel, carrière saison par saison. Pour vos joueurs seulement : personnalité, caractère, entente avec chaque coéquipier, notes des 10 derniers matchs et graphique de l'évolution depuis l'arrivée au club.
- **Retraites et nouveaux joueurs** : les joueurs partent à la retraite à partir de 31 ans. Chaque saison arrivent des jeunes au potentiel surtout modeste (quelques pépites seulement) et quelques révélations tardives de 22 à 27 ans.
- **Polémiques et conférences de presse** : amende, suspension (le joueur ne joue pas), excuses publiques, silence, ou défense en conférence de presse avec trois questions dont les réponses plaisent ou non aux fans, au conseil et aux joueurs.
- **Négociations** : quand l'agent refuse, il fait sa propre contre-proposition, qui remplit le contrat ; il suffit de l'accepter ou de la modifier.
- **Faillite** : un découvert coûte des intérêts chaque semaine. Sous un seuil, un administrateur judiciaire vend le joueur le plus cher toutes les 4 semaines, puis le club fait faillite au bout de 16 semaines (fin de partie).
- **Finances** : prévisionnel jusqu'à la fin de la saison, graphiques des recettes et dépenses par semaine, par catégorie et par section.
- **Résultats** : chaque match a sa date (« sam. 17 janv. »), le récap de la semaine liste les matchs dans l'ordre avec V/D, et une victoire en tournoi déclenche confettis et compteur des gains.

**Données réelles TFT** (fichiers de l'utilisateur d'après Liquipedia, dans `tools/sources/tft/`, importés par `python3 tools/build_tft.py`) : 617 vrais joueurs, dont 400 dans une organisation (T1, JD Gaming, Weibo, Team Vision, Aurora, Gentle Mates, MOUZ, Movistar KOI, Vitality, Academy de Dishsoap…), avec leur pays. Le fichier ne donne pas de niveau : la note de chaque joueur vient de ses résultats (vainqueurs et finalistes des Tactician's Crown, de l'EWC, des finales régionales et des Opens, les plus récents comptant le plus) et de son club. 600 autres joueurs du portail sont agents libres. Calendrier 2026 : les trois Tactician's Crown, l'EWC, le K3Soju Invitational, les finales régionales AMER/EMEA/APAC et chinoises, les coupes du TFT Pro Circuit, les Tactician's Cups et Trials, les championnats nationaux. Les modes à plusieurs (Double Up, 4v4) et le JCC (version mobile chinoise) ne sont pas repris. Le tier 1 compte 16 joueurs (deux lobbies), le tier 2 32. Palmarès réel 2020-2025 des tournois S et A-Tier.

**Données réelles Trackmania** (fichiers de l'utilisateur d'après Liquipedia, dans `tools/sources/trackmania/`, importés par `python3 tools/build_tm.py`) : 287 vrais pilotes, dont 270 dans une équipe (BIG avec GranaDy et Massa, Vitality avec Pac, Falcons avec Carl Jr., Liquid, Gen.G, ROC, Twisted Minds, FUT…), avec leur pays, et 800 autres pilotes du portail comme agents libres. Les communautés de dizaines de membres (PIWO, Onyx, OCD…) ne comptent pas comme des équipes pro. Les notes viennent des résultats 2026, du club et de références de la scène. Calendrier 2026 : OverDrive (Majors et wildcards des trois splits), The Opel Chase, Opel Trackmania Cup, GDEX, Fourmula Vae, Springs Mania, FallSpeed, l'EWC et les tournois Tier 3 (coupes nationales, Asia Cup, Monthly Cups). Le fichier couvrant la fin de saison, les deux premiers splits d'OverDrive et les Monthly Cups de janvier à août suivent le même modèle. Tier 1 à 16 pilotes, tier 2 à 32.

## Classement mondial CS2 (façon HLTV)

**Données réelles CS2** (fichiers de l'utilisateur d'après Liquipedia, dans `tools/sources/cs2/`, importés par `python3 tools/build_cs2.py`) : 158 équipes d'Europe, de la CEI, des Amériques, d'Asie, d'Océanie et d'Afrique avec leurs effectifs 2026 et la nationalité de chaque joueur, 900 vrais joueurs sans équipe comme agents libres, et le calendrier 2026 complet (22 tournois S-Tier dont les Majors de Cologne et de Singapour, l'EWC, les IEM, BLAST, PGL et ESL Pro League ; tournois A et B-Tier comme CCT, NODWIN Clutch, ESL Challenger League par région ; tournois C-Tier dotés d'au moins 5 000 $). Le tier 1 compte les 16 meilleures équipes du classement, le tier 2 les 32 suivantes. Les équipes féminines ne sont pas importées (pas de circuit féminin CS2 dans le jeu).

Chaque tournoi CS2 rapporte des points selon sa dotation et la place. Chaque match compte aussi, façon Elo (comme le face-à-face de la VRS) : le vainqueur prend des points au perdant, d'autant plus que l'écart de classement était grand (battre Vitality rapporte gros, perdre contre une équipe mal classée coûte cher), et les matchs des grands tournois pèsent plus. Le gain ou la perte s'affiche sous chaque match. Les points comptent pleinement 3 mois, à 75 % jusqu'à 6 mois et à 40 % jusqu'à un an. Les invitations aux grands tournois suivent ce classement, et en fin de saison les tiers sont refaits d'après lui. Comme la VRS de Valve, il y a un classement mondial et un classement par région (Europe, Amériques, Asie-Pacifique), visibles dans Compétitions.

**FNCS (Fortnite).** Chaque Major se joue par région en trois étapes, la même semaine que dans la réalité : qualifications ouvertes (B-Tier), demi-finales pour les 60 % les mieux classés (A-Tier), grande finale pour la moitié des demi-finalistes (S-Tier, dotation partagée entre les régions). Les meilleurs de chaque région sur les grandes finales des Majors jouent le FNCS Global Championship (Europe 12, Amérique du Nord 9, Amérique du Sud 4, Moyen-Orient 3, Asie 2, Océanie 2). Un mail annonce chaque qualification ou élimination. Un joueur seul dans son équipe joue avec un partenaire extérieur de son niveau (6 points d'écart au plus).

**Économie de chaque jeu.** Chaque jeu a un profil inspiré du réel : audience, attrait pour les marques grand public, part des sponsors de paris et de crypto (forte en CS2 et Dota) et des marques éthiques (plus présentes en Rocket League, Fortnite, LoL). La valeur et le salaire des joueurs suivent l'audience du jeu et le tier de leur club ; le montant des offres de sponsors suit le tier, l'audience et l'attrait de vos sections, et le type de marques suit votre jeu phare (onglet Sponsors, « 📺 Audience et sponsors de vos jeux »).

**EWC.** Chaque tournoi de l'Esports World Cup a des qualifications ouvertes à tous les tiers, trois semaines avant : environ 75 % des places sont des invitations (les meilleurs), les autres reviennent aux mieux classés des qualifications. Un mail annonce si vous êtes invité, qualifié ou éliminé.

**Négocier un transfert.** Le club vendeur a un prix plancher secret : plus bas si le contrat du joueur se termine, s'il est remplaçant ou mis en vente, ou si le club manque d'argent ; plus haut pour un pilier de l'équipe ou un jeune à fort potentiel. Il répond à chaque offre par une contre-proposition qui se rapproche de son plancher (« ne descendra pas plus bas » quand il l'atteint). Une offre ridicule l'agace ; à bout de patience, il rompt les discussions pendant 4 semaines. « Accepter leur prix » conclut l'accord, puis vient la négociation du contrat avec le joueur.

**Mercato des autres clubs.** Pendant les fenêtres de chaque jeu, les clubs de l'IA se renforcent : ils remplacent leur joueur le plus faible par un agent libre ou par un joueur d'un club de même niveau ou plus modeste, s'ils peuvent payer l'indemnité. Plus leurs résultats sont mauvais, plus ils bougent (environ 10 fois plus pour le dernier quart du classement que pour le premier) ; à l'intersaison, ils se basent sur leur classement de la saison passée. Tous les transferts sont dans Mercato → 📰 Mouvements, et les plus gros de vos jeux arrivent chaque semaine dans un mail récapitulatif.

**Argent du mercato.** Par défaut (mode automatique), un seul budget pour tout le club : vous pouvez dépenser votre budget moins une réserve de 10 semaines de salaires, et une recrue doit pouvoir être payée 20 semaines avec l'argent restant. Le mode manuel (une enveloppe mercato et un plafond de salaires par jeu, à la Football Manager) s'active dans Finances.

**Exclusivité des sponsors.** Le nombre de sponsors n'est pas limité (les grands clubs ont 20 à 35 partenaires), mais une marque nationale ou internationale refuse un club qui a déjà un concurrent du même secteur (Red Bull et Monster, Logitech et Razer…). Les commerces locaux se cumulent.

**Importance des matchs.** Dans la journée de match, chaque rencontre affiche son importance : finales de tier 1 et tournois S-Tier en or, playoffs de tier 1, finales de tier 2 et tournois A-Tier en argent, journées de ligue et tournois B-Tier normaux, cash cups (C-Tier) en discret. Chaque tournoi a un niveau S, A, B ou C selon son accès et sa dotation, avec un filtre dans l'onglet Tournois.

**Changer de tier.** Dans l'onglet Effectifs, « 🔀 Changer de tier » permet d'acheter une place dans une division plus haute (notoriété et droit d'entrée requis) ou de redescendre volontairement (notoriété −2, confiance du conseil −5). Le changement est immédiat si la saison de l'équipe n'a pas commencé, sinon il se fait à la fin de la saison. Pas pour les ligues fermées (franchise), les circuits ouverts ni CS2 (classement mondial).

**Un tournoi par semaine.** Comme en vrai, une équipe ne peut pas jouer deux tournois en même temps (tous les jeux). Quand elle est retenue dans plusieurs tournois la même semaine (une invitation et un open, deux invitations…), l'onglet Tournois propose « 🎯 Choix des tournois » : dotation, accès, niveau du plateau et points de classement selon la place (1er, 2e, top 4, top 8) de chaque option. Par défaut, le club joue le plus important.

## Contrats et négociation (façon FM)

Chaque signature, transfert ou prolongation se négocie avec le joueur et son agent :
- **Statut promis** (Star, Titulaire, Rotation, Remplaçant, Espoir) : si vous promettez une place de titulaire et laissez le joueur sur le banc, son moral s'effondre.
- **Salaire, durée, prime à la signature, commission de l'agent, prime par victoire.**
- **Part du cashprize** reversée au joueur : le club ne garde que le reste des gains de ligue et de tournoi.
- **Clause libératoire** : les stars et les ambitieux en exigent une ; un club plus prestigieux peut alors racheter le joueur à ce prix. Vous pouvez aussi payer la clause d'un joueur adverse, son club ne peut pas refuser.
- **Région de jeu** (Europe, Amérique du Nord, Amérique du Sud, Moyen-Orient & Afrique, Asie, Océanie) : vous pouvez demander à un joueur de jouer dans une autre région que la sienne (ex. Peterbot en Europe). Certains refusent net, les autres réclament un meilleur salaire pour s'installer, puis passent 8 semaines d'adaptation (performances en baisse). Règlement : tous les titulaires d'une équipe sont inscrits dans la même région.
- **Personnalité** (Calme, Loyal, Ambitieux, Mercenaire, Exigeant, Jeune talent) : elle change les demandes et la **patience**. Une offre insultante fait fondre la patience ; à zéro, le joueur claque la porte et refuse de vous parler pendant 4 semaines.

## Esports World Cup et petits tournois

- **EWC** (juillet-août) : un tournoi par jeu avec les dotations 2026, et le **Club Championship** : chaque top 8 rapporte des points au club, il faut un top 8 dans au moins 2 jeux pour être classé, et 24 clubs se partagent 30 M€ (7 M€ pour le champion).
- **Petits tournois générés chaque saison** pour tous les jeux : cash cups et LAN ouvertes (FACEIT, ESEA, DreamHack Open, Gamers Assembly… en CS2, chaque semaine) et circuits tier 2 (CCT, NODWIN Clutch Series, European Pro League, Skyesports…). De quoi faire grandir un nouveau club.

## Sponsors

L'onglet **🤝 Sponsors** présente vos partenaires (montant, semaines restantes, clauses et leur avancement), les **marques intéressées** par le club (la discussion est assurée, la liste change toutes les 4 semaines) et tout le catalogue de marques à **démarcher vous-même** (2 contacts par semaine, avec vos chances de succès selon la taille de la marque, votre notoriété et votre image). Cliquer sur une marque ouvre sa **fiche** : chiffre d'affaires, bénéfice, abonnés sur les réseaux, budget esport, cible, jeux qui l'intéressent, clubs déjà partenaires, exigences (notoriété, image), offre estimée et chances de rendez-vous. Ces chiffres sont des estimations du jeu, pas des données officielles. Chaque contrat a une **clause d'objectif** de classement dans votre ligue phare, à choisir entre prudent, standard et ambitieux : plus c'est ambitieux, plus la prime et le montant hebdomadaire sont élevés. Objectif atteint : prime versée et proposition de renouvellement (avec une hausse). Objectif manqué : pas de prime, pas de renouvellement. Les grandes marques ajoutent une prime au titre, les marques éthiques une prime à la croissance des fans.

Les offres arrivent au fil des semaines, et vous pouvez démarcher une marque éthique, classique ou controversée depuis l'onglet Finances (une fois par semaine ; les marques éthiques refusent un club à l'image dégradée). Chaque offre se négocie : contre-proposez un montant et une durée, la marque se rapproche de votre demande jusqu'à son plafond secret, mais elle peut rompre si vous êtes trop gourmand ou si les discussions s'éternisent.

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

**Qualifications visibles** : après chaque étape qualificative (qualifications, demi-finales et grande finale FNCS, qualifications EWC), le résultat indique clairement ✅ Qualifié pour l'étape suivante ou ❌ Éliminé avec le top requis ; pour chaque équipe quand vous en alignez plusieurs. Après une grande finale FNCS, il affiche votre place provisoire dans la course au Global Championship par rapport au quota de votre région. Le statut apparaît dans le jour de match, le direct, le bilan de la semaine et la colonne Résultat des Tournois.

**Titre mondial** : remporter le championnat du monde d'un jeu déclenche une grande animation plein écran. Ça vaut pour le plus grand tournoi S-tier du jeu (Worlds, The International, FNCS Global Championship, VALORANT Champions, RLCS World Championship…), ainsi que les Majors CS2 et les Tactician's Crown TFT. L'animation montre des rayons dorés, des feux d'artifice, « CHAMPIONS DU MONDE », l'équipe, ses joueurs et le cashprize.

**Salle des trophées** : nouvel onglet du menu Club. On y trouve :
- vos chiffres clés : trophées, titres mondiaux, titres de ligue, tournois gagnés, podiums et gains en tournoi ;
- une vitrine dorée « Champions du monde » ;
- une étagère avec tous vos trophées, classés par prestige ;
- les médailles (2e et 3e places en S-Tier et A-Tier) ;
- l'héritage du club, avec les titres remportés avant votre arrivée.

Les trophées peuvent être filtrés par jeu.

**Fluidité** : la sauvegarde se compresse dans un Web Worker, en arrière-plan, quelques instants après le dernier clic, au lieu de geler l'écran environ 1 s à chaque action. Pendant l'affichage d'un écran, les calculs répétés sont mis en cache : masse salariale, plateaux des tournois, forces des équipes, classements. Résultat : le mercato passe de 0,6 s à 0,03 s, le calendrier de 0,5 s à 0,05 s et le tableau de bord de 0,36 s à 0,05 s.

**EWC réelle** : chaque édition de l'Esports World Cup reprend les données de l'EWC 2026 (Paris, fichiers fournis par l'utilisateur) :
- les dotations et le nombre de participants de chaque jeu, par exemple 3 M$ en MLBB, HoK et PUBG Mobile, 2 M$ en LoL, CS2 et Valorant ;
- la répartition réelle du podium (par exemple 600 k$, 340 k$ et 220 k$ en LoL), le reste étant dégressif ;
- les dotations du Club Championship (7 M$, 5 M$, 4 M$… 650 k$ pour le 10e).

Le classement des structures affiche les points, les titres, les 2es et 3es places, les top 8 et la dotation. Les éditions jouées sont gardées dans un historique, et l'EWC 2026 réelle (classement des clubs et podiums par jeu) sert de référence. Les qualifications EWC ne rapportent plus de points au Club Championship.

**Jeux solo** : SF6, Tekken, Fatal Fury, échecs, StarCraft II, EA FC, TFT et Trackmania n'ont pas de banc. Chaque joueur sous contrat est titulaire et joue de son côté, sous les couleurs du club. Il a sa propre place dans la ligue du club et dans les tournois, et vos joueurs peuvent s'affronter. Un joueur recruté en cours de saison dispute tout de suite les tournois ; ses matchs de ligue commencent la saison suivante. Les résultats affichent aussi la place de vos autres engagés.

**Onglet EWC** : un onglet dédié dans le menu Jouer. Il contient :
- la dotation totale et le classement complet du Club Championship, avec le cashprize visé à chaque place ;
- les 24 tournois avec leur dotation et les gains des trois premières places ;
- le vainqueur de chaque tournoi, votre place, vos gains et vos points ;
- l'historique des éditions jouées et la référence de l'EWC 2026 réelle.

Un bandeau sur le tableau de bord pendant l'EWC et dans l'onglet Tournois y renvoie. Quand vous gagnez plusieurs titres la même semaine, la célébration les liste tous, avec leurs gains.

**Version Windows (.exe)** : le dossier `desktop/` empaquette le jeu avec Electron en un seul `EsportsManager.exe` portable, sans installation. Pour le refaire : `cd desktop && npm install && npm run build` ; le fichier arrive dans `desktop/dist/`. La sauvegarde est enregistrée sur l'ordinateur du joueur.

**Alertes de sponsors** : les clauses en danger n'encombrent plus le tableau de bord. Elles n'apparaissent que lorsque le verdict approche : les 6 dernières journées de ligue pour un objectif de classement, le dernier quart du contrat pour les fans ou un titre. Elles sont regroupées en une seule ligne (nombre de clauses, primes en jeu, objectifs principaux, votre place), et les rappels par mail sont regroupés en un seul message.

**12 nouvelles scènes (Liquipedia)** : Brawl Stars, Marvel Rivals, Wild Rift, World of Tanks, Heroes of the Storm, Hearthstone, Clash Royale, GeoGuessr, Age of Empires II, Warcraft III, StarCraft: Brood War et Super Smash Bros. Ultimate. Ces jeux ne sont pas à l'Esports World Cup. `tools/build_liquipedia.py` importe depuis l'API de Liquipedia :
- les vraies équipes et les vrais joueurs des grands tournois 2025-2026, par exemple Crazy Raccoon et HMBLE en Brawl Stars, Virtus.pro et NaVi en Marvel Rivals, Hera, Liereyy et TheViper en AoE, Happy en Warcraft III, Bisu et Larva en Brood War, MkLeo en Smash ;
- le calendrier S-Tier de 2026 et le palmarès 2025.

Les notes viennent des résultats : vainqueur, finaliste et nombre de grands tournois joués. En Heroes of the Storm, la scène se joue surtout entre sélections nationales : ses vrais joueurs sont des agents libres à recruter. Les pages lues sont mises en cache dans `tools/sources/liquipedia` (hors du dépôt). Liquipedia limite fortement les requêtes, le premier import est donc long.
