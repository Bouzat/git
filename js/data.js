// =====================================================================
//  ESPORTS MANAGER — Base de données
//  Effectifs 2026 recoupés dans la presse esport (Worlds, Majors, TI, Champions,
//  FNCS…) quand c'était possible ; les autres sont établis de mémoire.
//  Format joueur : [pseudo, nationalité (ISO), note /100, âge]
//  L'ordre des joueurs suit l'ordre des rôles du jeu.
// =====================================================================

// version de js/data_live.js attendue (voir LIVE_FORMAT dans tools/build_live.py)
const LIVE_EXPECTED = 5;

// fmt : "team" (séries BO3/BO5), "br" (battle royale en lobby), "duel" (1 contre 1)
const GAMES = {
  lol:  { name: "League of Legends", short: "LoL",  icon: "⚔️", fmt: "team", size: 5, roles: ["Top", "Jungle", "Mid", "ADC", "Support"], prize: 3000000, mult: 1.0, color: "#c89b3c",
          tiers: ["LoL Elite (LCK · LPL · LEC · LTA)", "Ligues régionales (LFL · Prime League · LCK CL · ERL)", "Open Tour (scène amateur)"] },
  cs2:  { name: "Counter-Strike 2",  short: "CS2",  icon: "🔫", fmt: "team", size: 5, tierSizes: [16, 32], roles: ["IGL", "AWP", "Entry", "Rifler", "Lurker"], prize: 2500000, mult: 1.0, color: "#de9b35", rounds: 13,
          tiers: ["Circuit Majors (BLAST · IEM · ESL Pro League)", "ESL Challenger · CCT · European Pro League", "ESEA Open · FACEIT Cups"] },
  val:  { name: "Valorant",          short: "VAL",  icon: "🎯", fmt: "team", size: 5, tierSizes: [16, 32], roles: ["Duelliste", "Initiateur", "Contrôleur", "Sentinelle", "Flex"], prize: 2000000, mult: 0.9, color: "#ff4655", rounds: 13,
          tiers: ["VCT International (EMEA · Pacific · Americas · China)", "VCT Challengers", "Premier · Open Cups"] },
  // circuit féminin et marginalisé de Riot, séparé de la VCT : ses propres équipes (souvent la section GC d'une organisation), ligues et tournois
  valgc: { name: "Valorant Game Changers", short: "VAL GC", icon: "💜", fmt: "team", size: 5, tierSizes: [12, 24], roles: ["Duelliste", "Initiateur", "Contrôleur", "Sentinelle", "Flex"], prize: 500000, mult: 0.45, color: "#c56cf0", rounds: 13,
          tiers: ["Game Changers — élite (Championship)", "Game Changers régionaux (EMEA · NA · Brésil · Pacifique)", "Game Changers Academy · Open"] },
  dota: { name: "Dota 2",            short: "DOTA", icon: "🛡️", fmt: "team", size: 5, roles: ["Carry", "Mid", "Offlane", "Soft Sup", "Hard Sup"], prize: 3000000, mult: 0.9, color: "#a72714",
          tiers: ["The International · Riyadh Masters · PGL", "DreamLeague Division 2 · CCT Dota", "Open Qualifiers"] },
  rl:   { name: "Rocket League",     short: "RL",   icon: "🚗", fmt: "team", size: 3, tierSizes: [16, 32], roles: ["Striker", "Playmaker", "Défenseur"], prize: 1000000, mult: 0.6, color: "#0f7bff",
          tiers: ["RLCS Majors", "RLCS Open Regionals", "Ranked Cups 3v3"] },
  ow:   { name: "Overwatch 2",       short: "OW2",  icon: "🦾", fmt: "team", size: 5, roles: ["Tank", "DPS", "DPS", "Support", "Support"], prize: 800000, mult: 0.6, color: "#f99e1a",
          tiers: ["OWCS World Finals", "OWCS Regional Open", "Open Cups"] },
  r6:   { name: "Rainbow Six Siege", short: "R6",   icon: "🧨", fmt: "team", size: 5, roles: ["IGL", "Entry", "Flex", "Support", "Anchor"], prize: 800000, mult: 0.55, color: "#4a90d9", rounds: 7,
          tiers: ["Six Invitational · Majors", "Regional League Challenger", "Open Cups"] },
  cod:  { name: "Call of Duty",      short: "COD",  icon: "💥", fmt: "team", size: 4, roles: ["AR", "SMG", "SMG", "Flex"], prize: 1000000, mult: 0.7, color: "#5b8c3a",
          tiers: ["Call of Duty League (CDL)", "CoD Challengers", "Amateur Cups"] },
  mlbb: { name: "Mobile Legends",    short: "MLBB", icon: "📱", fmt: "team", size: 5, roles: ["EXP", "Jungle", "Mid", "Gold", "Roam"], prize: 800000, mult: 0.6, color: "#2b6cff",
          tiers: ["MPL · M-Series World Championship", "MDL (Development League)", "Open Cups"] },
  fn:   { name: "Fortnite",          short: "FN",   icon: "🏗️", fmt: "br", size: 2, lobby: 50, gamesPerWeek: 4, tierSizes: [20, 60], roles: ["Fragger", "IGL"], prize: 1500000, mult: 0.6, color: "#9d4dbb", unit: "duo",
          // circuit ouvert : une seule compétition (FNCS) pour tous les duos ; le « tier » d'un club n'est plus qu'un statut
          // (Élite = top 20, Pro = top 80, Open = le reste) recalculé chaque saison d'après son classement
          open: true, circuit: "FNCS — circuit ouvert", statuses: ["Élite", "Pro", "Open"],
          // la FNCS alterne les formats : duos les années paires (2026), trios les années impaires (2027)
          formats: { even: { size: 2, unit: "duo", lobby: 50 }, odd: { size: 3, unit: "trio", lobby: 33 } },
          tiers: ["FNCS — statut Élite", "FNCS — statut Pro", "FNCS — statut Open"] },
  apex: { name: "Apex Legends",      short: "APEX", icon: "🪂", fmt: "br", size: 3, lobby: 20, gamesPerWeek: 4, roles: ["IGL", "Fragger", "Support"], prize: 700000, mult: 0.5, color: "#da292a", unit: "trio",
          tiers: ["ALGS Pro League", "ALGS Challenger Circuit", "Online Tournaments"] },
  pubg: { name: "PUBG",              short: "PUBG", icon: "🍳", fmt: "br", size: 4, lobby: 16, gamesPerWeek: 4, roles: ["IGL", "Fragger", "Scout", "Support"], prize: 600000, mult: 0.45, color: "#f2a900", unit: "squad",
          tiers: ["PUBG Global Series · PGC", "PUBG Nations · Regional Series", "Open Scrims"] },
  fc:   { name: "EA Sports FC",      short: "FC",   icon: "⚽", fmt: "duel", size: 1, roles: ["Solo"], prize: 500000, mult: 0.4, color: "#00d26a",
          tiers: ["FC Pro World Championship", "FC Pro Open · eLigue 1", "FUT Champions Cups"] },
  sf6:  { name: "Street Fighter 6",  short: "SF6",  icon: "🥊", fmt: "duel", size: 1, roles: ["Solo"], prize: 400000, mult: 0.35, color: "#f2c200",
          tiers: ["Capcom Cup · EVO", "Capcom Pro Tour Premier", "Online Locals"] },
  sc2:  { name: "StarCraft II",      short: "SC2",  icon: "👾", fmt: "duel", size: 1, roles: ["Solo"], prize: 300000, mult: 0.35, color: "#00a8e8",
          tiers: ["IEM Katowice · World Tour", "ESL Masters", "Weekly Cups"] },
  // ---- jeux ajoutés pour couvrir les 24 titres de l'Esports World Cup 2026 ----
  hok:  { name: "Honor of Kings",    short: "HOK",  icon: "👑", fmt: "team", size: 5, roles: ["Clash", "Jungle", "Mid", "Farm", "Roam"], prize: 2500000, mult: 0.7, color: "#e8b04b",
          tiers: ["KPL · Honor of Kings World Cup", "KPL Development League", "Open Cups"] },
  cf:   { name: "Crossfire",         short: "CF",   icon: "🪖", fmt: "team", size: 5, roles: ["IGL", "Sniper", "Entry", "Rifler", "Support"], prize: 1000000, mult: 0.4, color: "#c0392b", rounds: 11,
          tiers: ["CFS Grand Finals", "CF Pro League", "Open Cups"] },
  // la scène pro (World Series of Warzone, EWC) se joue en trios
  wz:   { name: "Call of Duty: Warzone", short: "WZ", icon: "🪂", fmt: "br", size: 3, lobby: 50, gamesPerWeek: 4, roles: ["IGL", "Fragger", "Support"], prize: 1000000, mult: 0.45, color: "#6b8e23", unit: "trio",
          tiers: ["Warzone World Series", "Warzone Pro Circuit", "Kill Race Cups"] },
  pubgm:{ name: "PUBG Mobile",       short: "PUBGM", icon: "📲", fmt: "br", size: 4, lobby: 16, gamesPerWeek: 4, roles: ["IGL", "Fragger", "Assaulter", "Support"], prize: 2000000, mult: 0.5, color: "#f4b400", unit: "squad",
          tiers: ["PMGC · PMWC", "PUBG Mobile Super League", "Open Cups"] },
  ff:   { name: "Free Fire",         short: "FF",   icon: "🔥", fmt: "br", size: 4, lobby: 12, gamesPerWeek: 4, roles: ["IGL", "Rusher", "Sniper", "Support"], prize: 1000000, mult: 0.4, color: "#ff7a00", unit: "squad",
          tiers: ["Free Fire World Series", "FFWS régionales", "Open Cups"] },
  tft:  { name: "Teamfight Tactics", short: "TFT",  icon: "♟️", fmt: "br", size: 1, tierSizes: [16, 32], lobby: 8, gamesPerWeek: 4, roles: ["Solo"], prize: 500000, mult: 0.3, color: "#5ab0ff", unit: "joueur",
          tiers: ["TFT Open · Worlds", "Tactician's Cup", "Ranked Cups"] },
  trackmania: { name: "Trackmania",  short: "TM",   icon: "🏎️", fmt: "br", size: 1, lobby: 16, gamesPerWeek: 4, roles: ["Pilote"], prize: 500000, mult: 0.25, color: "#00c896", unit: "pilote",
          tiers: ["Trackmania World Cup", "Trackmania Grand League", "Cup of the Day"] },
  tk8:  { name: "Tekken 8",          short: "TK8",  icon: "🥋", fmt: "duel", size: 1, roles: ["Solo"], prize: 1000000, mult: 0.35, color: "#b03a2e",
          tiers: ["Tekken World Tour Finals · EVO", "TWT Challenger", "Online Locals"] },
  fatal:{ name: "Fatal Fury: City of the Wolves", short: "FATAL", icon: "🐺", fmt: "duel", size: 1, roles: ["Solo"], prize: 500000, mult: 0.25, color: "#d35400",
          tiers: ["SNK World Championship", "SNK Pro Tour", "Online Locals"] },
  chess:{ name: "Échecs",            short: "CHESS", icon: "♞", fmt: "duel", size: 1, roles: ["Joueur"], prize: 1500000, mult: 0.4, color: "#bfa76a",
          tiers: ["Champions Chess Tour Finals", "Champions Chess Tour (Division I-II)", "Titled Tuesday"] },
};

