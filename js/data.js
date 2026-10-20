// =====================================================================
//  ESPORTS MANAGER — Base de données (saison 2025-26, approximative)
//  Les effectifs évoluent vite : modifiez librement ce fichier.
//  Format joueur : [pseudo, nationalité (ISO), note /100, âge]
//  L'ordre des joueurs suit l'ordre des rôles du jeu.
// =====================================================================

const GAMES = {
  lol:  { name: "League of Legends", short: "LoL",  icon: "⚔️", size: 5, roles: ["Top", "Jungle", "Mid", "ADC", "Support"], league: "LoL World Circuit", prize: 3000000, entry: 450000, mult: 1.0, color: "#c89b3c" },
  cs2:  { name: "Counter-Strike 2",  short: "CS2",  icon: "🔫", size: 5, roles: ["IGL", "AWP", "Entry", "Rifler", "Lurker"], league: "CS2 Pro League", prize: 2500000, entry: 350000, mult: 1.0, color: "#de9b35", rounds: 13 },
  val:  { name: "Valorant",          short: "VAL",  icon: "🎯", size: 5, roles: ["Duelliste", "Initiateur", "Contrôleur", "Sentinelle", "Flex"], league: "VCT Champions Tour", prize: 2000000, entry: 300000, mult: 0.9, color: "#ff4655", rounds: 13 },
  dota: { name: "Dota 2",            short: "DOTA", icon: "🛡️", size: 5, roles: ["Carry", "Mid", "Offlane", "Soft Sup", "Hard Sup"], league: "Dota Pro Circuit", prize: 3000000, entry: 350000, mult: 0.9, color: "#a72714" },
  rl:   { name: "Rocket League",     short: "RL",   icon: "🚗", size: 3, roles: ["Striker", "Playmaker", "Défenseur"], league: "RLCS", prize: 1000000, entry: 120000, mult: 0.6, color: "#0f7bff" },
  ow:   { name: "Overwatch 2",       short: "OW2",  icon: "🦾", size: 5, roles: ["Tank", "DPS", "DPS", "Support", "Support"], league: "OW Champions Series", prize: 800000, entry: 120000, mult: 0.6, color: "#f99e1a" },
  r6:   { name: "Rainbow Six Siege", short: "R6",   icon: "🧨", size: 5, roles: ["IGL", "Entry", "Flex", "Support", "Anchor"], league: "R6 Pro League", prize: 800000, entry: 120000, mult: 0.55, color: "#4a90d9", rounds: 7 },
  cod:  { name: "Call of Duty",      short: "COD",  icon: "💥", size: 4, roles: ["AR", "SMG", "SMG", "Flex"], league: "Call of Duty League", prize: 1000000, entry: 200000, mult: 0.7, color: "#5b8c3a" },
  apex: { name: "Apex Legends",      short: "APEX", icon: "🪂", size: 3, roles: ["IGL", "Fragger", "Support"], league: "ALGS", prize: 700000, entry: 100000, mult: 0.5, color: "#da292a" },
  fn:   { name: "Fortnite",          short: "FN",   icon: "🏗️", size: 1, roles: ["Solo"], league: "FNCS Solo", prize: 1500000, entry: 60000, mult: 0.6, color: "#9d4dbb" },
  fc:   { name: "EA Sports FC",      short: "FC",   icon: "⚽", size: 1, roles: ["Solo"], league: "FC Pro World", prize: 500000, entry: 40000, mult: 0.4, color: "#00d26a" },
  sf6:  { name: "Street Fighter 6",  short: "SF6",  icon: "🥊", size: 1, roles: ["Solo"], league: "Capcom Pro Tour", prize: 400000, entry: 30000, mult: 0.35, color: "#f2c200" },
  sc2:  { name: "StarCraft II",      short: "SC2",  icon: "👾", size: 1, roles: ["Solo"], league: "SC2 World Tour", prize: 300000, entry: 30000, mult: 0.35, color: "#00a8e8" },
  mlbb: { name: "Mobile Legends",    short: "MLBB", icon: "📱", size: 5, roles: ["EXP", "Jungle", "Mid", "Gold", "Roam"], league: "MLBB World League", prize: 800000, entry: 100000, mult: 0.6, color: "#2b6cff" },
  pubg: { name: "PUBG",              short: "PUBG", icon: "🍳", size: 4, roles: ["IGL", "Fragger", "Scout", "Support"], league: "PUBG Global Series", prize: 600000, entry: 80000, mult: 0.45, color: "#f2a900" },
};