// Organisations réelles : [nom, tag, pays, couleur, notoriété /100]
const ORGS = {
  t1: ["T1", "T1", "KR", "#e2012d", 95], geng: ["Gen.G", "GEN", "KR", "#aa8a00", 88], hle: ["Hanwha Life Esports", "HLE", "KR", "#f37321", 82],
  dk: ["Dplus KIA", "DK", "KR", "#1d1d1b", 78], kt: ["KT Rolster", "KT", "KR", "#e4002b", 74], drx: ["DRX", "DRX", "KR", "#5a8dee", 70],
  ns: ["Nongshim RedForce", "NS", "KR", "#de2027", 60], bfx: ["BNK FearX", "BFX", "KR", "#f5a623", 58],
  blg: ["Bilibili Gaming", "BLG", "CN", "#00a1d6", 80], tes: ["Top Esports", "TES", "CN", "#ff4a1c", 76], al: ["AG.AL (Anyone's Legend)", "AGAL", "CN", "#c7a76c", 80],
  jdg: ["JD Gaming", "JDG", "CN", "#c8102e", 74], wbg: ["Weibo Gaming", "WBG", "CN", "#e6162d", 68], edg: ["EDward Gaming", "EDG", "CN", "#6b6b6b", 75],
  xg: ["Xtreme Gaming", "XG", "CN", "#ffcc00", 70],
  g2: ["G2 Esports", "G2", "DE", "#f40404", 88], fnatic: ["Fnatic", "FNC", "GB", "#ff5900", 86], kc: ["Karmine Corp", "KC", "FR", "#0a8fd8", 84],
  vitality: ["Team Vitality", "VIT", "FR", "#f5e600", 87], koi: ["Movistar KOI", "MKOI", "ES", "#6a1b9a", 74], bds: ["Team BDS", "BDS", "CH", "#ff2d6f", 68],
  gx: ["GIANTX", "GX", "ES", "#ffd400", 60], heretics: ["Team Heretics", "TH", "ES", "#ffd100", 78], m8: ["Gentle Mates", "M8", "FR", "#e5007e", 66],
  mouz: ["MOUZ", "MOUZ", "DE", "#e3001b", 76], navi: ["Natus Vincere", "NAVI", "UA", "#ffe500", 85], spirit: ["Team Spirit", "TS", "RS", "#9aa5b1", 83],
  aurora: ["Aurora Gaming", "AUR", "RS", "#7b2ff7", 70], vp: ["Virtus.pro", "VP", "RU", "#ff6a13", 72], betboom: ["BetBoom Team", "BB", "RU", "#ff1e56", 66],
  parivision: ["PARIVISION", "PARI", "RU", "#00c2ff", 58], astralis: ["Astralis", "AST", "DK", "#e30613", 74], heroic: ["HEROIC", "HERO", "DK", "#ff4f00", 64],
  gl: ["GamerLegion", "GL", "DE", "#00ff9c", 58], big: ["BIG", "BIG", "DE", "#00a3e0", 56], b8: ["B8", "B8", "UA", "#ffd200", 52], tdm: ["3DMAX", "3DMAX", "FR", "#00e1ff", 58],
  falcons: ["Team Falcons", "FLC", "SA", "#00a650", 86], liquid: ["Team Liquid", "TL", "NL", "#0c2340", 85], faze: ["FaZe Clan", "FAZE", "US", "#e43d30", 82],
  c9: ["Cloud9", "C9", "US", "#00aeef", 76], sentinels: ["Sentinels", "SEN", "US", "#ce0037", 80], nrg: ["NRG", "NRG", "US", "#ff6b00", 74],
  "100t": ["100 Thieves", "100T", "US", "#e00000", 76], optic: ["OpTic Gaming", "OPTC", "US", "#92c83e", 78], fly: ["FlyQuest", "FLY", "US", "#0f9d58", 66],
  tsm: ["TSM", "TSM", "US", "#e6e6e6", 66], furia: ["FURIA", "FUR", "BR", "#bfbfbf", 72], loud: ["LOUD", "LOUD", "BR", "#13ff00", 72],
  pain: ["paiN Gaming", "PNG", "BR", "#ff0033", 66], mibr: ["MIBR", "MIBR", "BR", "#ffffff", 64], w7m: ["w7m esports", "W7M", "BR", "#0045ff", 58],
  lev: ["Leviatán", "LEV", "AR", "#00b5e2", 62], prx: ["Paper Rex", "PRX", "SG", "#ff3f7f", 78], rrq: ["Rex Regum Qeon", "RRQ", "ID", "#ffb400", 66],
  onic: ["ONIC", "ONIC", "ID", "#fff200", 68], zeta: ["ZETA DIVISION", "ZETA", "JP", "#0a0a0a", 62], fut: ["FUT Esports", "FUT", "TR", "#e30a17", 58],
  mongolz: ["The MongolZ", "MNG", "MN", "#d4af37", 74], tm: ["Twisted Minds", "TWIS", "SA", "#7a4dff", 56], cr: ["Crazy Raccoon", "CR", "JP", "#ff3c3c", 62],
  nigma: ["Nigma Galaxy", "NGX", "AE", "#9b30ff", 60], gg: ["Gaimin Gladiators", "GG", "GB", "#ff6b00", 66], ssg: ["Spacestation Gaming", "SSG", "US", "#ffa800", 56],
  ultra: ["Toronto Ultra", "TOR", "CA", "#7c3aed", 60], breach: ["Boston Breach", "BOS", "US", "#00a651", 56], ravens: ["Carolina Royal Ravens", "CAR", "US", "#2b5cff", 54],
  nysl: ["New York Subliners", "NYSL", "US", "#ff5b00", 56], alliance: ["Alliance", "ALL", "SE", "#24292e", 58], dz: ["DarkZero Esports", "DZ", "US", "#8e44ad", 52],
  danawa: ["DN Freecs", "DNF", "KR", "#ff4f00", 52], s2: ["Soniqs", "SQ", "US", "#00c3ff", 48], echo: ["Team Liquid PH", "TLPH", "PH", "#0c2340", 60],
  blacklist: ["Blacklist International", "BLCK", "PH", "#222", 56],
  bigetron: ["Bigetron by Vitality", "BTR", "ID", "#f5e600", 66],
  ig: ["Invictus Gaming", "IG", "CN", "#c8102e", 72], lyon: ["LYON", "LYON", "US", "#1e90ff", 60], dnsoop: ["DN SOOPers", "DNS", "KR", "#ff4f00", 56],
  sk: ["SK Gaming", "SK", "DE", "#6e6e6e", 60], shifters: ["Shifters", "SHF", "FR", "#8a2be2", 54], tyloo: ["TYLOO", "TYL", "CN", "#e60012", 62],
  xlg: ["Xi Lai Gaming", "XLG", "CN", "#d4a017", 56], global: ["Global Esports", "GE", "IN", "#00a3ff", 52], bbl: ["BBL Esports", "BBL", "TR", "#111", 54],
  kru: ["KRÜ Esports", "KRU", "AR", "#ff2d87", 56], ironwing: ["Iron Wing (1w Team)", "1W", "GB", "#7a7a7a", 68], yandex: ["Team Yandex", "YDX", "RU", "#fc3f1d", 64],
  fuel: ["Dallas Fuel", "DAL", "US", "#0072ce", 60], surge: ["Vancouver Surge", "VAN", "CA", "#00b2a9", 52], hyperspirit: ["HYPERSPIRIT", "HYP", "RO", "#00e0ff", 50],
  mancity: ["Manchester City Esports", "MCI", "GB", "#6cabdd", 62], basilisk: ["BASILISK", "BSK", "NL", "#5b2d90", 52],
};

// Effectifs par jeu, du plus fort au moins fort.
// Les 12 premiers démarrent en tier 1, les 12 suivants en tier 2, le reste en tier 3.
// 3e élément à 1 = effectif vérifié dans des sources 2026 (Worlds, Majors, TI, Champions…).
// Âge = âge en 2026 d'après l'année de naissance connue ; 0 = âge inconnu (estimé au hasard).
const ROSTERS = {
  lol: [
    ["geng", [["Kiin","KR",91,27],["Canyon","KR",92,25],["Chovy","KR",95,25],["Ruler","KR",93,28],["Duro","KR",86,24]], 1],
    ["hle", [["Zeus","KR",93,22],["Kanavi","KR",90,26],["Zeka","KR",90,24],["Gumayusi","KR",91,24],["Delight","KR",88,24]], 1],
    ["t1", [["Doran","KR",88,26],["Oner","KR",90,24],["Faker","KR",95,30],["Peyz","KR",90,21],["Keria","KR",94,24]], 1],
    ["al", [["Breathe","CN",87,25],["Tarzan","KR",88,27],["Shanks","CN",87,25],["Hope","CN",87,26],["Kael","KR",86,24]], 1],
    ["blg", [["Bin","CN",93,23],["Xun","CN",86,25],["Knight","CN",92,26],["Viper","KR",92,26],["ON","CN",86,23]], 1],
    ["dk", [["Siwoo","KR",86,21],["Lucid","KR",87,21],["ShowMaker","KR",89,26],["Smash","KR",85,20],["Career","KR",84,21]], 1],
    ["tes", [["369","CN",88,25],["Tian","CN",87,26],["Creme","CN",87,23],["JackeyLove","CN",89,26],["Zhuo","CN",85,24]], 1],
    ["ig", [["TheShy","KR",87,26],["Wei","CN",87,23],["Rookie","KR",86,29],["JiaQi","CN",85,22],["Meiko","CN",86,28]], 1],
    ["g2", [["BrokenBlade","DE",86,26],["SkewMond","FR",85,22],["Caps","DK",90,27],["Hans Sama","FR",87,27],["Labrov","GR",83,24]], 1],
    ["koi", [["Myrwn","ES",83,22],["Elyoya","ES",86,26],["Jojopyun","CA",85,21],["Supa","ES",84,23],["Alvaro","ES",83,23]], 1],
    ["kc", [["Canna","KR",85,26],["Yike","SE",84,25],["kyeahoo","KR",84,0],["Caliste","FR",87,20],["Busio","US",83,22]], 1],
    ["liquid", [["Morgan","KR",82,26],["Josedeodo","AR",83,27],["Quid","KR",84,22],["Yeon","US",84,23],["CoreJJ","KR",85,32]], 1],
    ["lyon", [["Dhokla","US",81,27],["Inspired","PL",86,24],["Saint","KR",82,0],["Berserker","KR",86,23],["Isles","US",80,0]], 1],
    ["c9", [["Thanatos","KR",83,22],["Blaber","US",84,26],["Loki","KR",83,0],["Tactical","US",82,25],["Vulcan","CA",83,28]], 1],
    ["jdg", [["Xiaoxu","CN",84,0],["JunJia","CN",84,0],["HongQ","CN",84,0],["GALA","CN",87,25],["Vampire","CN",83,0]], 1],
    ["fnatic", [["Soboro","KR",82,0],["Razork","ES",85,26],["Vladi","GR",85,22],["Upset","DE",87,27],["Lospa","KR",82,0]], 1],
    ["dnsoop", [["DuDu","KR",83,25],["Pyosik","KR",84,26],["Clozer","KR",83,23],["deokdam","KR",85,26],["Peter","KR",83,25]], 1],
    ["vitality", [["Naak Nako","SE",81,23],["Lyncas","LT",81,22],["Humanoid","CZ",85,26],["Carzzy","CZ",83,24],["Fleshy","PL",80,22]], 1],
    ["navi", [["Maynter","RU",80,0],["Rhilech","ES",81,0],["Poby","KR",83,22],["Hans SamD","FR",80,0],["Parus","TR",80,23]], 1],
    ["heretics", [["Tracyn","PL",80,0],["Sheo","FR",81,24],["Serin","KR",81,0],["Ice","KR",82,23],["Stend","PL",79,0]], 1],
    ["gx", [["Lot","FR",80,24],["ISMA","ES",80,0],["Jackies","CZ",80,23],["Noah","KR",81,24],["Jun","KR",80,25]], 1],
    ["sk", [["Wunder","DK",81,28],["Skeanz","FR",80,0],["LIDER","PK",81,28],["Jopa","ES",80,0],["Mikyx","SI",83,28]], 1],
    ["shifters", [["Rooster","FR",79,0],["Boukada","FR",79,0],["nuc","FR",82,25],["Paduck","KR",80,0],["Trymbi","PL",81,26]], 1],
    ["fly", [["Gakgos","KR",79,0],["Gryffinn","US",79,0],["Quad","KR",83,24],["Massu","US",83,22],["Cryogen","US",79,0]], 1],
  ],
  cs2: [
    ["spirit", [["magixx","RU",84,23],["sh1ro","RU",91,25],["donk","RU",96,19],["zont1x","UA",85,23],["tN1R","RU",84,0]], 1],
    ["vitality", [["apEX","FR",85,33],["ZywOo","FR",97,26],["flameZ","IL",88,23],["mezii","GB",86,28],["ropz","EE",92,27]], 1],
    ["falcons", [["karrigan","DK",83,36],["m0NESY","RU",94,21],["NiKo","BA",92,29],["TeSeS","DK",84,26],["kyousuke","RU",85,0]], 1],
    ["mouz", [["PR","PT",82,0],["torzsi","HU",88,24],["xelex","SE",82,0],["xertioN","IL",87,23],["Spinx","IL",86,26]], 1],
    ["furia", [["FalleN","BR",80,35],["molodoy","KZ",85,0],["YEKINDAR","LV",86,27],["KSCERATO","BR",86,27],["yuurih","BR",85,27]], 1],
    ["aurora", [["kyxsan","MK",82,29],["woxic","TR",85,28],["XANTARES","TR",86,31],["Wicadia","TR",85,20],["Jimpphat","FI",86,20]], 1],
    ["navi", [["Aleksib","FI",86,29],["w0nderful","UA",89,22],["iM","RO",87,24],["makazze","UA",83,0],["b1t","UA",88,23]], 1],
    ["mongolz", [["bLitz","MN",84,0],["910","MN",87,0],["Techno4K","MN",85,0],["mzinho","MN",86,20],["cobrazera","MN",80,0]], 1],
    ["faze", [["Neityu","AU",80,0],["frozen","SK",87,24],["Twistzz","CA",87,27],["jcobbb","PL",83,0],["JBOEN","DK",80,0]], 1],
    ["g2", [["huNter-","BA",84,31],["MATYS","SK",81,0],["HeavyGod","IL",84,0],["NertZ","IL",83,0],["r1nkle","UA",82,0]], 1],
    ["parivision", [["Jame","RU",84,28],["xiELO","RU",82,0],["zweih","RU",83,0],["slaxejezzz","RU",80,0],["FL1T","RU",82,25]], 1],
    ["astralis", [["HooXi","DK",79,31],["phzy","SE",82,0],["ryu","BR",80,0],["jabbi","DK",83,23],["Staehr","DK",82,0]], 1],
    ["100t", [["rain","NO",81,32],["poiii","FR",80,0],["sirah","US",79,0],["Ag1l","PT",80,0],["fl0m","US",78,0]], 1],
    ["pain", [["biguzera","BR",80,0],["nqz","BR",82,0],["snow","BR",80,0],["lux","BR",78,0],["kauez","BR",78,0]]],
    ["mibr", [["exit","BR",79,0],["brnz4n","BR",80,0],["insani","BR",81,0],["saffee","BR",82,31],["Lucaozy","BR",80,0]]],
    ["tdm", [["Maka","FR",80,0],["Graviti","FR",82,0],["Lucky","FR",82,0],["Ex3rcice","FR",82,0],["bodyy","FR",79,0]]],
    ["gl", [["Snax","PL",77,33],["REZ","SE",81,29],["Tauson","DK",80,0],["ztr","SE",79,0]]],
    ["betboom", [["Boombl4","RU",79,28],["zorte","RU",79,0],["s1ren","RU",80,0],["Magnojez","RU",79,0],["d1Ledez","RU",78,0]]],
    ["big", [["tabseN","DE",80,32],["syrsoN","DE",80,0],["JDC","DE",79,0],["faven","DE",79,0],["Krimbo","DE",79,0]]],
    ["b8", [["npl","UA",78,0],["headtr1ck","UA",80,0],["kensizor","UA",79,0],["alex666","UA",78,0],["esenthial","UA",78,0]]],
  ],
  val: [
    ["vitality", [["Derke","FI",89,23],["Chronicle","RU",88,24],["PROFEK","PL",84,0],["Jamppi","FI",84,26],["Sayonara","RU",84,0]], 1],
    ["loud", [["Darker","BR",85,0],["DaviH","BR",84,0],["lukxo","BR",85,0],["erde","BR",84,0],["tkzin","BR",84,0]], 1],
    ["prx", [["something","RU",88,24],["f0rsakeN","ID",88,22],["d4v41","MY",85,26],["Jinggg","SG",86,23],["invy","SG",83,0]], 1],
    ["g2", [["trent","US",86,23],["valyn","US",83,25],["jawgemo","KH",86,27],["leaf","US",84,23],["BABYBAY","US",84,28]], 1],
    ["nrg", [["brawk","US",83,24],["Ethan","US",83,26],["keiko","GB",83,22],["mada","CA",85,22],["skuba","US",81,0]], 1],
    ["t1", [["iZu","KR",84,21],["stax","KR",83,26],["BuZz","KR",85,23],["Meteor","KR",85,24],["Munchkin","KR",84,27]], 1],
    ["100t", [["Asuna","US",84,23],["Cryocells","US",85,24],["bang","US",82,23],["Timotino","US",82,0],["vora","US",81,0]], 1],
    ["kc", [["N4RRATE","US",85,22],["dos9","KZ",82,0],["SUYGETSU","RU",83,0],["LewN","TR",81,0],["avez","EG",81,0]], 1],
    ["liquid", [["MiniBoo","LT",88,21],["nAts","RU",86,24],["kamo","PL",82,0],["purp0","RU",81,0],["wayne","RU",80,0]], 1],
    ["fut", [["MrFaliN","TR",82,0],["yetujey","TR",80,0],["baha","TR",81,0],["xeus","TR",82,0],["KROSTALY","TR",80,0]], 1],
    ["edg", [["ZmjjKK","CN",89,23],["CHICHOO","CN",85,0],["nobody","CN",83,0],["Smoggy","CN",82,0],["Jieni7","CN",81,0]], 1],
    ["tyloo", [["slowly","CN",81,0],["Erv","CN",80,0],["SiuFatBB","CN",81,0],["Scales","CN",80,0],["xihe","CN",80,0]], 1],
    ["jdg", [["jkuro","CN",79,0],["Yuicaw","CN",79,0],["zhe","CN",79,0],["stew","CN",79,0],["coconut","CN",78,0]], 1],
    ["xlg", [["NoMan","CN",79,0],["Rarga","CN",79,0],["WsLeo","CN",78,0],["Lysoar","CN",78,0],["happywei","CN",78,0]], 1],
    ["ns", [["Rb","KR",80,0],["Dambi","KR",80,0],["Francis","KR",79,0],["Ivy","KR",79,0],["Xross","KR",79,0]], 1],
    ["fnatic", [["Boaster","GB",83,31],["Alfajer","TR",87,21],["kaajak","PL",84,21],["crashies","US",82,28],["Veqaj","BE",80,0]], 1],
    ["heretics", [["Boo","LT",83,27],["RieNs","TR",83,0],["Wo0t","TR",86,21],["benjyfishy","GB",84,22],["ComeBack","TR",80,0]], 1],
    ["c9", [["Zellsis","US",82,28],["Xeppaa","US",82,0],["OXY","US",84,21],["v1c","US",81,0],["penny","US",80,0]], 1],
    ["mibr", [["aspas","BR",89,23],["Verno","BR",82,0],["Mazino","CL",82,0],["tex","BR",83,0],["zekken","US",86,21]], 1],
    ["geng", [["t3xture","KR",86,0],["Karon","KR",83,0],["Efina","KR",80,0],["Ash","KR",80,0],["Raxcal","KR",80,0]], 1],
    ["m8", [["starxo","PL",80,0],["Minny","CZ",80,0],["bipo","GB",79,0],["GLYPH","US",79,0],["marteen","CZ",80,0]], 1],
    ["gx", [["Cloud","RU",80,0],["westside","PL",79,0],["ara","RO",79,0],["Flickless","BE",80,0],["GRUBINHO","PL",79,0]], 1],
    ["global", [["Autumn","AU",79,0],["UdoTan","JP",79,0],["Kr1stal","KR",79,0],["xavi8k","PH",79,0],["PatMen","PH",79,0]], 1],
    ["bbl", [["Rosé","TR",78,0],["Crewen","TR",78,0],["Lar0k","TR",78,0],["Loita","TR",78,0],["lovers rock","TR",78,0]], 1],
    ["drx", [["MaKo","KR",84,0],["free1ng","KR",82,0],["BeYN","KR",81,0],["Hermes","KR",80,0],["HYUNMIN","KR",80,0]], 1],
    ["rrq", [["Jemkin","RU",84,0],["Monyet","ID",82,0],["xffero","ID",80,0],["Kushy","ID",79,0],["crazyguy","VN",81,0]], 1],
    ["blg", [["nephh","CN",79,0],["rushia","CN",79,0],["whzy","CN",80,0],["Knight","CN",79,0],["bud","CN",78,0]], 1],
    ["kru", [["Saadhak","AR",80,0],["Dantedeu5","AR",78,0],["Less","BR",84,0],["mwzera","BR",79,0],["silentzz","BR",78,0]]],
  ],
  dota: [
    ["spirit", [["Yatoro","UA",93,23],["Larl","RU",89,0],["Collapse","RU",92,24],["rue","RU",85,0],["panto","RU",84,0]], 1],
    ["parivision", [["Satanic","RU",89,0],["No[o]ne","UA",86,29],["Noticed","RU",85,0],["Dukalis","RU",85,0],["9Class","RU",84,0]], 1],
    ["falcons", [["skiter","SK",91,28],["Malr1ne","KZ",91,22],["ATF","JO",89,22],["Cr1t-","DK",86,30],["Sneyking","US",85,30]], 1],
    ["ironwing", [["Pure","RU",89,22],["bzm","CN",86,0],["33","IL",87,0],["Ari","SE",84,0],["Whitemon","ID",85,0]], 1],
    ["betboom", [["Kiritych","RU",85,0],["gpk","RU",89,25],["MieRo","RU",85,0],["Save-","MD",86,29],["Kataomi","RU",83,0]], 1],
    ["yandex", [["watson","RU",87,0],["CHIRA_JUNIOR","RU",84,0],["DM","RU",85,0],["Malady","RU",83,0],["Saksa","MK",83,0]], 1],
    ["xg", [["Ame","CN",89,29],["NothingToSay","MY",88,24],["Xxs","CN",85,0],["fy","CN",83,34],["xNova","MY",85,0]], 1],
    ["liquid", [["miCKe","SE",88,26],["Nisha","PL",90,26],["Ace","DK",85,30],["Boxi","SE",85,28],["tOfu","DE",84,29]], 1],
    ["aurora", [["Nightfall","RU",86,23],["Mikoto","RU",84,0],["Ws","RU",83,0],["Mira","UA",84,0],["kaori","RU",82,0]], 1],
  ],
  rl: [
    ["falcons", [["Rw9","SA",89,0],["Kiileerrz","FR",89,0],["dralii","FR",88,0]], 1],
    ["kc", [["Vatira","FR",91,0],["Atow","BE",88,0],["juicy","FR",86,0]], 1],
    ["nrg", [["Atomic","US",86,0],["BeastMode","US",86,0],["Daniel","US",87,0]], 1],
    ["vitality", [["zen","FR",93,0],["ExoTiiK","FR",85,0],["stizzy","FR",84,0]], 1],
    ["furia", [["yANXNZ","BR",85,0],["Lostt","BR",84,0],["drufinho","BR",84,0]]],
  ],
  ow: [
    ["cr", [["Mealgaru","KR",88,0],["Proper","KR",92,0],["Bernar","KR",87,0],["Shu","KR",87,0],["knife","KR",86,0]], 1],
    ["tm", [["JaeWoo","KR",86,0],["Quartz","KR",87,0],["Youbi","KR",86,0],["TVNT","KR",85,0],["KSAA","SA",84,0]], 1],
    ["fuel", [["Kronik","KR",85,0],["SeonJun","KR",86,0],["Kellan","US",84,0],["Cjay","KR",84,0],["Lukemino","US",83,0]], 1],
    ["vp", [["eisgnom","DE",84,0],["Seicoe","US",85,0],["FiXa","FI",84,0],["kevster","SE",84,0],["Landon","US",83,0]], 1],
  ],
  r6: [
    ["faze", [["Cyber","BR",86,0],["Handyy","BR",84,0],["KDS","BR",84,0],["VITAKING","BR",85,0],["soulz1","BR",85,0]], 1],
    ["g2", [["Stompn","GB",83,0],["Alem4o","BR",84,0],["Shaiiko","FR",87,0],["Benjamaster","ES",84,0],["Doki","GB",82,0]], 1],
  ],
  cod: [
    ["faze", [["Simp","US",90,0],["Abuzah","US",87,0],["Drazah","US",87,0],["04","US",85,0]], 1],
    ["optic", [["Shotzzy","US",91,0],["Dashy","CA",89,0],["Huke","US",85,0],["Mercules","US",85,0]], 1],
    ["100t", [["aBeZy","US",88,0],["HyDra","FR",88,0],["Nium","US",84,0],["Scrap","US",84,0]], 1],
    ["m8", [["Envoy","US",84,0],["Ghosty","US",85,0],["Neptune","US",83,0],["Sib","US",82,0]], 1],
    ["heretics", [["MettalZ","GB",85,0],["RenKoR","ES",84,0],["SupeR","ES",85,0],["ReeaL","GB",83,0]], 1],
    ["c9", [["Encourage","US",82,0],["Hide","US",82,0],["Nejra","US",81,0],["Wevy","US",81,0]], 1],
    ["breach", [["Purj","US",83,0],["Snoopy","US",83,0],["Nastie","US",82,0],["Cammy","GB",83,0]], 1],
    ["ravens", [["Craze","US",81,0],["SlasheR","US",80,0],["KnoX","US",80,0],["Lurqxx","US",80,0]], 1],
    ["surge", [["Gwinn","US",82,0],["Lunarz","US",80,0],["TJHaLy","US",80,0],["Lqgend","US",80,0]], 1],
  ],
  mlbb: [
    ["onic", [["Butsss","ID",86,0],["Kairi","PH",90,0],["Sanz","ID",86,0],["CW","ID",84,0],["Kiboy","ID",85,0]]],
    ["liquid", [["Sanford","PH",85,0],["KarlTzy","PH",88,0],["Sanji","PH",84,0],["Bennyqt","PH",85,0],["Jaypee","PH",84,0]]],
    ["rrq", [["Dyrennn","ID",83,0],["Sutsujin","ID",84,0],["Clayyy","ID",83,0],["Skylar","ID",85,0],["Idok","ID",83,0]]],
    ["blacklist", [["Edward","PH",82,0],["Wise","PH",84,0],["OhMyV33nus","PH",87,0],["Hadji","PH",82,0],["Oheb","PH",83,0]]],
  ],
  apex: [
    ["tsm", [["ImperialHal","US",89,0],["Verhulst","US",84,0],["Reps","US",85,0]]],
    ["alliance", [["Hakis","SE",86,0],["Effect","SE",82,0],["Uxako","SE",81,0]]],
    ["dz", [["Zaine","US",82,0],["Xynew","US",82,0],["Hardecki","US",81,0]]],
  ],
  pubg: [
    ["tm", [["BatulinS","RU",85,0],["Perfect1ks","RU",84,0],["xmpl","RU",84,0],["Lu","CN",83,0]], 1],
    ["danawa", [["Pio","KR",86,0],["Inonix","KR",85,0],["Loki","KR",82,0],["Taemin","KR",81,0]]],
    ["s2", [["TGLTN","AU",87,0],["Shrimzy","US",82,0],["Kickstart","US",82,0],["Hwinn","US",82,0]]],
  ],
};