// Clubs réels : fame (notoriété /100), divisions & effectifs
const CLUBS = [
  { id: "t1", name: "T1", tag: "T1", country: "KR", color: "#e2012d", fame: 95, rosters: {
    lol: [["Doran","KR",87,25],["Oner","KR",90,23],["Faker","KR",96,30],["Gumayusi","KR",91,24],["Keria","KR",94,23]] } },
  { id: "geng", name: "Gen.G", tag: "GEN", country: "KR", color: "#aa8a00", fame: 88, rosters: {
    lol: [["Kiin","KR",91,26],["Canyon","KR",92,24],["Chovy","KR",95,25],["Ruler","KR",93,27],["Duro","KR",85,23]],
    val: [["t3xture","KR",86,24],["Meteor","KR",84,25],["Karon","KR",83,23],["Lakia","KR",81,26],["Munchkin","KR",84,27]] } },
  { id: "hle", name: "Hanwha Life Esports", tag: "HLE", country: "KR", color: "#f37321", fame: 82, rosters: {
    lol: [["Zeus","KR",93,22],["Peanut","KR",88,28],["Zeka","KR",90,23],["Viper","KR",92,25],["Delight","KR",87,24]] } },
  { id: "blg", name: "Bilibili Gaming", tag: "BLG", country: "CN", color: "#00a1d6", fame: 80, rosters: {
    lol: [["Bin","CN",93,22],["Beichuan","CN",84,22],["Knight","CN",93,25],["Elk","CN",91,24],["ON","CN",85,22]] } },
  { id: "g2", name: "G2 Esports", tag: "G2", country: "DE", color: "#f40404", fame: 88, rosters: {
    lol: [["BrokenBlade","DE",86,26],["SkewMond","FR",84,21],["Caps","DK",90,26],["Hans Sama","FR",87,26],["Labrov","GR",82,24]],
    cs2: [["huNter-","BA",84,30],["malbsMd","GT",85,22],["HeavyGod","IL",84,23],["SunPayus","ES",82,26],["MATYS","SK",80,21]],
    val: [["valyn","US",83,24],["trent","US",86,22],["jawgemo","US",86,26],["leaf","US",84,22],["JonahP","CA",82,23]],
    rl:  [["Atomic","US",86,22],["BeastMode","US",86,22],["daniel","US",87,19]] } },
  { id: "fnatic", name: "Fnatic", tag: "FNC", country: "GB", color: "#ff5900", fame: 86, rosters: {
    lol: [["Oscarinin","ES",83,22],["Razork","ES",85,25],["Poby","KR",83,21],["Upset","DE",87,26],["Mikyx","SI",84,27]],
    val: [["Boaster","GB",84,30],["Chronicle","RU",88,23],["Alfajer","TR",87,20],["kaajak","PL",84,20],["crashies","US",83,27]] } },
  { id: "kc", name: "Karmine Corp", tag: "KC", country: "FR", color: "#0a8fd8", fame: 84, rosters: {
    lol: [["Canna","KR",85,25],["Yike","SE",84,24],["Vladi","GR",85,21],["Caliste","FR",86,19],["Targamas","BE",83,25]],
    rl:  [["Vatira","FR",91,19],["Atow","BE",88,22],["dralii","FR",87,20]] } },
  { id: "vitality", name: "Team Vitality", tag: "VIT", country: "FR", color: "#f5e600", fame: 87, rosters: {
    lol: [["Naak Nako","SE",80,22],["Lyncas","LT",81,21],["Humanoid","CZ",85,25],["Carzzy","CZ",82,23],["Fleshy","PL",79,21]],
    cs2: [["apEX","FR",85,33],["ZywOo","FR",97,25],["flameZ","IL",88,22],["mezii","GB",86,27],["ropz","EE",92,26]],
    rl:  [["Zen","FR",93,19],["Alpha54","FR",88,24],["Radosin","FR",86,23]] } },
  { id: "liquid", name: "Team Liquid", tag: "TL", country: "NL", color: "#0c2340", fame: 85, rosters: {
    lol:  [["Impact","KR",82,30],["UmTi","KR",80,26],["APA","US",82,22],["Yeon","US",83,23],["CoreJJ","KR",85,31]],
    dota: [["miCKe","SE",89,26],["Nisha","PL",91,25],["33","IL",88,27],["Boxi","SE",86,27],["Insania","SE",87,29]] } },
  { id: "navi", name: "Natus Vincere", tag: "NAVI", country: "UA", color: "#ffe500", fame: 85, rosters: {
    cs2: [["Aleksib","FI",86,28],["iM","RO",87,23],["b1t","UA",88,22],["jL","LT",89,25],["w0nderful","UA",89,21]] } },
  { id: "faze", name: "FaZe Clan", tag: "FAZE", country: "US", color: "#e43d30", fame: 84, rosters: {
    cs2: [["karrigan","DK",83,35],["rain","NO",84,31],["broky","LV",87,24],["frozen","SK",87,23],["EliGE","US",85,28]],
    cod: [["Simp","US",90,24],["aBeZy","US",89,25],["Cellium","US",88,24],["Drazah","US",87,22]] } },
  { id: "spirit", name: "Team Spirit", tag: "TS", country: "RS", color: "#9aa5b1", fame: 83, rosters: {
    cs2:  [["chopper","RU",84,28],["donk","RU",96,19],["sh1ro","RU",91,24],["zont1x","UA",85,22],["tN1R","RU",84,23]],
    dota: [["Yatoro","UA",93,22],["Larl","RU",89,22],["Collapse","RU",92,24],["rue","RU",85,22],["Miposhka","RU",88,30]] } },
  { id: "mouz", name: "MOUZ", tag: "MOUZ", country: "DE", color: "#e3001b", fame: 76, rosters: {
    cs2: [["Brollan","SE",84,23],["torzsi","HU",88,23],["Jimpphat","FI",86,19],["xertioN","IL",87,22],["Spinx","IL",86,25]] } },
  { id: "falcons", name: "Team Falcons", tag: "FLC", country: "SA", color: "#00a650", fame: 86, rosters: {
    cs2:  [["NiKo","BA",92,28],["m0NESY","RU",94,20],["kyxsan","MK",82,28],["TeSeS","DK",84,25],["Magisk","DK",83,27]],
    dota: [["skiter","SK",91,26],["Malr1ne","KZ",91,21],["ATF","JO",89,21],["Cr1t-","DK",86,29],["Sneyking","US",85,30]],
    rl:   [["trk511","SA",89,20],["Kiileerrz","FR",88,20],["Rw9","SA",88,22]] } },
  { id: "aurora", name: "Aurora Gaming", tag: "AUR", country: "RS", color: "#7b2ff7", fame: 70, rosters: {
    cs2: [["XANTARES","TR",86,30],["woxic","TR",85,27],["MAJ3R","TR",80,34],["Wicadia","TR",84,19],["jottAAA","TR",83,20]] } },
  { id: "mongolz", name: "The MongolZ", tag: "MNG", country: "MN", color: "#d4af37", fame: 74, rosters: {
    cs2: [["bLitz","MN",84,26],["Techno4K","MN",85,23],["910","MN",87,23],["mzinho","MN",86,19],["Senzu","MN",85,20]] } },
  { id: "sentinels", name: "Sentinels", tag: "SEN", country: "US", color: "#ce0037", fame: 80, rosters: {
    val: [["zekken","US",87,21],["johnqt","MA",84,26],["N4RRATE","US",85,21],["Zellsis","US",83,27],["Sacy","BR",83,28]] } },
  { id: "prx", name: "Paper Rex", tag: "PRX", country: "SG", color: "#ff3f7f", fame: 78, rosters: {
    val: [["f0rsakeN","ID",88,21],["something","RU",88,23],["d4v41","MY",85,26],["Jinggg","SG",86,22],["mindfreak","ID",82,26]] } },
  { id: "heretics", name: "Team Heretics", tag: "TH", country: "ES", color: "#ffd100", fame: 78, rosters: {
    val: [["Boo","LT",84,26],["MiniBoo","LT",88,20],["RieNs","TR",84,22],["benjyfishy","GB",85,21],["Wo0t","TR",87,20]] } },
  { id: "edg", name: "EDward Gaming", tag: "EDG", country: "CN", color: "#1f1f1f", fame: 75, rosters: {
    val: [["CHICHOO","CN",85,24],["ZmjjKK","CN",89,21],["nobody","CN",83,27],["Smoggy","CN",82,23],["S1Mon","CN",83,24]] } },
  { id: "100t", name: "100 Thieves", tag: "100T", country: "US", color: "#e00000", fame: 76, rosters: {
    val: [["Asuna","US",84,22],["Cryocells","US",85,23],["bang","US",82,22],["Boostio","US",81,25],["eeiu","US",83,22]] } },
  { id: "koi", name: "Movistar KOI", tag: "MKOI", country: "ES", color: "#6a1b9a", fame: 74, rosters: {
    lol: [["Myrwn","ES",82,21],["Elyoya","ES",85,25],["Jojopyun","CA",85,21],["Supa","ES",83,22],["Alvaro","ES",82,23]] } },
  { id: "c9", name: "Cloud9", tag: "C9", country: "US", color: "#00aeef", fame: 77, rosters: {
    lol: [["Thanatos","KR",83,21],["Blaber","US",84,26],["Quid","KR",83,22],["Zven","DK",83,29],["Vulcan","CA",84,27]] } },
  { id: "bds", name: "Team BDS", tag: "BDS", country: "CH", color: "#ff2d6f", fame: 70, rosters: {
    lol: [["Adam","FR",80,23],["Sheo","FR",80,23],["nuc","FR",82,24],["Ice","KR",81,22],["Parus","TR",79,22]],
    rl:  [["M0nkey M00n","FR",87,23],["Seikoo","FR",86,21],["Extra","FR",84,21]] } },
  { id: "gg", name: "Gaimin Gladiators", tag: "GG", country: "GB", color: "#ff6b00", fame: 70, rosters: {
    dota: [["dyrachyo","RU",88,26],["Quinn","US",87,25],["Ace","DK",86,30],["tOfu","DE",85,29],["Seleri","DE",84,29]] } },
  { id: "betboom", name: "BetBoom Team", tag: "BB", country: "RU", color: "#ff1e56", fame: 68, rosters: {
    dota: [["Pure","RU",89,21],["gpk","RU",89,24],["MieRo","RU",85,25],["Save-","MD",86,28],["Kataomi","RU",83,24]] } },
  { id: "xg", name: "Xtreme Gaming", tag: "XG", country: "CN", color: "#ffcc00", fame: 72, rosters: {
    dota: [["Ame","CN",89,28],["Xm","CN",87,24],["Xxs","CN",86,26],["XinQ","CN",88,27],["xNova","MY",85,28]] } },
  { id: "optic", name: "OpTic Gaming", tag: "OPTC", country: "US", color: "#92c83e", fame: 78, rosters: {
    cod: [["Shotzzy","US",91,24],["Dashy","CA",89,25],["Pred","AU",89,23],["Kenny","US",87,24]] } },
  { id: "gentlemates", name: "Gentle Mates", tag: "M8", country: "FR", color: "#e5007e", fame: 65, rosters: {
    rl: [["Rise","GB",85,23],["juicy","FR",84,20],["ExoTiiK","FR",84,24]] } },
];