// Divisions réelles dont l'effectif exact n'a pas pu être vérifié : le jeu les crée avec des joueurs inventés
// (signalés « joueurs inventés » dans la fiche du club). Sources : pages Wikipedia/Liquipedia des organisations,
// classement du Club Championship EWC 2026.
const EXTRA_DIVS = {
  falcons:  ["apex", "fc", "mlbb", "ow", "pubg", "r6", "ff", "cf", "chess", "hok", "pubgm", "wz"],
  vitality: ["mlbb", "hok", "ff", "pubgm"],
  liquid:   ["cs2", "r6", "apex", "rl"],
  kc:       ["tft", "trackmania"],
  g2:       ["rl"],
  navi:     ["pubg", "r6"],
  aurora:   ["mlbb", "pubgm"],
  vp:       ["dota", "pubg", "cs2"],
  tm:       ["rl", "pubgm", "ff"],
  wbg:      ["lol", "ow"],
  al:       ["hok"],
  furia: ["r6"],
  loud:     ["ff", "lol"],
  m8: ["rl", "lol"],
  bds:      ["rl", "r6"],
  nrg: ["apex"],
  geng:     ["pubg", "pubgm"],
  t1:       ["ow", "tk8"],
  spirit:   ["mlbb"],
  parivision: ["pubgm"],
  zeta:     ["ow", "sf6"],
  heretics: ["r6"],
  fnatic: ["r6"],
  faze: ["pubgm"],
  sentinels: ["apex"],
};

// Duo Fortnite : D(note, [pseudo, pays, âge?], [pseudo, pays, âge?], org optionnelle)
function D(r, a, b, org) {
  const duo = [[a[0], a[1], r, a[2] || 0], [b[0], b[1], Math.max(60, r - 1), b[2] || 0]];
  return org ? [org, duo] : duo;
}
// Joueur solo signé dans une organisation : O(org, pseudo, pays, note, âge)
const O = (org, h, cc, r, a) => [org, [[h, cc, r, a]]];