// Joueurs réels libres (agents libres / retraités en reprise / joueurs sans club modélisé)
const FREE_AGENTS = {
  lol:  [["ShowMaker","KR",89,25],["Deft","KR",88,29],["Uzi","CN",85,28],["Perkz","HR",84,27],["Bwipo","BE",84,26],["Rekkles","SE",80,29],["Jankos","PL",80,30],["Doublelift","US",76,32]],
  cs2:  [["s1mple","UA",89,28],["device","DK",86,30],["Twistzz","CA",87,26],["electroNic","RU",84,27],["Jame","RU",84,27],["shox","FR",79,33],["kennyS","FR",78,30],["ScreaM","BE",80,31],["Ex3rcice","FR",81,24]],
  val:  [["aspas","BR",90,23],["Derke","FI",88,23],["Demon1","US",87,23],["TenZ","CA",82,25],["ScreaM","BE",80,31],["Nats","RU",86,25],["Less","BR",85,20],["Sayf","SE",85,25]],
  dota: [["Topson","FI",87,27],["Ceb","FR",82,33],["N0tail","DK",80,32],["Puppey","EE",80,35],["Ana","AU",86,26],["Arteezy","CA",85,29]],
  rl:   [["Kaydop","FR",85,27],["Fairy Peak","FR",83,27],["jstn","US",84,25],["SquishyMuffinz","CA",82,26]],
  ow:   [["Proper","KR",92,22],["Hanbin","KR",90,25],["Fielder","KR",89,24],["Viol2t","KR",88,25],["LIP","KR",89,24],["Shu","KR",87,27],["Profit","KR",85,28],["Fleta","KR",86,27],["ChiYo","KR",87,24],["Fearless","KR",85,26],["Kevster","SE",84,25]],
  r6:   [["Shaiiko","FR",88,25],["BriD","FR",84,27],["Beaulo","CA",85,24],["Pengu","DK",82,29],["Nesk","BR",86,24],["Kantoraketti","FI",85,26],["Paluh","BR",85,26],["Jstn","US",84,26]],
  cod:  [["HyDra","FR",87,24],["Ghosty","US",85,24],["Kremp","US",84,26],["Abuzah","US",86,23],["Crimsix","US",82,31],["Scump","US",80,30]],
  apex: [["ImperialHal","US",89,26],["Genburten","CA",88,24],["Hakis","SE",86,23],["Sweet","US",86,25],["Verhulst","US",84,24],["Reps","US",85,26],["Zer0","US",83,27],["Dropped","US",84,27]],
  fn:   [["Peterbot","US",93,18],["Pollo","US",90,17],["Queasy","SI",88,20],["Malibuca","HR",87,19],["Veno","GB",87,19],["Bugha","US",86,23],["MrSavage","NO",86,21],["Clix","US",85,21],["Mongraal","GB",83,21]],
  fc:   [["Anders Vejrgang","DK",92,20],["Tekkz","GB",88,25],["ManuBachoore","NL",87,28],["PHzin","BR",87,22],["Umut","DE",86,26]],
  sf6:  [["MenaRD","DO",91,27],["Kakeru","JP",89,24],["Kawano","JP",89,25],["Punk","US",89,26],["Xiaohai","CN",87,31],["Angrybird","AE",87,35],["Tokido","JP",86,40],["Problem X","GB",86,31],["Daigo","JP",85,44],["Phenom","NO",85,33]],
  sc2:  [["Serral","FI",95,27],["Clem","FR",93,23],["Maru","KR",92,28],["Reynor","IT",91,23],["herO","KR",90,31],["Dark","KR",89,30],["MaxPax","DK",89,21],["Oliveira","CN",87,25]],
  mlbb: [["Kairi","PH",90,21],["OhMyV33nus","PH",88,27],["Sanz","ID",86,23],["Butsss","ID",85,24],["Lemon","ID",84,27]],
  pubg: [["TGLTN","AU",88,26],["Pio","KR",87,26],["Inonix","KR",86,26],["Fexx","DE",84,25]],
};