// Joueurs solo : indépendants, ou [org, [joueur]] quand ils sont signés dans une organisation.
// Pour Fortnite, chaque entrée est un duo.
// Warzone : les trios du World Series of Warzone 2025 (Global Final, Las Vegas) et de l'EWC 2025 (Riyad), d'après le wiki Call of Duty Esports et Liquipedia.
// Nationalité laissée vide quand elle n'est pas connue.
Object.assign(ORGS, {
  teamvision: ["Team Vision", "VSN", "GB", "#3a7bd5", 55], escchampenois: ["ESC Champenois", "ESC", "FR", "#c9a227", 35], ravenesports: ["Raven eSports", "RVN", "US", "#5b5b6b", 38],
});
ROSTERS.wz = [
  ["teamvision", [["Fifakill", "GB", 88], ["Echo1867", "GB", 87], ["Lenun", "GB", 87]], true],          // champions WSOW 2025
  ["tm", [["Aydan", "US", 88], ["Almond", "", 86], ["zSmit", "", 87]], true],                           // champions EWC 2025
  ["m8", [["HalloW", "FR", 87], ["Gromalok", "FR", 86], ["Enkeo", "FR", 86]], true],                      // 2es WSOW et EWC 2025
  ["falcons", [["Biffle", "US", 87], ["Shifty", "US", 86], ["Hisoka", "US", 86]], true],
  ["bds", [["Jukeyz", "GB", 86], ["Gooy", "", 85], ["FLS", "", 84]], true],
  ["roc", [["Prxdigy", "", 83], ["WarsZ", "", 83], ["iVisionSR", "", 82]], true],
  ["escchampenois", [["Master5K", "", 82], ["Niasen", "", 82], ["KingChawk", "", 81]], true],
  ["onic", [["abWizz", "", 82], ["Disrrpt", "", 81], ["BubbleCT", "", 81]], true],
  ["ravenesports", [["UnRationaL", "US", 81], ["Destroy", "US", 81], ["Grimey", "", 80]], true],
  ["100t", [["Skullface", "", 79], ["Blazt", "", 78], ["GabeKuun", "", 78]], true],
];
const SOLOS = {
  // EA FC : FC Pro World Championship 2026 (EWC Paris) et favoris de la saison
  fc: [O("hyperspirit","RvPLegend","RO",92,0), ["levyfinn","DE",90,0], O("mancity","Bonanno","IT",90,0), ["Nassada","",89,0], ["Alihan","",88,0],
       ["Anders Vejrgang","DK",91,21], ["ManuBachoore","NL",88,29], ["DFernandes","PT",86,0], ["GugaFerraz","BR",86,0],
       ["Tekkz","GB",86,26], ["PHzin","BR",86,0], ["Umut","DE",85,0], ["Obrun2002","BR",85,0], ["Nicolas99fc","ES",85,0], ["Fouma","FR",82,0]],
  // SF6 : Capcom Cup 12, EWC 2026, Evo France 2026, Combo Breaker 2026
  sf6: [["Sahara","JP",91,0], O("falcons","Craime","",91,0), ["Kilzyou","JP",89,0], ["Blaz","CL",88,0], ["Hibiki","JP",88,0], ["Hinao","JP",88,0],
        O("cr","Dual Kevin","US",88,0), ["Tachikawa","JP",87,0], ["Punk","US",88,27], ["kobayan","JP",86,0], ["Fuudo","JP",86,0], ["Vxbao","CN",86,0],
        ["Higuchi","JP",86,0], ["Micky","",85,0], ["Xiaohai","CN",87,0], ["MenaRD","DO",89,0], ["Kakeru","JP",87,0], ["Tokido","JP",84,41],
        ["Daigo","JP",83,45], ["Angrybird","AE",84,0], ["Problem X","GB",84,0], ["Leshar","GB",84,0], ["EndingWalker","JP",85,0], ["Itabashi Zangief","JP",84,0]],
  // Échecs : élite mondiale (âges d'après les années de naissance)
  chess: [O("liquid","Magnus Carlsen","NO",97,35), ["Hikaru Nakamura","US",94,38], ["Alireza Firouzja","FR",92,23], ["Fabiano Caruana","US",92,34],
          ["Gukesh D","IN",91,20], ["Arjun Erigaisi","IN",91,23], ["Praggnanandhaa R","IN",90,21], ["Nodirbek Abdusattorov","UZ",90,22],
          ["Ian Nepomniachtchi","RU",89,36], ["Wesley So","US",89,33], ["Maxime Vachier-Lagrave","FR",88,35], ["Anish Giri","NL",88,32],
          ["Vincent Keymer","DE",88,21], ["Jan-Krzysztof Duda","PL",87,28], ["Le Quang Liem","VN",87,35], ["Levon Aronian","US",87,44]],
  // Tekken 8 : têtes d'affiche du Tekken World Tour (âges non vérifiés)
  tk8: [["Arslan Ash","PK",91,0], ["Knee","KR",89,0], ["Atif","PK",89,0], ["Ulsan","KR",88,0], ["JDCR","KR",87,0], ["Chikurin","JP",88,0],
        ["Qudans","KR",87,0], ["LowHigh","KR",87,0], ["Rangchu","KR",86,0], ["Nobi","JP",86,0], ["Kkokkoma","KR",85,0], ["Anakin","US",84,0]],
  // SC2 : EWC 2025, HomeStory Cup XXIX, GSTL 2026
  sc2: [O("basilisk","Serral","FI",95,28), O("liquid","Clem","FR",93,24), O("vitality","Maru","KR",92,29), ["Classic","KR",89,0], ["herO","KR",90,0],
        ["Reynor","IT",90,24], ["Dark","KR",88,0], ["MaxPax","DK",89,22], ["Oliveira","CN",86,0], ["Cure","KR",86,0], ["Solar","KR",85,0],
        ["SHIN","KR",85,0], ["Rogue","KR",84,0], ["Zoun","KR",84,0], ["ByuN","KR",84,0], ["ShoWTimE","DE",82,0], ["Lambo","DE",81,0], ["Elazer","PL",81,0]],
  // Fortnite : duos réels des FNCS 2026 (Majors 1 & 2, Global Championship d'Anvers),
  // classés d'après leurs résultats. Pays inconnu = "" ; âge 0 = tiré au hasard.
  fn: [
    // ---- Europe ----
    D(94, ["SwizzY",""], ["Pixie",""], "vitality"), D(93, ["Shxrk","RO",15], ["t3eny",""], "aurora"), D(92, ["Sky",""], ["Scroll",""]),
    D(92, ["vic0","FR"], ["Malibuca","RU"], "big"), D(89, ["Tjino",""], ["PabloWingu",""]), D(88, ["Charyy",""], ["Kami","PL",21]),
    D(88, ["FoCuS",""], ["Th0masHD","DK",24]), D(87, ["Cr1nge",""], ["Twi",""]), D(86, ["IDrop",""], ["Ghonzo",""]),
    D(86, ["Darm",""], ["Demus",""]), D(85, ["Velo",""], ["Zynox",""]), D(85, ["Chap",""], ["Flickzy",""]),
    D(85, ["SShur4",""], ["Repairs",""]), D(85, ["Syaaz",""], ["Scaryy",""]), D(85, ["Japko",""], ["Panzer",""]),
    D(84, ["Rax","IT",15], ["JannisZ",""], "m8"), D(83, ["Tidi",""], ["Julle",""]), D(83, ["Fant",""], ["Hlechis",""]),
    D(83, ["Nebs",""], ["Nxthan",""]), D(83, ["Pixx",""], ["Firen",""]),
    // ---- NA Central ----
    D(91, ["Peterbot","US",19], ["Pollo","US"]), D(90, ["Clix","US",21], ["Rapid",""]), D(89, ["Acorn","US"], ["Boltz",""], "tm"),
    D(89, ["Ritual",""], ["Cold","",19]), D(89, ["Ajerss",""], ["Veno","GB",21]), D(88, ["Higgs",""], ["Curve","US",15]),
    D(86, ["Muz",""], ["Rise","CA",24]), D(86, ["VicterV",""], ["Queasy","RS",24]), D(85, ["Kingaling",""], ["Kraez",""]),
    D(85, ["josh",""], ["Eomzo","US"]), D(84, ["Golden",""], ["Ozone",""]), D(83, ["Shadow",""], ["Vergo",""]),
    D(83, ["Bugha","US"], ["Braydz",""]), D(82, ["Moneymaker",""], ["Fnajen",""]), D(82, ["Reet","US"], ["Cooper","US"]),
    D(81, ["Xavi",""], ["Aminished",""]), D(81, ["Visxals",""], ["Threats",""]), D(80, ["Dash",""], ["Noxy",""]),
    D(80, ["angel",""], ["BatmanJoe",""]), D(80, ["Sails",""], ["verT",""]),
    // ---- NA West ----
    D(84, ["EpikWhale",""], ["PXMP",""]), D(82, ["phoenix",""], ["Retro","CA",15]), D(81, ["Inact",""], ["ZLink",""]), D(79, ["Compton",""], ["Snevy",""]),
    // ---- Brésil ----
    D(85, ["916Gon","BR"], ["Night","BR"], "furia"), D(84, ["Mack","BR"], ["Diguera","BR"]), D(83, ["Nuti","BR"], ["Gabzera","BR"]), D(82, ["Lewa","BR"], ["Romero","BR"]),
    // ---- Asie ----
    D(83, ["Yuma","JP"], ["Koyota","JP"]), D(82, ["Minipiyo","JP"], ["FuuKun","JP"]), D(80, ["Raeyache",""], ["Noel",""]), D(78, ["MxGuR0",""], ["Ritsu",""]),
    // ---- Moyen-Orient ----
    D(82, ["FKS",""], ["Hero",""]), D(80, ["7man1x",""], ["Controller",""]),
    // ---- Océanie ----
    D(81, ["Resignz","AU"], ["Tinka","AU"]), D(80, ["Solvey","AU",15], ["Sazers","AU"]), D(77, ["Spookz","AU"], ["Deymo","AU"]),
  ],
};// trio sans organisation (4e du WSOW 2025)
SOLOS.wz = [[["Stukex", "", 85], ["Layze", "", 85], ["Dekii", "", 84]]];


// Clubs fictifs pour compléter les circuits (surtout les petites scènes)
const FILLER_NAMES = [
  ["Nebula Esports","NEB","#6c5ce7","FR"],["Iron Wolves","IRW","#636e72","DE"],["Crimson Owls","CRO","#d63031","GB"],["Polar Gaming","PLR","#74b9ff","SE"],
  ["Atlas Esports","ATL","#00b894","US"],["Vortex Club","VTX","#e17055","ES"],["Solar Kings","SOL","#fdcb6e","BR"],["Shadow Foxes","SFX","#4b5563","JP"],
  ["Neon Tigers","NEO","#fd79a8","KR"],["Titan Squad","TTN","#0984e3","CA"],["Blue Hydra","HYD","#00cec9","IT"],["Rogue Pixels","RGP","#a29bfe","PL"],
  ["Desert Lions","DSL","#e1b12c","MA"],["Sakura Spirit","SKR","#ff9ff3","JP"],["Andes Condors","AND","#10ac84","AR"],["Viking Raiders","VKR","#7f8fa6","NO"],
  ["Golden Dragons","GDR","#feca57","CN"],["Savanna Kings","SVK","#ee5253","SN"],["Lyon Gaming Club","LGC","#e84118","FR"],["Marseille Oursins","OMR","#00a8ff","FR"],
  ["Bruxelles Arena","BXA","#fbc531","BE"],["Genève Eagles","GVE","#c23616","CH"],["Montréal Moose","MTL","#273c75","CA"],["Casablanca Storm","CSB","#44bd32","MA"],
  ["Dakar Lions","DKL","#e1b12c","SN"],["Abidjan Elephants","ABJ","#f39c12","CI"],["Tunis Falcons","TNF","#c0392b","TN"],["Alger Phoenix","ALP","#16a085","DZ"],
  ["Berlin Bears","BRB","#2f3640","DE"],["Madrid Toros","MDT","#e74c3c","ES"],["Milano Lupi","MIL","#8e44ad","IT"],["Lisboa Navigators","LSB","#2980b9","PT"],
  ["Amsterdam Tulips","AMS","#ff7f50","NL"],["Warsaw Wings","WAW","#d35400","PL"],["Stockholm Ghosts","STO","#95a5a6","SE"],["Helsinki Frost","HEL","#3498db","FI"],
  ["Seoul Phantoms","SPH","#9b59b6","KR"],["Tokyo Ronin","TKR","#c0392b","JP"],["Shanghai Pandas","SHP","#2ecc71","CN"],["Riyadh Hawks","RYH","#27ae60","SA"],
  ["Dubai Mirage","DXB","#f1c40f","AE"],["São Paulo Jaguars","SPJ","#f39c12","BR"],["Buenos Aires Tango","BAT","#5dade2","AR"],["Austin Outlaws","AUS","#a04000","US"],
  ["Chicago Wind","CHI","#2874a6","US"],["Vancouver Orcas","VAN","#1abc9c","CA"],["Istanbul Sultans","IST","#e74c3c","TR"],["Kyiv Defenders","KYV","#f4d03f","UA"],
  ["Sydney Sharks","SYD","#0abde3","AU"],["Melbourne Magpies","MEL","#222f3e","AU"],["Auckland Kiwis","AKL","#10ac84","NZ"],["Perth Scorchers","PRS","#ff9f43","AU"],
  ["Manila Thunder","MNL","#ee5253","PH"],["Jakarta Garudas","JKT","#feca57","ID"],["Bangkok Elephants","BKK","#5f27cd","TH"],["Hanoi Tigers","HAN","#ff6b6b","VN"],
  ["Singapore Merlions","SGM","#c8d6e5","SG"],["Kuala Lumpur Hornbills","KLH","#1dd1a1","MY"],["Taipei Bears","TPB","#576574","TW"],["Osaka Kitsune","OSK","#ff9ff3","JP"],
  ["Busan Wave","BSW","#2e86de","KR"],["Incheon Falcons","ICF","#8395a7","KR"],["Chengdu Pandas","CDP","#10ac84","CN"],["Shenzhen Dragons","SZD","#ee5253","CN"],
  ["Beijing Lions","BJL","#feca57","CN"],["Hangzhou Cranes","HZC","#48dbfb","CN"],["Doha Falcons","DOH","#8e44ad","QA"],["Cairo Pharaohs","CAI","#f6b93b","EG"],
  ["Jeddah Tide","JED","#079992","SA"],["Kuwait Storm","KWS","#3c6382","KW"],["Lima Llamas","LIM","#e55039","PE"],["Santiago Pumas","SCL","#4a69bd","CL"],
  ["Bogotá Cóndores","BOG","#f6b93b","CO"],["Rio Tubarões","RIO","#38ada9","BR"],["Mexico Aztecas","MEX","#b71540","MX"],["Toronto Northmen","TOR","#0c2461","CA"],
  ["Miami Heatwave","MIA","#fa983a","US"],["Seattle Rain","SEA","#60a3bc","US"],["Denver Peaks","DEN","#6a89cc","US"],["Atlanta Phoenix","ATP","#e58e26","US"],
];

const COUNTRIES = {
  PK:"Pakistan", UZ:"Ouzbékistan", VN:"Viêt Nam",   RS:"Serbie",   IN:"Inde", KH:"Cambodge", RO:"Roumanie", MK:"Macédoine du Nord",   FR:"France", BE:"Belgique", CH:"Suisse", CA:"Canada", US:"États-Unis", GB:"Royaume-Uni", DE:"Allemagne", ES:"Espagne",
  IT:"Italie", PT:"Portugal", NL:"Pays-Bas", KR:"Corée du Sud", CN:"Chine", JP:"Japon", BR:"Brésil", AR:"Argentine",
  MA:"Maroc", DZ:"Algérie", TN:"Tunisie", SN:"Sénégal", CI:"Côte d'Ivoire", SA:"Arabie saoudite", AE:"Émirats arabes unis",
  PL:"Pologne", SE:"Suède", DK:"Danemark", NO:"Norvège", FI:"Finlande", UA:"Ukraine", RU:"Russie", TR:"Turquie",
  PH:"Philippines", ID:"Indonésie", AU:"Australie", MX:"Mexique", CL:"Chili",
};

// Régions de compétition. Chaque joueur a une région d'origine (selon sa nationalité) et une région de jeu fixée par son contrat.
const REGIONS = { EU: "Europe", NA: "Amérique du Nord", SA: "Amérique du Sud", MENA: "Moyen-Orient & Afrique", ASIA: "Asie", OCE: "Océanie" };
const REGION_COUNTRIES = {
  NA: "US CA MX PR DO CU JM TT GT HN SV NI CR PA",
  SA: "BR AR CL CO PE UY PY BO EC VE",
  MENA: "SA AE QA KW BH OM JO LB IQ SY EG MA DZ TN LY IL IR PS YE SN CI NG GH KE ZA CM ET",
  ASIA: "KR CN JP TW HK MO VN TH PH ID MY SG KH LA MM IN PK BD LK NP MN KZ UZ KG TJ",
  OCE: "AU NZ FJ PG",
};
// équipes qui ne jouent pas dans la région du pays de leur organisation (jeu:organisation)
const REGION_OVERRIDES = {
  "lol:liquid": "NA", "cs2:falcons": "EU", "cs2:faze": "EU", "cs2:furia": "EU", "cs2:liquid": "NA", "cs2:mongolz": "EU",
  "dota:falcons": "EU", "mlbb:liquid": "ASIA", "cod:m8": "NA", "cod:heretics": "NA",
};
const REGION_OF = {};
for (const [r, ccs] of Object.entries(REGION_COUNTRIES)) for (const cc of ccs.split(" ")) REGION_OF[cc] = r;

// ---------- ligues régionales ----------
// Chaque jeu a ses zones (une ligue par zone et par tier), comme dans la réalité : LEC, LCK, LPL… en LoL, VCT EMEA / Americas /
// Pacific / China en Valorant. Les jeux sans ligues régionales (CS2, Dota, jeux de combat…) n'ont qu'une zone « Monde ».
const ZONE_NAMES = { W: "Monde", EU: "Europe", EMEA: "EMEA", NA: "Amérique du Nord", AMER: "Amériques", SA: "Amérique du Sud", MENA: "Moyen-Orient & Afrique",
  KR: "Corée", CN: "Chine", PAC: "Pacifique", ASIA: "Asie-Pacifique", OCE: "Océanie" };
// map : région (REGIONS) -> zone, ou fonction (pays de l'organisation) ; sizes : taille des ligues tier 1 et tier 2 ; names : nom de chaque ligue
const GAME_ZONES = {
  lol: { zones: ["EU", "KR", "CN", "NA", "SA", "PAC"], map: { EU: "EU", MENA: "EU", NA: "NA", SA: "SA", OCE: "PAC", ASIA: cc => cc === "KR" ? "KR" : cc === "CN" ? "CN" : "PAC" },
    sizes: [10, 10], names: [{ EU: "LEC", KR: "LCK", CN: "LPL", NA: "LCS", SA: "CBLOL", PAC: "LCP" },
      { EU: "EMEA Masters · ligues régionales (LFL, Prime League…)", KR: "LCK Challengers League", CN: "LDL", NA: "NACL", SA: "Circuito Desafiante", PAC: "Ligues nationales du Pacifique (VCS, PCS, LJL)" },
      { KR: "LCK Academy Series", CN: "LDL Development · académies", EU: "Divisions 2 et académies EMEA", NA: "Ligues amateurs et universitaires (Amérique du Nord)", SA: "Ligues amateurs (Amérique du Sud)", PAC: "Ligues amateurs du Pacifique" }],
    // tier 2 découpé en ligues nationales (ERL d'Europe, NACL et Liga Regional Norte, Desafiante et Liga Regional Sur, VCS / PCS / LJL / LTS)
    subs: { 2: { EU: ["LFL", "PRM", "LVP", "UL", "TCL", "EBL", "ES", "HM", "GLL", "LIT", "LPLOL", "NLC", "AL"], NA: ["NACL", "LRN"], SA: ["CD", "LRS"], PAC: ["VCS", "PCS", "LJL", "LTS"] } } },
  val: { zones: ["EMEA", "AMER", "PAC", "CN"], map: { EU: "EMEA", MENA: "EMEA", NA: "AMER", SA: "AMER", OCE: "PAC", ASIA: cc => cc === "CN" ? "CN" : "PAC" },
    sizes: [12, 16], names: [{ EMEA: "VCT EMEA", AMER: "VCT Americas", PAC: "VCT Pacific", CN: "VCT China" }, "VCT Challengers {z}", "Premier {z}"] },
  valgc: { zones: ["EMEA", "NA", "SA", "PAC"], map: { EU: "EMEA", MENA: "EMEA", NA: "NA", SA: "SA", OCE: "PAC", ASIA: "PAC" },
    sizes: [8, 10], names: ["Game Changers {z}", "Game Changers {z} — Division 2", "Game Changers Academy {z}"] },
  rl: { zones: ["EU", "NA", "SA", "MENA", "OCE", "ASIA"], map: { EU: "EU", NA: "NA", SA: "SA", MENA: "MENA", OCE: "OCE", ASIA: "ASIA" },
    sizes: [12, 16], names: ["RLCS {z} — Élite", "RLCS {z} — Open", "Ranked Cups 3v3 {z}"] },
  ow: { zones: ["EU", "NA", "ASIA"], map: { EU: "EU", MENA: "EU", NA: "NA", SA: "NA", OCE: "ASIA", ASIA: "ASIA" },
    sizes: [8, 8], names: [{ EU: "OWCS EMEA", NA: "OWCS North America", ASIA: "OWCS Asia" }, "OWCS {z} — Open", "Open Cups {z}"] },
  r6: { zones: ["EU", "NA", "SA", "ASIA"], map: { EU: "EU", MENA: "EU", NA: "NA", SA: "SA", OCE: "ASIA", ASIA: "ASIA" },
    sizes: [10, 10], names: [{ EU: "European League", NA: "North America League", SA: "Brasileirão", ASIA: "Asia-Pacific League" }, "Challenger League {z}", "Open Cups {z}"] },
  // la FNCS se joue par région (lobbies séparés) ; le statut Élite / Pro / Open dépend du classement dans sa région
  fn: { zones: ["EU", "NA", "SA", "MENA", "ASIA", "OCE"], map: { EU: "EU", NA: "NA", SA: "SA", MENA: "MENA", OCE: "OCE", ASIA: "ASIA" },
    names: ["FNCS {z}", "FNCS {z}", "FNCS {z}"] },
};
// ligues fermées (franchises) : ni montée ni descente ; on y entre en rachetant la place d'un club (prix de base d'une place, en €)
const FRANCHISES = {
  lol: { 1: { EU: 12000000, KR: 10000000, CN: 10000000, NA: 8000000, SA: 2500000, PAC: 3000000 } },
  val: { 1: { EMEA: 8000000, AMER: 8000000, PAC: 5000000, CN: 5000000 } },
  cod: { 1: { W: 25000000 } },
};
// région de jeu correspondant à une zone (pour une équipe qui rachète une franchise à l'étranger)
const ZONE_REGION = { EU: "EU", EMEA: "EU", NA: "NA", AMER: "NA", SA: "SA", MENA: "MENA", KR: "ASIA", CN: "ASIA", PAC: "ASIA", ASIA: "ASIA", OCE: "OCE" };
// sous-ligues (ligues nationales d'un même tier) : nom et pays
const SUB_NAMES = { LFL: "LFL", PRM: "Prime League", LVP: "LVP SuperLiga", UL: "Rift Legends (Ultraliga)", TCL: "TCL", EBL: "Esports Balkan League", ES: "Road of Legends (Elite Series)",
  HM: "Hitpoint Masters", GLL: "Hellenic Legends League", LIT: "LIT", LPLOL: "LPLOL", NLC: "NLC", AL: "Arabian League", NACL: "NACL", LRN: "Liga Regional Norte",
  CD: "Circuito Desafiante", LRS: "Liga Regional Sur", VCS: "VCS", PCS: "PCS", LJL: "LJL", LTS: "LTS" };