// Clubs fictifs pour compléter les circuits
const FILLER_CLUBS = [
  ["Nebula Esports","NEB","#6c5ce7","FR"],["Iron Wolves","IRW","#636e72","DE"],["Crimson Owls","CRO","#d63031","GB"],
  ["Polar Gaming","PLR","#74b9ff","SE"],["Atlas Esports","ATL","#00b894","US"],["Vortex Club","VTX","#e17055","ES"],
  ["Solar Kings","SOL","#fdcb6e","BR"],["Shadow Foxes","SFX","#2d3436","JP"],["Neon Tigers","NEO","#fd79a8","KR"],
  ["Titan Squad","TTN","#0984e3","CA"],["Blue Hydra","HYD","#00cec9","IT"],["Rogue Pixels","RGP","#a29bfe","PL"],
  ["Desert Lions","DSL","#e1b12c","MA"],["Sakura Spirit","SKR","#ff9ff3","JP"],["Andes Condors","AND","#10ac84","AR"],
  ["Viking Raiders","VKR","#576574","NO"],["Golden Dragons","GDR","#feca57","CN"],["Savanna Kings","SVK","#ee5253","SN"],
];

const COUNTRIES = {
  FR:"France", BE:"Belgique", CH:"Suisse", CA:"Canada", US:"États-Unis", GB:"Royaume-Uni", DE:"Allemagne", ES:"Espagne",
  IT:"Italie", PT:"Portugal", NL:"Pays-Bas", KR:"Corée du Sud", CN:"Chine", JP:"Japon", BR:"Brésil", AR:"Argentine",
  MA:"Maroc", DZ:"Algérie", TN:"Tunisie", SN:"Sénégal", CI:"Côte d'Ivoire", SA:"Arabie saoudite", AE:"Émirats arabes unis",
  PL:"Pologne", SE:"Suède", DK:"Danemark", NO:"Norvège", FI:"Finlande", UA:"Ukraine", RU:"Russie", TR:"Turquie",
};

// Syllabes pour générer des pseudos réalistes
const NAME_PARTS = {
  a: ["zen","kai","rex","nova","blitz","vex","lynx","fury","zero","ace","myth","sky","drak","jin","ryu","volt","echo","flux","grim","haze",
      "kyro","mako","nyx","orb","pyro","quill","rift","sly","tox","vyn","wrath","xeno","yuki","zap","bolt","cypher","dusk","ember","frost","glitch",
      "hex","ion","jolt","karma","lumen","mira","nero","onyx","prism","raze","sage","talon","umbra","viper","wisp","zed","astro","bane","crux"],
  b: ["", "", "", "x", "0", "z", "y", "er", "ix", "99", "on", "ka", "o", "i", "7", "us", "ie", "an"],
};