const SUB_CC = { LFL: "FR MC", PRM: "DE AT CH", LVP: "ES AD", UL: "PL EE LV LT UA IL GE BY MD AZ RU", TCL: "TR", EBL: "RS HR BA ME HU RO BG MK AL SI", ES: "NL BE LU", HM: "CZ SK",
  GLL: "GR CY", LIT: "IT SM MT", LPLOL: "PT", NLC: "GB IE SE NO DK FI IS FO", AL: "SA AE EG MA DZ TN JO KW LB IQ SY PS IR QA BH OM", NACL: "US CA",
  LRN: "MX CR GT HN SV PA CU DO PR TT NI CO VE", CD: "BR", LRS: "AR CL PE UY PY BO EC", VCS: "VN", PCS: "TW HK MO PH SG MY ID AU NZ PF", LJL: "JP", LTS: "TH KH LA MM" };
const subsOf = (game, tier, zone) => (GAME_ZONES[game] && GAME_ZONES[game].subs && GAME_ZONES[game].subs[tier] && GAME_ZONES[game].subs[tier][zone]) || null;
// sous-ligue d'un pays (la NLC accueille les pays d'Europe sans ligue propre)
function subFor(game, tier, zone, cc) {
  const subs = subsOf(game, tier, zone); if (!subs) return null;
  return subs.find(s => SUB_CC[s] && SUB_CC[s].split(" ").includes(cc)) || (subs.includes("NLC") ? "NLC" : subs[0]);
}
// zone d'une équipe dans un jeu, d'après sa région (et le pays de son organisation pour l'Asie)
function zoneFrom(game, region, cc) {
  const Z = GAME_ZONES[game]; if (!Z) return "W";
  const z = Z.map[region || "EU"];
  return typeof z === "function" ? z(cc) : z || Z.zones[0];
}
const gameZones = game => GAME_ZONES[game] ? GAME_ZONES[game].zones : ["W"];

// Syllabes pour générer des pseudos réalistes
const NAME_PARTS = {
  a: ["zen","kai","rex","nova","blitz","vex","lynx","fury","zero","ace","myth","sky","drak","jin","ryu","volt","echo","flux","grim","haze",
      "kyro","mako","nyx","orb","pyro","quill","rift","sly","tox","vyn","wrath","xeno","yuki","zap","bolt","cypher","dusk","ember","frost","glitch",
      "hex","ion","jolt","karma","lumen","mira","nero","onyx","prism","raze","sage","talon","umbra","viper","wisp","zed","astro","bane","crux",
      "dante","enzo","fyre","gale","hiro","ivo","juno","kenzo","loki","milo","nox","oslo","pax","rook","sora","taz","uzi","vito","wyn","yaro"],
  b: ["", "", "", "x", "0", "z", "y", "er", "ix", "99", "on", "ka", "o", "i", "7", "us", "ie", "an", "fps", "tv"],
};

// =====================================================================
//  Tournois à cashprize (en plus des ligues). Dotations ≈ réelles, en €.
//  [nom, semaine (1-13), dotation, tiers admis ("1" = invitations tier 1, "12", "2", "23", "3"), places]
//  Les tournois "EWC — …" forment l'Esports World Cup (semaines 7 à 10) et comptent pour le Club Championship.
//  Les petits tournois (cash cups, circuits tier 2) sont générés à part chaque saison : voir SMALL_EVENTS.
// =====================================================================
const TOURNAMENTS = {
  lol:  [["First Stand", 11, 1000000, "1", 8], ["Mid-Season Invitational (MSI)", 27, 2000000, "1", 8], ["EWC — League of Legends", 28, 2000000, "1", 8],
         ["EMEA Masters", 38, 300000, "2", 16], ["Worlds (Championnat du monde)", 45, 5000000, "1", 16]],
  cs2:  [["IEM Kraków", 6, 1000000, "1", 16], ["BLAST Open", 12, 400000, "1", 8], ["Major (printemps)", 23, 1250000, "1", 16], ["EWC — Counter-Strike 2", 34, 2000000, "1", 16],
         ["IEM Cologne Major", 25, 1250000, "1", 16], ["Thunderpick World Championship", 42, 1000000, "12", 16], ["BLAST World Final", 49, 1000000, "1", 8]],
  val:  [["VCT Masters (1)", 10, 1000000, "1", 8], ["Challengers Finals", 22, 200000, "2", 8], ["EWC — VALORANT", 28, 2000000, "1", 8],
         ["VCT Masters (2)", 24, 1000000, "1", 8], ["VALORANT Champions", 41, 2250000, "1", 16]],
  dota: [["DreamLeague", 9, 1000000, "1", 16], ["PGL Wallachia", 15, 1000000, "1", 16], ["BLAST Slam", 20, 1000000, "1", 8], ["EWC — Dota 2", 29, 2000000, "1", 16],
         ["The International", 36, 2500000, "1", 16]],
  rl:   [["RLCS Major (1)", 8, 350000, "1", 16], ["RLCS Major (2)", 24, 350000, "1", 16], ["EWC — Rocket League", 32, 1000000, "1", 16], ["RLCS World Championship", 38, 1000000, "1", 16]],
  ow:   [["OWCS Midseason Championship", 26, 500000, "1", 8], ["EWC — Overwatch 2", 31, 1000000, "1", 8], ["OWCS World Finals", 46, 1000000, "1", 8]],
  r6:   [["Six Invitational", 7, 3000000, "1", 16], ["R6 Major (1)", 19, 750000, "1", 16], ["EWC — Rainbow Six Siege X", 32, 2000000, "1", 16], ["R6 Major (2)", 47, 750000, "1", 16]],
  cod:  [["CDL Major (1)", 6, 500000, "1", 8], ["CDL Major (2)", 12, 500000, "1", 8], ["EWC — Call of Duty: Black Ops 7", 30, 1500000, "1", 8],
         ["CDL Major (3)", 18, 500000, "1", 8], ["CDL Championship (Champs)", 26, 2000000, "1", 8]],
  mlbb: [["MPL Invitational", 11, 300000, "1", 8], ["EWC — Mobile Legends: Mid Season Cup", 28, 3000000, "1", 16], ["M World Championship", 49, 1000000, "1", 16]],
  hok:  [["KPL Spring Finals", 22, 1000000, "1", 8], ["EWC — Honor of Kings", 30, 2000000, "1", 16], ["Honor of Kings World Cup", 45, 2000000, "1", 16]],
  cf:   [["CFS Invitational", 14, 300000, "1", 8], ["EWC — Crossfire", 33, 1000000, "1", 8], ["CFS Grand Finals", 48, 500000, "1", 8]],
  fn:   [["FNCS Major (1)", 12, 600000, "12", 33], ["EWC — Fortnite Reload Elite Series", 31, 1000000, "1", 16], ["FNCS Major (2)", 22, 600000, "12", 33],
         ["FNCS Global Championship", 36, 2000000, "1", 16]],
  apex: [["ALGS Open", 18, 1000000, "12", 20], ["EWC — Apex Legends", 29, 2000000, "1", 12], ["ALGS Championship", 5, 2000000, "1", 12]],
  pubg: [["PGS (1)", 17, 500000, "1", 12], ["PGS (2)", 20, 500000, "1", 12], ["EWC — PUBG: Battlegrounds", 29, 1000000, "1", 12], ["PUBG Global Championship (PGC)", 48, 1000000, "1", 12]],
  pubgm:[["PMWC Points Finals", 28, 500000, "1", 16], ["EWC — PUBG Mobile", 30, 3000000, "1", 16], ["PUBG Mobile Global Championship", 48, 3000000, "1", 16]],
  ff:   [["FFWS Spring", 18, 300000, "1", 12], ["EWC — Free Fire", 29, 1000000, "1", 12], ["Free Fire World Series Global Finals", 46, 1000000, "1", 12]],
  wz:   [["World Series of Warzone — finales régionales", 36, 500000, "12", 50], ["EWC — Call of Duty: Warzone", 32, 1000000, "1", 21], ["World Series of Warzone — Global Final", 40, 1000000, "1", 50]],
  fc:   [["FC Pro Open", 10, 250000, "12", 16], ["eChampions League", 22, 280000, "1", 16], ["EWC — EA Sports FC 26 (FC Pro World Championship)", 31, 1000000, "1", 16]],
  sf6:  [["Capcom Cup", 10, 1000000, "1", 16], ["EVO", 31, 250000, "12", 16], ["EWC — Street Fighter 6", 33, 1000000, "1", 16], ["Evo France", 41, 100000, "12", 16]],
  tk8:  [["EVO — Tekken 8", 31, 150000, "12", 16], ["EWC — TEKKEN 8", 34, 1000000, "1", 16], ["Tekken World Tour Finals", 49, 300000, "1", 16]],
  fatal:[["EVO — Fatal Fury", 31, 50000, "12", 16], ["EWC — FATAL FURY: City of the Wolves", 32, 1000000, "1", 16], ["SNK World Championship", 48, 200000, "1", 16]],
  chess:[["Champions Chess Tour — Spring Finals", 22, 300000, "1", 16], ["EWC — Chess", 34, 1500000, "1", 16], ["Champions Chess Tour Finals", 49, 500000, "1", 16]],
  tft:  [["TFT Open", 15, 300000, "12", 8], ["EWC — Teamfight Tactics", 29, 500000, "1", 8], ["TFT World Championship", 37, 500000, "1", 8]],
  trackmania: [["Trackmania Grand League Finals", 20, 100000, "1", 16], ["EWC — Trackmania", 33, 500000, "1", 16], ["Trackmania World Cup", 45, 100000, "1", 16]],
  sc2:  [["IEM Katowice", 6, 500000, "1", 16], ["HomeStory Cup", 25, 50000, "12", 16], ["SC2 World Championship", 44, 300000, "1", 16]],
};

// Petits tournois générés chaque saison : cash cups ouvertes (tier 3) et circuits professionnels (tier 2).
// [noms de cash cups], [noms de circuits tier 2], [dotation min/max cash cup], [min/max tier 2], fréquence (semaines)
const SMALL_EVENTS = {
  cs2:  { t3: ["FACEIT Weekly Cup", "ESEA Cash Cup", "Gamers Assembly LAN", "DreamHack Open", "Lyon e-Sport LAN", "NSTLGA Emerald Cup", "SUGD Cup", "Elisa Open", "Swiss Gaming Cup", "OMEN Challenger"],
          t2: ["CCT Europe Series", "NODWIN Clutch Series", "European Pro League", "ESL Challenger League", "RLG Tesla Cup", "FiRe Last Chance", "Exort Series", "Skyesports Championship"],
          p3: [1000, 6000], p2: [15000, 75000], every3: 1, every2: 2 },
  lol:  { t3: ["Open Tour France", "Prime League Cup", "Elite Series Open", "Superliga Cup", "Northern League Cup"], t2: ["LFL Cup", "Prime League Pokal", "LCK Challengers Cup", "NLC Finals"], p3: [1000, 5000], p2: [20000, 60000] },
  valgc: { t3: ["Game Changers Academy Cup", "GC Open Series", "Riot Game Changers Open", "Valkyrie Cup"], t2: ["VCT Game Changers EMEA", "VCT Game Changers North America", "VCT Game Changers Brazil", "VCT Game Changers East Asia", "VCT Game Changers APAC"], p3: [500, 3000], p2: [10000, 50000] },
  val:  { t3: ["Premier Cash Cup", "VCL Open Cup", "Spike Nations", "Red Bull Campus Clutch"], t2: ["Challengers France", "Challengers DACH", "Challengers Spain", "Red Bull Home Ground"], p3: [1000, 5000], p2: [15000, 60000] },
  dota: { t3: ["Open Qualifier Cup", "Dota Pro Circuit Open", "European Pro League Dota"], t2: ["CCT Dota", "Elite League Qualifier", "FISSURE Playground"], p3: [1000, 5000], p2: [20000, 80000] },
  rl:   { t3: ["3v3 Cash Cup", "RLCS Open Cup", "Gamers8 Open"], t2: ["RLCS Open Regionals", "Rocket Baguette", "Elite Series"], p3: [500, 3000], p2: [10000, 40000] },
  ow:   { t3: ["Open Cup", "Contenders Cup"], t2: ["OWCS Open", "OWCS Regional Cup"], p3: [500, 2000], p2: [5000, 25000] },
  r6:   { t3: ["Open Cup", "Go4R6 Cup"], t2: ["Challenger Cup", "Regional League Challenger"], p3: [500, 3000], p2: [10000, 50000] },
  cod:  { t3: ["Amateur Cash Cup", "GameBattles 4v4"], t2: ["Challengers Cup", "Challengers Elite"], p3: [500, 3000], p2: [10000, 50000] },
  mlbb: { t3: ["Open Cup", "Campus Cup"], t2: ["MDL Cup", "MPL Qualifier"], p3: [500, 3000], p2: [10000, 40000] },
  hok:  { t3: ["Open Cup", "Campus Clash"], t2: ["KPL Development Cup", "HoK Elite League"], p3: [500, 3000], p2: [10000, 50000] },
  cf:   { t3: ["Open Cup"], t2: ["CF Pro League Cup"], p3: [500, 2000], p2: [5000, 30000] },
  fn:   { t3: ["Victory Cup", "Cash Cup", "Console Victory Cup"], t2: ["FNCS Divisional Cup", "Cash Cup Finals", "Elite Series"], p3: [500, 3000], p2: [10000, 40000] },
  apex: { t3: ["Online Cup", "Apex Open Cup"], t2: ["ALGS Challenger Cup", "ALGS Challenger Circuit"], p3: [500, 2000], p2: [10000, 30000] },
  pubg: { t3: ["Scrim Cup", "Weekly Cup"], t2: ["PUBG Nations Qualifier", "Regional Series"], p3: [500, 2000], p2: [10000, 30000] },
  pubgm:{ t3: ["Open Cup", "Campus Championship"], t2: ["PMSL Weekly", "PUBG Mobile Pro League"], p3: [500, 3000], p2: [10000, 50000] },
  ff:   { t3: ["Open Cup", "Booyah Cup"], t2: ["FFWS Regional Week", "Free Fire Pro League"], p3: [500, 2000], p2: [5000, 30000] },
  wz:   { t3: ["Kill Race", "Warzone Open Cup"], t2: ["Warzone Pro Circuit Cup", "WSOW Qualifier"], p3: [500, 5000], p2: [10000, 50000] },
  fc:   { t3: ["FUT Champions Cup", "Weekend League Cup"], t2: ["eLigue 1", "FC Pro Open Qualifier", "eChampions Qualifier"], p3: [500, 2000], p2: [5000, 30000] },
  sf6:  { t3: ["Online Locals", "Weekly Brawl", "Stunfest Open"], t2: ["Capcom Pro Tour Premier", "CPT World Warrior", "Red Bull Kumite"], p3: [200, 1500], p2: [5000, 40000] },
  tk8:  { t3: ["Online Locals", "Weekly Tekken"], t2: ["TWT Challenger", "TWT Master Event"], p3: [200, 1500], p2: [5000, 30000] },
  fatal:{ t3: ["Online Locals"], t2: ["SNK Pro Tour"], p3: [200, 1000], p2: [3000, 15000] },
  chess:{ t3: ["Titled Tuesday", "Bullet Brawl", "Arena Kings"], t2: ["Champions Chess Tour Division II", "Speed Chess Championship"], p3: [500, 2000], p2: [5000, 40000] },
  tft:  { t3: ["Ranked Cup", "Hyper Roll Cup"], t2: ["Tactician's Cup", "TFT Pro Circuit"], p3: [200, 1500], p2: [5000, 30000] },
  trackmania: { t3: ["Cup of the Day", "Weekly Shorts"], t2: ["Trackmania Grand League", "Trackmania Monthly"], p3: [200, 1500], p2: [3000, 20000] },
  sc2:  { t3: ["Weekly Cup", "Wardi Open"], t2: ["ESL Masters", "WTL Finals"], p3: [200, 1000], p2: [5000, 30000] },
};

// Club Championship de l'EWC : dotation des 24 meilleurs clubs (≈ 30 M$ au total)
const EWC_CLUB_PRIZES = [7000000, 5000000, 4000000, 3000000, 2000000, 1500000, 1200000, 1000000,
  700000, 600000, 500000, 450000, 400000, 350000, 300000, 300000, 250000, 250000, 200000, 200000, 200000, 150000, 150000, 150000];
const EWC_POINTS = [1000, 750, 500, 500, 250, 250, 250, 250];

// ---------- périodes de mercato (semaines ISO, calées sur le vrai calendrier de chaque scène) ----------
// [début, fin, explication]. Hors période, on ne peut pas racheter un joueur sous contrat à un club :
// seuls les agents libres et les indépendants se signent (comme en football). « always » : pas de fenêtre réglementée,
// les transferts sont possibles toute l'année ; les périodes listées sont alors les moments où le marché s'emballe.
const MERCATO_WINDOWS = {
  lol:   { w: [[2, 5, "fin de l'intersaison : derniers transferts avant le verrouillage des effectifs"], [13, 15, "pause entre les deux splits"], [25, 28, "fenêtre d'été"], [45, 50, "intersaison : agence libre à la mi-novembre, après les Worlds"]] },
  val:   { w: [[2, 6, "avant le Kickoff de la VCT"], [15, 17, "après le premier Masters"], [25, 28, "entre le Stage 1 et le Stage 2"], [38, 50, "intersaison après Champions"]] },
  valgc: { w: [[2, 6, "avant la saison Game Changers"], [25, 28, "mi-saison"], [45, 50, "intersaison après le Championship"]] },
  cs2:   { always: true, w: [[2, 4, "rentrée après la pause de fin d'année"], [27, 31, "pause estivale des joueurs"], [47, 50, "pause de fin d'année, le grand remaniement"]] },
  dota:  { w: [[2, 5, "début de saison"], [20, 23, "mi-saison"], [38, 46, "le grand remaniement d'après The International"]] },
  rl:    { w: [[2, 6, "avant la saison RLCS"], [13, 16, "entre deux splits"], [38, 47, "intersaison après les Worlds"]] },
  ow:    { w: [[2, 7, "intersaison OWCS"], [21, 24, "mi-saison"], [45, 50, "intersaison OWCS"]] },
  r6:    { w: [[2, 4, "intersaison"], [8, 12, "après le Six Invitational"], [24, 28, "fenêtre de mi-saison"], [45, 50, "fin de saison"]] },
  cod:   { w: [[9, 12, "fenêtre de mi-saison CDL"], [27, 41, "intersaison CDL après les Champs"]] },
  mlbb:  { w: [[2, 7, "avant la saison MPL du printemps"], [22, 31, "entre les deux saisons MPL"], [45, 50, "après les M-Series"]] },
  hok:   { w: [[2, 6, "avant la saison KPL"], [24, 28, "mi-saison"], [45, 50, "intersaison"]] },
  cf:    { w: [[2, 6, "avant la saison CFPL"], [24, 28, "mi-saison"], [45, 50, "intersaison"]] },
};
// jeux sans fenêtre réglementée par défaut : battle royale, jeux en solo (contrats libres toute l'année)
function mercatoRules(game) {
  return MERCATO_WINDOWS[game] || { always: true, w: GAMES[game] && GAMES[game].fmt === "team" ? [[2, 5, "début de saison"], [24, 28, "mi-saison"], [45, 50, "intersaison"]] : [[2, 4, "début de saison"], [46, 50, "fin de saison"]] };
}
