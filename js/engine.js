// =====================================================================
//  ESPORTS MANAGER — Moteur de simulation (état, matchs, économie)
// =====================================================================

// v3 : calendrier réel et ligues régionales (les parties v2 ne sont plus compatibles)
const SAVE_KEY = "esports-manager-save-v3";
const FACILITIES = {
  house:     { name: "Gaming House",        icon: "🏠", desc: "Moral et forme des joueurs." },
  coaching:  { name: "Staff de coaching",   icon: "🧠", desc: "Bonus de performance en match + progression." },
  analytics: { name: "Cellule d'analyse",   icon: "📊", desc: "Bonus de performance en match." },
  content:   { name: "Studio de contenu",   icon: "🎥", desc: "Croissance des fans et revenus merch/stream." },
  academy:   { name: "Académie",            icon: "🎓", desc: "Révèle des jeunes talents chaque saison." },
};
const MAX_FAC = 5;
const LEAGUE_SIZE = 12;          // équipes (ou joueurs) par circuit
const START_BUDGET = 250000;     // budget d'un club créé de zéro
const TIER_LABEL = ["Tier 1", "Tier 2", "Tier 3"];
const TIER_PRIZE = [1, 0.08, 0.012];        // part du cashprize du jeu
const TIER_FAME_REQ = [65, 30, 0];          // notoriété de référence (jeu moyen) ; voir fameReq pour chaque jeu
// notoriété requise pour acheter une place : plus le jeu est suivi, plus il en faut (tier 1 de LoL ≈ 75, de Trackmania ≈ 40)
function fameReq(game, tier) {
  if (tier >= 3) return 0;
  const v = Math.sqrt((GAME_ECO[game] ? GAME_ECO[game].view : 10) / 100);
  return Math.round((tier === 1 ? 35 + 40 * v : 15 + 20 * v) / 5) * 5;
}
const TIER_OP = [3500, 700, 100];            // frais hebdo par joueur
const TIER_SPONSOR = [6000, 2000, 500];    // revenus sponsors liés à la division
const TIER_RATING = [[80, 88], [70, 80], [61, 74]]; // niveau des joueurs générés
const TIER_FAME_TARGET = [75, 40, 15];

// ---------- calendrier réel ----------
// la saison suit l'année : semaines ISO 2 (début janvier) à 50 (mi-décembre)
const SEASON_FIRST = 2, SEASON_LAST = 50;
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
// journées de ligue : split 1 (mi-janvier → fin mars), split 2 (avril → mi-juin) ; playoffs en septembre, après l'EWC
const LEAGUE_DAYS = [...range(3, 13), ...range(15, 25)];
const PO_SEMI = 37, PO_FINAL = 38;
const SEASON_WEEKS = SEASON_LAST - SEASON_FIRST + 1;
// les probabilités hebdomadaires (progression, événements…) étaient réglées pour une saison de 13 semaines
const WEEK_SCALE = 13 / SEASON_WEEKS;
const matchday = w => LEAGUE_DAYS.indexOf(w) + 1;
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
// lundi de la semaine ISO w
function weekMonday(season, w) {
  const jan4 = new Date(Date.UTC(season, 0, 4)), dow = (jan4.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(season, 0, 4 - dow + (w - 1) * 7));
}
// jour précis d'un match : d = 0 (lundi) à 6 (dimanche)
const DAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
function dayLabel(season, w, d) { const t = new Date(weekMonday(season, w).getTime() + (d || 0) * 864e5); return `${DAYS[d || 0]} ${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}`; }
// jour habituel des journées de ligue de chaque jeu (LoL le samedi, CS2 le mercredi…)
const LEAGUE_WEEKDAY = { lol: 5, val: 4, valgc: 3, cs2: 2, dota: 3, rl: 6, ow: 5, r6: 3, cod: 4, mlbb: 4, hok: 5, cf: 3, fn: 6, apex: 5, pubg: 3, pubgm: 4, ff: 5, wz: 6, tft: 2, trackmania: 3, fc: 1, sf6: 2, tk8: 2, fatal: 3, chess: 1, sc2: 4 };
// « 12-18 janv. » ou « 26 janv. - 1 févr. » (avec l'année si demandé)
function weekLabel(season, w, year) {
  if (season === undefined) { season = S.season; w = S.week; }
  const a = weekMonday(season, w), b = new Date(a.getTime() + 6 * 864e5);
  const txt = a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()}-${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}` : `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()]} - ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`;
  return year ? `${txt} ${b.getUTCFullYear()}` : txt;
}

let S = null; // état global

// ---------- utilitaires ----------
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const uid = (() => { let n = 0; return p => p + "_" + Date.now().toString(36) + "_" + (n++).toString(36); })();
// une ligue par jeu, tier et zone (LEC, LCK…) ; une seule ligue par zone pour les circuits ouverts (Fortnite), quel que soit le statut du club
const lkey = (game, tier, zone = "W", sub) => `${game}:${GAMES[game] && GAMES[game].open ? 1 : tier}:${zone}${sub ? ":" + sub : ""}`;
const leagueOf = (clubId, game) => { const d = divOf(clubId, game); return d ? S.leagues[lkey(game, d.tier, d.zone || "W", d.sub)] : null; };
const leaguesOf = game => Object.values(S.leagues).filter(L => L.game === game);
const MIN_LEAGUE = 8;
// progression : points d'expérience par semaine (≈ +4 de note par saison pour un titulaire de 18 ans qui joue bien)
const XP_RATE = 0.14;            // expérience gagnée par semaine par un jeune titulaire (un point de note quand elle atteint 1)
const tierLabel = (game, t) => (GAMES[game] && GAMES[game].statuses ? GAMES[game].statuses : TIER_LABEL)[t - 1];

function flag(cc) {
  if (!cc || cc.length !== 2) return "🏳️";
  return String.fromCodePoint(...[...cc.toUpperCase()].map(c => 127397 + c.charCodeAt(0)));
}
function money(n) {
  const neg = n < 0; n = Math.abs(n);
  let s;
  if (n >= 1e6) s = (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(".", ",") + " M€";
  else if (n >= 1e4) s = Math.round(n / 1e3) + " k€";
  else if (n >= 1e3) s = (n / 1e3).toFixed(1).replace(".", ",") + " k€";
  else s = Math.round(n) + " €";
  return (neg ? "-" : "") + s;
}
function genHandle() {
  let h = pick(NAME_PARTS.a) + pick(NAME_PARTS.b);
  const r = Math.random();
  if (r < 0.45) h = h[0].toUpperCase() + h.slice(1);
  else if (r < 0.55) h = h.toUpperCase();
  return h;
}
function tierPrize(game, tier) { return Math.round(GAMES[game].prize * TIER_PRIZE[tier - 1]); }
function tierEntry(game, tier) { return Math.round(GAMES[game].prize * [0.3, 0.04, 0.004][tier - 1] / 1000) * 1000; }
// nom réel de la ligue : « LEC », « VCT Pacific », « FNCS Europe »…
function tierName(game, tier, zone, sub) {
  if (sub && SUB_NAMES[sub]) return SUB_NAMES[sub];
  const Z = GAME_ZONES[game];
  if (!Z || !zone || zone === "W") return GAMES[game].tiers[tier - 1];
  const n = Z.names[tier - 1], v = typeof n === "string" ? n : n[zone] || GAMES[game].tiers[tier - 1];
  return v.replace("{z}", ZONE_NAMES[zone]);
}
function leagueName(L) { return tierName(L.game, L.tier, L.zone, L.sub); }
// ligue d'un club dans un jeu (nom)
const divName = (clubId, game) => { const d = divOf(clubId, game); return d ? tierName(game, GAMES[game].open ? 1 : d.tier, d.zone, d.sub) : ""; };
// tailles des ligues tier 1 et tier 2 d'une zone
const zoneSizes = game => GAME_ZONES[game] && GAME_ZONES[game].sizes ? GAME_ZONES[game].sizes : GAMES[game].tierSizes && !GAMES[game].open ? GAMES[game].tierSizes : [LEAGUE_SIZE, LEAGUE_SIZE];
// zone d'une équipe des données réelles, avant la création du monde (même règle que clubRegion)
function entryZone(game, orgId, roster) {
  const ov = orgId && REGION_OVERRIDES[game + ":" + orgId], occ = orgId && ORGS[orgId] ? ORGS[orgId][2] : null;
  if (ov) return zoneFrom(game, ov, occ);
  if (GAMES[game].fmt === "team" && occ) return zoneFrom(game, REGION_OF[occ] || "EU", occ);
  const cc = roster[0] ? roster[0][1] : occ;
  return zoneFrom(game, REGION_OF[cc] || "EU", cc);
}
// pays d'une zone (pour les clubs et joueurs fictifs)
function zoneCountries(game, zone) {
  const cache = zoneCountries.c || (zoneCountries.c = {}), k = game + ":" + zone;
  if (!cache[k]) {
    const all = [...new Set(Object.keys(COUNTRIES).concat(Object.keys(REGION_OF)))];
    cache[k] = zone === "W" ? Object.keys(COUNTRIES) : all.filter(cc => zoneFrom(game, REGION_OF[cc] || "EU", cc) === zone);
    if (!cache[k].length) cache[k] = Object.keys(COUNTRIES);
  }
  return cache[k];
}
// répartition des équipes réelles par zone et par tier, dans l'ordre des données (les meilleures d'abord)
function planTiers(game) {
  const g = GAMES[game], sizes = zoneSizes(game), count = {};
  const entries = (ROSTERS[game] || []).map(([orgId, roster, verified, label]) => ({ orgId, roster, verified: !!verified, label, avg: roster.reduce((s, p) => s + p[2], 0) / roster.length }));
  // entrée SOLOS : un joueur, un duo, ou [org, duo] pour un duo signé dans une organisation
  const solos = (SOLOS[game] || []).map(x => typeof x[0] === "string" && Array.isArray(x[1]) && Array.isArray(x[1][0]) ? { orgId: x[0], roster: x[1] } : { roster: Array.isArray(x[0]) ? x : [x] })
    .map(e => ({ ...e, avg: e.roster.reduce((s, p) => s + p[2], 0) / e.roster.length })).sort((a, b) => b.avg - a.avg);
  const all = entries.concat(solos);
  const fixed = typeof LIVE_LEAGUES !== "undefined" && LIVE_LEAGUES[game] || {};
  for (const e of all) {
    // ligue donnée par les sources (LEC, LFL, LCK CL…) ; sinon d'après le rang de l'équipe dans sa zone
    const f = e.orgId && fixed[e.orgId];
    if (f) { [e.zone, e.tier] = f; e.sub = f[2] || null; continue; }
    e.zone = entryZone(game, e.orgId, e.roster);
    const n = count[e.zone] = (count[e.zone] || 0) + 1;
    e.tier = g.open ? 1 : n <= sizes[0] ? 1 : n <= sizes[0] + sizes[1] ? 2 : 3;
    if (!g.open && subsOf(game, e.tier, e.zone)) e.sub = subFor(game, e.tier, e.zone, e.orgId && ORGS[e.orgId] ? ORGS[e.orgId][2] : e.roster[0] && e.roster[0][1]);
  }
  return all;
}

// ---------- économie de chaque jeu ----------
// view : audience moyenne des grandes compétitions (indice, LoL = 100) ; spon : attrait pour les marques grand public ;
// bet : part des sponsors de paris, casinos et crypto ; eth : part des marques éthiques. Inspiré des audiences et des sponsors réels.
const GAME_ECO = {
  lol: { view: 100, spon: 1.3, bet: 0.12, eth: 0.25 }, cs2: { view: 60, spon: 0.9, bet: 0.55, eth: 0.08 }, val: { view: 40, spon: 1.1, bet: 0.2, eth: 0.18 },
  valgc: { view: 6, spon: 1.1, bet: 0.05, eth: 0.4 }, dota: { view: 35, spon: 0.85, bet: 0.5, eth: 0.08 }, rl: { view: 18, spon: 1.25, bet: 0.08, eth: 0.28 },
  ow: { view: 10, spon: 1, bet: 0.1, eth: 0.2 }, r6: { view: 12, spon: 0.95, bet: 0.3, eth: 0.12 }, cod: { view: 14, spon: 1.05, bet: 0.2, eth: 0.12 },
  mlbb: { view: 55, spon: 1, bet: 0.3, eth: 0.12 }, fn: { view: 22, spon: 1.25, bet: 0.05, eth: 0.3 }, apex: { view: 12, spon: 1, bet: 0.12, eth: 0.18 },
  pubg: { view: 9, spon: 0.85, bet: 0.35, eth: 0.1 }, fc: { view: 9, spon: 1.2, bet: 0.35, eth: 0.15 }, sf6: { view: 8, spon: 1, bet: 0.1, eth: 0.18 },
  sc2: { view: 5, spon: 0.85, bet: 0.15, eth: 0.15 }, hok: { view: 45, spon: 1, bet: 0.2, eth: 0.12 }, cf: { view: 8, spon: 0.8, bet: 0.3, eth: 0.1 },
  wz: { view: 7, spon: 1, bet: 0.2, eth: 0.12 }, pubgm: { view: 35, spon: 0.95, bet: 0.3, eth: 0.12 }, ff: { view: 25, spon: 0.9, bet: 0.3, eth: 0.12 },
  tft: { view: 8, spon: 1, bet: 0.1, eth: 0.2 }, trackmania: { view: 3, spon: 1.05, bet: 0.05, eth: 0.3 }, tk8: { view: 6, spon: 0.95, bet: 0.15, eth: 0.15 },
  fatal: { view: 2, spon: 0.9, bet: 0.15, eth: 0.15 }, chess: { view: 8, spon: 1.15, bet: 0.08, eth: 0.35 },
};
const ecoOf = game => GAME_ECO[game] || { view: 10, spon: 1, bet: 0.2, eth: 0.15 };
// poids économique d'un jeu (audience) : la valeur des joueurs et leurs salaires en dépendent
const ecoMult = game => clamp(0.25 + 0.8 * Math.sqrt(ecoOf(game).view / 100), 0.3, 1.1);
// niveau de la division d'un club dans un jeu : un joueur de tier 1 vaut plus et demande plus qu'en tier 3
const TIER_VALUE = [1.2, 0.85, 0.65];
const clubTierIn = (clubId, game) => { const d = clubId && divOf(clubId, game); return d ? (GAMES[game].open ? d.tier : d.tier) : 0; };
// ---------- joueurs ----------
function playerValue(p) {
  const g = { mult: ecoMult(p.game) }, tier = clubTierIn(p.club, p.game);
  const af = p.age <= 20 ? 1.3 : p.age <= 24 ? 1.15 : p.age <= 28 ? 1 : p.age <= 31 ? 0.7 : 0.45;
  const potBonus = 1 + Math.max(0, p.pot - p.rating) * 0.02;
  return Math.max(2000, Math.round(25000 * Math.pow(1.13, p.rating - 60) * af * g.mult * potBonus * (tier ? TIER_VALUE[tier - 1] : 0.85) / 500) * 500);
}
function salaryDemand(p, club) {
  // courbe exponentielle : ~200 €/sem pour un amateur noté 60, ~15 k€/sem pour une superstar notée 95
  const base = (150 + 15 * Math.pow(1.17, p.rating - 50)) * Math.max(0.45, ecoMult(p.game));
  // les petits clubs doivent payer plus cher pour attirer les stars
  const prestige = club ? 1 + Math.max(0, p.rating - 50 - club.fame) / 100 : 1;
  // les salaires suivent le niveau de la division du club (tier 1 mieux payé)
  const t = club ? clubTierIn(club.id, p.game) : 0, tierF = t ? [1.15, 0.9, 0.75][t - 1] : 1;
  return Math.max(150, Math.round(base * prestige * tierF / 50) * 50);
}
// potentiel : marge de progression qui dépend surtout de l'âge (un joueur de 25 ans ou plus a atteint son plafond)
function potentialFor(rating, age) {
  const gain = age <= 18 ? randi(5, 12) : age <= 20 ? randi(3, 8) : age <= 22 ? randi(1, 5) : age <= 24 ? randi(0, 2) : 0;
  return clamp(rating + gain, rating, 99);
}
function makePlayer(handle, nat, rating, age, game, roleIdx, club) {
  const g = GAMES[game];
  const p = {
    id: uid("p"), handle, nat, game, rating, age: age || randi(17, 23), ageKnown: !!age,
    role: g.roles[roleIdx % g.roles.length],
    pot: potentialFor(rating, age || 21),
    form: randi(55, 80), morale: randi(60, 85), club: club || null,
    salary: 0, years: randi(1, 3), starter: false, stats: { w: 0, l: 0, mvp: 0 },
  };
  p.salary = Math.round(salaryDemand(p) * rand(0.85, 1.1) / 50) * 50;
  // détails du contrat (les stars des clubs IA ont souvent une clause libératoire élevée)
  p.prizeShare = 50; p.winBonus = 0; p.status = "Titulaire";
  p.clause = club && rating >= 80 && Math.random() < 0.6 ? Math.round(playerValue(p) * rand(2, 4) / 10000) * 10000 : 0;
  return p;
}
function genPlayer(game, minR, maxR, ageMin = 17, ageMax = 28, club = null, roleIdx = null) {
  const g = GAMES[game];
  return makePlayer(genHandle(), pick(Object.keys(COUNTRIES)), randi(minR, maxR), randi(ageMin, ageMax), game, roleIdx ?? randi(0, g.roles.length - 1), club);
}
function addPlayer(p) { S.players[p.id] = p; }
const user = () => S.clubs[S.userId];
const divOf = (clubId, game) => S.clubs[clubId] && S.clubs[clubId].divisions[game];
const clubPlayers = (clubId, game) => { const d = divOf(clubId, game); return d ? d.players.map(id => S.players[id]).filter(Boolean) : []; };
const allUserPlayers = () => Object.keys(user().divisions).flatMap(g => gamePlayers(g));
// noms des joueurs d'une équipe ; un partenaire extérieur au club est marqué d'un astérisque
function soloName(club, game) { return clubPlayers(club.id, game).map(p => p.handle).concat(unitMates(club.id, game).map(p => p.handle + "*")).join(" & ") || club.name; }
const unitMates = (clubId, game) => { const d = divOf(clubId, game); return d && d.mates ? d.mates.map(id => S.players[id]).filter(Boolean) : []; };

// ---------- clubs ----------
// ---------- palmarès réel ----------
// rapproche un nom d'équipe des sources (« Gen.G Esports », « Leviatán ») d'une organisation du jeu
const normTeam = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/\b(team|esports?|gaming|club|e-sports)\b/g, "").replace(/[^a-z0-9]/g, "");
function findOrgId(name) {
  if (!findOrgId.idx) {
    findOrgId.idx = {};
    for (const [id, o] of Object.entries(ORGS)) { findOrgId.idx[normTeam(o[0])] = findOrgId.idx[normTeam(o[0])] || id; findOrgId.idx[normTeam(o[1])] = findOrgId.idx[normTeam(o[1])] || id; }
  }
  return findOrgId.idx[normTeam(name)] || null;
}
// titres réels (avant 2026) : palmarès des clubs et historique de « Clubs & palmarès »
function seedRealHistory() {
  if (typeof LIVE_HISTORY === "undefined") return;
  for (const [game, list] of Object.entries(LIVE_HISTORY)) {
    // équipes au nom propre dans ce jeu (« Team Liquid Brazil », section GC de Team Liquid)
    const byLabel = {};
    for (const c of Object.values(S.clubs)) if (c.divisions[game] && c.divisions[game].label) byLabel[normTeam(c.divisions[game].label)] = c.id;
    for (const [year, name, winner] of list.slice().sort((a, b) => a[0] - b[0])) {
      const nw = normTeam(winner);
      // « Gentle Mates Alpine », « G2 Stride » : l'organisation dont le nom commence le nom de l'équipe
      const prefix = () => Object.values(S.clubs).filter(c => c.divisions[game] && !c.solo && !c.filler && normTeam(c.name).length >= 2 && nw.startsWith(normTeam(c.name)))
        .sort((a, b) => normTeam(b.name).length - normTeam(a.name).length)[0]?.id;
      const id = byLabel[nw] || findOrgId(winner) || Object.entries(byLabel).find(([k]) => nw.length > 3 && k.startsWith(nw))?.[1] || prefix(), c = id && S.clubs[id];
      if (c) c.titles.push(name);
      S.titles.push({ season: year, game, name, club: c ? (c.divisions[game] && c.divisions[game].label) || c.name : winner, clubId: c ? id : null, real: true });
    }
  }
}
// ---------- académies ----------
// une académie est une seconde équipe du club du joueur dans un jeu par équipes, deux tiers sous l'équipe première au mieux un tier sous elle
const academyId = game => `${S.userId}~aca~${game}`;
const academyOf = game => S.clubs[academyId(game)] || null;
const userAcademies = () => Object.values(S.clubs).filter(c => c.parent === S.userId && c.academyOf);
// toutes les équipes du club du joueur dans un jeu : équipe première, académie, autres duos/trios (Fortnite)
const userTeams = game => [S.userId].concat(Object.values(S.clubs).filter(c => c.parent === S.userId && c.divisions[game]).map(c => c.id)).filter(id => divOf(id, game));
const gamePlayers = game => userTeams(game).flatMap(id => clubPlayers(id, game));
const canHaveAcademy = game => GAMES[game].fmt === "team";
// installations d'un club (une académie utilise celles de son club)
const facOf = c => (c.parent && S.clubs[c.parent] ? S.clubs[c.parent] : c).facilities;
function academyCost(game) { return tierEntry(game, 3) + 20000; }
function canCreateAcademy(game) {
  const u = user(), d = u.divisions[game];
  if (!canHaveAcademy(game)) return "Les académies existent seulement pour les jeux en équipe (LoL, CS2, Valorant, CoD…).";
  if (!d) return "Ouvrez d'abord une équipe première dans ce jeu.";
  if (academyOf(game)) return "Vous avez déjà une académie dans ce jeu.";
  if (d.tier >= 3) return "Votre équipe première doit jouer au moins en tier 2 : l'académie ne peut pas être dans la même division.";
  if (u.facilities.academy < 1) return "Construisez d'abord l'infrastructure « Académie » (onglet Infrastructures).";
  if (u.budget < academyCost(game)) return `Budget insuffisant (${money(academyCost(game))}).`;
  return null;
}
// des jeunes à fort potentiel, peu payés
function academyProspect(game, aca) {
  const lvl = user().facilities.academy;
  const [lo, hi] = TIER_RATING[2];
  const p = genPlayer(game, lo - 2 + lvl, hi - 4 + lvl * 2, 16, 19);
  p.pot = clamp(p.rating + randi(8, 16 + lvl * 2), 0, 96); addPlayer(p);
  const r = REGION_OF[aca.country] || "EU"; if (homeRegion(p) !== r) p.region = r;   // jeune recruté par la filière locale
  joinClub(p, aca, round50(200 + p.rating * 4), 2); p.status = "Espoir"; p.prizeShare = 30;
  return p;
}
function createAcademy(game) {
  const e = canCreateAcademy(game); if (e) return e;
  const u = user(), g = GAMES[game];
  book("academy", -academyCost(game), game, "Création de l'académie");
  const c = baseClub(academyId(game), `${u.name} Academy`, (u.tag + "A").slice(0, 5), u.country, u.color, Math.round(u.fame * 0.4), false);
  c.parent = u.id; c.academyOf = game;
  S.clubs[c.id] = c;
  const zone = u.divisions[game].zone || "W";
  c.divisions[game] = { tier: 3, zone, players: [] };
  const L = S.leagues[lkey(game, 3, zone)];
  const fid = L.teams.find(id => S.clubs[id].filler);
  if (fid) { swapInLeague(L, fid, c.id); dissolveDivision(fid, game); } else { L.teams.push(c.id); L.table[c.id] = emptyRow(g.fmt); }
  for (let i = 0; i < g.size + 1; i++) academyProspect(game, c);
  autoStarters(c.id, game);
  mail(`🎓 ${c.name} (${g.short})`, `Votre académie ${g.name} est créée et rejoint le <b>${tierName(game, 3)}</b>. ${g.size + 1} jeunes de 16 à 19 ans y signent leur premier contrat.<br>
    Faites monter les meilleurs en équipe première, envoyez-y des joueurs pour qu'ils prennent du temps de jeu. L'académie progresse plus vite avec un bon niveau d'infrastructure « Académie », mais ne peut jamais jouer dans la même division que l'équipe première.`, "info");
  return null;
}
// passer un joueur de l'équipe première à l'académie et inversement (même contrat)
function moveToAcademy(pid) {
  const p = S.players[pid], aca = academyOf(p.game);
  if (!aca) return "Pas d'académie dans ce jeu.";
  if (p.club === aca.id) { removeFromClub(p, true); user().divisions[p.game].players.push(p.id); p.club = S.userId; p.starter = false; autoStarters(aca.id, p.game); return `${p.handle} rejoint l'équipe première (sur le banc).`; }
  if (p.club !== S.userId) return "Ce joueur n'est pas dans votre club.";
  if (clubPlayers(aca.id, p.game).length >= GAMES[p.game].size + 3) return "L'académie est complète.";
  removeFromClub(p, true); aca.divisions[p.game].players.push(p.id); p.club = aca.id;
  if (p.status === "Star" || p.status === "Titulaire") p.morale = clamp(p.morale - 20, 0, 100);
  autoStarters(aca.id, p.game);
  return `${p.handle} part à l'académie${p.status === "Star" || p.status === "Titulaire" ? " (il le prend très mal : on lui avait promis une place de titulaire)" : ""}.`;
}
function closeAcademy(game) {
  const aca = academyOf(game); if (!aca) return;
  for (const p of clubPlayers(aca.id, game)) releasePlayer(p.id, true);
  const L = leagueOf(aca.id, game);
  const f = fillerClub(game, aca.divisions[game].tier, aca.divisions[game].zone);
  swapInLeague(L, aca.id, f.id);
  delete S.clubs[aca.id];
}
function baseClub(id, name, tag, country, color, fame, ai) {
  const fac = ai ? Math.floor(fame / 22) : 0;
  return {
    id, name, tag, country, color, fame, ai,
    fans: Math.round(2.5 * Math.pow(fame, 3) + 500),
    budget: Math.round(fame * 45000), divisions: {},
    facilities: { house: fac, coaching: fac, analytics: fac, content: fac, academy: fac },
    sponsorDeals: [], titles: [],
  };
}
function orgClub(id) {
  if (S.clubs[id]) return S.clubs[id];
  const [name, tag, cc, color, fame] = ORGS[id];
  return (S.clubs[id] = baseClub(id, name, tag, cc, color, fame, true));
}
function addDivision(club, game, tier, roster, zone = "W", sub = null) {
  club.divisions[game] = { tier, zone, players: [] };
  if (sub) club.divisions[game].sub = sub;
  roster.forEach(([h, n, r, a], i) => {
    const p = makePlayer(h, n, r, a, game, i, club.id);
    p.starter = i < GAMES[game].size; addPlayer(p); club.divisions[game].players.push(p.id);
  });
  // une équipe réelle est inscrite dans une seule région, même si ses joueurs viennent d'ailleurs
  const ps = clubPlayers(club.id, game);
  if (ps.length) { const r = clubRegion(club, game); ps.forEach(p => { if (homeRegion(p) !== r) p.region = r; }); }
}
// équipe supplémentaire d'une organisation dans un jeu solo/duo (ex. 2e duo Fortnite de Solary)
function sisterClub(orgId, game) {
  const base = orgClub(orgId);
  let n = 2; while (S.clubs[`${orgId}~${game}${n}`]) n++;
  const c = baseClub(`${orgId}~${game}${n}`, base.name, base.tag, base.country, base.color, base.fame, true);
  c.sister = orgId;
  return (S.clubs[c.id] = c);
}
// club indépendant : un joueur (ou un duo) qui joue sous son propre nom
function soloClub(game, tier, roster, zone, sub) {
  const id = uid("solo");
  const avg = roster.reduce((s, p) => s + p[2], 0) / roster.length;
  const c = baseClub(id, roster.map(p => p[0]).join(" & "), roster[0][0].slice(0, 4).toUpperCase(), roster[0][1],
    `hsl(${randi(0, 359)} 55% 55%)`, clamp(Math.round((avg - 55) * 1.5), 5, 70), true);
  c.solo = true;
  addDivision(c, game, tier, roster, zone, sub);
  S.clubs[id] = c;
  return c;
}
// club fictif : réutilise un nom libre pour ce jeu (un même club fictif peut avoir plusieurs divisions)
function fillerClub(game, tier, zone = "W", sub = null, range = null) {
  const g = GAMES[game];
  const [lo, hi] = range || TIER_RATING[tier - 1], sccs = sub && SUB_CC[sub] ? SUB_CC[sub].split(" ") : null, ccs = sccs || zoneCountries(game, zone);
  if (g.fmt === "duel" || (g.fmt === "br" && g.size <= 2)) {
    const roster = Array.from({ length: g.size }, () => [genHandle(), pick(ccs), randi(lo, hi), randi(16, 27)]);
    const c = soloClub(game, tier, roster, zone, sub); c.filler = true; return c;
  }
  // un nom de club de la zone (« Seoul Phantoms » en Corée), libre dans ce jeu
  let cand = shuffle(FILLER_NAMES).find(([n, tag, col, cc]) => { const c = S.clubs["f_" + tag]; return ccs.includes(cc) && (!c || !c.divisions[game]); });
  let c;
  if (cand) {
    const [name, tag, color, cc] = cand, id = "f_" + tag;
    c = S.clubs[id] || (S.clubs[id] = baseClub(id, name, tag, cc, color, randi(...[[45, 60], [20, 40], [5, 20]][tier - 1]), true));
  } else {
    let tag; do tag = "X" + randi(100, 999); while (S.clubs["f_" + tag]);
    const local = FILLER_NAMES.filter(x => ccs.includes(x[3]));
    c = S.clubs["f_" + tag] = baseClub("f_" + tag, (local.length ? pick(local) : pick(FILLER_NAMES))[0] + " " + tag, tag, pick(ccs), `hsl(${randi(0, 359)} 45% 50%)`, randi(...[[45, 60], [20, 40], [5, 20]][tier - 1]), true);
  }
  c.filler = true;
  const roster = Array.from({ length: g.size }, () => [genHandle(), Math.random() < 0.7 && ccs.includes(c.country) ? c.country : pick(ccs), randi(lo, hi), randi(17, 29)]);
  addDivision(c, game, tier, roster, zone, sub);
  return c;
}

// ---------- création du monde ----------
function newWorld(opts) {
  S = {
    version: 2, dataVersion: dataVersion(), ceo: opts.ceo, mode: opts.mode, season: 2026, week: 1, over: false,
    clubs: {}, players: {}, leagues: {}, inbox: [], finance: [], titles: [], ledger: [], tourResults: [], tourChoice: {},
    userId: null, board: { confidence: 60, objective: null }, lastWeek: null,
  };
  applySeasonFormats();
  for (const game of Object.keys(GAMES)) {
    const g = GAMES[game], open = g.open, sizes = zoneSizes(game);
    const byZone = {};
    const slot = z => byZone[z] || (byZone[z] = [[], [], []]);
    const all = planTiers(game);
    for (const e of all) {
      // une org peut aligner plusieurs duos/joueurs dans un jeu solo : les suivants jouent dans une équipe « sœur » à ses couleurs
      let c = e.orgId ? orgClub(e.orgId) : null;
      if (c && c.divisions[game]) c = g.size <= 2 ? sisterClub(e.orgId, game) : null;
      if (c) { addDivision(c, game, e.tier, e.roster, e.zone, e.sub); c.divisions[game].verified = e.verified || !!SOLOS[game]; if (e.label) c.divisions[game].label = e.label; }
      const club = c || soloClub(game, e.tier, e.roster, e.zone, e.sub);
      slot(e.zone)[e.tier - 1].push(club.id);
    }
    // divisions réelles sans effectif connu : joueurs inventés au niveau du club
    for (const [orgId, games] of Object.entries(EXTRA_DIVS)) {
      if (!games.includes(game) || !ORGS[orgId]) continue;
      const c = orgClub(orgId);
      if (c.divisions[game]) continue;
      const zone = entryZone(game, orgId, [[null, c.country]]), b = slot(zone);
      // équipe aux joueurs inventés : en tier 1 seulement si les vraies équipes de sa zone ne suffisent pas à le remplir
      const tier = open ? 1 : c.fame >= 70 && b[0].length < sizes[0] && !isClosed(game, 1, zone) ? 1 : b[1].length < sizes[1] ? 2 : 3;
      const [lo, hi] = TIER_RATING[tier - 1];
      const roster = Array.from({ length: g.size }, () => [genHandle(), c.country, randi(lo + 2, hi), randi(18, 26)]);
      addDivision(c, game, tier, roster, zone, subFor(game, tier, zone, c.country));
      c.divisions[game].generated = true;
      b[tier - 1].push(c.id);
    }
    for (const zone of gameZones(game)) {
      const b = slot(zone);
      for (let t = 1; t <= 3; t++) {
        if (open && t > 1) break;
        // une ligue par sous-ligue nationale quand le tier en a (LFL, Prime League…), sinon une seule
        for (const sub of subsOf(game, t, zone) || [null]) {
          const key = lkey(game, t, zone, sub);
          const teams = b[t - 1].filter(id => (divOf(id, game).sub || null) === sub);
          const L = S.leagues[key] = { key, game, tier: t, zone, sub, teams, schedule: [], table: {}, results: [], playoffs: null, champion: null };
          const min = zone === "W" ? LEAGUE_SIZE : open ? 12 : MIN_LEAGUE;
          // clubs fictifs au niveau des vraies équipes de la ligue (une petite ligue nationale reste une petite ligue)
          const rs = teams.flatMap(id => clubPlayers(id, game).map(p => p.rating)), avg = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0;
          const range = avg ? [Math.round(avg - 5), Math.round(avg + 1)] : null;
          while (L.teams.length < min) L.teams.push(fillerClub(game, t, zone, sub, range).id);
        }
      }
      // circuit ouvert : statut Élite / Pro / Open d'après le niveau, dans la région
      if (open) {
        const L = S.leagues[lkey(game, 1, zone)], [a, bb] = statusCuts(L.teams.length);
        L.teams.slice().sort((x, y) => teamStrength(y, game).str - teamStrength(x, game).str).forEach((id, i) => S.clubs[id].divisions[game].tier = i < a ? 1 : i < bb ? 2 : 3);
      }
    }
  }
  // un remplaçant pour chaque équipe d'au moins 3 joueurs
  for (const c of Object.values(S.clubs)) for (const [game, d] of Object.entries(c.divisions)) {
    if (GAMES[game].size >= 3) {
      const [lo, hi] = TIER_RATING[d.tier - 1];
      const sub = genPlayer(game, lo - 4, hi - 6, 17, 24, c.id); addPlayer(sub); d.players.push(sub.id);
      const r = clubRegion(c, game); if (homeRegion(sub) !== r) sub.region = r;
    }
  }
  // effectifs incomplets (joueur parti, info manquante) : on complète
  aiFillRoster.pool = {};
  for (const c of Object.values(S.clubs)) for (const game of Object.keys(c.divisions)) aiFillRoster(c.id, game);
  aiFillRoster.pool = null;
  // vrais joueurs sans équipe (sources Liquipedia) : agents libres
  for (const [game, list] of Object.entries(typeof LIVE_FREE_AGENTS !== "undefined" ? LIVE_FREE_AGENTS : {})) {
    if (!GAMES[game]) continue;
    list.forEach(([h, nat, r, a], i) => { const p = makePlayer(h, nat, r, a, game, i, null); p.years = 0; p.club = null; p.starter = false; addPlayer(p); });
  }
  // agents libres générés
  for (const game of Object.keys(GAMES)) {
    const n = GAMES[game].size * 14 + 8;
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      const p = r < 0.65 ? genPlayer(game, 48, 64, 16, 26) : r < 0.95 ? genPlayer(game, 62, 72, 17, 28) : genPlayer(game, 72, 77, 19, 30);
      p.years = 0; addPlayer(p);
    }
  }
  seedRealHistory();
  seedRanking();
  seedCoaches();
  // club du joueur
  if (opts.mode === "create") {
    const c = baseClub("user", opts.name, opts.tag, opts.country, opts.color, 5, false);
    c.budget = START_BUDGET; c.fans = 800;
    S.clubs.user = c; S.userId = "user";
    joinLeague(opts.firstGame, 3);
  } else {
    S.userId = opts.clubId; S.clubs[opts.clubId].ai = false;
    // les autres duos/trios de l'organisation (Fortnite) deviennent des équipes du club
    for (const c of Object.values(S.clubs)) if (c.sister === opts.clubId) {
      const game = Object.keys(c.divisions)[0];
      c.ai = false; c.parent = opts.clubId; c.unitOf = game; delete c.sister;
      if (!S.clubs[opts.clubId].divisions[game]) { delete S.clubs[c.id]; continue; }
      c.divisions[game].mates = [];
    }
  }
  newSeasonSetup(true);
  const u = user();
  mail("Bienvenue, " + S.ceo + " !",
    opts.mode === "create"
      ? `Vous venez de fonder <b>${u.name}</b> avec ${money(u.budget)} en poche. Votre club démarre en <b>${tierLabel(opts.firstGame, 3)}</b> du ${GAMES[opts.firstGame].name} (${divName(u.id, opts.firstGame)}).<br>
         Recrutez au <b>Mercato</b> (filtre « agents libres »), terminez dans les 2 premiers pour monter en tier 2, puis visez le tier 1.`
      : `Vous êtes le nouveau CEO de <b>${u.name}</b>. Objectif du conseil : <b>${objectiveText()}</b>.<br>Les supporters vous attendent au tournant !`, "info");
  save();
}

// ---------- circuits ----------
function roundRobin(teams) {
  const t = teams.slice();
  if (t.length % 2) t.push(null);
  const n = t.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = t[i], b = t[n - 1 - i];
      if (a && b) pairs.push(r % 2 ? [b, a] : [a, b]);
    }
    rounds.push(pairs);
    t.splice(1, 0, t.pop());
  }
  return rounds;
}
const emptyRow = fmt => fmt === "br" ? { pts: 0, kills: 0, top1: 0, games: 0, place: 0 } : { w: 0, l: 0, mw: 0, ml: 0 };

// formats qui changent selon l'année (Fortnite : duos puis trios). À appeler dès que S.season change ou qu'une partie est chargée.
function applySeasonFormats() {
  const changed = [];
  for (const [k, g] of Object.entries(GAMES)) {
    if (!g.formats) continue;
    const f = g.formats[S.season % 2 === 0 ? "even" : "odd"];
    if (g.size !== f.size) changed.push(k);
    Object.assign(g, f);
  }
  return changed;
}
function newSeasonSetup(first) {
  const changed = applySeasonFormats();
  for (const game of changed) {
    if (first) continue;
    const g = GAMES[game];
    // les clubs de l'IA complètent (ou réduisent) leurs équipes ; le joueur doit recruter lui-même
    for (const c of Object.values(S.clubs)) {
      if (!c.divisions[game]) continue;
      if (c.id !== S.userId) aiFillRoster(c.id, game);
      if (c.id !== S.userId || g.size < clubPlayers(c.id, game).filter(p => p.starter).length) autoStarters(c.id, game);
    }
    if (user().divisions[game]) {
      const n = clubPlayers(S.userId, game).length;
      mail(`${g.icon} ${g.name} ${S.season} : place aux ${g.unit}s !`, `La FNCS change de format cette saison : les équipes jouent en <b>${g.unit}s</b> (${g.size} joueurs, lobbies de ${g.lobby * g.size} joueurs).` +
        (n < g.size ? `<br>Votre effectif n'a que ${n} joueur(s) : recrutez vite, une place vide coûte très cher en lobby.` : `<br>Vérifiez vos titulaires dans l'onglet Effectifs.`), "info");
    }
  }
  for (const L of Object.values(S.leagues)) {
    L.teams = L.teams.filter(id => S.clubs[id] && divOf(id, L.game));
    const fmt = GAMES[L.game].fmt;
    // matchs aller et retour, sur les journées du calendrier
    const rr = fmt === "br" ? [] : roundRobin(shuffle(L.teams));
    L.schedule = rr.concat(rr.map(rd => rd.map(([a, b]) => [b, a]))).slice(0, LEAGUE_DAYS.length);
    L.table = {};
    L.teams.forEach(id => L.table[id] = emptyRow(fmt));
    L.results = []; L.playoffs = null; L.champion = null;
  }
  S.week = SEASON_FIRST;
  S.rep = null; S.tourChoice = {}; S.tourOrder = {}; if (S.moves) S.moves = S.moves.filter(m => m[0] >= S.season - 1);
  S.smallTours = genSmallEvents();
  S.ewc = {};
  S.board.objective = pickObjective(first);
  if (!first) mail(`Saison ${S.season} : objectif du conseil`, `Le conseil d'administration fixe l'objectif : <b>${objectiveText()}</b>.`, "board");
}
function bestTier() { const ts = Object.values(user().divisions).map(d => d.tier); return ts.length ? Math.min(...ts) : 3; }
function pickObjective(first) {
  const u = user(), t = bestTier();
  if (S.mode === "create" && first) return { type: "budget", tier: 3 };
  if (t === 1) return { type: u.fame >= 90 ? "title" : u.fame >= 80 ? "final" : "top4", tier: 1 };
  if (t === 2) return { type: u.fame >= 50 ? "final" : "top4", tier: 2 };
  return { type: "top4", tier: 3 };
}
// circuit ouvert : dans chaque région, les 10 % les mieux classés ont le statut Élite, les 40 % suivants... jusqu'au top 40 % le statut Pro
const statusCuts = n => [Math.max(2, Math.round(n * 0.1)), Math.max(4, Math.round(n * 0.4))];
// rang à atteindre dans le circuit régional du club pour obtenir le statut t
function statusCut(game, t) { const L = leagueOf(S.userId, game), [a, b] = statusCuts(L ? L.teams.length : 100); return t === 1 ? a : b; }
function objectiveText(o = S.board.objective) {
  if (!o) return "";
  const u = S.userId && user(), onlyOpen = u && Object.keys(u.divisions).length && Object.keys(u.divisions).every(g => GAMES[g].open);
  const where = onlyOpen ? `d'un circuit avec le statut ${tierLabel(Object.keys(u.divisions)[0], o.tier)}${o.tier > 1 ? " ou mieux" : ""}`
    : `d'un circuit ${TIER_LABEL[o.tier - 1]}${o.tier > 1 ? " ou mieux" : ""}`;
  const open = u ? Object.entries(u.divisions).filter(([g, d]) => GAMES[g].open && d.tier > 1 && d.tier <= o.tier) : [];
  const extra = (o.type === "top4" || o.type === "final") && open.length ? ` (${open.map(([g, d]) => `${GAMES[g].name} : finir dans le top ${statusCut(g, d.tier - 1)} du circuit pour le statut ${tierLabel(g, d.tier - 1)}`).join(", ")})` : "";
  return { title: `remporter le titre ${where}`, final: `atteindre la finale ${where}${extra}`, top4: `se qualifier pour les playoffs ${where}${extra}`,
    budget: "terminer la saison avec un budget positif et une équipe complète" }[o.type];
}
function standings(key) {
  const L = S.leagues[key], br = GAMES[L.game].fmt === "br";
  return Object.entries(L.table).filter(([id]) => S.clubs[id])
    .map(([id, t]) => ({ id, ...t, diff: (t.mw || 0) - (t.ml || 0) }))
    .sort(br ? (a, b) => b.pts - a.pts || b.top1 - a.top1 || b.kills - a.kills
             : (a, b) => b.w - a.w || b.diff - a.diff || b.mw - a.mw);
}
function userLeagues() { return Object.keys(user().divisions).map(g => leagueOf(S.userId, g)).filter(Boolean); }

// ---------- divisions ----------
function canJoin(game, tier) {
  const u = user();
  if (u.divisions[game]) return "Division déjà ouverte.";
  if (tier === 1 && isClosed(game, 1, zoneFrom(game, REGION_OF[u.country] || "EU", u.country))) return `${tierName(game, 1, zoneFrom(game, REGION_OF[u.country] || "EU", u.country))} est une ligue fermée : il faut racheter la place (franchise) d'un club.`;
  if (GAMES[game].open && tier < 3) return `${GAMES[game].name} est un circuit ouvert : tout le monde y entre en statut ${tierLabel(game, 3)}, le statut ${tierLabel(game, tier)} se gagne au classement.`;
  if (u.fame < fameReq(game, tier)) return `Notoriété ${fameReq(game, tier)} requise pour acheter une place en ${TIER_LABEL[tier - 1]} de ${GAMES[game].short} (vous êtes à ${Math.round(u.fame)}).`;
  if (u.budget < tierEntry(game, tier)) return "Budget insuffisant.";
  return null;
}
// ---------- changer de tier (achat d'une place plus haut, ou descente volontaire) ----------
// pas encore de match joué cette saison dans la ligue du club : le changement peut être immédiat
function seasonStarted(game) {
  const L = leagueOf(S.userId, game), r = L && L.table[S.userId];
  return !L || !!L.playoffs || !!(r && (r.w || r.l || r.games));
}
function tierChangeCheck(game, t) {
  const u = user(), d = u.divisions[game], g = GAMES[game]; if (!d) return "Pas de section dans ce jeu.";
  if (g.open) return `${g.name} est un circuit ouvert : le statut se gagne au classement du circuit.`;
  if (RANKED_GAMES.includes(game)) return `En ${g.short}, les tiers suivent le classement mondial : montez en gagnant des matchs et des tournois.`;
  if (!(t >= 1 && t <= 3)) return "Ce tier n'existe pas.";
  if (t === d.tier) return "Votre équipe joue déjà dans ce tier.";
  if (isClosed(game, d.tier, d.zone || "W")) return `${tierName(game, d.tier, d.zone)} est une ligue fermée : il faut revendre votre franchise.`;
  if (isClosed(game, t, d.zone || "W")) return `${tierName(game, t, d.zone)} est une ligue fermée : il faut racheter une franchise.`;
  if (t < d.tier && u.fame < fameReq(game, t)) return `Notoriété ${fameReq(game, t)} requise pour acheter une place en ${TIER_LABEL[t - 1]} de ${GAMES[game].short} (vous êtes à ${Math.round(u.fame)}).`;
  if (t < d.tier && u.budget < tierEntry(game, t)) return `Budget insuffisant : la place coûte ${money(tierEntry(game, t))}.`;
  const aca = academyOf(game);
  if (t > d.tier && aca && aca.divisions[game].tier <= t) return "Votre académie joue dans ce tier ou plus bas : l'équipe première ne peut pas y descendre.";
  return null;
}
// le club du joueur prend la place d'un club du tier visé (le plus faible s'il monte, le plus fort s'il descend), qui prend la sienne
function moveTier(game, t) {
  const u = user(), d = u.divisions[game], zone = d.zone || "W", from = leagueOf(u.id, game);
  const sub = subPrefFor(u.id, game, t, zone), to = S.leagues[lkey(game, t, zone, sub)];
  if (!from || !to) return "Ligue introuvable.";
  const cand = to.teams.filter(id => S.clubs[id] && !isMine(id) && !S.clubs[id].parent).sort((a, b) => teamStrength(a, game).str - teamStrength(b, game).str);
  const swap = t < d.tier ? cand[0] : cand[cand.length - 1];
  if (!swap) return "Aucune place disponible.";
  const fee = t < d.tier ? tierEntry(game, t) : 0;
  if (fee) book("entry", -fee, game, `Place achetée en ${tierName(game, t, zone, sub)}`);
  const old = { tier: d.tier, sub: d.sub }, sd = S.clubs[swap].divisions[game];
  swapInLeague(to, swap, "__swap"); swapInLeague(from, u.id, swap); swapInLeague(to, "__swap", u.id);
  d.tier = t; if (sub) d.sub = sub; else delete d.sub;
  sd.tier = old.tier; if (old.sub) sd.sub = old.sub; else delete sd.sub;
  if (t > old.tier) { u.fame = Math.max(1, u.fame - 2); S.board.confidence = clamp(S.board.confidence - 5, 0, 100); }
  mail(`${t < old.tier ? "⬆️" : "⬇️"} ${GAMES[game].short} : changement de tier`, `${u.name} joue désormais en <b>${tierName(game, t, zone, sub)}</b> (${TIER_LABEL[t - 1]})${fee ? `, place achetée ${money(fee)}` : ""}. ${clubLabel(swap, game)} prend votre ancienne place.${t > old.tier ? " Le conseil et les fans n'apprécient pas la descente volontaire." : ""}`, "info", game);
  return null;
}
// demande de changement : tout de suite si la saison du club n'a pas commencé, sinon à la fin de la saison
function requestTier(game, t) {
  const e = tierChangeCheck(game, t); if (e) return { err: e };
  if (!seasonStarted(game)) { const er = moveTier(game, t); return er ? { err: er } : { now: true }; }
  (user().tierReq = user().tierReq || {})[game] = t;
  return { later: true };
}
function applyTierRequests(moves) {
  const u = user();
  for (const [game, t] of Object.entries(u.tierReq || {})) {
    delete u.tierReq[game];
    if (!u.divisions[game]) continue;
    const e = tierChangeCheck(game, t) || moveTier(game, t);
    moves.push(e ? `❌ ${GAMES[game].short} : changement de tier impossible (${e})` : `🔀 ${GAMES[game].short} : votre équipe passe en ${TIER_LABEL[t - 1]} comme demandé`);
  }
}
function openDivision(game, tier, sub) {
  const e = canJoin(game, tier); if (e) return e;
  if (sub) (user().subPref || (user().subPref = {}))[game] = sub;
  const fee = tierEntry(game, tier);
  book("entry", -fee, game, "Droit d'entrée : " + tierName(game, tier));
  const late = joinLeague(game, tier);
  mail(`Nouvelle division : ${GAMES[game].name}`, `Votre club rejoint le <b>${divName(S.userId, game)}</b> (${tierLabel(game, tier)}) pour ${money(fee)}. Il vous faut ${GAMES[game].size} joueur(s) titulaire(s).${late ? "<br>Le calendrier étant déjà fixé, vos matchs commenceront la saison prochaine." : ""}`, "info");
  return null;
}
// ---------- franchises (ligues fermées : LEC, LCK, VCT, CDL…) ----------
const isClosed = (game, tier, zone = "W") => !!(FRANCHISES[game] && FRANCHISES[game][tier] && FRANCHISES[game][tier][zone] !== undefined);
const franchiseZones = game => FRANCHISES[game] && FRANCHISES[game][1] ? Object.keys(FRANCHISES[game][1]) : [];
// prix d'une place : selon la ligue et le prestige du club vendeur
function franchisePrice(game, zone, sellerId) {
  const c = S.clubs[sellerId];
  return Math.round(FRANCHISES[game][1][zone] * (c.filler ? 0.75 : 0.7 + c.fame / 150) / 100000) * 100000;
}
// places à vendre : les clubs fictifs et les 3 clubs les moins connus de la ligue (les grandes organisations ne vendent pas)
function franchiseSlots(game, zone) {
  const L = S.leagues[lkey(game, 1, zone)]; if (!L) return [];
  const others = L.teams.filter(id => S.clubs[id] && !isMine(id) && !(S.franchiseDeal && S.franchiseDeal.sellerId === id));
  const real = others.filter(id => !S.clubs[id].filler && S.clubs[id].fame < 75).sort((a, b) => S.clubs[a].fame - S.clubs[b].fame).slice(0, 3);
  return others.filter(id => S.clubs[id].filler).concat(real).map(id => ({ id, price: franchisePrice(game, zone, id) }));
}
// pendant la saison de ligue, la place change de mains à la fin de la saison
const leagueSeasonOn = () => S.week >= LEAGUE_DAYS[0] && S.week <= PO_FINAL;
function buyFranchise(game, zone, sellerId) {
  const u = user(), L = S.leagues[lkey(game, 1, zone)], seller = S.clubs[sellerId];
  if (!isClosed(game, 1, zone) || !L || !L.teams.includes(sellerId)) return "Place introuvable.";
  if (L.teams.some(isMine)) return "Votre club a déjà une place dans cette ligue.";
  if (S.franchiseDeal) return "Un rachat de franchise est déjà en cours : il prendra effet à la fin de la saison.";
  if (!franchiseSlots(game, zone).some(x => x.id === sellerId)) return `${seller.name} refuse de vendre sa place.`;
  const price = franchisePrice(game, zone, sellerId);
  if (u.budget < price) return `Budget insuffisant : la place coûte ${money(price)} (vous avez ${money(u.budget)}).`;
  book("entry", -price, game, `Franchise ${tierName(game, 1, zone)} : rachat de la place de ${seller.name}`);
  seller.budget += price;
  if (leagueSeasonOn()) {
    S.franchiseDeal = { game, zone, sellerId, price };
    mail(`🔒 Franchise achetée : ${tierName(game, 1, zone)}`, `Vous rachetez la place de <b>${seller.name}</b> en ${tierName(game, 1, zone)} pour <b>${money(price)}</b>. La saison étant en cours, vous y jouerez dès la saison prochaine ; ${seller.name} prendra votre place actuelle.`, "info", game);
  } else applyFranchise(game, zone, sellerId, price);
  return null;
}
function applyFranchise(game, zone, sellerId, price) {
  const u = user(), L = S.leagues[lkey(game, 1, zone)], seller = S.clubs[sellerId], sd = seller && seller.divisions[game];
  if (!L || !sd || !L.teams.includes(sellerId)) return;
  const myD = u.divisions[game];
  if (myD) {
    // échange des places : le vendeur prend la place actuelle du club
    const myL = leagueOf(u.id, game), old = { tier: myD.tier, zone: myD.zone, sub: myD.sub };
    swapInLeague(L, sellerId, "__swap"); swapInLeague(myL, u.id, sellerId); swapInLeague(L, "__swap", u.id);
    myD.tier = 1; myD.zone = zone; delete myD.sub; sd.tier = old.tier; sd.zone = old.zone; if (old.sub) sd.sub = old.sub; else delete sd.sub;
  } else {
    u.divisions[game] = { tier: 1, zone, players: [] };
    swapInLeague(L, sellerId, u.id);
    if (seller.filler) dissolveDivision(sellerId, game);
    else { const sub = subFor(game, 2, zone, seller.country), L2 = S.leagues[lkey(game, 2, zone, sub)]; L2.teams.push(sellerId); L2.table[sellerId] = emptyRow(GAMES[game].fmt); sd.tier = 2; if (sub) sd.sub = sub; }
  }
  // une franchise à l'étranger : le club y est inscrit (règle des régions des joueurs, tournois régionaux)
  const reg = ZONE_REGION[zone];
  S.regionOverride = S.regionOverride || {};
  if (reg && REGION_OF[u.country] !== reg && !(reg === "EU" && REGION_OF[u.country] === undefined)) S.regionOverride[game + ":" + u.id] = reg; else delete S.regionOverride[game + ":" + u.id];
  mail(`🔒 Bienvenue en ${tierName(game, 1, zone)} !`, `${u.name} occupe désormais la place de ${seller.name} en <b>${tierName(game, 1, zone)}</b>${price ? ` (rachetée ${money(price)})` : ""}. Ligue fermée : pas de relégation possible. Il vous faut ${GAMES[game].size} joueurs titulaires.`, "info", game);
}
// place le club du joueur dans un circuit, en prenant si possible la place d'un club fictif
function joinLeague(game, tier) {
  const u = user(), zone = zoneFrom(game, clubRegion(u, game), u.country), sub = subPrefFor(u.id, game, tier, zone), L = S.leagues[lkey(game, tier, zone, sub)];
  u.divisions[game] = { tier, zone, players: [] };
  if (sub) u.divisions[game].sub = sub;
  const fid = L.teams.find(id => S.clubs[id].filler);
  if (fid) {
    swapInLeague(L, fid, u.id);
    dissolveDivision(fid, game);
    return false;
  }
  L.teams.push(u.id); L.table[u.id] = emptyRow(GAMES[game].fmt);
  return L.schedule.length > 0 && GAMES[game].fmt !== "br";
}
// ligue nationale d'un club dans un tier découpé : pour le club du joueur, celle qu'il a choisie ; sinon celle de son pays
function subPrefFor(id, game, tier, zone) {
  const u = user(), subs = subsOf(game, tier, zone); if (!subs) return null;
  if (id === u.id && u.subPref && subs.includes(u.subPref[game])) return u.subPref[game];
  return subFor(game, tier, zone, S.clubs[id].country);
}
// le club du joueur peut-il changer de ligue nationale tout de suite ? (pas encore de match joué cette saison)
function canSwitchSub(game) {
  const u = user(), d = u.divisions[game]; if (!d || !d.sub) return false;
  const L = S.leagues[lkey(game, d.tier, d.zone, d.sub)], r = L && L.table[u.id];
  return !!L && !L.playoffs && !(r && (r.w || r.l || r.games));
}
// échange la place du club du joueur avec le club le plus faible de la ligue visée (même tier)
function moveToSub(game, sub) {
  const u = user(), d = u.divisions[game];
  const from = S.leagues[lkey(game, d.tier, d.zone, d.sub)], to = S.leagues[lkey(game, d.tier, d.zone, sub)];
  if (!from || !to || from === to) return false;
  const swap = to.teams.filter(id => S.clubs[id] && !isMine(id)).sort((a, b) => teamStrength(a, game).str - teamStrength(b, game).str)[0];
  if (!swap) return false;
  const old = d.sub;
  swapInLeague(to, swap, "__swap"); swapInLeague(from, u.id, swap); swapInLeague(to, "__swap", u.id);
  d.sub = sub; S.clubs[swap].divisions[game].sub = old;
  return true;
}
// choix de la ligue nationale (LFL, Prime League…) : tout de suite si la saison du club n'a pas commencé, sinon la saison prochaine
function changeSub(game, sub) {
  const u = user(), d = u.divisions[game];
  if (!d) return { err: "Votre club ne joue pas à ce jeu." };
  const subs = subsOf(game, 2, d.zone) || subsOf(game, d.tier, d.zone);
  if (!subs || !subs.includes(sub)) return { err: "Cette ligue n'est pas dans votre zone." };
  (u.subPref || (u.subPref = {}))[game] = sub;
  if (d.tier === 2 || subsOf(game, d.tier, d.zone)) {
    if (d.sub === sub) return { now: true };
    if (canSwitchSub(game) && moveToSub(game, sub)) return { now: true };
    return { later: true };
  }
  return { pref: true };
}
function swapInLeague(L, oldId, newId) {
  L.teams = L.teams.map(id => id === oldId ? newId : id);
  for (const rd of L.schedule) for (const m of rd) for (let k = 0; k < 2; k++) if (m[k] === oldId) m[k] = newId;
  if (L.table[oldId]) { L.table[newId] = L.table[oldId]; delete L.table[oldId]; }
}
function dissolveDivision(clubId, game) {
  const c = S.clubs[clubId];
  for (const p of clubPlayers(clubId, game)) { p.club = null; p.starter = false; p.years = 0; }
  delete c.divisions[game];
  if (!Object.keys(c.divisions).length && clubId !== S.userId) delete S.clubs[clubId];
}
function closeDivision(game) {
  if (academyOf(game)) closeAcademy(game);
  const u = user(), tier = u.divisions[game].tier, zone = u.divisions[game].zone;
  for (const id of userTeams(game).filter(id => id !== u.id && S.clubs[id].unitOf)) { for (const p of clubPlayers(id, game)) releasePlayer(p.id, true); removeUnit(id, game); }
  for (const p of clubPlayers(u.id, game)) releasePlayer(p.id, true);
  const L = leagueOf(u.id, game);
  const f = fillerClub(game, GAMES[game].open ? 3 : tier, zone, u.divisions[game].sub);
  swapInLeague(L, u.id, f.id);
  delete u.divisions[game];
  u.fame = Math.max(1, u.fame - 2);
}

// ---------- grand livre ----------
const BOOK_LABELS = {
  sponsors: "Sponsors et droits", merch: "Merch & streaming", prize: "Cashprizes (part du club)", ewc: "EWC Club Championship", sales: "Ventes de joueurs",
  clauses: "Clauses libératoires encaissées", investors: "Investisseurs", events: "Divers (recettes)",
  salaries: "Salaires", operations: "Frais de fonctionnement des équipes", academy: "Académies", facilities: "Entretien des infrastructures", bonuses: "Primes de victoire",
  transfers: "Indemnités de transfert", signing: "Primes à la signature", agents: "Commissions d'agents", travel: "Déplacements en LAN", release: "Indemnités de rupture",
  upgrades: "Travaux d'infrastructures", entry: "Droits d'entrée en ligue", staff: "Bootcamps et créateurs", coaches: "Entraîneurs", interest: "Intérêts bancaires", fines: "Amendes infligées aux joueurs",
};
// toute entrée ou sortie d'argent du club du joueur passe par ici : budget, rapport de la semaine, grand livre et budget mercato du jeu
function book(cat, amount, game, label) {
  amount = Math.round(amount); if (!amount) return;
  const u = user(); u.budget += amount;
  const r = weekReport(), side = amount >= 0 ? r.income : r.expenses;
  side[cat] = (side[cat] || 0) + Math.abs(amount);
  (S.ledger || (S.ledger = [])).push([S.season, S.week, cat, amount, game || "", label || ""]);
  if (S.ledger.length > 5000) S.ledger.splice(0, S.ledger.length - 5000);
  if (game && MERCATO_CATS.includes(cat)) allocOf(game).spent -= amount;
}
// ---------- budget mercato par jeu ----------
// En début de saison, le CEO répartit son budget de transferts entre ses sections (et fixe une masse salariale par jeu).
// Les indemnités, primes et commissions d'un jeu sont prises sur son enveloppe ; les ventes la remboursent.
const MERCATO_CATS = ["transfers", "signing", "agents", "sales", "clauses"];
const gameWages = game => gamePlayers(game).reduce((s, p) => s + p.salary, 0);
function defaultAlloc() {
  const u = user(), games = Object.keys(u.divisions);
  const weight = g => GAMES[g].mult * [3, 1.6, 1][u.divisions[g].tier - 1];
  const sw = games.reduce((s, g) => s + weight(g), 0) || 1, pot = Math.max(0, u.budget * 0.5);
  const out = {};
  // plafond salarial conseillé : la masse actuelle + de quoi payer une recrue (environ 2,5 % de l'enveloppe par semaine)
  for (const g of games) { const t = Math.round(pot * weight(g) / sw / 1000) * 1000; out[g] = { transfer: t, wages: round50(gameWages(g) * 1.2 + t / 40 + 500), spent: 0 }; }
  return { season: S.season, games: out, set: false };
}
function allocOf(game) {
  if (!S.alloc || S.alloc.season !== S.season) S.alloc = defaultAlloc();
  return S.alloc.games[game] || (S.alloc.games[game] = { transfer: 0, wages: round50(gameWages(game) + 500), spent: 0 });
}
// Deux façons de gérer l'argent du mercato :
// - automatique (par défaut) : un seul budget pour tout le club ; on garde une réserve de 10 semaines de salaires,
//   et une recrue doit pouvoir être payée 20 semaines avec l'argent restant ;
// - manuel : une enveloppe et un plafond de salaires par jeu, à répartir soi-même (onglet Finances).
const allocManual = () => !!S.allocManual;
const RESERVE_WEEKS = 10, WAGE_WEEKS = 20;
const clubWages = () => allUserPlayers().reduce((s, p) => s + p.salary, 0);
const clubReserve = () => Math.round(clubWages() * RESERVE_WEEKS / 1000) * 1000;
const spendable = () => Math.max(0, user().budget - clubReserve());
const transferRoom = game => allocManual() ? allocOf(game).transfer - allocOf(game).spent : spendable();
const wageRoom = game => allocManual() ? allocOf(game).wages - gameWages(game) : Math.floor(spendable() / WAGE_WEEKS / 50) * 50;
// ce que le club peut réellement dépenser tout de suite dans un jeu (enveloppe restante, limitée par l'argent en caisse)
const spendRoom = game => user().divisions[game] ? Math.max(0, Math.min(user().budget, transferRoom(game))) : 0;
// nouvelle répartition : { jeu: { transfer, wages } } ; le total des enveloppes ne peut pas dépasser le budget disponible
function setAlloc(map) {
  const u = user();
  const committed = Object.entries(map).reduce((s, [g, a]) => s + Math.max(0, a.transfer - Math.max(0, allocOf(g).spent)), 0);
  if (committed > Math.max(0, u.budget)) return `La répartition (${money(committed)} encore disponibles au mercato) dépasse votre budget (${money(u.budget)}).`;
  for (const [g, a] of Object.entries(map)) { const cur = allocOf(g); cur.transfer = Math.max(0, Math.round(a.transfer)); cur.wages = Math.max(0, round50(a.wages)); }
  S.alloc.set = true;
  return null;
}
// change l'enveloppe et le plafond salarial d'une section ; si l'argent non réparti ne suffit pas,
// la différence est reprise sur ce qui reste dans les enveloppes des autres sections (les plus garnies d'abord)
function adjustAlloc(game, transfer, wages) {
  const u = user(), cur = allocOf(game), games = Object.keys(u.divisions);
  transfer = Math.max(0, Math.round(transfer)); wages = Math.max(0, round50(wages));
  const left = g => Math.max(0, allocOf(g).transfer - Math.max(0, allocOf(g).spent));
  const free = Math.max(0, u.budget) - games.reduce((s, g) => s + left(g), 0);
  let need = Math.max(0, transfer - Math.max(0, cur.spent)) - left(game) - Math.max(0, free);
  const others = games.filter(g => g !== game && left(g) > 0).sort((a, b) => left(b) - left(a));
  if (need > others.reduce((s, g) => s + left(g), 0)) return { err: `Pas assez d'argent : votre budget (${money(u.budget)}) ne couvre pas une enveloppe de ${money(transfer)} en ${GAMES[game].short}.` };
  const moved = [];
  for (const g of others) { if (need <= 0) break; const take = Math.min(need, left(g)); allocOf(g).transfer -= take; need -= take; moved.push([g, take]); }
  cur.transfer = transfer; cur.wages = wages; S.alloc.set = true;
  return { moved };
}
// une dépense de mercato rentre-t-elle dans le budget total, l'enveloppe du jeu et sa masse salariale ?
function budgetCheck(game, upfront, extraWeekly = 0) {
  if (upfront > user().budget) return `Budget insuffisant : il faut ${money(upfront)} tout de suite.`;
  if (!allocManual()) {
    const free = spendable();
    if (upfront > free) return `Pas assez d'argent disponible : ${money(free)} (budget ${money(user().budget)} moins une réserve de ${money(clubReserve())} pour payer ${RESERVE_WEEKS} semaines de salaires). Il faudrait ${money(upfront)}.`;
    if (extraWeekly > 0 && extraWeekly * WAGE_WEEKS > free - upfront) return `Salaire trop lourd : ${WAGE_WEEKS} semaines de ${money(extraWeekly)}/sem (${money(extraWeekly * WAGE_WEEKS)}) dépassent l'argent qui resterait après l'opération (${money(Math.max(0, free - upfront))}). Vendez un joueur ou trouvez des sponsors.`;
    return null;
  }
  if (upfront > transferRoom(game)) return `Enveloppe mercato ${GAMES[game].short} dépassée : il reste ${money(Math.max(0, transferRoom(game)))} sur ${money(allocOf(game).transfer)}. Ajustez la répartition (ci-dessous ou dans l'onglet Finances).`;
  if (extraWeekly > 0 && extraWeekly > wageRoom(game)) return `Masse salariale ${GAMES[game].short} dépassée : ${money(gameWages(game))}/sem sur ${money(allocOf(game).wages)}/sem autorisés (il faudrait ${money(extraWeekly)}/sem de plus). Ajustez la répartition (ci-dessous ou dans l'onglet Finances).`;
  return null;
}

// ---------- mercato ----------
// fenêtres de transferts : voir MERCATO_WINDOWS (data.js)
function windowAt(game, w = S.week) { return mercatoRules(game).w.find(x => w >= x[0] && w <= x[1]) || null; }
function mercatoOpen(game, w = S.week) { return !!(mercatoRules(game).always || windowAt(game, w)); }
// prochaine ouverture : [semaine, saison, fenêtre]
function nextWindow(game, w = S.week) {
  const ws = mercatoRules(game).w, n = ws.find(x => x[0] > w);
  return n ? [n[0], S.season, n] : [ws[0][0], S.season + 1, ws[0]];
}
// l'intersaison continue d'une saison à l'autre (fenêtre de fin de saison + fenêtre de janvier) : vraie date de fermeture
function windowEnd(game, w = S.week) {
  const r = mercatoRules(game), cur = windowAt(game, w); if (!cur) return null;
  const first = cur[1] === SEASON_LAST && r.w.find(x => x[0] === SEASON_FIRST);
  return first ? { season: S.season + 1, week: first[1], weeks: SEASON_LAST - w + 1 + first[1] - SEASON_FIRST + 1 } : { season: S.season, week: cur[1], weeks: cur[1] - w + 1 };
}
const windowContinues = (game, w = S.week) => w === SEASON_FIRST && mercatoRules(game).w.some(x => x[1] === SEASON_LAST) && !!windowAt(game, w);
const untilTxt = e => `jusqu'au ${dayLabel(e.season, e.week, 6)}${e.season !== S.season ? " " + e.season : ""} (${e.weeks === 1 ? "dernière semaine" : e.weeks + " semaines"})`;
function mercatoStatus(game) {
  const r = mercatoRules(game), cur = windowAt(game), [nw, ns, nx] = nextWindow(game), end = windowEnd(game);
  const until = cur && untilTxt(end);
  if (r.always) return { open: true, hot: !!cur, text: cur ? `🔥 Marché en ébullition (${cur[2]}) ${until}` : `Pas de fenêtre réglementée : transferts possibles toute l'année. Prochain pic : ${weekLabel(ns, nw)} (${nx[2]})` };
  if (cur) return { open: true, last: end.weeks === 1, weeks: end.weeks, text: `🟢 Mercato ouvert ${until} — ${cur[2]}` };
  return { open: false, text: `🔴 Mercato fermé : réouverture le ${dayLabel(ns, nw, 0)}${ns !== S.season ? " " + ns : ""} (${nx[2]}). En attendant, seuls les agents libres et les indépendants peuvent signer.` };
}
// hors fenêtre, un club ne peut pas céder un joueur sous contrat
function windowCheck(p) {
  if (!p.club || (S.clubs[p.club] && S.clubs[p.club].solo) || mercatoOpen(p.game)) return null;
  const [nw, ns] = nextWindow(p.game);
  return `Mercato ${GAMES[p.game].short} fermé : ${p.handle} est sous contrat et ne peut pas être transféré avant le ${dayLabel(ns, nw, 0)}${ns !== S.season ? " " + ns : ""}. Vous pouvez signer un agent libre en attendant.`;
}
// ouvertures de la semaine (pour l'animation « Mercato time ! ») et dernières semaines des fenêtres des sections du club
function mercatoChanges() {
  const u = user(), opened = [], closing = [];
  for (const g of Object.keys(GAMES)) {
    const cur = windowAt(g);
    if (cur && cur[0] === S.week && !windowContinues(g)) opened.push([g, cur, !!u.divisions[g], !!mercatoRules(g).always, windowEnd(g)]);
    if (cur && windowEnd(g).weeks === 1 && u.divisions[g] && !mercatoRules(g).always) closing.push(g);
  }
  const mine = opened.filter(o => o[2]);
  if (mine.length) mail(`🔁 Mercato ouvert : ${mine.map(o => GAMES[o[0]].short).join(", ")}`, mine.map(([g, cur, , al, end]) => `${GAMES[g].icon} <b>${GAMES[g].name}</b> : ${al ? "le marché s'emballe" : "fenêtre ouverte"} ${untilTxt(end)} — ${cur[2]}.`).join("<br>") + "<br>Vous pouvez faire des offres aux clubs pour leurs joueurs sous contrat, et vos joueurs placés sur la liste des transferts recevront des offres.", "transfer");
  if (closing.length) mail(`⏳ Dernière semaine du mercato : ${closing.map(g => GAMES[g].short).join(", ")}`, `La fenêtre de transferts se ferme dimanche pour ${closing.map(g => GAMES[g].name).join(", ")}. Ensuite, seuls les agents libres pourront signer.`, "transfer");
  return opened.length ? { opened, closing } : null;
}
function askingPrice(p) {
  if (!p.club) return 0;
  const c = S.clubs[p.club];
  if (c.solo) return Math.round(playerValue(p) * 0.8 / 500) * 500; // prime versée au joueur indépendant
  if (p.listed && p.askPrice) return p.askPrice;
  return Math.round(playerValue(p) * (p.starter ? 1.6 : 1.2) * (0.8 + c.fame / 250) / 500) * 500;
}
function signFreeAgent(pid, salary, years) {
  const p = S.players[pid], u = user();
  if (p.club) return "Ce joueur n'est pas libre.";
  if (!u.divisions[p.game]) return `Ouvrez d'abord une division ${GAMES[p.game].name}.`;
  const demand = salaryDemand(p, u);
  if (salary < demand * 0.9) { p.morale = clamp(p.morale - 5, 0, 100); return `${p.handle} refuse : il demande au moins ${money(demand * 0.9)}/sem.`; }
  const bonus = Math.round(salary * 4);
  const be = budgetCheck(p.game, bonus, salary); if (be) return be;
  book("signing", -bonus, p.game, "Prime de signature : " + p.handle);
  joinClub(p, u, salary, years);
  mail(`Signature : ${p.handle}`, `${flag(p.nat)} <b>${p.handle}</b> (${GAMES[p.game].short}, ${p.rating}) rejoint ${u.name} pour ${years} an(s) à ${money(salary)}/sem. Prime de signature : ${money(bonus)}.`, "transfer");
  return null;
}
// une star ne rejoint pas un club trop modeste
// note maximale des joueurs prêts à discuter avec le club dans un jeu (notoriété + tier de l'équipe dans ce jeu)
function interestMax(game) {
  const d = user().divisions[game];
  return Math.min(99, Math.floor(user().fame + 70 + (d ? [20, 8, 0][d.tier - 1] : 0)));
}
function interestCheck(p) { return p.rating <= interestMax(p.game); }
function makeOffer(pid, fee) {
  const p = S.players[pid], u = user();
  if (!p.club || p.club === u.id) return "Offre impossible.";
  if (!u.divisions[p.game]) return `Ouvrez d'abord une division ${GAMES[p.game].name}.`;
  const we = windowCheck(p); if (we) return we;
  if (u.budget < fee) return "Budget insuffisant.";
  const seller = S.clubs[p.club], ask = askingPrice(p);
  if (!interestCheck(p)) return `${p.handle} n'est pas intéressé par le projet : votre club manque de notoriété (${u.fame.toFixed(0)}) ou évolue trop bas.`;
  if (fee < ask * rand(0.88, 1.08)) return `${seller.solo ? p.handle : seller.name} refuse votre offre de ${money(fee)}. (Prix estimé : ~${money(ask)})`;
  const salary = salaryDemand(p, u);
  book("transfers", -fee, p.game, "Transfert : " + p.handle); seller.budget += fee;
  removeFromClub(p);
  joinClub(p, u, salary, randi(2, 3));
  aiFillRoster(seller.id, p.game);
  mail(`Transfert : ${p.handle}`, `${flag(p.nat)} <b>${p.handle}</b> ${seller.solo ? "(indépendant)" : "quitte " + seller.name + " et"} rejoint ${u.name} pour ${money(fee)}. Salaire : ${money(salary)}/sem.`, "transfer");
  u.fame = clamp(u.fame + Math.max(0, (p.rating - 80) * 0.15), 0, 100);
  return null;
}
// étape 1 d'un transfert : le club vendeur accepte-t-il l'indemnité ? (les termes du joueur se négocient ensuite)
function transferFeeCheck(pid, fee) {
  const p = S.players[pid], u = user();
  if (!p.club || p.club === u.id) return "Offre impossible.";
  if (!u.divisions[p.game]) return `Ouvrez d'abord une division ${GAMES[p.game].name}.`;
  const we = windowCheck(p); if (we) return we;
  const be = budgetCheck(p.game, fee); if (be) return be;
  if (!interestCheck(p)) return `${p.handle} n'est pas intéressé par le projet : votre club manque de notoriété (${u.fame.toFixed(0)}) ou évolue trop bas.`;
  const seller = S.clubs[p.club], ask = askingPrice(p);
  if (p.offerRefused === nowIndex() + ":" + fee) return `${seller.name} a déjà refusé ce montant.`;
  if (fee < ask * rand(0.88, 1.08)) { p.offerRefused = nowIndex() + ":" + fee; return `${seller.solo ? p.handle : seller.name} refuse votre offre de ${money(fee)}. (Prix estimé : ~${money(ask)})`; }
  return null;
}
// ---------- négociation de l'indemnité avec le club vendeur ----------
// Le club a un prix plancher secret (plus bas si le contrat se termine, si le joueur est remplaçant ou en vente, si le club
// manque d'argent ; plus haut pour un titulaire ou un jeune à fort potentiel) et une patience limitée. Il répond par des
// contre-propositions qui se rapprochent de son plancher ; une offre ridicule l'agace, et à bout de patience il rompt
// les discussions pour 4 semaines.
function feeTalk(pid) {
  const p = S.players[pid], c = S.clubs[p.club], T = S.feeTalk = S.feeTalk || {};
  let t = T[pid];
  if (t && (t.club !== p.club || nowIndex() - t.at > 6) && !(t.walked && nowIndex() - t.walked < 4)) t = null;
  if (!t) {
    const ask = askingPrice(p), why = [];
    let k = rand(0.8, 0.94);
    if (p.years <= 1) { k *= 0.72; why.push("son contrat se termine à la fin de la saison"); }
    if (!p.starter) { k *= 0.88; why.push("il est remplaçant"); }
    if (p.listed) { k *= 0.85; why.push("le club l'a mis en vente"); }
    if (c.budget !== undefined && c.budget < 0) { k *= 0.85; why.push("le club a besoin d'argent"); }
    if (p.starter && p.rating >= 85) { k *= 1.06; why.push("c'est un pilier de l'équipe"); }
    if (p.age <= 20 && p.pot - p.rating >= 8) { k *= 1.08; why.push("c'est un jeune à fort potentiel"); }
    t = T[pid] = { club: p.club, at: nowIndex(), ask, counter: ask, reserve: round50(ask * k), patience: randi(3, 5), max: 0, log: [], why };
  }
  return t;
}
function clubTalk(pid, fee) {
  const p = S.players[pid], u = user(), seller = S.clubs[p.club], t = feeTalk(pid), who = seller.solo ? p.handle : seller.name;
  if (t.walked && nowIndex() - t.walked < 4) return { status: "closed", msg: `${who} ne veut plus discuter de ${p.handle} pour l'instant (encore ${4 - (nowIndex() - t.walked)} semaine(s)).` };
  fee = Math.max(0, Math.round(fee));
  t.log.push({ you: fee });
  if (fee >= t.reserve || fee >= t.counter) { t.log.push({ them: fee, ok: true }); t.accepted = fee; return { status: "accept", fee, msg: `${who} accepte ${money(fee)} pour ${p.handle}.` }; }
  const ratio = fee / t.reserve;
  t.patience -= ratio < 0.55 ? 2 : 1;
  if (t.patience <= 0) { t.walked = nowIndex(); t.log.push({ walk: true }); return { status: "walk", msg: `${who} met fin aux discussions : ${ratio < 0.55 ? "votre offre est jugée insultante" : "les positions sont trop éloignées"}. Pas de nouvelle offre possible pendant 4 semaines.` }; }
  // contre-proposition : le club fait un pas vers vous, sans descendre sous son plancher
  const step = ratio < 0.55 ? rand(0.05, 0.12) : ratio < 0.8 ? rand(0.18, 0.32) : rand(0.3, 0.5);
  t.counter = Math.max(t.reserve, round50(t.counter - (t.counter - fee) * step));
  const last = t.patience === 1;
  t.log.push({ them: t.counter, last });
  const tone = ratio < 0.55 ? "Offre jugée insultante." : ratio < 0.8 ? "Le club trouve l'offre bien trop basse." : ratio < 0.95 ? "On se rapproche." : "Le club est tout près d'accepter.";
  return { status: "counter", counter: t.counter, last, msg: `${tone} ${who} demande désormais <b>${money(t.counter)}</b>${t.counter <= t.reserve ? " et <b>ne descendra pas plus bas</b>" : ""}${last ? " — <b>dernière offre</b> avant de rompre les discussions" : ""}.` };
}
// vente à un club de l'IA (buyerId et fee : offre reçue pour un joueur placé sur la liste des transferts)
function sellPlayer(pid, buyerId, offerFee) {
  const p = S.players[pid], u = user();
  const L = leagueOf(p.club, p.game) || leagueOf(u.id, p.game);
  const buyers = L.teams.filter(id => !isMine(id) && S.clubs[id] && !S.clubs[id].solo);
  const pool = buyers.length ? buyers : Object.values(S.clubs).filter(c => c.ai && !c.solo && c.divisions[p.game]).map(c => c.id);
  const buyer = S.clubs[buyerId && S.clubs[buyerId] && S.clubs[buyerId].divisions[p.game] ? buyerId : pick(pool)];
  const fee = offerFee || Math.round(playerValue(p) * rand(0.75, 1.1) / 500) * 500;
  unlistPlayer(p.id);
  const game = p.game;
  const sellerId = p.club;
  removeFromClub(p);
  joinClub(p, buyer, salaryDemand(p, buyer), randi(1, 3));
  logMove(p, sellerId, buyer.id, fee);
  book("sales", fee, game, `Vente de ${p.handle} à ${buyer.name}`);
  arrangeUnits(game);
  const roster = clubPlayers(buyer.id, p.game);
  if (roster.length > GAMES[p.game].size + 2) {
    const worst = roster.filter(x => x.id !== p.id).sort((a, b) => a.rating - b.rating)[0];
    removeFromClub(worst); worst.years = 0;
  }
  autoStarters(buyer.id, p.game);
  mail(`Vente : ${p.handle}`, `${p.handle} est vendu à <b>${buyer.name}</b> pour ${money(fee)}.`, "transfer");
  return fee;
}
function releasePlayer(pid, silent) {
  const p = S.players[pid], u = user();
  const cost = Math.round(p.salary * 52 * p.years * 0.25);
  book("release", -cost, p.game, "Rupture de contrat : " + p.handle);
  removeFromClub(p); p.years = 0; p.morale = 60;
  arrangeUnits(p.game);
  if (!silent) mail(`Libération : ${p.handle}`, `Le contrat de ${p.handle} est résilié. Indemnité versée : ${money(cost)}.`, "transfer");
  return cost;
}
function renewDemand(p) { return Math.round(salaryDemand(p, user()) * (p.morale < 40 ? 1.3 : 1.05) / 50) * 50; }
function renewPlayer(pid, years) {
  const p = S.players[pid], demand = renewDemand(p);
  p.salary = demand; p.years = years; p.morale = clamp(p.morale + 10, 0, 100);
  mail(`Prolongation : ${p.handle}`, `${p.handle} prolonge de ${years} an(s) à ${money(demand)}/sem.`, "transfer");
}
function joinClub(p, club, salary, years) {
  p.club = club.id; p.salary = salary; p.years = years; p.starter = false;
  p.morale = clamp(p.morale + 15, 0, 100);
  club.divisions[p.game].players.push(p.id);
  if (club.ai) {
    // les clubs de l'IA inscrivent leur recrue dans la région de l'équipe
    const mate = clubPlayers(club.id, p.game).find(x => x.id !== p.id);
    if (mate && playRegion(mate) !== playRegion(p)) { p.region = playRegion(mate); p.movedAt = nowIndex(); }
    autoStarters(club.id, p.game);
  }
  else if (unitGame(p.game) && club.id === S.userId) arrangeUnits(p.game);
  else if (clubPlayers(club.id, p.game).filter(x => x.starter).length < GAMES[p.game].size) p.starter = true;
}
function removeFromClub(p, keepContract) {
  if (p.listed) unlistPlayer(p.id);
  const d = divOf(p.club, p.game);
  if (d) d.players = d.players.filter(id => id !== p.id);
  p.club = null; p.starter = false;
  // sans contrat, le joueur rentre jouer chez lui
  if (!keepContract) { delete p.region; delete p.movedAt; }
}
// ---------- Fortnite : plusieurs duos/trios par club ----------
// Pas de banc : chaque joueur du club joue dans un duo (ou trio). Le club peut aligner plusieurs équipes, chacune dans sa région
// (un duo américain en FNCS Amérique du Nord, un duo européen en FNCS Europe). Un joueur seul se trouve un partenaire hors du club,
// que le club ne paie pas.
const unitGame = game => !!(GAMES[game] && GAMES[game].open);
const playerZone = (p, game = p.game) => zoneFrom(game, playRegion(p), p.nat);
function createUnit(game, zone) {
  const u = user(); let n = 2; while (S.clubs[`${u.id}~${game}~${n}`]) n++;
  const c = baseClub(`${u.id}~${game}~${n}`, u.name, u.tag, u.country, u.color, u.fame, false);
  c.parent = u.id; c.unitOf = game;
  c.divisions[game] = { tier: 3, zone, players: [], mates: [] };   // un nouveau duo démarre en statut Open
  S.clubs[c.id] = c;
  const L = S.leagues[lkey(game, 1, zone)];
  L.teams.push(c.id); L.table[c.id] = emptyRow(GAMES[game].fmt);
  return c;
}
function removeUnit(id, game) {
  const L = leagueOf(id, game);
  if (L) { L.teams = L.teams.filter(x => x !== id); delete L.table[id]; }
  delete S.clubs[id];
}
// change une équipe de région (elle repart de zéro au classement de sa nouvelle région)
function moveTeamZone(id, game, zone) {
  const d = divOf(id, game); if (!d || d.zone === zone) return;
  const old = leagueOf(id, game);
  if (old) { old.teams = old.teams.filter(x => x !== id); delete old.table[id]; }
  d.zone = zone;
  const L = S.leagues[lkey(game, 1, zone)];
  if (!L.teams.includes(id)) { L.teams.push(id); L.table[id] = emptyRow(GAMES[game].fmt); }
}
// partenaires extérieurs : des agents libres de la même région, du niveau du joueur
function refreshMates(id, game) {
  const d = divOf(id, game), g = GAMES[game]; if (!d) return;
  const own = clubPlayers(id, game), need = Math.max(0, g.size - own.length);
  const taken = new Set(userTeams(game).filter(x => x !== id).flatMap(x => (divOf(x, game).mates || [])));
  const ok = pid => { const p = S.players[pid]; return p && !p.club && p.game === game && playerZone(p) === d.zone && !taken.has(pid); };
  if (!own.length) { d.mates = []; return; }
  const level = own.reduce((s, p) => s + p.rating, 0) / own.length;
  // un partenaire extérieur a à peu près le niveau du joueur : un partenaire trop faible est remplacé
  d.mates = (d.mates || []).filter(pid => ok(pid) && S.players[pid].rating >= level - 6).slice(0, need);
  const cand = Object.values(S.players).filter(p => ok(p.id) && !d.mates.includes(p.id) && p.rating <= level + 3 && p.rating >= level - 6).sort((a, b) => Math.abs(a.rating - level + 2) - Math.abs(b.rating - level + 2));
  while (d.mates.length < need) {
    if (cand.length) { d.mates.push(cand.shift().id); continue; }
    // personne de ce niveau sans équipe dans la région : un joueur de la scène accepte de jouer avec lui
    const p = genPlayer(game, Math.round(level - 5), Math.round(level), 17, 26); p.years = 0; p.club = null; p.starter = false;
    const reg = ZONE_REGION[d.zone]; if (reg && zoneFrom(game, homeRegion(p), p.nat) !== d.zone) p.region = reg;
    addPlayer(p); d.mates.push(p.id);
  }
}
// range les joueurs Fortnite du club : pas plus de joueurs que la taille d'une équipe, tous de la région de leur équipe ;
// l'équipe principale (le club) n'est jamais vide s'il reste des joueurs
function arrangeUnits(game) {
  if (!unitGame(game) || !user().divisions[game]) return;
  const g = GAMES[game], u = user();
  const teams = () => userTeams(game).filter(id => !S.clubs[id].academyOf);
  const homeless = [];
  for (const id of teams()) {
    const d = divOf(id, game);
    for (const p of clubPlayers(id, game)) {
      const keep = clubPlayers(id, game).filter(x => playerZone(x) === d.zone);
      if (playerZone(p) !== d.zone || keep.indexOf(p) >= g.size) { d.players = d.players.filter(x => x !== p.id); homeless.push(p); }
    }
  }
  // l'équipe principale vide prend la région du premier joueur à placer
  if (!clubPlayers(u.id, game).length && homeless.length) moveTeamZone(u.id, game, playerZone(homeless[0]));
  for (const p of homeless) {
    const z = playerZone(p);
    let id = teams().find(t => divOf(t, game).zone === z && clubPlayers(t, game).length < g.size);
    if (!id) id = createUnit(game, z).id;
    divOf(id, game).players.push(p.id); p.club = id;
  }
  // une équipe secondaire vide disparaît ; si le club n'a plus personne, une équipe secondaire devient l'équipe principale
  for (const id of teams()) if (id !== u.id && !clubPlayers(id, game).length) removeUnit(id, game);
  if (!clubPlayers(u.id, game).length) {
    const other = teams().find(id => id !== u.id);
    if (other) { const d = divOf(other, game); moveTeamZone(u.id, game, d.zone); for (const p of clubPlayers(other, game)) { u.divisions[game].players.push(p.id); p.club = u.id; } d.players = []; removeUnit(other, game); }
  }
  for (const id of teams()) { clubPlayers(id, game).forEach(p => p.starter = true); refreshMates(id, game); }
}
// déplace un joueur dans une autre équipe du club (to : id d'équipe, ou "new" pour un nouveau duo/trio dans sa région)
function assignUnit(pid, to) {
  const p = S.players[pid], game = p.game, g = GAMES[game];
  if (!isMine(p.club)) return "Ce joueur n'est pas dans votre club.";
  if (to !== "new") {
    const d = divOf(to, game);
    if (!d) return "Équipe introuvable.";
    if (d.zone !== playerZone(p)) return `${p.handle} joue en ${ZONE_NAMES[playerZone(p)]} : il ne peut pas rejoindre une équipe inscrite en ${ZONE_NAMES[d.zone]}. Renégociez sa région de jeu dans son contrat.`;
    if (clubPlayers(to, game).length >= g.size) return `Cette équipe a déjà ${g.size} joueurs.`;
  }
  const from = p.club;
  divOf(from, game).players = divOf(from, game).players.filter(x => x !== pid);
  const target = to === "new" ? createUnit(game, playerZone(p)).id : to;
  divOf(target, game).players.push(pid); p.club = target;
  arrangeUnits(game);
  return null;
}
function autoStarters(clubId, game) {
  if (unitGame(game) && isMine(clubId)) return arrangeUnits(game);
  const ps = clubPlayers(clubId, game).sort((a, b) => effRating(b) - effRating(a));
  // les titulaires doivent tous être inscrits dans la même région : on garde celle qui donne la meilleure équipe
  const size = GAMES[game].size;
  const score = r => ps.filter(p => playRegion(p) === r).slice(0, size).reduce((s, p) => s + effRating(p), 0);
  const region = [...new Set(ps.map(playRegion))].sort((a, b) => score(b) - score(a))[0] || null;
  let n = 0;
  ps.forEach(p => p.starter = playRegion(p) === region && n++ < GAMES[game].size);
}
function aiFillRoster(clubId, game) {
  const c = S.clubs[clubId], g = GAMES[game], d = divOf(clubId, game);
  if (!c || !d) return;
  const want = g.size >= 3 ? g.size + 1 : g.size;
  const [lo, hi] = TIER_RATING[d.tier - 1];
  let added = 0;
  while (clubPlayers(clubId, game).length < want) {
    added++;
    // agents libres du jeu, du meilleur au moins bon (liste mise en cache pendant une fin de saison)
    const pool = aiFillRoster.pool ? (aiFillRoster.pool[game] = aiFillRoster.pool[game] || Object.values(S.players).filter(p => !p.club && p.game === game).sort((a, b) => b.rating - a.rating))
      : Object.values(S.players).filter(p => !p.club && p.game === game).sort((a, b) => b.rating - a.rating);
    const fa = pool.find(p => !p.club && S.players[p.id] && p.rating <= hi + 2);
    const p = fa && fa.rating >= lo - 6 ? fa : genPlayer(game, lo, hi, 17, 26);
    if (!S.players[p.id]) addPlayer(p);
    joinClub(p, c, salaryDemand(p, c), randi(1, 3));
  }
  // les titulaires réels restent en place, sauf s'il a fallu compléter l'effectif
  if (added || clubPlayers(clubId, game).filter(p => p.starter).length < GAMES[game].size) autoStarters(clubId, game);
  if (c.solo) c.name = soloName(c, game);
}
function toggleStarter(pid) {
  const p = S.players[pid];
  if (unitGame(p.game) && isMine(p.club)) return `Pas de banc en ${GAMES[p.game].name} : chaque joueur joue dans un ${GAMES[p.game].unit}. Changez-le d'équipe pour le faire jouer avec un autre.`;
  if (p.starter) { p.starter = false; return null; }
  if (clubPlayers(p.club, p.game).filter(x => x.starter).length >= GAMES[p.game].size) return `Déjà ${GAMES[p.game].size} titulaire(s). Passez d'abord un joueur sur le banc.`;
  const other = clubPlayers(p.club, p.game).find(x => x.starter && playRegion(x) !== playRegion(p));
  if (other) return `Règlement : tous les titulaires doivent être inscrits dans la même région. ${p.handle} joue en ${REGIONS[playRegion(p)]}, ${other.handle} en ${REGIONS[playRegion(other)]}. Renégociez son contrat pour changer sa région.`;
  p.starter = true; return null;
}

// ---------- discussions avec les joueurs (façon FM) ----------
// forme récente : moyenne des 3 dernières notes (sinon de la saison)
const recentNote = p => { const n = (p.notes || []).slice(-3); return n.length ? n.reduce((a, b) => a + b, 0) / n.length : avgNote(p); };
const TALK_SUCCESS = { "Calme": 0.75, "Loyal": 0.7, "Jeune talent": 0.6, "Ambitieux": 0.55, "Mercenaire": 0.45, "Exigeant": 0.4 };
function boostPlayer(p, val, weeks) { p.boost = Math.max(boostOf(p), val); p.boostUntil = nowIndex() + weeks; }
// kind : praise (féliciter), motivate (encourager), demand (exiger mieux), playtime (promettre une place), list (liste des transferts)
function talkToPlayer(pid, kind) {
  const p = S.players[pid];
  if (!p || !isMine(p.club)) return { tone: "bad", msg: "Ce joueur n'est pas dans votre club." };
  if (kind !== "list" && p.talkedAt && nowIndex() - p.talkedAt < 2) return { tone: "bad", msg: `${p.handle} : « On en a déjà parlé cette semaine, coach. » (une discussion toutes les 2 semaines)` };
  const pers = personalityOf(p), rec = recentNote(p) ?? 6.5, ok = Math.random() < (TALK_SUCCESS[pers] || 0.6);
  const mood = d => { p.morale = clamp(p.morale + d, 0, 100); };
  if (kind !== "list") p.talkedAt = nowIndex();
  let r;
  if (kind === "praise") {
    if (rec >= 7) { mood(8); boostPlayer(p, 2, 2); r = ["ok", "« Merci coach, je vais continuer comme ça ! » Il est gonflé à bloc."]; }
    else if (rec >= 6.2) { mood(4); r = ["ok", "« Merci, ça fait plaisir. »"]; }
    else if (pers === "Exigeant" || pers === "Ambitieux") { mood(-3); r = ["bad", "« Je sais que je joue mal, pas la peine de me mentir. » Il trouve vos compliments hypocrites."]; }
    else { mood(1); r = ["", "« Euh… merci ? » Il ne semble pas convaincu de mériter ces compliments."]; }
  } else if (kind === "motivate") {
    if (ok || p.morale < 40) { mood(7); boostPlayer(p, 3, 3); r = ["ok", "« Vous avez raison, je vais tout donner. » Il paraît remotivé."]; }
    else { r = ["", "Il vous écoute poliment, mais reste de marbre."]; }
  } else if (kind === "demand") {
    if (rec >= 6.8) { mood(-15); r = ["bad", `« Je suis un des meilleurs de l'équipe (${rec.toFixed(1)} de moyenne) ! » Il est furieux d'être critiqué.`]; }
    else if (ok) { mood(-2); boostPlayer(p, 5, 3); r = ["ok", "« Vous avez raison, je vais me reprendre. » Il promet de se remettre au travail."]; }
    else { mood(-12); r = ["bad", "« Vous n'avez rien compris, je fais tout pour l'équipe ! » Il le prend très mal."]; if (p.morale < 30) p.wantsOut = true; }
  } else if (kind === "playtime") {
    if (p.starter) r = ["", "Il est déjà titulaire."];
    else { p.status = "Titulaire"; p.promiseBroken = 0; mood(10); r = ["ok", "« Merci, je ne vous décevrai pas. » Attention : il compte jouer, sinon son moral chutera."]; }
  } else if (kind === "list") {
    if (p.listed) unlistPlayer(p.id); else listPlayer(p.id);
    if (!p.listed) { mood(4); r = ["ok", `${p.handle} est retiré de la liste des transferts.`]; }
    else if (p.wantsOut || (pers === "Mercenaire" && p.morale < 55) || p.morale < 35) { mood(5); r = ["ok", `${p.handle} est sur la liste des transferts. Il n'est pas mécontent de pouvoir partir.`]; }
    else { mood(-10); r = ["bad", `${p.handle} est sur la liste des transferts. Il est vexé qu'on ne compte plus sur lui.`]; }
  }
  mail(`💬 Discussion avec ${p.handle}`, r[1], "transfer", p.game);
  return { tone: r[0], msg: r[1] };
}
// réunion d'équipe d'un jeu : kind = calm (rester calme), reassure (rassurer), pressure (mettre la pression), praise (féliciter le groupe)
function teamResults(game, n = 5) {
  const rs = leaguesOf(game).flatMap(L => L.results).filter(r => r.a && (isMine(r.a) || isMine(r.b))).slice(-n);
  return { n: rs.length, wins: rs.filter(r => isMine(r.winner)).length };
}
function teamTalk(game, kind) {
  const u = user(); u.teamTalks = u.teamTalks || {};
  if (u.teamTalks[game] && nowIndex() - u.teamTalks[game] < 3) return { tone: "bad", msg: "Vous avez déjà réuni l'équipe il y a peu : attendez quelques semaines." };
  u.teamTalks[game] = nowIndex();
  const { n, wins } = teamResults(game), bad = n >= 3 && wins / n < 0.4, good = n >= 3 && wins / n >= 0.6;
  const lines = [];
  for (const p of gamePlayers(game)) {
    const pers = personalityOf(p), ok = Math.random() < (TALK_SUCCESS[pers] || 0.6);
    let d = 0, txt;
    if (kind === "praise") { d = good ? 6 : bad ? -4 : 2; txt = good ? "ravi" : bad ? "trouve ça déplacé vu les résultats" : "content"; }
    else if (kind === "reassure") { d = bad ? 6 : 2; txt = bad ? "rassuré" : "serein"; if (bad && ok) boostPlayer(p, 2, 2); }
    else if (kind === "pressure") { if (ok || bad) { boostPlayer(p, 4, 2); d = -3; txt = "piqué au vif, veut réagir"; } else { d = -10; txt = "se sent injustement visé"; } }
    else { d = 2; txt = "écoute calmement"; }
    p.morale = clamp(p.morale + d, 0, 100);
    lines.push(`${p.handle} : ${txt} (${d >= 0 ? "+" : ""}${d} moral)`);
  }
  const head = { praise: "Vous félicitez le groupe.", reassure: "Vous rassurez le groupe.", pressure: "Vous mettez la pression sur le groupe.", calm: "Vous demandez au groupe de rester concentré." }[kind];
  const msg = `${head} ${n ? `(${wins} victoire(s) sur les ${n} derniers matchs)` : ""}<br>${lines.join("<br>")}`;
  mail(`💬 Réunion d'équipe ${GAMES[game].short}`, msg, "transfer", game);
  return { tone: "", msg };
}
// joueurs placés sur la liste des transferts : des clubs de l'IA font des offres
// ---------- liste des transferts ----------
// Mettre un joueur en vente ne garantit rien : les clubs font une offre seulement s'il leur apporte quelque chose,
// s'ils en ont les moyens, si le prix demandé est raisonnable et si le mercato de son jeu est ouvert.
function listPlayer(pid, price) {
  const p = S.players[pid];
  p.listed = true; p.askPrice = Math.max(0, Math.round((price ?? playerValue(p)) / 500) * 500); p.listedAt = p.listedAt || rankNow(); p.offers = p.offers || [];
  return null;
}
function unlistPlayer(pid) { const p = S.players[pid]; delete p.listed; delete p.askPrice; delete p.listedAt; delete p.offers; delete p.noOfferMail; }
// clubs de l'IA pour qui le joueur serait un renfort et qui peuvent payer environ ce prix
function potentialBuyers(p, price = p.askPrice || playerValue(p)) {
  return Object.values(S.clubs).filter(c => c.ai && !c.solo && !c.filler && c.id !== p.club && c.divisions[p.game] && c.budget > price * 0.7 && !(c.parent && isMine(c.parent)) && (() => {
    const r = clubPlayers(c.id, p.game);
    return r.length < GAMES[p.game].size || r.some(x => x.rating < p.rating - 1);
  })());
}
// 0 (personne) à 3 (très demandé)
function transferInterest(p) {
  const ratio = (p.askPrice || playerValue(p)) / Math.max(1, playerValue(p)), n = potentialBuyers(p).length;
  if (!n || ratio > 1.6) return 0;
  const score = Math.min(n, 12) / 12 * 2 + (1.4 - ratio) * 2 + (p.age <= 22 ? 0.4 : p.age >= 28 ? -0.4 : 0);
  return score >= 2.2 ? 3 : score >= 1.2 ? 2 : score > 0.3 ? 1 : 0;
}
const INTEREST_LABEL = ["Aucun club intéressé", "Intérêt faible", "Intérêt moyen", "Très demandé"];
function offersForListed(report) {
  const now = rankNow();
  for (const p of allUserPlayers().filter(x => x.listed)) {
    p.listedAt = p.listedAt ?? now; p.askPrice = p.askPrice || playerValue(p);
    p.offers = (p.offers || []).filter(o => o.until >= now && S.clubs[o.club] && mercatoOpen(p.game));
    if (!mercatoOpen(p.game)) continue;
    const lvl = transferInterest(p);
    if (!lvl || p.offers.length >= 3 || Math.random() > [0, 0.12, 0.28, 0.5][lvl] * (windowAt(p.game) ? 1.3 : 1)) {
      if (!p.offers.length && now - p.listedAt >= 6 && !p.noOfferMail) { p.noOfferMail = true; mail(`📋 Aucune offre pour ${p.handle}`, `${p.handle} est sur la liste des transferts depuis ${now - p.listedAt} semaines sans la moindre offre (${INTEREST_LABEL[lvl].toLowerCase()}). Prix demandé : ${money(p.askPrice)} pour une valeur estimée à ${money(playerValue(p))}. Baissez le prix ou attendez une période de mercato plus animée.`, "transfer", p.game); }
      continue;
    }
    const cands = potentialBuyers(p).filter(c => !p.offers.some(o => o.club === c.id));
    if (!cands.length) continue;
    const buyer = pick(cands), ask = p.askPrice || playerValue(p), val = playerValue(p);
    // un club offre en dessous du prix demandé, et garde une marge pour une contre-proposition
    const max = Math.round(Math.min(buyer.budget * 0.8, Math.max(ask * rand(0.85, 1.05), val * rand(0.8, 1.1))) / 500) * 500;
    const fee = Math.round(max * rand(0.78, 0.95) / 500) * 500;
    if (fee < 500) continue;
    const o = { id: "of" + Math.random().toString(36).slice(2, 8), club: buyer.id, fee, max, until: now + 2, at: now };
    p.offers.push(o);
    mail(`💼 Offre pour ${p.handle} : ${money(fee)}`, `<b>${buyer.name}</b> propose <b>${money(fee)}</b> pour ${flag(p.nat)} ${p.handle} (${GAMES[p.game].short}, note ${p.rating}). Prix demandé : ${money(ask)}. Répondez avant de passer à la semaine suivante : acceptez, refusez ou faites une contre-proposition (bouton « 📨 Offres à traiter » ou Mercato → Liste des transferts).`, "transfer", p.game);
  }
}
function findOffer(pid, oid) { const p = S.players[pid]; return p && (p.offers || []).find(o => o.id === oid); }
function acceptTransferOffer(pid, oid) {
  const p = S.players[pid], o = findOffer(pid, oid);
  if (!o || !isMine(p.club)) return "Offre expirée.";
  if (!mercatoOpen(p.game)) return "Le mercato est fermé.";
  const fee = o.fee; unlistPlayer(pid); sellPlayer(pid, o.club, fee);
  return `${p.handle} part à ${S.clubs[o.club].name} pour ${money(fee)}.`;
}
function refuseTransferOffer(pid, oid) { const p = S.players[pid]; p.offers = (p.offers || []).filter(o => o.id !== oid); }
// contre-proposition : le club accepte jusqu'à son plafond, s'aligne une seule fois si on demande un peu plus, sinon se retire
function counterTransferOffer(pid, oid, fee) {
  const p = S.players[pid], o = findOffer(pid, oid);
  if (!o) return { status: "gone", msg: "Offre expirée." };
  const club = S.clubs[o.club].name;
  if (fee <= o.fee) return { status: "same", msg: "Votre contre-proposition est inférieure ou égale à leur offre." };
  if (fee <= o.max) { o.fee = fee; return { status: "accept", msg: `${club} accepte ${money(fee)}.` }; }
  if (!o.final && fee <= o.max * 1.2) { o.fee = o.max; o.final = true; o.until = Math.max(o.until, rankNow() + 1); return { status: "raise", msg: `${club} ne va pas jusque-là, mais monte à ${money(o.max)}. C'est leur dernière offre.` }; }
  refuseTransferOffer(pid, oid);
  return { status: "walk", msg: `${club} juge votre demande excessive et retire son offre.` };
}
// les clubs de l'IA mettent aussi en vente des remplaçants ou des joueurs en trop (moins chers qu'un joueur non transférable)
function aiTransferList() {
  for (const c of Object.values(S.clubs)) {
    if (!c.ai || c.solo || c.filler || Math.random() > 0.04) continue;
    for (const g of Object.keys(c.divisions)) {
      if (!mercatoOpen(g) || Math.random() > 0.5) continue;
      const r = clubPlayers(c.id, g);
      const cand = r.filter(p => !p.listed && (!p.starter || r.length > GAMES[g].size + 1)).sort((a, b) => a.rating - b.rating)[0];
      if (cand) listPlayer(cand.id, playerValue(cand) * rand(0.75, 1.05));
    }
  }
  // offres entre clubs de l'IA pour les joueurs en vente ; sans preneur, le club finit par le garder
  for (const p of Object.values(S.players).filter(p => p.listed && p.club && !isMine(p.club))) {
    if (rankNow() - (p.listedAt ?? rankNow()) > 16) { unlistPlayer(p.id); continue; }
    if (!mercatoOpen(p.game) || Math.random() > 0.05) continue;
    const buyer = pick(potentialBuyers(p)); if (!buyer) continue;
    const seller = S.clubs[p.club], fee = p.askPrice;
    unlistPlayer(p.id); removeFromClub(p); buyer.budget -= fee; seller.budget += fee;
    joinClub(p, buyer, salaryDemand(p, buyer), randi(1, 3)); aiFillRoster(seller.id, p.game);
    logMove(p, seller.id, buyer.id, fee);
  }
}

// ---------- classement mondial façon HLTV (CS2) ----------
// Chaque tournoi rapporte des points selon sa dotation et la place ; chaque victoire en ligue en rapporte un peu.
// Les points comptent pleinement 3 mois, à 75 % jusqu'à 6 mois, à 40 % jusqu'à un an. Les invitations aux grands
// tournois suivent ce classement, et les tiers sont refaits d'après lui à chaque fin de saison.
const RANKED_GAMES = ["cs2"];
const rankNow = () => S.season * 52 + S.week;
function rankAdd(game, id, pts, t = rankNow(), why = "") {
  if (!S.clubs[id]) return;
  ((S.rankLog = S.rankLog || {})[game] = S.rankLog[game] || []).push([t, id, Math.round(pts)]);
  // points gagnés ou perdus par le club du joueur cette semaine (récap après chaque match)
  if (why && isMine(id) && S.rep && S.rep.season === S.season && S.rep.week === S.week) (S.rep.rank = S.rep.rank || []).push([game, Math.round(pts), why, id]);
}
function rankLeagueWin(game, id) { const d = divOf(id, game); if (d) rankAdd(game, id, [12, 5, 2][d.tier - 1]); }
// points du classement de chaque équipe, recalculés une fois par semaine (assez précis pour les face-à-face)
function rankPtsMap(game) {
  const c = (rankPtsMap.cache = rankPtsMap.cache || {});
  if (!c[game] || c[game].t !== rankNow() || c[game].season !== S.season) { const m = {}; rankingOf(game).forEach(x => m[x.id] = x.pts); c[game] = { t: rankNow(), season: S.season, m }; }
  return c[game].m;
}
// Face-à-face façon Elo (comme la VRS de Valve) : le vainqueur prend des points au perdant. Battre une équipe bien mieux
// classée rapporte gros ; perdre contre une équipe bien moins classée en coûte beaucoup ; un résultat attendu change peu.
// Plus l'enjeu est grand (grand tournoi, phase finale), plus le match compte.
function rankMatch(game, winner, loser, stake = 1) {
  const m = rankPtsMap(game), ra = (m[winner] || 0) / 4, rb = (m[loser] || 0) / 4;
  const expected = 1 / (1 + Math.pow(10, (rb - ra) / 400));
  const k = 50 + 25 * Math.min(2, stake), delta = Math.round(k * (1 - expected));
  const d = divOf(winner, game), bonus = d ? [12, 5, 2][d.tier - 1] : 0;
  rankAdd(game, winner, bonus + delta, undefined, `Victoire contre ${clubLabel(loser, game)}`); rankAdd(game, loser, -delta, undefined, `Défaite contre ${clubLabel(winner, game)}`);
  return { win: bonus + delta, loss: -delta };
}
function rankTournament(game, order, prize, name = "Tournoi") {
  const base = clamp(60 + prize / 2500, 60, 1000);
  order.forEach((id, i) => rankAdd(game, id, base * (i < 1 ? 1 : i < 2 ? 0.7 : i < 4 ? 0.5 : i < 8 ? 0.3 : i < 16 ? 0.15 : 0.07), undefined, `${name} : ${i === 0 ? "vainqueur" : i + 1 + "e place"}`));
}
function rankingOf(game) {
  const now = rankNow(), tot = {};
  for (const [t, id, pts] of (S.rankLog && S.rankLog[game]) || []) {
    const age = now - t, k = age <= 13 ? 1 : age <= 26 ? 0.75 : age <= 52 ? 0.4 : 0;
    if (k && S.clubs[id] && divOf(id, game)) tot[id] = (tot[id] || 0) + pts * k;
  }
  return Object.entries(tot).map(([id, pts]) => ({ id, pts: Math.round(pts) })).sort((a, b) => b.pts - a.pts);
}
const rankPos = (game, id) => rankingOf(game).findIndex(x => x.id === id) + 1;
// classement régional (comme la VRS de Valve : Europe, Amériques, Asie-Pacifique)
const RANK_REGIONS = { EU: ["Europe", ["EU", "MENA"]], AM: ["Amériques", ["NA", "SA"]], AS: ["Asie-Pacifique", ["ASIA", "OCE"]] };
const rankRegionOf = (id, game) => { const r = clubRegion(S.clubs[id], game); return Object.keys(RANK_REGIONS).find(k => RANK_REGIONS[k][1].includes(r)) || "EU"; };
const regionalRanking = (game, reg) => rankingOf(game).filter(x => rankRegionOf(x.id, game) === reg);
// classement de départ : d'après le niveau des équipes (comme si la saison précédente venait de finir)
function seedRanking() {
  for (const game of RANKED_GAMES) {
    const ids = leaguesOf(game).flatMap(L => L.teams).filter(id => S.clubs[id]).sort((a, b) => teamStrength(b, game).str - teamStrength(a, game).str);
    ids.slice(0, 48).forEach((id, i) => rankAdd(game, id, 1000 * Math.pow(0.91, i), rankNow() - 6));
  }
}
function rankSnapshot() {
  S.rankPrev = S.rankPrev || {};
  for (const game of RANKED_GAMES) { const o = {}; rankingOf(game).forEach((x, i) => o[x.id] = i + 1); S.rankPrev[game] = o; }
  for (const g in S.rankLog || {}) S.rankLog[g] = S.rankLog[g].filter(e => rankNow() - e[0] <= 52);
}
// fin de saison : les tiers suivent le classement mondial (top 12 en tier 1…)
function reassignByRanking(game, moves) {
  const Ls = [1, 2, 3].map(t => S.leagues[lkey(game, t)]), sizes = Ls.map(L => L.teams.length);
  const pts = {}; rankingOf(game).forEach(x => pts[x.id] = x.pts);
  const all = Ls.flatMap(L => L.teams).filter(id => S.clubs[id] && divOf(id, game))
    .sort((a, b) => (pts[b] || 0) - (pts[a] || 0) || teamStrength(b, game).str - teamStrength(a, game).str);
  let k = 0;
  Ls.forEach((L, t) => { L.teams = all.slice(k, k + sizes[t]); k += sizes[t]; });
  Ls[2].teams = Ls[2].teams.concat(all.slice(k));
  Ls.forEach((L, t) => L.teams.forEach(id => {
    const d = divOf(id, game);
    if (isMine(id) && d.tier !== t + 1) moves.push(`${t + 1 < d.tier ? "⬆️" : "⬇️"} ${GAMES[game].short} : ${all.indexOf(id) + 1}e du classement mondial, place en ${TIER_LABEL[t]} (${tierName(game, t + 1)})`);
    d.tier = t + 1;
  }));
}

// ---------- contrats détaillés (façon Football Manager) ----------
const STATUSES = ["Espoir", "Remplaçant", "Rotation", "Titulaire", "Star"];
const PERSONALITIES = {
  "Calme":       { patience: 6, greed: 1.0,  w: { salary: 0.4, bonus: 0.1, share: 0.15, win: 0.05 }, desc: "Patient, ouvert à la discussion." },
  "Loyal":       { patience: 6, greed: 0.92, w: { salary: 0.4, bonus: 0.1, share: 0.15, win: 0.05 }, desc: "Attaché au projet, demandes modérées." },
  "Ambitieux":   { patience: 4, greed: 1.05, w: { salary: 0.35, bonus: 0.1, share: 0.15, win: 0.05 }, status: 2, desc: "Veut un rôle important et une clause pour partir vers plus grand." },
  "Mercenaire":  { patience: 3, greed: 1.12, w: { salary: 0.5, bonus: 0.2, share: 0.2, win: 0.1 }, desc: "Pense d'abord à l'argent." },
  "Exigeant":    { patience: 2, greed: 1.1,  w: { salary: 0.4, bonus: 0.12, share: 0.18, win: 0.05 }, status: 1.5, desc: "Peu de patience, déteste les offres au rabais." },
  "Jeune talent":{ patience: 5, greed: 0.95, w: { salary: 0.3, bonus: 0.08, share: 0.1, win: 0.03 }, status: 1.5, desc: "Veut du temps de jeu avant tout." },
};
const hashOf = str => [...str].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
function personalityOf(p) {
  if (!p.personality) {
    const keys = ["Calme", "Loyal", "Ambitieux", "Mercenaire", "Exigeant"];
    p.personality = p.age <= 19 && hashOf(p.id) % 2 ? "Jeune talent" : keys[hashOf(p.handle + p.id) % keys.length];
  }
  return p.personality;
}
const nowIndex = () => S.season * 100 + S.week;
// part des gains conservée par le club du joueur dans un jeu donné
function clubKeep(game) {
  const ps = clubPlayers(S.userId, game);
  if (!ps.length) return 0.5;
  return clamp(1 - ps.reduce((t, p) => t + (p.prizeShare ?? 50), 0) / ps.length / 100, 0, 1);
}
// statut que le joueur estime mériter dans votre effectif
function expectedStatus(p, club) {
  const mates = clubPlayers(club.id, p.game).filter(x => x.id !== p.id).map(x => x.rating).sort((a, b) => b - a);
  const rank = mates.filter(r => r > p.rating).length, size = GAMES[p.game].size;
  if (p.age <= 19 && p.rating < 75) return "Espoir";
  if (rank === 0 && p.rating >= 80) return "Star";
  if (rank < size) return "Titulaire";
  return rank < size + 2 ? "Rotation" : "Remplaçant";
}
// ce que demande le joueur (et son agent)
// ---------- régions ----------
const homeRegion = p => REGION_OF[p.nat] || "EU";
const playRegion = p => p.region || homeRegion(p);
// envie de s'installer dans une autre région (0 = jamais, 1 = partant), propre à chaque joueur
function relocateWill(p) {
  const pers = personalityOf(p);
  const base = (hashOf(p.id + "|move") % 100) / 100;
  return clamp(base + ({ Ambitieux: 0.2, Mercenaire: 0.25, Loyal: -0.15, "Jeune talent": -0.1 }[pers] || 0) - (p.age <= 17 ? 0.15 : 0), 0, 1);
}
// semaines écoulées depuis un instant nowIndex()
const weeksSince = t => (S.season - Math.floor(t / 100)) * 52 + (S.week - t % 100);
const ADAPT_WEEKS = 8;
// malus d'adaptation après un changement de région (nouveau ping, nouveaux horaires, déménagement)
function adaptFactor(p) {
  if (!p.movedAt) return 1;
  const w = weeksSince(p.movedAt);
  return w >= ADAPT_WEEKS ? 1 : 1 - 0.06 * (1 - w / ADAPT_WEEKS);
}
// région d'inscription d'une équipe : celle de l'organisation pour les jeux en équipe (Karmine Corp → Europe, même avec des imports
// coréens), celle du premier joueur pour les duos, trios et joueurs indépendants
function clubRegion(club, game) {
  const ov = REGION_OVERRIDES[game + ":" + (club.sister || club.id)] || (S && S.regionOverride && S.regionOverride[game + ":" + club.id]); if (ov) return ov;
  if (GAMES[game].fmt === "team" && !club.solo && !club.filler && REGION_OF[club.country] !== undefined) return REGION_OF[club.country];
  if (GAMES[game].fmt === "team" && !club.solo && !club.filler) return "EU";
  const first = clubPlayers(club.id, game)[0];
  return first ? homeRegion(first) : REGION_OF[club.country] || "EU";
}
// règlement : tous les titulaires d'une équipe sont inscrits dans la même région
function teamRegion(clubId, game) {
  const st = clubPlayers(clubId, game).filter(p => p.starter);
  return st.length ? playRegion(st[0]) : null;
}
function contractDemands(p, club, ctx) {
  const pers = PERSONALITIES[personalityOf(p)];
  const greed = pers.greed * (ctx === "renew" && p.morale < 40 ? 1.25 : 1) * (ctx === "renew" && personalityOf(p) === "Loyal" ? 0.92 : 1);
  const salary = round50(salaryDemand(p, club) * greed);
  const value = playerValue(p);
  const star = p.rating >= 82 || personalityOf(p) === "Ambitieux";
  return {
    salary,
    years: p.age <= 21 ? [2, 4] : p.age >= 28 ? [2, 3] : personalityOf(p) === "Ambitieux" ? [1, 2] : [1, 3],
    bonus: round50(salary * rand(3, 6) * (personalityOf(p) === "Mercenaire" ? 1.6 : 1)),
    agentFee: Math.max(200, Math.round(Math.min(value * 0.06, salary * rand(4, 10)) / 100) * 100),
    prizeShare: clamp(Math.round(30 + (p.rating - 70) * 1.2 + (personalityOf(p) === "Mercenaire" ? 10 : 0)), 15, 75),
    winBonus: round50(salary * rand(0.08, 0.2)),
    clauseMax: star ? Math.round(value * rand(1.6, 2.6) / 10000) * 10000 : 0,
    status: expectedStatus(p, club),
    region: playRegion(p),
  };
}
function startNegotiation(pid, ctx, fee = 0) {
  const p = S.players[pid], u = user();
  if (p.noTalkUntil && p.noTalkUntil > nowIndex()) return { error: `${p.handle} refuse de vous parler pour le moment, après l'échec des dernières négociations.` };
  if (ctx === "transfer" && !interestCheck(p)) return { error: `${p.handle} n'est pas intéressé par le projet : votre club manque de notoriété ou évolue trop bas.` };
  const pers = PERSONALITIES[personalityOf(p)];
  const patience = pers.patience + randi(0, 1);
  return { pid, ctx, fee, dem: contractDemands(p, u, ctx), patience, maxPatience: patience, log: [], round: 0 };
}
const REPLIES = {
  insult: ["« Vous vous moquez de mon client ? »", "L'agent éclate de rire avant de raccrocher à moitié.", "« Avec cette offre, on ne va pas aller loin. C'est presque insultant. »"],
  low: ["« On est encore loin du compte. »", "« Mon client attend un vrai effort de votre part. »", "« Ce n'est pas sérieux, revenez avec mieux. »"],
  close: ["« On se rapproche, mais il manque encore quelque chose. »", "« Encore un petit effort et on signe. »", "« C'est presque bon. »"],
};
// évalue une offre : renvoie accept / counter / walk avec la réaction de l'agent
function proposeContract(N, offer) {
  const p = S.players[N.pid], d = N.dem, pers = PERSONALITIES[personalityOf(p)];
  const ratio = (v, want) => want <= 0 ? 1.1 : Math.min(1.15, v / want);
  // jouer hors de chez lui : certains refusent net, les autres veulent être payés pour s'installer
  const home = homeRegion(p), region = offer.region || playRegion(p), moving = region !== playRegion(p) && region !== home;
  const will = relocateWill(p), movePremium = moving ? 1.12 + 0.6 * (1 - will) : 1;
  if (moving && will < 0.25) {
    N.round++; N.patience -= 1; N.log.push({ offer: { ...offer }, score: 0 });
    if (N.patience <= 0) { p.noTalkUntil = nowIndex() + 4; return { status: "walk", msg: `« Mon client ne quittera pas ${REGIONS[home]}, c'est non négociable. » ${p.handle} met fin aux négociations pour 4 semaines.` }; }
    return { status: "counter", tone: "insult", msg: `« Mon client refuse de jouer en ${REGIONS[region]} : il veut rester en ${REGIONS[home]}. Ce n'est pas une question d'argent. »` };
  }
  const parts = {
    salary: ratio(offer.salary, d.salary * movePremium), bonus: ratio(offer.bonus, d.bonus),
    share: ratio(offer.prizeShare, d.prizeShare), win: ratio(offer.winBonus, d.winBonus),
  };
  let score = Object.entries(pers.w).reduce((t, [k, w]) => t + w * parts[k], 0) / Object.values(pers.w).reduce((a, b) => a + b, 0);
  const issues = [];
  const statusGap = STATUSES.indexOf(d.status) - STATUSES.indexOf(offer.status);
  if (statusGap > 0) { score -= statusGap * 0.06 * (pers.status || 1); issues.push(`veut le statut « ${d.status} »`); }
  if (offer.years < d.years[0] || offer.years > d.years[1]) { score -= 0.04; issues.push(`souhaite un contrat de ${d.years[0]} à ${d.years[1]} ans`); }
  if (d.clauseMax && (!offer.clause || offer.clause > d.clauseMax)) { score -= offer.clause ? 0.05 : 0.08; issues.push(`exige une clause libératoire ≤ ${money(d.clauseMax)}`); }
  const agentR = offer.agentFee / d.agentFee;
  if (agentR < 1) { score -= (1 - agentR) * 0.12; if (agentR < 0.8) issues.push(`l'agent réclame ${money(d.agentFee)} de commission`); }
  for (const [k, lbl] of [["share", "la part du cashprize trop basse"], ["bonus", "la prime à la signature trop basse"], ["salary", "le salaire trop bas"]]) if (parts[k] < 0.92) issues.unshift(`trouve ${lbl}`);
  if (moving && parts.salary < 0.97) issues.unshift(`accepte de s'installer en ${REGIONS[region]}, mais veut environ ${money(round50(d.salary * movePremium))}/sem pour ça`);
  N.round++;
  N.log.push({ offer: { ...offer }, score });
  if (score >= 0.97) return { status: "accept", msg: "« Marché conclu, mon client est ravi ! »" };
  let tone;
  if (score < 0.72 || agentR < 0.4) { N.patience -= 2; tone = "insult"; }
  else if (score < 0.88) { N.patience -= 1; tone = "low"; }
  else { N.patience -= 1; tone = "close"; d.salary = round50(d.salary * 0.97); d.bonus = round50(d.bonus * 0.95); }
  if (N.patience <= 0) {
    p.noTalkUntil = nowIndex() + 4;
    p.morale = clamp(p.morale - (N.ctx === "renew" ? 15 : 0), 0, 100);
    return { status: "walk", msg: `${pick(REPLIES[tone === "close" ? "low" : tone])} ${p.handle} met fin aux négociations et ne veut plus en entendre parler pendant 4 semaines.` };
  }
  // l'agent fait sa propre contre-proposition (le contrat se met à jour, il suffit de l'accepter)
  const counter = { ...offer, region, status: d.status, years: clamp(offer.years, d.years[0], d.years[1]), salary: Math.max(offer.salary, round50(d.salary * movePremium)),
    bonus: Math.max(offer.bonus, d.bonus), agentFee: Math.max(offer.agentFee, d.agentFee), prizeShare: Math.max(offer.prizeShare, d.prizeShare), winBonus: Math.max(offer.winBonus, d.winBonus),
    clause: d.clauseMax ? (offer.clause && offer.clause <= d.clauseMax ? offer.clause : d.clauseMax) : offer.clause };
  return { status: "counter", tone, counter, msg: pick(REPLIES[tone]) + (issues.length ? " Il " + issues.slice(0, 3).join(", ") + "." : "") };
}
// applique le contrat signé
function acceptContract(N, offer) {
  const p = S.players[N.pid], u = user();
  const upfront = offer.bonus + offer.agentFee + (N.ctx === "transfer" ? N.fee : 0);
  if (u.budget < upfront) return `Budget insuffisant : il faut ${money(upfront)} tout de suite (prime, commission${N.ctx === "transfer" ? ", transfert" : ""}).`;
  const be = budgetCheck(p.game, upfront, offer.salary - (N.ctx === "renew" ? p.salary : 0)); if (be) return be;
  book("signing", -offer.bonus, p.game, "Prime à la signature : " + p.handle);
  book("agents", -offer.agentFee, p.game, "Commission d'agent : " + p.handle);
  if (N.ctx === "transfer") book("transfers", -N.fee, p.game, `Transfert : ${p.handle} (${S.clubs[p.club].name})`);
  const prevRegion = playRegion(p), prevMoved = p.movedAt;
  let from = "";
  if (N.ctx === "transfer") {
    const seller = S.clubs[p.club];
    from = seller.solo ? " (indépendant)" : ` (transfert depuis ${seller.name} : ${money(N.fee)})`;
    seller.budget += N.fee;
    removeFromClub(p);
    joinClub(p, u, offer.salary, offer.years);
    logMove(p, seller.id, u.id, N.fee);
    aiFillRoster(seller.id, p.game);
    u.fame = clamp(u.fame + Math.max(0, (p.rating - 80) * 0.15), 0, 100);
  } else if (N.ctx === "sign") {
    joinClub(p, u, offer.salary, offer.years);
    logMove(p, null, u.id, 0);
  }
  Object.assign(p, { salary: offer.salary, years: offer.years, prizeShare: offer.prizeShare, winBonus: offer.winBonus, clause: offer.clause, status: offer.status, promiseBroken: 0 });
  const region = offer.region || prevRegion;
  if (region !== homeRegion(p)) p.region = region; else delete p.region;
  if (region !== prevRegion) p.movedAt = nowIndex(); else if (prevMoved) p.movedAt = prevMoved;
  arrangeUnits(p.game);
  // un titulaire inscrit dans une autre région que ses coéquipiers passe sur le banc
  const tr = teamRegion(u.id, p.game);
  if (!unitGame(p.game) && p.starter && tr && clubPlayers(u.id, p.game).some(x => x.starter && x.id !== p.id && playRegion(x) !== playRegion(p))) p.starter = false;
  p.morale = clamp(p.morale + 10, 0, 100);
  mail(`${N.ctx === "renew" ? "Prolongation" : "Signature"} : ${p.handle}`,
    `${flag(p.nat)} <b>${p.handle}</b> (${GAMES[p.game].short}, ${p.rating})${from} — ${offer.years} an(s), ${money(offer.salary)}/sem, statut « ${offer.status} ».<br>
     Région de jeu : ${REGIONS[playRegion(p)]}${p.movedAt === nowIndex() ? ` (déménagement : ${ADAPT_WEEKS} semaines d'adaptation)` : ""}.<br>Prime de signature ${money(offer.bonus)} · commission d'agent ${money(offer.agentFee)} · ${offer.prizeShare} % des cashprizes · prime de victoire ${money(offer.winBonus)} · clause libératoire ${offer.clause ? money(offer.clause) : "aucune"}.`, "transfer");
  return null;
}
// prix d'une clause libératoire d'un joueur IA : son club ne peut pas refuser
function payClause(pid) { const p = S.players[pid], we = windowCheck(p); if (we) return { error: we }; return p.clause > 0 ? startNegotiation(pid, "transfer", p.clause) : { error: "Ce joueur n'a pas de clause libératoire." }; }
// effets hebdomadaires : promesses de statut, clauses activées par d'autres clubs
function weeklyContractEffects() {
  const u = user();
  for (const p of allUserPlayers()) {
    const promised = STATUSES.indexOf(p.status || "Titulaire");
    if (promised >= 3 && !p.starter) {
      p.morale = clamp(p.morale - (promised === 4 ? 2 : 1.2), 0, 100);
      p.promiseBroken = (p.promiseBroken || 0) + 1;
      if (p.promiseBroken === 6) mail(`😠 ${p.handle} se sent trahi`, `On lui avait promis le statut « ${p.status} », mais il est sur le banc depuis 6 semaines. Son moral chute.`, "transfer", p.game);
    } else p.promiseBroken = 0;
    // un club plus prestigieux peut payer la clause
    if (p.clause > 0 && mercatoOpen(p.game) && p.rating >= 75 && p.clause <= playerValue(p) * 1.6 && Math.random() < 0.04 * WEEK_SCALE) {
      const myTier = u.divisions[p.game].tier;
      const buyers = Object.values(S.clubs).filter(c => c.ai && !c.solo && c.divisions[p.game] && c.divisions[p.game].tier <= myTier && c.fame > u.fame - 5);
      if (!buyers.length) continue;
      const buyer = pick(buyers);
      book("clauses", p.clause, p.game, `Clause libératoire de ${p.handle} payée par ${buyer.name}`);
      const sellerId = p.club;
      removeFromClub(p);
      joinClub(p, buyer, salaryDemand(p, buyer), randi(2, 4));
      logMove(p, sellerId, buyer.id, p.clause);
      const roster = clubPlayers(buyer.id, p.game);
      if (roster.length > GAMES[p.game].size + 2) { const worst = roster.filter(x => x.id !== p.id).sort((a, b) => a.rating - b.rating)[0]; removeFromClub(worst); worst.years = 0; }
      mail(`💸 Clause activée : ${p.handle}`, `<b>${buyer.name}</b> a payé la clause libératoire de ${p.handle} (${money(p.clause)}). Le joueur quitte le club.`, "transfer");
      p.clause = 0;
    }
  }
}

// ---------- matchs ----------
// un joueur remotivé par une discussion joue un peu au-dessus de son niveau pendant quelques semaines
const boostOf = p => p.boostUntil && S && p.boostUntil >= nowIndex() ? (p.boost || 0) : 0;
function effRating(p) { return p.rating * (0.88 + 0.12 * p.form / 100) * (0.92 + 0.08 * p.morale / 100) * adaptFactor(p) * (1 + boostOf(p) / 100); }
// ---------- notes de match sur 10 (comme dans FM) ----------
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 0.75;
function addNote(p, n, keep) {
  n = Math.round(clamp(n, 3, 10) * 10) / 10;
  p.stats.r = (p.stats.r || 0) + n; p.stats.rn = (p.stats.rn || 0) + 1; p.lastNote = n;
  // l'historique détaillé n'est gardé que pour vos joueurs (la sauvegarde reste légère)
  if (keep) p.notes = (p.notes || []).concat(n).slice(-10);
  return n;
}
const avgNote = p => p.stats && p.stats.rn ? p.stats.r / p.stats.rn : null;
// note de chaque joueur d'une équipe : son niveau face à l'adversaire, le résultat, et une part de hasard
function rateLineup(lineup, oppStr, won, mvp, keep) {
  return lineup.map(p => {
    let n = 6.4 + clamp((effRating(p) - oppStr) / 10, -1.4, 1.4) + (won ? 0.5 : -0.5) + gauss() * 0.7;
    if (p === mvp) n = Math.max(n + 0.5, 7.5);
    return [p.handle, addNote(p, n, keep && isMine(p.club)), p.id];
  });
}
// ---------- caractères et entente ----------
const TRAITS = { "Leader": "Prend les choses en main ; deux leaders se marchent dessus.", "Boute-en-train": "Met une bonne ambiance dans le groupe.",
  "Discret": "S'entend avec tout le monde sans faire de bruit.", "Mentor": "Fait progresser les jeunes et les encadre.", "Perfectionniste": "Exigeant, supporte mal les têtes brûlées.",
  "Tête brûlée": "Imprévisible, agace les perfectionnistes.", "Solitaire": "Joue pour lui, crée peu de liens.", "Toxique": "Pourrit l'ambiance quand ça va mal." };
function traitOf(p) {
  if (!p.trait) { const h = hashOf(p.handle + "|trait") % 100; p.trait = h < 14 ? "Leader" : h < 30 ? "Boute-en-train" : h < 52 ? "Discret" : h < 60 ? "Mentor" : h < 72 ? "Perfectionniste" : h < 84 ? "Tête brûlée" : h < 94 ? "Solitaire" : "Toxique"; }
  return p.trait;
}
// entente entre deux joueurs (-3 à +3)
function pairScore(a, b) {
  const ta = traitOf(a), tb = traitOf(b), has = t => ta === t || tb === t;
  let s = a.nat && a.nat === b.nat ? 1 : 0;
  if (ta === "Leader" && tb === "Leader") s -= 2;
  if (has("Toxique")) s -= ta === tb ? 3 : 2;
  if (has("Boute-en-train")) s += 1;
  if (has("Perfectionniste") && has("Tête brûlée")) s -= 2;
  if (has("Solitaire")) s -= 0.5;
  if ((ta === "Mentor" && b.age <= 20) || (tb === "Mentor" && a.age <= 20)) s += 2;
  return clamp(s, -3, 3);
}
// entente d'une équipe (-10 à +10) ; un entraîneur qui gère bien les egos atténue les conflits
function chemistry(list, coach) {
  if (!list || list.length < 2) return 0;
  let sum = 0, n = 0;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { sum += pairScore(list[i], list[j]); n++; }
  let c = clamp(sum / n * 4, -10, 10);
  if (c < 0 && coach) c *= 1 - coach.attrs.discipline / 30;
  return Math.round(c * 10) / 10;
}
const conflicts = list => { const out = []; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const sc = pairScore(list[i], list[j]); if (sc <= -2 || sc >= 2) out.push([list[i], list[j], sc]); } return out; };

// ---------- entraîneurs (façon FM) ----------
// notes sur 20 : tactique (niveau en match), motivation (moral), formation des jeunes (progression des moins de 22 ans), gestion des egos (entente)
const COACH_ATTRS = { tactique: "Tactique", motivation: "Motivation", jeunes: "Formation des jeunes", discipline: "Gestion des egos" };
const COACH_FIRST = ["Marc", "Julien", "Lucas", "Kim", "Lee", "Park", "Alex", "Sam", "Tomás", "Diego", "Jonas", "Erik", "Mehdi", "Yanis", "Hugo", "Léo", "Chen", "Wang", "Ivan", "Pavel", "Rafael", "Mateo", "Nico", "Oliver", "Max", "Ben", "Ryu", "Kenji", "Omar", "Ali"];
const COACH_LAST = ["Durand", "Martin", "Moreau", "Schmidt", "Novak", "Silva", "Costa", "Rossi", "Jensen", "Kowalski", "Petrov", "Nguyen", "Tanaka", "Seo", "Choi", "Zhang", "Liu", "García", "López", "Müller", "Fischer", "Dubois", "Bernard", "Haddad", "Benali", "Andersson", "Lindqvist", "Ferreira", "Romero", "Kaya"];
const coachLevel = c => Object.values(c.attrs).reduce((a, b) => a + b, 0) / 4;
const coachOf = game => { const id = S.userId && S.clubs[S.userId] && S.clubs[S.userId].coaches && S.clubs[S.userId].coaches[game]; return id && S.coaches && S.coaches[id] ? S.coaches[id] : null; };
function coachWage(c) { const l = coachLevel(c); return round50((250 + l * l * 9) * (0.5 + 0.5 * GAMES[c.game].mult)); }
function makeCoach(game, o = {}) {
  const lvl = o.lvl ?? randi(5, 13), a = () => clamp(Math.round(lvl + rand(-3, 3)), 1, 20);
  const c = { id: uid("co"), name: o.name || `${pick(COACH_FIRST)} ${pick(COACH_LAST)}`, nat: o.nat || pick(Object.keys(COUNTRIES)), age: o.age || randi(28, 55), game,
    attrs: { tactique: a(), motivation: a(), jeunes: a(), discipline: a(), ...(o.attrs || {}) }, club: null, ex: o.ex || null, won: o.won || [] };
  c.wage = coachWage(c);
  (S.coaches = S.coaches || {})[c.id] = c;
  return c;
}
// un joueur qui prend sa retraite peut devenir entraîneur : sa tactique vient de son niveau, sa motivation et sa gestion des egos de sa personnalité
function coachFromPlayer(p) {
  const pers = personalityOf(p), base = clamp((p.rating - 55) / 2.2, 4, 18);
  return makeCoach(p.game, { name: p.handle, nat: p.nat, age: p.age + 1, ex: p.handle, won: (p.won || []).slice(-6), lvl: base,
    attrs: { tactique: clamp(Math.round(base + rand(-2, 3)), 1, 20), motivation: clamp(Math.round(base + ({ Loyal: 3, Calme: 2, Exigeant: -2, Mercenaire: -3 }[pers] || 0) + rand(-3, 3)), 1, 20),
      jeunes: clamp(Math.round(base - 2 + (traitOf(p) === "Mentor" ? 6 : 0) + rand(-3, 3)), 1, 20), discipline: clamp(Math.round(base + (traitOf(p) === "Leader" ? 4 : traitOf(p) === "Toxique" ? -6 : 0) + rand(-3, 3)), 1, 20) } });
}
// entraîneurs fictifs : libres (surtout moyens, un seul vraiment bon par jeu) et en poste dans les clubs des tiers 1 et 2
function seedCoaches() {
  for (const game of Object.keys(GAMES)) {
    for (let i = 0; i < 7; i++) makeCoach(game, { lvl: i === 0 ? randi(12, 14) : i < 3 ? randi(9, 12) : randi(5, 9) });
    for (const c of Object.values(S.clubs)) {
      const d = c.divisions[game];
      if (!d || c.filler || c.solo || c.parent || c.id === S.userId || d.tier > 2) continue;
      if (Math.random() > (d.tier === 1 ? 0.9 : 0.5)) continue;
      // le niveau suit le prestige du club, sans excès : 4 à 17 sur 20
      const co = makeCoach(game, { lvl: clamp(Math.round(4 + c.fame / 8 + rand(-2, 2)), 4, 16) });
      employCoach(co, c.id, randi(1, 3));
    }
  }
}
function employCoach(co, clubId, years) {
  const c = S.clubs[clubId]; if (!c) return;
  co.club = clubId; co.years = years;
  if (clubId === S.userId) { (c.coaches = c.coaches || {})[co.game] = co.id; return; }
  (c.coachIds = c.coachIds || {})[co.game] = co.id;
}
// entraîneur d'un club de l'IA dans un jeu
const aiCoachOf = (clubId, game) => { const c = S.clubs[clubId], id = c && c.coachIds && c.coachIds[game]; return id && S.coaches && S.coaches[id] ? S.coaches[id] : null; };
// recruter l'entraîneur d'un autre club : indemnité au club, puis l'entraîneur décide selon le projet (prestige, tier, salaire, durée, attachement)
function coachRelease(co) { const c = S.clubs[co.club]; return Math.round(co.wage * 18 * Math.max(1, co.years || 1) * (0.6 + (c ? c.fame : 30) / 150) / 1000) * 1000; }
function poachCoach(id, wage, years) {
  const u = user(), co = S.coaches[id], club = co && S.clubs[co.club];
  if (!co || !club || club.id === u.id) return { error: "Cet entraîneur n'est pas en poste dans un autre club." };
  if (!u.divisions[co.game]) return { error: `Ouvrez d'abord une division ${GAMES[co.game].name}.` };
  const fee = coachRelease(co), prime = wage * 6;
  if (u.budget < fee + prime) return { error: `Budget insuffisant : il faut ${money(fee)} d'indemnité pour ${club.name} et ${money(prime)} de prime d'arrivée.` };
  if (co.refusedAt && nowIndex() - co.refusedAt < 6) return { error: `${co.name} a déjà refusé votre offre récemment.` };
  const ud = u.divisions[co.game], cd = club.divisions[co.game];
  const loyal = (hashOf(co.id + "loyal") % 100) / 100;          // attachement à son club
  const reasons = [];
  let score = (u.fame - club.fame) / 25 + (wage / co.wage - 1) * 2.2 + (cd && ud ? (cd.tier - ud.tier) * 0.6 : 0) + (years >= 2 ? 0.15 : -0.1) - loyal * 0.8 + rand(-0.25, 0.25);
  if (u.fame < club.fame - 10) reasons.push(`${club.name} est plus prestigieux que votre club`);
  if (wage < co.wage * 1.1) reasons.push(`le salaire proposé n'est pas assez supérieur à son salaire actuel (${money(co.wage)}/sem)`);
  if (cd && ud && ud.tier > cd.tier) reasons.push(`il entraîne en tier ${cd.tier} et vous jouez en tier ${ud.tier}`);
  if (loyal > 0.7) reasons.push(`il est très attaché à ${club.name}`);
  if (score < 0.5) { co.refusedAt = nowIndex(); return { ok: false, msg: `${co.name} refuse : ${reasons.slice(0, 2).join(", ") || "il préfère finir son contrat"}.` }; }
  book("coaches", -fee, co.game, `Indemnité à ${club.name} pour ${co.name}`); club.budget += fee;
  book("coaches", -prime, co.game, `Prime d'arrivée : ${co.name}`);
  delete club.coachIds[co.game];
  // le club remplace son entraîneur par un autre, un peu moins bon
  employCoach(makeCoach(co.game, { lvl: clamp(Math.round(coachLevel(co) - randi(1, 4)), 3, 16) }), club.id, randi(1, 3));
  if (u.coaches && u.coaches[co.game]) fireCoach(co.game, true);
  co.wage = wage; employCoach(co, u.id, years);
  mail(`🧑‍🏫 ${co.name} rejoint le club`, `${co.name} quitte ${club.name} (indemnité ${money(fee)}) et devient l'entraîneur ${GAMES[co.game].name} pour ${money(wage)}/sem pendant ${years} an(s).`, "transfer", co.game);
  return { ok: true, msg: `${co.name} accepte votre projet !` };
}
function hireCoach(id) {
  const u = user(), c = S.coaches[id];
  if (!c || c.club) return "Cet entraîneur n'est pas disponible.";
  if (!u.divisions[c.game]) return `Ouvrez d'abord une division ${GAMES[c.game].name}.`;
  const prime = c.wage * 6;
  if (u.budget < prime) return `Budget insuffisant : il demande une prime de ${money(prime)}.`;
  u.coaches = u.coaches || {};
  if (u.coaches[c.game]) fireCoach(c.game, true);
  book("coaches", -prime, c.game, `Prime d'arrivée : ${c.name}`);
  c.club = u.id; c.years = 2; u.coaches[c.game] = c.id;
  mail(`🧑‍🏫 Nouvel entraîneur ${GAMES[c.game].short} : ${c.name}`, `${c.name}${c.ex ? " (ancien joueur pro)" : ""} prend en main l'équipe ${GAMES[c.game].name} pour ${money(c.wage)}/sem. Tactique ${c.attrs.tactique}, motivation ${c.attrs.motivation}, formation des jeunes ${c.attrs.jeunes}, gestion des egos ${c.attrs.discipline}.`, "transfer", c.game);
  return null;
}
function fireCoach(game, silent) {
  const u = user(), c = coachOf(game); if (!c) return;
  book("coaches", -c.wage * 8, game, `Indemnité de départ : ${c.name}`);
  c.club = null; delete u.coaches[game];
  if (!silent) mail(`Départ de l'entraîneur : ${c.name}`, `${c.name} quitte le club (indemnité de ${money(c.wage * 8)}).`, "transfer", game);
}
function teamStrength(clubId, game) {
  const c = S.clubs[clubId], g = GAMES[game];
  // un joueur suspendu ne joue pas
  const ps = clubPlayers(clubId, game).filter(p => !(p.suspendedUntil && p.suspendedUntil >= nowIndex()));
  // un joueur seul dans son duo/trio joue avec un partenaire trouvé hors du club
  let st = ps.filter(p => p.starter).concat(unitMates(clubId, game));
  if (st.length < g.size) st = st.concat(ps.filter(p => !p.starter).sort((a, b) => b.rating - a.rating));
  st = st.slice(0, g.size);
  const sum = st.reduce((s, p) => s + effRating(p), 0) + (g.size - st.length) * 30;
  const co = isMine(clubId) ? coachOf(game) : aiCoachOf(clubId, game);
  const bonus = facOf(c).coaching * 0.6 + facOf(c).analytics * 0.4 + (co ? co.attrs.tactique * 0.15 : 0);
  // entente entre les joueurs : jusqu'à ±3 %
  const chem = chemistry(st, co);
  return { str: (sum / g.size + bonus) * (1 + chem * 0.003), lineup: st, chem };
}
function afterResult(lineup, won) {
  lineup.forEach(p => {
    p.form = clamp(p.form + (won ? randi(1, 5) : -randi(1, 4)), 0, 100);
    p.morale = clamp(p.morale + (won ? 2 : -2), 0, 100);
    won ? p.stats.w++ : p.stats.l++;
  });
}
// enjeu d'un match pour les fans : tier de la ligue et popularité du jeu
const stakeOf = (game, tier) => [1, 0.35, 0.12][(tier || 3) - 1] * (0.4 + 0.6 * GAMES[game].mult);
const isMine = id => id === S.userId || (S.clubs[id] && S.clubs[id].parent === S.userId);
function clubResult(id, won, weight = 1, label) {
  const c = S.clubs[id];
  c.fame = clamp(c.fame + (won ? 0.25 : -0.15) * Math.min(2, weight), 1, 100);
  fanChange(id, won ? 1 : -1, weight, label);
}
// fans gagnés ou perdus après un résultat (sign : 1 victoire, -1 défaite, 0 nul ; weight : enjeu).
// Ordres de grandeur réels : une victoire en ligue majeure fait gagner ~0,1 % de fans, un titre mondial 5 à 10 %.
// Une bonne image (sponsors éthiques) amplifie les gains et amortit les défaites ; une mauvaise image fait l'inverse.
function fanChange(id, sign, weight, label) {
  const c = S.clubs[id]; if (!c) return 0;
  const host = c.parent && S.clubs[c.parent] ? S.clubs[c.parent] : c, img = host.image ?? 60;
  const pct = sign > 0 ? 0.0006 * weight * (0.5 + img / 100) : sign < 0 ? -0.0004 * weight * (1.5 - img / 100) : 0;
  const delta = Math.round(host.fans * pct + (sign > 0 ? 20 * weight : 0));
  host.fans = Math.max(100, host.fans + delta);
  if (host.id === S.userId && label) weekReport().fans.push([label, delta]);
  return delta;
}
function playSeries(game, a, b, bestOf, stake = 1, stage = "") {
  const g = GAMES[game];
  const A = teamStrength(a, game), B = teamStrength(b, game);
  const need = Math.ceil(bestOf / 2);
  let wa = 0, wb = 0; const maps = [], seq = [];
  while (wa < need && wb < need) {
    const sa = A.str + rand(-4, 4), sb = B.str + rand(-4, 4);
    const aWin = Math.random() < 1 / (1 + Math.pow(10, -(sa - sb) / 9));
    aWin ? wa++ : wb++; seq.push(aWin ? "a" : "b");
    if (g.rounds) { const lose = randi(Math.round(g.rounds * 0.2), g.rounds - 2); maps.push(aWin ? `${g.rounds}-${lose}` : `${lose}-${g.rounds}`); }
  }
  const winner = wa > wb ? a : b, loser = winner === a ? b : a;
  const wl = winner === a ? A.lineup : B.lineup;
  afterResult(wl, true); afterResult(winner === a ? B.lineup : A.lineup, false);
  const mvp = wl.slice().sort((x, y) => effRating(y) * rand(0.9, 1.1) - effRating(x) * rand(0.9, 1.1))[0];
  if (mvp) mvp.stats.mvp++;
  const mine = isMine(a) || isMine(b);
  const notesA = rateLineup(A.lineup, B.str, winner === a, mvp, mine), notesB = rateLineup(B.lineup, A.str, winner === b, mvp, mine);
  const rk = RANKED_GAMES.includes(game) ? rankMatch(game, winner, loser, stake) : null;
  const nm = id => { const c = S.clubs[id]; return c.solo ? soloName(c, game) : (c.divisions[game] && c.divisions[game].label) || c.name; };
  clubResult(winner, true, stake, isMine(winner) ? `${g.short} · victoire ${Math.max(wa, wb)}-${Math.min(wa, wb)} contre ${nm(loser)}${stage ? " (" + stage + ")" : ""}` : null);
  clubResult(loser, false, stake, isMine(loser) ? `${g.short} · défaite ${Math.min(wa, wb)}-${Math.max(wa, wb)} contre ${nm(winner)}${stage ? " (" + stage + ")" : ""}` : null);
  const r = { a, b, sa: wa, sb: wb, winner, loser, maps, mvp: mvp ? mvp.handle : null, bestOf };
  if (rk) r.rk = rk;
  if (mine) { r.seq = seq; r.notesA = notesA; r.notesB = notesB; }
  return r;
}
// Battle royale : un lobby complet (les places restantes sont prises par des équipes de l'open)
function playLobby(L, entrants, nGames, stake = 0.6, stage = "") {
  const g = GAMES[L.game];
  const [lo, hi] = TIER_RATING[L.tier - 1];
  const S0 = entrants.map(id => ({ id, ...teamStrength(id, L.game) }));
  const nOpen = Math.max(0, g.lobby - S0.length);
  const res = {}; entrants.forEach(id => res[id] = { places: [], kills: 0, pts: 0, top1: 0, kpg: [] });
  const gumbel = () => -6 * Math.log(-Math.log(Math.random()));
  // une partie de battle royale est très aléatoire : le niveau donne des probabilités, pas des places fixes.
  // Forme du jour de chaque équipe, mort prématurée (mauvais atterrissage, troisième équipe, zone) plus fréquente
  // pour les équipes faibles mais possible pour les meilleures, et parfois une partie « folle » pour n'importe qui.
  const avgStr = S0.length ? S0.reduce((a, e) => a + e.str, 0) / S0.length : (lo + hi) / 2;
  const day = {}; S0.forEach(e => day[e.id] = gauss() * 3);
  const roll = str => {
    // l'écart de niveau compte, mais une partie se joue aussi sur l'atterrissage, la zone et les combats
    let v = avgStr + (str - avgStr) * 0.55 + gumbel();
    if (Math.random() < clamp(0.2 - (str - avgStr) * 0.007, 0.07, 0.35)) v -= rand(18, 45);
    else if (Math.random() < 0.07) v += rand(6, 16);
    return v;
  };
  for (let k = 0; k < nGames; k++) {
    const field = S0.map(e => ({ id: e.id, perf: roll(e.str + day[e.id]) }))
      .concat(Array.from({ length: nOpen }, () => ({ id: null, perf: roll(rand(lo - 6, hi - 2)) })));
    field.sort((x, y) => y.perf - x.perf);
    const N = field.length, avg = field.reduce((s, f) => s + f.perf, 0) / N;
    field.forEach((f, i) => {
      if (!f.id) return;
      const place = i + 1;
      const kills = Math.max(0, Math.round(rand(0, g.size * 1.6) + (f.perf - avg) / 4));
      const pts = (place === 1 ? 25 : Math.round(18 * Math.pow(1 - (place - 1) / (N - 1), 2))) + kills;
      const r = res[f.id];
      r.places.push(place); r.kpg.push(kills); r.kills += kills; r.pts += pts; if (place === 1) r.top1++;
    });
  }
  const ranked = entrants.slice().sort((x, y) => res[y].pts - res[x].pts);
  const notes = {};
  ranked.forEach((id, i) => {
    const good = i < ranked.length / 2;
    // notes : place au classement du lobby et éliminations
    const e = S0.find(x => x.id === id), frac = ranked.length > 1 ? i / (ranked.length - 1) : 0, kshare = res[id].kills / Math.max(1, nGames * g.size * 1.6);
    notes[id] = e.lineup.map(p => [p.handle, addNote(p, 5.2 + (1 - frac) * 3 + kshare * 1.2 + gauss() * 0.6 + (effRating(p) - e.str) / 8, isMine(id)), p.id]);
    afterResult(S0.find(e => e.id === id).lineup, good);
    // les fans suivent le classement du lobby : top 3 = victoire, première moitié = neutre
    const sign = i < 3 ? 1 : good ? 0 : -1;
    S.clubs[id].fame = clamp(S.clubs[id].fame + (good ? 0.15 : -0.1) * stake, 1, 100);
    fanChange(id, sign, stake * (i === 0 ? 2 : 1), isMine(id) ? `${GAMES[L.game].short} · ${i + 1}e du lobby${stage ? " (" + stage + ")" : ""}` : null);
  });
  const best = S0.flatMap(e => e.lineup).sort((x, y) => effRating(y) * rand(0.85, 1.15) - effRating(x) * rand(0.85, 1.15))[0];
  if (best) best.stats.mvp++;
  const mineNotes = {}; for (const id of entrants.filter(isMine)) mineNotes[id] = notes[id];
  return { res, ranked, mvp: best ? best.handle : null, lobby: S0.length + nOpen, games: nGames, notes: mineNotes };
}

// ---------- semaine ----------
// rapport de la semaine en cours : il se remplit au fil des matchs lancés à la main, puis à la fin de la semaine
function weekReport() {
  if (!S.rep || S.rep.season !== S.season || S.rep.week !== S.week)
  { S.rep = { season: S.season, week: S.week, matches: [], lobbies: [], tournaments: [], income: {}, expenses: {}, events: [], fans: [], done: {}, fields: {} }; rankSnapshot(); }
  return S.rep;
}
// nom d'une équipe en texte simple
function clubLabel(id, game) { const c = S.clubs[id]; if (!c) return "?"; return c.solo ? soloName(c, game) : (c.divisions[game] && c.divisions[game].label) || c.name; }
// gains : le club du joueur ne garde que la part prévue dans les contrats (le reste revient aux joueurs)
function payPrize(id, amount, game, label) {
  if (!S.clubs[id]) return;
  if (S.clubs[id].parent === S.userId) id = S.userId;
  if (id === S.userId) return book("prize", amount * clubKeep(game), game, label);
  S.clubs[id].budget += Math.round(amount);
}
// une journée de ligue (toutes les rencontres de la ligue cette semaine)
function playLeagueDay(L) {
  const rep = weekReport(), key = "L:" + L.key;
  if (rep.done[key]) return; rep.done[key] = true;
  const g = GAMES[L.game], w = S.week, md = matchday(w), prize = tierPrize(L.game, L.tier), name = leagueName(L);
  const payL = (id, amount) => payPrize(id, amount, L.game, name), stake = stakeOf(L.game, L.tier);
  if (g.fmt === "br") {
    if (md) {
      const lob = playLobby(L, L.teams.filter(id => S.clubs[id]), g.gamesPerWeek, stake * 0.6, "journée " + md);
      for (const [id, r] of Object.entries(lob.res)) {
        const t = L.table[id] || (L.table[id] = emptyRow("br"));
        t.pts += r.pts; t.kills += r.kills; t.top1 += r.top1; t.games += r.places.length; t.place += r.places.reduce((a, b) => a + b, 0);
      }
      lob.ranked.slice(0, 3).forEach((id, i) => payL(id, prize * [0.01, 0.005, 0.0025][i]));
      L.results.push({ week: w, day: md, top: lob.ranked.slice(0, 3), pts: lob.ranked.slice(0, 3).map(id => lob.res[id].pts), mvp: lob.mvp });
      for (const id of L.teams.filter(isMine)) rep.lobbies.push({ game: L.game, tier: S.clubs[id].divisions[L.game].tier, ...lob, stage: `${name} — journée ${md}`, mine: lob.res[id], rank: lob.ranked.indexOf(id) + 1, club: id, week: w, dd: LEAGUE_WEEKDAY[L.game] ?? 6 });
    } else if (w === PO_SEMI || w === PO_FINAL) {
      // grande finale sur 2 semaines : les 8 meilleurs du classement
      if (w === PO_SEMI) L.playoffs = { finalists: standings(L.key).slice(0, 8).map(x => x.id), pts: {}, top1: {} };
      const P = L.playoffs; if (!P) return;
      const lob = playLobby(L, P.finalists.filter(id => S.clubs[id]), g.gamesPerWeek + 2, stake * 1.5, "grande finale");
      for (const [id, r] of Object.entries(lob.res)) { P.pts[id] = (P.pts[id] || 0) + r.pts; P.top1[id] = (P.top1[id] || 0) + r.top1; }
      for (const id of P.finalists.filter(isMine)) rep.lobbies.push({ game: L.game, tier: S.clubs[id].divisions[L.game].tier, ...lob, stage: `${name} — grande finale, jour ${w - PO_SEMI + 1}`, mine: lob.res[id], rank: lob.ranked.indexOf(id) + 1, club: id, week: w, dd: 6 });
      if (w === PO_FINAL) {
        const order = P.finalists.filter(id => S.clubs[id]).sort((a, b) => (P.pts[b] || 0) - (P.pts[a] || 0));
        P.order = order; L.champion = order[0];
        [0.4, 0.2, 0.1, 0.1].forEach((part, i) => order[i] && payL(order[i], prize * part));
        crown(L, order[0], order[1], `${P.pts[order[0]]} pts sur la finale`);
      }
    }
    return;
  }
  const t = id => L.table[id] || (L.table[id] = emptyRow(g.fmt));
  if (md && md <= L.schedule.length) {
    for (const [a, b] of L.schedule[md - 1]) {
      if (!S.clubs[a] || !S.clubs[b]) continue;
      const r = playSeries(L.game, a, b, 3, stake, name);
      r.week = w; r.day = md; r.dd = LEAGUE_WEEKDAY[L.game] ?? 5; r.stage = `${name} — journée ${md}`;
      L.results.push(r);
      const ta = t(a), tb = t(b);
      ta.mw += r.sa; ta.ml += r.sb; tb.mw += r.sb; tb.ml += r.sa;
      r.winner === a ? (ta.w++, tb.l++) : (tb.w++, ta.l++);
      payL(r.winner, prize * 0.0025);
      if (isMine(a) || isMine(b)) rep.matches.push({ ...r, game: L.game, tier: L.tier });
    }
  } else if (w === PO_SEMI) {
    const st = standings(L.key).slice(0, 4).map(x => x.id);
    if (st.length < 4) return;
    L.playoffs = { semis: [playSeries(L.game, st[0], st[3], 3, stake * 2, "demi-finale"), playSeries(L.game, st[1], st[2], 3, stake * 2, "demi-finale")], final: null };
    L.playoffs.semis.forEach(r => { r.stage = `${name} — demi-finale`; r.week = w; r.dd = 5; if (isMine(r.a) || isMine(r.b)) rep.matches.push({ ...r, game: L.game, tier: L.tier }); });
  } else if (w === PO_FINAL && L.playoffs) {
    const [s1, s2] = L.playoffs.semis;
    const f = playSeries(L.game, s1.winner, s2.winner, 5, stake * 3, "finale");
    f.stage = `${name} — grande finale`; f.week = w; f.dd = 6;
    L.playoffs.final = f; L.champion = f.winner;
    if (isMine(f.a) || isMine(f.b)) rep.matches.push({ ...f, game: L.game, tier: L.tier });
    payL(f.winner, prize * 0.4); payL(f.loser, prize * 0.2); payL(s1.loser, prize * 0.1); payL(s2.loser, prize * 0.1);
    crown(L, f.winner, f.loser, `${f.sa}-${f.sb} · MVP ${f.mvp}`);
  }
}
// palmarès personnel : chaque titulaire de l'équipe championne garde le titre dans sa carrière
function awardPlayers(clubId, game, label) {
  for (const p of clubPlayers(clubId, game).filter(x => x.starter)) { p.won = (p.won || []).concat(label).slice(-20); }
}
function crown(L, winner, runnerUp, detail) {
  const champ = S.clubs[winner], label = `${leagueName(L)} ${S.season}`;
  champ.fame = clamp(champ.fame + [5, 2.5, 1][L.tier - 1], 0, 100);
  fanChange(winner, 1, stakeOf(L.game, L.tier) * 15, isMine(winner) ? `🏆 Titre : ${label}` : null);
  champ.titles.push(label); awardPlayers(winner, L.game, label);
  S.titles.push({ season: S.season, game: L.game, tier: L.tier, zone: L.zone, name: leagueName(L), club: clubLabel(winner, L.game), clubId: champ.id });
  if (isMine(winner)) mail(`🏆 CHAMPIONS ! ${label}`, `${user().name} remporte le <b>${label}</b> (${tierLabel(L.game, L.tier)}) face à ${clubLabel(runnerUp, L.game)} — ${detail}.`, "trophy", L.game);
}
// niveau d'un tournoi façon Liquipedia (S, A, B, C) : selon l'accès (invitation des meilleurs ou open) et la dotation
function tourTier(t) {
  if (t[6] && t[6].tier) return t[6].tier;
  const prize = t[2] || 0, tiers = t[3] || "";
  if (prize >= 500000 || (tiers === "1" && prize >= 250000)) return "S";
  if (tiers === "1" || tiers === "12" || tiers === "123" || prize >= 100000) return "A";
  if (prize >= 15000 || tiers.includes("2")) return "B";
  return "C";
}
const TIER_IMP = { S: "gold", A: "silver", B: "normal", C: "minor" };
// FNCS : chaque Major se joue par région en trois étapes (qualifications ouvertes, demi-finales, grande finale) ;
// les meilleurs de chaque région aux grandes finales vont au Global Championship (quotas par région, comme en vrai).
// t[6] : { tier, from (étape précédente), top (qualifiés), worlds }
const FNCS_SHARE = { EU: 0.3, NA: 0.25, SA: 0.12, MENA: 0.11, ASIA: 0.11, OCE: 0.11 };
const FNCS_QUOTA = { EU: 12, NA: 9, SA: 4, MENA: 3, ASIA: 2, OCE: 2 };
(function fncsCircuit() {
  const T = TOURNAMENTS.fn; if (!T || T.some(t => t[6])) return;
  const out = [];
  for (const t of T) {
    const m = /^FNCS Major \((\d)\)$/.exec(t[0]);
    if (t[0] === "FNCS Global Championship") { out.push([t[0], t[1], t[2], "123", 32, "", { tier: "S", worlds: true }]); continue; }
    if (!m) { out.push(t); continue; }
    for (const z of gameZones("fn")) {
      const base = `FNCS Major ${m[1]} ${ZONE_NAMES[z] || z}`;
      out.push([`${base} — Qualifications`, t[1] - 2, 0, "1230", 200, z, { tier: "B" }]);
      out.push([`${base} — Demi-finales`, t[1] - 1, 0, "123", 100, z, { tier: "A", from: `${base} — Qualifications`, top: 0.6 }]);
      out.push([`${base} — Grande finale`, t[1], Math.round(t[2] * (FNCS_SHARE[z] || 0.1) / 1000) * 1000, "123", 50, z, { tier: "S", from: `${base} — Demi-finales`, top: 0.5 }]);
    }
  }
  TOURNAMENTS.fn = out;
})();
// nombre de qualifiés : une part du plateau de l'étape précédente (au plus un lobby complet)
const qualTop = (spec, n, game) => Math.min(GAMES[game].lobby * 2, Math.max(2, spec.top <= 1 ? Math.ceil(n * spec.top) : spec.top));
// EWC : chaque tournoi a des qualifications ouvertes trois semaines avant ; environ 75 % des places sont des invitations
(function ewcQualifiers() {
  for (const [game, T] of Object.entries(TOURNAMENTS)) {
    if (T.some(t => t[6] && t[6].ewcQual)) continue;
    const add = [];
    for (const t of T) {
      if (!/^EWC — /.test(t[0]) || t[6]) continue;
      const q = `EWC — Qualifications ${GAMES[game] ? GAMES[game].short : game}`;
      add.push([q, Math.max(SEASON_FIRST, t[1] - 3), 0, "1230", GAMES[game] && GAMES[game].fmt === "br" ? 64 : 32, "", { tier: "B" }]);
      t[6] = { tier: "S", ewcQual: q, invite: Math.max(1, Math.round(t[4] * 0.75)) };
    }
    T.push(...add);
  }
})();
const qualSpec = (game, name) => { const t = (TOURNAMENTS[game] || []).find(x => x[0] === name); return t && t[6] ? t[6] : null; };
// plateau d'une étape qualificative : les mieux classés de l'étape précédente (null si elle n'a pas encore été jouée)
function qualField(game, spec, name, week, raw) {
  const O = S.tourOrder || {}, g = GAMES[game];
  const keep = id => S.clubs[id] && divOf(id, game) && (raw || !(isMine(id) && declinedFor(id, game, name, week)));
  if (spec.from) { const o = O[game + "|" + spec.from]; if (!o) return null; const ok = o.filter(id => S.clubs[id] && divOf(id, game)); return ok.slice(0, qualTop(spec, ok.length, game)).filter(keep); }
  if (spec.worlds) {
    const finals = Object.keys(O).filter(k => k.startsWith(game + "|") && k.endsWith(" — Grande finale"));
    if (!finals.length) return null;
    const pts = {}; for (const k of finals) O[k].forEach((id, i) => pts[id] = (pts[id] || 0) + Math.max(1, 60 - i));
    return Object.entries(FNCS_QUOTA).flatMap(([z, q]) => Object.keys(pts).filter(id => S.clubs[id] && divOf(id, game) && (divOf(id, game).zone || "W") === z).sort((a, b) => pts[b] - pts[a]).slice(0, q)).filter(keep);
  }
  return null;
}
// tournois de la semaine : [jeu, tournoi]
function weekTournaments(w = S.week) {
  const out = [];
  for (const game of Object.keys(GAMES)) for (const t of allTournaments(game)) if (t[1] === w) out.push([game, t]);
  return out;
}
const tourKey = (game, name) => "T:" + game + "|" + name;
// plateau d'un tournoi de la semaine, tiré une seule fois : celui affiché avant le match est celui qui joue
function weekField(game, t) {
  const rep = weekReport(), k = tourKey(game, t[0]);
  if (!rep.fields[k]) rep.fields[k] = tournamentField(game, t[3], t[4], t[5], t[0], t[1]);
  return rep.fields[k];
}
// événements du club du joueur cette semaine (à lancer un par un, ou tous d'un coup)
function weekEvents() {
  const w = S.week, md = matchday(w), out = [], rep = weekReport();
  for (const g of Object.keys(user().divisions)) arrangeUnits(g);
  for (const L of Object.values(S.leagues)) {
    const mine = L.teams.filter(isMine); if (!mine.length) continue;
    const g = GAMES[L.game]; let what = null;
    if (g.fmt === "br") {
      if (md) what = `Journée ${md} · lobby de ${L.teams.length} ${g.unit}s, ${g.gamesPerWeek} parties`;
      else if (w === PO_SEMI || w === PO_FINAL) {
        const fin = w === PO_SEMI ? standings(L.key).slice(0, 8).map(x => x.id) : L.playoffs ? L.playoffs.finalists : [];
        if (mine.some(id => fin.includes(id))) what = `Grande finale (top 8) — jour ${w - PO_SEMI + 1}`;
      }
    } else if (md && md <= L.schedule.length) {
      const m = L.schedule[md - 1].find(m => m.some(isMine));
      if (m) what = `Journée ${md} : contre ${clubLabel(isMine(m[0]) ? m[1] : m[0], L.game)} (BO3)`;
    } else if (w === PO_SEMI) { if (standings(L.key).slice(0, 4).some(x => isMine(x.id))) what = "Demi-finale des playoffs (BO3)"; }
    else if (w === PO_FINAL && L.playoffs && L.playoffs.semis.some(x => isMine(x.winner))) what = "Grande finale des playoffs (BO5)";
    // importance : la finale en or, les playoffs en argent, les journées de ligue normales
    const imp = md ? ["normal", "Ligue"] : w === PO_FINAL ? [["gold", "silver", "normal"][L.tier - 1], "🏆 Finale"] : [L.tier === 1 ? "silver" : "normal", "🔥 Playoffs"];
    if (what) out.push({ id: "L:" + L.key, kind: "league", game: L.game, title: leagueName(L), what, imp: imp[0], impLabel: imp[1], done: !!rep.done["L:" + L.key], when: dayLabel(S.season, w, md ? LEAGUE_WEEKDAY[L.game] ?? 5 : w === PO_FINAL ? 6 : 5) });
  }
  for (const [game, t] of weekTournaments()) {
    const field = weekField(game, t);
    const tt = tourTier(t);
    if (field.length >= 2 && field.some(isMine)) out.push({ id: tourKey(game, t[0]), kind: "tour", game, title: t[0], imp: TIER_IMP[tt], impLabel: tt === "C" ? "C-Tier · cash cup" : tt + "-Tier", what: `${t[2] ? "Dotation " + money(t[2]) + " · " : ""}${field.length} ${GAMES[game].fmt === "br" ? GAMES[game].unit + "s" : "participants"}`, done: !!rep.done[tourKey(game, t[0])], when: `${dayLabel(S.season, w, 3)} → ${dayLabel(S.season, w, 6)}` });
  }
  return out;
}
// lance un événement de la semaine et renvoie ce qui s'y est passé pour le club
function playEvent(id) {
  const rep = weekReport(), u = user();
  const b = { m: rep.matches.length, l: rep.lobbies.length, t: rep.tournaments.length, f: rep.fans.length, r: (rep.rank || []).length, budget: u.budget, fans: u.fans };
  if (id.startsWith("L:")) { const L = S.leagues[id.slice(2)]; if (L) playLeagueDay(L); }
  else { const hit = weekTournaments().find(([game, t]) => tourKey(game, t[0]) === id); if (hit) playTournament(hit[0], hit[1]); }
  scheduleSave();
  return { matches: rep.matches.slice(b.m), lobbies: rep.lobbies.slice(b.l), tournaments: rep.tournaments.slice(b.t), fans: rep.fans.slice(b.f), rank: (rep.rank || []).slice(b.r), money: u.budget - b.budget, fanDelta: u.fans - b.fans };
}
// image du club (0-100) : les sponsors éthiques la font monter, les sponsors controversés la font chuter
function imageTarget(u) {
  return clamp(60 + u.sponsorDeals.reduce((s, d) => s + (d.ethic === "ethique" ? 8 : d.ethic === "controverse" ? -16 : 0), 0) + (u.imageBonus || 0), 5, 98);
}
// progression façon FM : expérience gagnée par semaine (un point de note à chaque fois qu'elle atteint 1)
function growthOf(p, c = p.club && S.clubs[p.club], f = c ? facOf(c) : null) {
  if (!c || p.rating >= p.pot) return { rate: 0, ageF: 0, play: 0, perf: 1, train: 1, avg: avgNote(p), co: null };
  const ageF = p.age <= 18 ? 1 : p.age <= 20 ? 0.8 : p.age <= 22 ? 0.55 : p.age <= 24 ? 0.3 : 0.08;
  const play = p.starter ? 1 : 0.4, avg = avgNote(p);
  const perf = avg ? clamp(1 + (avg - 6.4) * 0.6, 0.5, 1.8) : 1;
  // à l'académie, les jeunes qui jouent progressent plus vite
  const co = isMine(p.club) ? coachOf(p.game) : null;
  const aca = c.academyOf && p.starter ? 0.15 + f.academy * 0.05 : 0, coach = co && p.age <= 21 ? (co.attrs.jeunes - 10) * 0.03 : 0;
  const train = 0.7 + f.coaching * 0.12 + aca + coach;
  return { rate: ageF * play * perf * train * XP_RATE, ageF, play, perf, train, avg, co, aca, coach, coaching: f.coaching };
}
function advanceWeek() {
  if (S.over) return;
  const u = user(), w = S.week, report = weekReport();
  for (const aca of userAcademies()) autoStarters(aca.id, aca.academyOf);
  for (const g of Object.keys(u.divisions)) arrangeUnits(g);

  // tout ce qui n'a pas été lancé à la main se joue maintenant
  for (const L of Object.values(S.leagues)) playLeagueDay(L);
  for (const [game, t] of weekTournaments()) playTournament(game, t);
  if (w === EWC_LAST_WEEK) awardEwcClubChampionship(report);
  // un tournoi décliné : les joueurs du jeu se reposent
  for (const [game, t] of weekTournaments()) if (declined(game, t[0], t[1]) && u.divisions[game]) gamePlayers(game).forEach(p => p.form = clamp(p.form + 6, 0, 100));

  // primes de victoire prévues dans les contrats
  for (const r of report.matches) if (isMine(r.winner)) book("bonuses", -clubPlayers(r.winner, r.game).filter(p => p.starter).reduce((t, p) => t + (p.winBonus || 0), 0), r.game, r.stage);
  weeklyContractEffects();

  // économie du club joueur : chaque ligne est inscrite au grand livre, jeu par jeu quand c'est possible
  const fac = u.facilities;
  book("sponsors", 300 + 3.6 * u.fame * u.fame + Object.values(u.divisions).reduce((s, d) => s + TIER_SPONSOR[d.tier - 1], 0) * (0.5 + u.fame / 100), "", "Partenaires historiques et droits de diffusion");
  sponsorWeek(report);
  book("merch", u.fans * (0.012 + fac.content * 0.003), "", "Merch, abonnements et streaming");
  for (const game of Object.keys(u.divisions)) {
    book("salaries", -gamePlayers(game).reduce((s, p) => s + p.salary, 0), game, "Salaires");
    book("operations", -TIER_OP[u.divisions[game].tier - 1] * GAMES[game].size * GAMES[game].mult, game, "Frais de fonctionnement");
    const co = coachOf(game);
    if (co) book("coaches", -co.wage, game, "Entraîneur : " + co.name);
    const aca = academyOf(game);
    if (aca) book("academy", -TIER_OP[aca.divisions[game].tier - 1] * GAMES[game].size * GAMES[game].mult * 0.7, game, "Frais de l'académie");
  }
  book("facilities", -Object.values(fac).reduce((s, l) => s + l * 800, 0), "", "Entretien des infrastructures");
  // image et fans : l'image tend vers ce que reflètent les sponsors ; une bonne image attire des fans chaque semaine
  u.image = u.image ?? 60;
  u.image = clamp(u.image + (imageTarget(u) - u.image) * 0.12, 0, 100);
  const drift = Math.round(u.fans * ((u.image - 55) / 45 * 0.0004 + fac.content * 0.00025) + fac.content * 5);
  if (drift) { u.fans = Math.max(100, u.fans + drift); report.fans.push([u.image >= 55 ? "Image du club et contenus" : "Image du club (sponsors controversés)", drift]); }
  const inc = Object.values(report.income).reduce((a, b) => a + b, 0), exp = Object.values(report.expenses).reduce((a, b) => a + b, 0);
  S.finance.push({ label: weekLabel(S.season, w), season: S.season, week: w, inc: Math.round(inc), exp: Math.round(exp), budget: Math.round(u.budget), fans: u.fans });
  if (S.finance.length > 120) S.finance.shift();

  // entraînement, forme, moral ; progression façon FM : âge, qualité de l'entraînement, temps de jeu et notes en match
  report.progress = report.progress || [];
  for (const p of Object.values(S.players)) {
    const c = p.club && S.clubs[p.club];
    if (!c) continue;
    const f = facOf(c);
    if (p.rating < p.pot) {
      p.xp = (p.xp || 0) + growthOf(p, c, f).rate;
      if (p.xp >= 1) { p.xp -= 1; p.rating++; if (isMine(p.club)) report.progress.push([p.id, p.handle, p.game, p.rating]); }
    }
    // évolution suivie semaine après semaine pour les joueurs du club
    if (isMine(p.club)) { p.hist = (p.hist || []).concat([[S.season * 100 + S.week, p.rating, Math.round(p.form), Math.round(p.morale)]]).slice(-120); if (!p.joinedAt) p.joinedAt = nowIndex(); }
    // un jeune qui brille dépasse parfois ce qu'on attendait de lui
    if (p.age <= 21 && p.rating >= p.pot - 1 && p.stats.rn >= 6 && avgNote(p) >= 7.4 && Math.random() < 0.03 && p.pot < 97) p.pot++;
    p.form = clamp(p.form + (65 - p.form) * 0.08 + rand(-3, 3) + f.house * 0.3, 20, 100);
    const cm = isMine(p.club) ? coachOf(p.game) : null;
    let dm = (70 - p.morale) * 0.05 + f.house * 0.3 + (cm ? (cm.attrs.motivation - 10) * 0.08 : 0);
    if (!p.starter && p.rating >= 80 && !unitGame(p.game)) dm -= 1;
    p.morale = clamp(p.morale + dm + rand(-2, 2), 5, 100);
  }
  offersForListed(report);

  // découvert : intérêts, puis administrateur judiciaire qui vend des joueurs, puis faillite
  const limit = -Math.max(100000, u.fame * 8000);
  if (u.budget < 0) {
    book("interest", u.budget * 0.004, "", "Intérêts du découvert bancaire");
    S.board.confidence = clamp(S.board.confidence - 2, 0, 100);
    if (w % 4 === 0) mail("⚠️ Budget dans le rouge", `Le budget est négatif (${money(u.budget)}). La banque prélève des intérêts chaque semaine et le conseil s'inquiète. Sous ${money(limit)}, un administrateur judiciaire prendra le contrôle des finances.`, "board");
  }
  if (u.budget < limit) {
    S.debtWeeks = (S.debtWeeks || 0) + 1;
    if (S.debtWeeks === 1) mail("🏦 Procédure de redressement", `Le découvert dépasse ${money(limit)}. Un administrateur judiciaire est nommé : toutes les 4 semaines, il vendra le joueur le plus cher du club tant que les comptes resteront sous ce seuil. Au bout de 16 semaines, c'est la faillite et la fin de la partie.`, "board");
    if (S.debtWeeks % 4 === 0) {
      const star = allUserPlayers().sort((a, b) => playerValue(b) - playerValue(a))[0];
      if (star) { const fee = sellPlayer(star.id); mail(`🏦 Vente forcée : ${star.handle}`, `L'administrateur judiciaire vend ${star.handle} pour ${money(fee)} afin de rembourser les dettes.`, "board"); }
    }
    if (S.debtWeeks >= 16 || u.budget < limit * 5) { S.over = true; S.bankrupt = true; mail("💥 Faillite", `${u.name} est placé en liquidation judiciaire : les dettes (${money(u.budget)}) ne peuvent plus être remboursées. ${S.ceo} perd le club.`, "board"); }
  } else S.debtWeeks = 0;
  if (w === 45) {
    const exp = allUserPlayers().filter(p => p.years <= 1);
    if (exp.length) mail("⏳ Contrats en fin de saison", `Ces joueurs partiront à la fin de la saison (mi-décembre) si vous ne les prolongez pas : <b>${exp.map(p => p.handle).join(", ")}</b>.`, "transfer");
  }
  if (Math.random() < 0.1) { const ev = randomEvent(); if (ev) report.events.push(ev); }
  aiMarket();
  aiTransferList();
  aiMercato();
  mercatoDigest();
  // un message de résultats par jeu (comme le compte rendu de match de Football Manager)
  const byGame = {};
  for (const r of report.matches) (byGame[r.game] = byGame[r.game] || []).push(`${r.stage || ""} : <b>${clubLabel(r.a, r.game)} ${r.sa}-${r.sb} ${clubLabel(r.b, r.game)}</b>${r.mvp ? " · MVP " + r.mvp : ""}`);
  for (const l of report.lobbies) (byGame[l.game] = byGame[l.game] || []).push(`${l.stage} : <b>${l.rank}e</b> (${l.mine.pts} pts, ${l.mine.kills} éliminations)`);
  for (const t of report.tournaments) (byGame[t.game] = byGame[t.game] || []).push(`${t.name} : <b>${t.place === 1 ? "🏆 vainqueur" : t.place + "e sur " + t.n}</b>${t.prize ? " · " + money(t.prize) : ""}`);
  for (const [g, lines] of Object.entries(byGame)) {
    const wins = report.matches.filter(r => r.game === g && isMine(r.winner)).length, losses = report.matches.filter(r => r.game === g && isMine(r.loser)).length;
    mail(`📋 ${GAMES[g].short} : résultats de la semaine${wins + losses ? ` (${wins}V-${losses}D)` : ""}`, lines.join("<br>"), "match", g);
  }

  S.lastWeek = { ...report, fields: undefined, done: undefined };
  const out = S.lastWeek;
  S.rep = null;
  if (w >= SEASON_LAST) out.seasonEnd = endSeason();
  else S.week++;
  if (!S.over) out.mercato = mercatoChanges();

  if (!S.over && S.board.confidence <= 0) {
    S.over = true;
    mail("❌ Licencié", `Le conseil d'administration a perdu confiance. ${S.ceo} est démis de ses fonctions de CEO de ${u.name}.`, "board");
  }
  scheduleSave();
  return out;
}
// ---------- tournois à cashprize ----------
const EWC_FIRST = 28, EWC_LAST_WEEK = 35;   // Esports World Cup : juillet-août
// grands tournois fixes + petits tournois générés pour la saison
function allTournaments(game) {
  return (TOURNAMENTS[game] || []).concat((S.smallTours || []).filter(t => t[5] === game).map(t => t.slice(0, 5)));
}
function genSmallEvents() {
  const out = [];
  for (const [game, E] of Object.entries(SMALL_EVENTS)) {
    const g = GAMES[game]; if (!g) continue;
    const br = g.fmt === "br";
    const used = {};
    const name = list => { const n = list[(randi(0, list.length - 1))]; used[n] = (used[n] || 0) + 1; return used[n] > 1 ? `${n} #${used[n]}` : n; };
    const prize = ([a, b]) => Math.round(randi(a, b) / 100) * 100;
    // cash cups toutes les 4 semaines (2 en CS2), circuits tier 2 toutes les 8 semaines (4 en CS2), sauf en décembre
    for (let w = SEASON_FIRST + 2; w <= SEASON_LAST - 3; w += (E.every3 || 2) * 2) out.push([name(E.t3), w, prize(E.p3), g.fmt === "team" ? "23" : "3", br ? g.lobby : 16, game]);
    for (let w = SEASON_FIRST + 4; w <= SEASON_LAST - 3; w += (E.every2 || 4) * 2) out.push([name(E.t2), w, prize(E.p2), "2", br ? g.lobby : 8, game]);
  }
  return out;
}
// Club Championship : points des clubs (pas des joueurs indépendants) classés dans le top 8 d'un tournoi EWC
function ewcPoints(order, game) {
  S.ewc = S.ewc || {};
  order.slice(0, 8).forEach((id, i) => {
    const c = S.clubs[id]; if (!c || c.solo) return;
    const e = S.ewc[id] || (S.ewc[id] = { pts: 0, top8: 0, wins: 0, games: [] });
    e.pts += EWC_POINTS[i]; e.top8++; if (i === 0) e.wins++; e.games.push(game);
  });
}
function ewcStandings() {
  return Object.entries(S.ewc || {}).map(([id, e]) => ({ id, ...e, ok: e.top8 >= 2 })).filter(x => S.clubs[x.id]).sort((a, b) => b.ok - a.ok || b.pts - a.pts);
}
function awardEwcClubChampionship(report) {
  const u = user();
  let ranking = ewcStandings().filter(x => x.ok);
  // le champion doit avoir gagné au moins un tournoi
  const ci = ranking.findIndex(x => x.wins > 0);
  if (ci > 0) ranking.unshift(ranking.splice(ci, 1)[0]);
  ranking = ranking.slice(0, EWC_CLUB_PRIZES.length);
  ranking.forEach((x, i) => {
    const prize = EWC_CLUB_PRIZES[i];
    x.prize = prize;
    if (x.id === u.id) book("ewc", prize, "", "EWC Club Championship"); else S.clubs[x.id].budget += prize;
  });
  if (ranking[0]) {
    const champ = S.clubs[ranking[0].id];
    champ.fame = clamp(champ.fame + 6, 0, 100); champ.titles.push(`EWC Club Championship ${S.season}`);
    S.titles.push({ season: S.season, game: "ewc", tier: 0, name: "EWC Club Championship", club: champ.name, clubId: champ.id });
  }
  S.ewcResult = { season: S.season, ranking };
  const me = ranking.findIndex(x => x.id === u.id) + 1;
  mail(`🌍 EWC Club Championship ${S.season}`, `Vainqueur : <b>${ranking[0] ? S.clubs[ranking[0].id].name : "?"}</b>.<br>` +
    (me ? `${u.name} termine <b>${me}e</b> et touche ${money(EWC_CLUB_PRIZES[me - 1])}.` : `${u.name} n'est pas classé (il faut un top 8 dans au moins 2 tournois EWC).`), me === 1 ? "trophy" : "info");
}

const CLUB_SHARE = 0.5;
const PLACE_SHARE = [0.35, 0.18, 0.09, 0.09, 0.045, 0.045, 0.045, 0.045, 0.0125, 0.0125, 0.0125, 0.0125, 0.0125, 0.0125, 0.0125, 0.0125];
const ROUND_NAME = { 2: "Finale", 4: "Demi-finale", 8: "Quart de finale", 16: "Huitième de finale" };
// tournoi sur invitation : « 1 » (tier 1 mondial) ou « 123 » (les meilleurs de la région, tous tiers confondus).
// « 1230 » : open de toute une région (Opens RLCS) : tous les tiers, les meilleurs qualifiés, mais le club du joueur peut s'inscrire
const invitational = tiers => tiers === "1" || tiers === "123";
// tournoi régional (ex. « EU|MENA ») : seules les équipes inscrites dans ces régions y participent
// CN = équipes chinoises, PAC = Asie-Pacifique hors Chine (les ligues VCT les séparent)
function inRegion(clubId, game, region) {
  if (!region) return true;
  const c = S.clubs[clubId], r = clubRegion(c, game), cn = r === "ASIA" && c.country === "CN";
  return region.split("|").some(x => x === "CN" ? cn : x === "KR" ? r === "ASIA" && c.country === "KR" : x === "PAC" ? r === "ASIA" && !cn : x === r);
}
const REGION_LABEL = r => r ? r.split("|").map(x => ({ CN: "Chine", PAC: "Pacifique", KR: "Corée" })[x] || REGIONS[x]).join(" / ") : "Monde";
function tournamentPool(game, tiers, region) {
  const ids = leaguesOf(game).filter(L => GAMES[game].open || tiers.includes(String(L.tier))).flatMap(L => L.teams);
  return ids.filter(id => S.clubs[id] && divOf(id, game) && tiers.includes(String(S.clubs[id].divisions[game].tier)) && inRegion(id, game, region));
}
// plateau d'un tournoi (open : tous les clubs des tiers admis peuvent s'inscrire ; invitation : les mieux classés).
// Les équipes du club du joueur qui ont décliné le tournoi n'y sont pas.
function tournamentField(game, tiers, size, region, name, week, raw) {
  const g = GAMES[game], spec = name && qualSpec(game, name);
  // étape qualificative : seulement les qualifiés de l'étape précédente (personne tant qu'elle n'a pas été jouée)
  if (spec && (spec.from || spec.worlds)) return qualField(game, spec, name, week, raw) || [];
  // EWC : les invités (les meilleurs), puis les mieux classés des qualifications
  if (spec && spec.ewcQual) {
    const inv = tournamentField(game, tiers, spec.invite, region, null, week, raw).filter(id => raw || !(isMine(id) && declinedFor(id, game, name, week)));
    const o = (S.tourOrder || {})[game + "|" + spec.ewcQual];
    if (!o) return tournamentField(game, tiers, size, region, null, week, raw).filter(id => raw || !(isMine(id) && declinedFor(id, game, name, week)));
    const out = inv.slice();
    for (const id of o) { if (out.length >= size) break; if (!out.includes(id) && S.clubs[id] && divOf(id, game) && (raw || !(isMine(id) && declinedFor(id, game, name, week)))) out.push(id); }
    return GAMES[game].fmt === "br" ? out : out.slice(0, 2 ** Math.floor(Math.log2(out.length)));
  }
  // jeux à classement mondial (CS2) : les invitations suivent les points du classement
  const rp = {}; if (RANKED_GAMES.includes(game)) rankingOf(game).forEach(x => rp[x.id] = x.pts);
  const ranked = tournamentPool(game, tiers, region).filter(id => raw || !(isMine(id) && name && declinedFor(id, game, name, week)))
    .map(id => ({ id, s: (rp[id] || 0) * 1000 + teamStrength(id, game).str + S.clubs[id].fame * 0.05 })).sort((a, b) => b.s - a.s).map(x => x.id);
  // open (tiers 2-3 ou 3) : inscriptions libres, plateau tiré au hasard ; sinon les mieux classés
  const pool = tiers.includes("3") && !tiers.includes("1") ? shuffle(ranked) : ranked;
  let n = Math.min(size, pool.length);
  if (g.fmt !== "br") n = n >= 2 ? 2 ** Math.floor(Math.log2(n)) : 0;
  const field = pool.slice(0, n);
  // open : les équipes inscrites du club du joueur ont leur place
  if (!invitational(tiers) && n > 1) {
    let slot = n - 1;
    for (const id of pool.filter(isMine)) if (!field.includes(id)) { while (slot > 0 && isMine(field[slot])) slot--; field[slot--] = id; }
  }
  return field;
}
// Une équipe ne joue qu'un tournoi par semaine dans un jeu, comme en vrai : quand elle est retenue dans plusieurs
// (invitation à un grand tournoi et open la même semaine…), elle en choisit un ; par défaut le plus important.
const pickKey = (game, week, id) => game + "|" + week + "|" + id;
const tourWeek = (game, name) => { const t = allTournaments(game).find(x => x[0] === name); return t ? t[1] : -1; };
const optedOut = (game, name) => !!(S.tourChoice && S.tourChoice[game + "|" + name] === "out");
// tournois de la semaine auxquels l'équipe peut participer (inscrite à l'open ou invitée), hors ceux qu'elle a déclinés
function tourCandidates(game, week, id) {
  return allTournaments(game).filter(t => t[1] === week && !optedOut(game, t[0]) && (t[6] && t[6].ewcQual ? tournamentField(game, t[3], t[4], t[5], t[0], week, true).includes(id)
    : tournamentPool(game, t[3], t[5]).includes(id) && (!invitational(t[3]) || tournamentField(game, t[3], t[4], t[5], t[0], week, true).includes(id))));
}
// importance d'un tournoi : points de classement (dotation) et prestige des invitations
const tourValue = t => t[2] + (t[3] === "1" ? 1e6 : invitational(t[3]) ? 2e5 : 0);
function pickedTour(game, week, id) {
  const c = tourCandidates(game, week, id);
  if (c.length < 2) return c[0] ? c[0][0] : null;
  const p = S.tourPick && S.tourPick[pickKey(game, week, id)];
  if (p && c.some(t => t[0] === p)) return p;
  return c.slice().sort((a, b) => tourValue(b) - tourValue(a))[0][0];
}
function declinedFor(id, game, name, week) {
  if (optedOut(game, name)) return true;
  if (week === undefined || week === null) week = tourWeek(game, name);
  const p = pickedTour(game, week, id);
  return p !== null && p !== name;
}
// le club du joueur a-t-il décliné ce tournoi (ou choisi un autre tournoi la même semaine) ?
const declined = (game, name, week) => declinedFor(S.userId, game, name, week);
function setTourPick(game, week, name) {
  (S.tourPick = S.tourPick || {})[pickKey(game, week, S.userId)] = name;
  if (S.tourChoice) delete S.tourChoice[game + "|" + name];
  const rep = weekReport(); for (const t of allTournaments(game)) if (t[1] === week) delete rep.fields[tourKey(game, t[0])];
}
// points de classement d'un tournoi selon la place (même barème que rankTournament)
function rankPointsFor(prize) {
  const base = clamp(60 + prize / 2500, 60, 1000);
  return { win: Math.round(base), final: Math.round(base * 0.7), top4: Math.round(base * 0.5), top8: Math.round(base * 0.3), top16: Math.round(base * 0.15) };
}
function playTournament(game, t) {
  const rep = weekReport(), k = tourKey(game, t[0]);
  if (rep.done[k]) return; rep.done[k] = true;
  const [name, week, prize, tiers] = t;
  const g = GAMES[game], field = weekField(game, t), w = S.week;
  if (field.length < 2) return;
  const stake = (prize >= 1e6 ? 2.5 : prize >= 2e5 ? 1.2 : prize >= 5e4 ? 0.5 : 0.2) * (0.4 + 0.6 * g.mult);
  let order;
  if (g.fmt === "br") {
    const lob = playLobby({ game, tier: Math.max(...[...tiers].filter(x => x >= "1" && x <= "3").map(Number)) }, field, 6, stake, name);
    order = lob.ranked;
    for (const id of field.filter(isMine)) rep.lobbies.push({ game, tier: S.clubs[id].divisions[game].tier, ...lob, stage: name, mine: lob.res[id], rank: lob.ranked.indexOf(id) + 1, club: id, week: w, dd: 5 });
  } else {
    // élimination directe : 1er contre dernier, BO3 puis finale en BO5
    let round = field.slice(), rd = 0;
    const out = [];
    while (round.length > 1) {
      rd++;
      const next = [], losers = [];
      for (let i = 0; i < round.length / 2; i++) {
        const a = round[i], b = round[round.length - 1 - i];
        const stage = ROUND_NAME[round.length] || "Tour";
        const r = playSeries(game, a, b, round.length === 2 ? 5 : 3, stake * (round.length <= 4 ? 1.5 : 1), `${name}, ${stage.toLowerCase()}`);
        next.push(r.winner); losers.push(r.loser);
        if (isMine(a) || isMine(b)) rep.matches.push({ ...r, game, tier: S.clubs[isMine(a) ? a : b].divisions[game].tier, stage: `${name} — ${stage}`, week: w, dd: Math.min(6, 2 + rd) });
      }
      out.unshift(losers);
      round = next;
    }
    order = round.concat(out.flat());
  }
  // classement complet gardé pour les étapes suivantes (qualifications FNCS…) et messages de qualification
  (S.tourOrder = S.tourOrder || {})[game + "|" + name] = order.slice(0, 250);
  const next = (TOURNAMENTS[game] || []).find(x => x[6] && x[6].from === name);
  // qualifications EWC : les mieux classés qui ne sont pas déjà invités prennent les places restantes
  const ewcT = (TOURNAMENTS[game] || []).find(x => x[6] && x[6].ewcQual === name);
  if (ewcT) { const inv = tournamentField(game, ewcT[3], ewcT[6].invite, ewcT[5], null, ewcT[1], true), slots = ewcT[4] - inv.length;
    const qual = order.filter(id => !inv.includes(id)).slice(0, slots);
    for (const id of order.filter(isMine)) { const i = order.indexOf(id) + 1;
      mail(qual.includes(id) ? `✅ Qualifié pour l'${ewcT[0]}` : inv.includes(id) ? `🎟️ Déjà invité : ${ewcT[0]}` : `❌ Pas de place à l'EWC`, `${clubLabel(id, game)} termine <b>${i}e</b> des qualifications. ${qual.includes(id) ? `Il décroche une des ${slots} places qualificatives pour <b>${ewcT[0]}</b> (${weekLabel(S.season, ewcT[1])}).` : inv.includes(id) ? "L'équipe était déjà invitée grâce à son classement." : `Il fallait finir parmi les ${slots} meilleurs non invités.`}`, "info", game); } }
  if (next) { const top = qualTop(next[6], order.length, game);
    for (const id of order.filter(isMine)) { const i = order.indexOf(id) + 1;
      mail(i <= top ? `✅ Qualifié : ${next[0]}` : `❌ Éliminé : ${name}`, `${clubLabel(id, game)} termine <b>${i}e</b> de ${name}${i <= top ? ` et se qualifie pour <b>${next[0]}</b> (${weekLabel(S.season, next[1])}).` : ` : il fallait finir dans les ${top} premiers pour aller en ${next[0]}.`}`, "info", game); } }
  else if (/ — Grande finale$/.test(name)) for (const id of order.filter(isMine)) mail(`🌍 Global Championship : ${clubLabel(id, game)}`, `${clubLabel(id, game)} termine <b>${order.indexOf(id) + 1}e</b> de ${name}. Les meilleurs de chaque région aux grandes finales des Majors (${Object.entries(FNCS_QUOTA).map(([z, q]) => `${ZONE_NAMES[z]} ${q}`).join(", ")}) jouent le FNCS Global Championship.`, "info", game);
  // les grands tournois se jouent en LAN : billets d'avion et hôtel pour les joueurs
  const mineIn = field.filter(isMine);
  if (prize >= 100000 && mineIn.length) book("travel", -mineIn.length * g.size * (t[5] ? 900 : 2200), game, name);
  // les clubs IA gardent la moitié des gains ; le vôtre garde ce que prévoient les contrats
  order.forEach((id, i) => { const amt = prize * (PLACE_SHARE[i] || 0); payPrize(id, isMine(id) ? amt : amt * CLUB_SHARE, game, name); });
  const champ = S.clubs[order[0]];
  champ.fame = clamp(champ.fame + (prize >= 1e6 ? 4 : prize >= 1e5 ? 2 : 0.5), 0, 100);
  fanChange(order[0], 1, stake * 4, isMine(order[0]) ? `🏆 ${name} remporté` : null);
  champ.titles.push(`${name} ${S.season}`); awardPlayers(order[0], game, `${name} ${S.season}`);
  S.titles.push({ season: S.season, game, tier: 0, name, club: clubLabel(order[0], game), clubId: champ.id });
  if (RANKED_GAMES.includes(game)) rankTournament(game, order, prize, name);
  if (name.startsWith("EWC")) ewcPoints(order.map(id => S.clubs[id] && S.clubs[id].parent === S.userId && !S.clubs[id].academyOf ? S.userId : id), game);
  const mine = order.findIndex(isMine) + 1;
  (S.tourResults || (S.tourResults = [])).push({ season: S.season, week: w, game, name, prize, n: field.length, top: order.slice(0, 4), mine: mine || null });
  if (mine) {
    const won = Math.round(prize * (PLACE_SHARE[mine - 1] || 0) * clubKeep(game));
    rep.tournaments.push({ game, name, place: mine, n: field.length, prize: won, winner: order[0], week: w, dd: 6 });
    if (mine === 1) mail(`🏆 ${name} remporté !`, `${user().name} remporte le <b>${name} ${S.season}</b> (${GAMES[game].name}) et empoche ${money(won)}.`, "trophy", game);
  }
}

// classement final d'un circuit (pour le bilan et les montées/descentes)
function finalOrder(L) {
  const st = standings(L.key).map(x => x.id);
  let head = [];
  if (GAMES[L.game].fmt === "br") head = (L.playoffs && L.playoffs.order) || [];
  else if (L.playoffs && L.playoffs.final) { const f = L.playoffs.final; head = [f.winner, f.loser]; }
  return head.concat(st.filter(id => !head.includes(id)));
}

// montées et descentes quand un tier est découpé en ligues nationales : les 2 derniers de chaque ligue descendent,
// les meilleurs du tier inférieur montent dans la ligue de leur pays (ou dans une ligue qui a une place libre)
function promoteSubs(game, t, zone, moves) {
  const u = user(), ups = (subsOf(game, t, zone) || [null]).map(sub => S.leagues[lkey(game, t, zone, sub)]).filter(Boolean);
  const lows = (subsOf(game, t + 1, zone) || [null]).map(sub => S.leagues[lkey(game, t + 1, zone, sub)]).filter(Boolean);
  const blocked = id => { const c = S.clubs[id]; return c && c.parent && S.clubs[c.parent] && S.clubs[c.parent].divisions[game] && S.clubs[c.parent].divisions[game].tier <= t; };
  const vac = {}, downs = [];
  // beaucoup de ligues nationales : un seul relégué par ligue
  const nDown = ups.length > 2 ? 1 : 2;
  for (const L of ups) { const d = finalOrder(L).slice(-nDown); vac[L.key] = d.length; downs.push(...d.map(id => [id, L])); }
  const lowOrder = lows.flatMap(L => finalOrder(L).slice(0, 2).map(id => [id, L])).filter(([id]) => !blocked(id));
  // les meilleurs des ligues du tier inférieur, à la place des relégués
  const promos = lowOrder.sort((a, b) => teamStrength(b[0], game).str - teamStrength(a[0], game).str).slice(0, downs.length);
  // le club du joueur choisit sa ligue en premier (chaque ligue a au moins une place libre)
  promos.sort((a, b) => (b[0] === u.id) - (a[0] === u.id));
  for (const [id, L] of downs) {
    const c = S.clubs[id], d = c.divisions[game], sub = subPrefFor(id, game, t + 1, zone), low = lows.find(x => x.sub === sub) || lows[0];
    L.teams = L.teams.filter(x => x !== id); low.teams.push(id); d.tier = t + 1; if (low.sub) d.sub = low.sub; else delete d.sub;
    if (isMine(id) && id === u.id) moves.push(`⬇️ ${GAMES[game].short} : relégation en ${TIER_LABEL[t]} (${leagueName(low)})`);
  }
  for (const [id, L] of promos) {
    const c = S.clubs[id], d = c.divisions[game], want = subPrefFor(id, game, t, zone);
    const up = ups.find(x => x.sub === want && vac[x.key] > 0) || ups.find(x => vac[x.key] > 0);
    if (!up) break;
    vac[up.key]--; L.teams = L.teams.filter(x => x !== id); up.teams.push(id); d.tier = t; if (up.sub) d.sub = up.sub; else delete d.sub;
    if (id === u.id) moves.push(`⬆️ ${GAMES[game].short} : MONTÉE en ${TIER_LABEL[t - 1]} (${leagueName(up)}) !`);
  }
  // une place restée vide : le meilleur club du tier inférieur restant la prend
  for (const up of ups) while (vac[up.key] > 0) {
    // de préférence un club du pays de la ligue
    const fit = id => subFor(game, t, zone, S.clubs[id].country) === up.sub ? 1 : 0;
    const cand = lows.flatMap(L => L.teams.map(id => [id, L])).filter(([id]) => !blocked(id) && !up.teams.includes(id) && !S.clubs[id].filler)
      .sort((a, b) => fit(b[0]) - fit(a[0]) || teamStrength(b[0], game).str - teamStrength(a[0], game).str)[0];
    if (!cand) break;
    const [id, L] = cand, d = divOf(id, game);
    vac[up.key]--; L.teams = L.teams.filter(x => x !== id); up.teams.push(id); d.tier = t; if (up.sub) d.sub = up.sub; else delete d.sub;
  }
}
function endSeason() {
  const u = user();
  // classement final de chaque club (le mercato de l'intersaison en dépend)
  for (const L of Object.values(S.leagues)) { const o = finalOrder(L), n = o.length; o.forEach((id, i) => { const c = S.clubs[id]; if (c) (c.lastPos = c.lastPos || {})[L.game] = n > 1 ? i / (n - 1) : 0.5; }); }
  const o = S.board.objective;
  let ok = false, titles = 0, playoffs = false;
  const lines = [];
  for (const L of userLeagues()) {
    const order = finalOrder(L), pos = order.indexOf(u.id) + 1;
    const br = GAMES[L.game].fmt === "br";
    const champ = L.champion === u.id, final = pos > 0 && pos <= (br ? 3 : 2) && !!L.playoffs;
    const top4 = pos > 0 && pos <= (br ? 8 : 4);
    if (champ) titles++;
    if (top4) playoffs = true;
    // circuit ouvert : c'est le statut du club (Élite, Pro, Open) qui compte, et l'objectif est de gagner le statut supérieur
    const open = GAMES[L.game].open, lt = open ? u.divisions[L.game].tier : L.tier;
    lines.push(`${GAMES[L.game].icon} ${GAMES[L.game].short} ${open ? "circuit (statut " + tierLabel(L.game, lt) + ")" : TIER_LABEL[L.tier - 1]} : <b>${pos ? pos + "e" : "-"}</b>${champ ? " 🏆" : ""}`);
    if (lt <= o.tier) {
      if (o.type === "title" && champ) ok = true;
      // en statut Pro ou Open, « playoffs » et « finale » veulent dire : gagner le statut supérieur
      const upgrade = open && lt > 1 && pos > 0 && pos <= statusCut(L.game, lt - 1);
      if (o.type === "final" && (open && lt > 1 ? upgrade : final)) ok = true;
      if (o.type === "top4" && (open && lt > 1 ? upgrade : top4)) ok = true;
    }
  }
  if (o.type === "budget") ok = u.budget > 0 && userLeagues().some(L => clubPlayers(u.id, L.game).length >= GAMES[L.game].size);
  S.board.confidence = clamp(S.board.confidence + (ok ? 20 : playoffs ? -8 : -20) + titles * 8, 0, 100);

  // montées et descentes : 2 clubs par tier
  const moves = [];
  for (const game of Object.keys(GAMES)) {
    if (GAMES[game].open) {
      // circuit ouvert : le statut de chaque club suit son classement de la saison dans sa région
      for (const L of leaguesOf(game)) {
        const [a, b] = statusCuts(L.teams.length);
        finalOrder(L).forEach((id, i) => {
          const d = S.clubs[id] && S.clubs[id].divisions[game]; if (!d) return;
          const nt = i < a ? 1 : i < b ? 2 : 3;
          if ((id === u.id || (S.clubs[id].parent === u.id)) && nt !== d.tier) moves.push(`${nt < d.tier ? "⬆️" : "⬇️"} ${GAMES[game].short} ${ZONE_NAMES[L.zone]} : ${i + 1}e du circuit, statut ${tierLabel(game, nt)}${nt < d.tier ? " !" : ""}`);
          d.tier = nt;
        });
      }
      continue;
    }
    if (RANKED_GAMES.includes(game)) { reassignByRanking(game, moves); continue; }
    for (const zone of gameZones(game)) for (let t = 1; t <= 2; t++) {
      // ligue fermée (franchise) : ni relégation, ni montée depuis le tier inférieur
      if (isClosed(game, t, zone)) continue;
      if (subsOf(game, t, zone) || subsOf(game, t + 1, zone)) { promoteSubs(game, t, zone, moves); continue; }
      const up = S.leagues[lkey(game, t, zone)], low = S.leagues[lkey(game, t + 1, zone)];
      // une académie ne monte jamais dans la division de son équipe première
      const blocked = id => { const c = S.clubs[id]; return c && c.parent && S.clubs[c.parent] && S.clubs[c.parent].divisions[game] && S.clubs[c.parent].divisions[game].tier <= t; };
      const down = finalOrder(up).slice(-2), promo = finalOrder(low).filter(id => !blocked(id)).slice(0, 2);
      for (const id of finalOrder(low).slice(0, 2)) if (blocked(id) && id === academyId(game)) moves.push(`🎓 ${GAMES[game].short} : votre académie finit ${finalOrder(low).indexOf(id) + 1}e mais ne peut pas monter dans la division de l'équipe première.`);
      for (const id of down) {
        up.teams = up.teams.filter(x => x !== id); low.teams.push(id); S.clubs[id].divisions[game].tier = t + 1;
        if (id === u.id) moves.push(`⬇️ ${GAMES[game].short} : relégation en ${TIER_LABEL[t]} (${tierName(game, t + 1, zone)})`);
      }
      for (const id of promo) {
        if (down.includes(id)) continue;
        low.teams = low.teams.filter(x => x !== id); up.teams.push(id); S.clubs[id].divisions[game].tier = t;
        if (id === u.id) moves.push(`⬆️ ${GAMES[game].short} : MONTÉE en ${TIER_LABEL[t - 1]} (${tierName(game, t, zone)}) !`);
      }
    }
    // changement de ligue nationale demandé pendant la saison : il prend effet maintenant
    const ud = u.divisions[game], want = ud && u.subPref && u.subPref[game];
    if (want && ud.sub && ud.sub !== want && (subsOf(game, ud.tier, ud.zone) || []).includes(want) && moveToSub(game, want))
      moves.push(`🔁 ${GAMES[game].short} : votre club rejoint la ${SUB_NAMES[want] || want} comme demandé.`);
  }
  applyTierRequests(moves);
  for (const aca of userAcademies()) {
    const game = aca.academyOf, main = u.divisions[game];
    if (!main) { closeAcademy(game); moves.push(`🎓 ${GAMES[game].short} : sans équipe première, l'académie ferme.`); continue; }
    const at = aca.divisions[game].tier, zone = aca.divisions[game].zone || "W";
    if (at > main.tier) continue;
    if (at < 3) {
      // l'académie descend d'un tier ; le meilleur club du tier inférieur prend sa place
      const up = S.leagues[lkey(game, at, zone)], low = S.leagues[lkey(game, at + 1, zone)];
      const swap = finalOrder(low).find(id => id !== aca.id && !S.clubs[id].parent);
      up.teams = up.teams.filter(x => x !== aca.id); low.teams.push(aca.id); aca.divisions[game].tier = at + 1;
      if (swap) { low.teams = low.teams.filter(x => x !== swap); up.teams.push(swap); S.clubs[swap].divisions[game].tier = at; }
      moves.push(`🎓 ${GAMES[game].short} : l'équipe première est descendue dans la division de l'académie, qui est rétrogradée en ${TIER_LABEL[at]}.`);
    } else {
      // plus de division en dessous : les jeunes rejoignent l'équipe première
      for (const p of clubPlayers(aca.id, game)) { removeFromClub(p, true); main.players.push(p.id); p.club = u.id; p.starter = false; }
      const L = S.leagues[lkey(game, 3, zone)]; swapInLeague(L, aca.id, fillerClub(game, 3, zone).id); delete S.clubs[aca.id];
      moves.push(`🎓 ${GAMES[game].short} : l'équipe première et l'académie sont dans la même division ; l'académie est dissoute et ses joueurs rejoignent l'équipe première.`);
    }
  }
  for (const aca of userAcademies()) {
    const L = leagueOf(aca.id, aca.academyOf), pos = finalOrder(L).indexOf(aca.id) + 1;
    lines.push(`🎓 ${GAMES[aca.academyOf].short} académie (${TIER_LABEL[aca.divisions[aca.academyOf].tier - 1]}) : <b>${pos ? pos + "e" : "-"}</b>`);
  }
  mail(`Bilan de la saison ${S.season}`,
    `${lines.join("<br>") || "Aucune division."}<br>${moves.length ? "<br>" + moves.join("<br>") + "<br>" : ""}<br>
     Objectif (${objectiveText(o)}) : ${ok ? "<b style='color:var(--ok)'>atteint ✅</b>" : "<b style='color:var(--bad)'>manqué ❌</b>"}<br>
     Confiance du conseil : <b>${Math.round(S.board.confidence)}%</b>`, "board");

  // contrats, âge, retraites
  const leaving = [], retired = [];
  for (const p of Object.values(S.players)) {
    // carrière : club et note de la saison écoulée
    if (p.club && S.clubs[p.club]) p.car = (p.car || []).concat([[S.season, clubLabel(p.club, p.game), p.rating, Math.round((avgNote(p) || 0) * 10) / 10]]).slice(-10);
    p.age++;
    // retraite : de plus en plus probable après 30 ans ; les meilleurs deviennent parfois entraîneurs
    if (p.age >= 31 && Math.random() < (p.age - 30) * (p.club ? 0.05 : 0.15)) {
      if (isMine(p.club)) retired.push(p.handle);
      if (Math.random() < (p.rating >= 75 ? 0.4 : 0.12)) coachFromPlayer(p);
      if (p.club) removeFromClub(p);
      delete S.players[p.id]; continue;
    }
    if (p.age >= 28 && Math.random() < 0.5) p.rating = Math.max(45, p.rating - randi(0, p.age >= 31 ? 3 : 1));
    if (p.age <= 23 && p.pot > p.rating && Math.random() < 0.4) p.rating++;
    p.stats = { w: 0, l: 0, mvp: 0 };
    if (p.club) {
      p.years--;
      if (p.years <= 0) {
        const c = S.clubs[p.club];
        if (c && c.ai && !(p.age >= 33 && p.rating < 82)) { p.years = randi(1, 3); p.salary = salaryDemand(p, c); }
        else { if (c && !c.ai) leaving.push(p.handle); removeFromClub(p); p.years = 0; }
      }
    }
    if (!p.club && p.age >= 32 && Math.random() < 0.35) delete S.players[p.id];
    else if (!p.club && p.age >= 24 && p.rating < 62 && Math.random() < 0.5) delete S.players[p.id];
  }
  if (retired.length) mail("👋 Retraites", `Ont pris leur retraite : <b>${retired.join(", ")}</b>. Certains anciens joueurs se reconvertissent en entraîneurs (onglet Staff).`, "transfer");
  for (const c of Object.values(S.coaches || {})) {
    c.age++;
    // contrats des entraîneurs de l'IA : la plupart sont prolongés, les autres deviennent libres
    if (c.club && c.club !== S.userId && --c.years <= 0) {
      const cl = S.clubs[c.club];
      if (cl && Math.random() < 0.7) c.years = randi(1, 3); else { if (cl && cl.coachIds) delete cl.coachIds[c.game]; c.club = null; }
    }
    if (!c.club && c.age > 64) delete S.coaches[c.id];
  }
  // un club de l'IA sans entraîneur en engage un libre
  for (const cl of Object.values(S.clubs)) if (cl.ai && !cl.filler && !cl.solo) for (const [g, d] of Object.entries(cl.divisions)) {
    if (d.tier > 2 || aiCoachOf(cl.id, g) || Math.random() > 0.5) continue;
    const free = Object.values(S.coaches).filter(c => !c.club && c.game === g).sort((a, b) => coachLevel(b) - coachLevel(a))[randi(0, 2)];
    if (free) employCoach(free, cl.id, randi(1, 3));
  }
  for (const game of Object.keys(GAMES)) if (Math.random() < 0.6) makeCoach(game);
  if (leaving.length) mail("Fins de contrat", `Ont quitté le club (contrat expiré) : <b>${leaving.join(", ")}</b>.`, "transfer");

  // agents libres trop âgés ou trop faibles pour être recrutés un jour : retirés (la sauvegarde reste légère)
  for (const p of Object.values(S.players)) if (!p.club && (p.age >= 33 || (p.age >= 27 && p.rating < 58) || p.rating < 50)) delete S.players[p.id];
  // nouveaux talents
  // la plupart des jeunes ont un potentiel modeste, quelques-uns sont des pépites ; quelques joueurs plus âgés se révèlent sur le tard
  const gems = [];
  for (const gm of Object.keys(GAMES)) {
    for (let i = 0; i < GAMES[gm].size * 3; i++) {
      const p = genPlayer(gm, 50, 70, 16, 19), roll = Math.random(); p.years = 0;
      p.pot = clamp(p.rating + (roll < 0.6 ? randi(2, 7) : roll < 0.9 ? randi(7, 13) : randi(13, 22)), 0, 96); addPlayer(p);
      if (p.pot >= 88) gems.push(p);
    }
    for (let i = 0; i < randi(0, 2); i++) { const p = genPlayer(gm, 66, 77, 22, 27); p.years = 0; p.pot = clamp(p.rating + randi(0, 3), 0, 92); p.late = true; addPlayer(p); }
  }
  if (gems.length) news(`Nouveaux espoirs : ${gems.slice(0, 6).map(p => `${flag(p.nat)} ${p.handle} (${GAMES[p.game].short}, ${p.age} ans)`).join(", ")} font parler d'eux.`);
  // complète les académies avec de nouveaux jeunes
  for (const aca of userAcademies()) while (clubPlayers(aca.id, aca.academyOf).length < GAMES[aca.academyOf].size + 1) academyProspect(aca.academyOf, aca);
  if (u.facilities.academy > 0 && Object.keys(u.divisions).length) {
    const gm = pick(Object.keys(u.divisions));
    const p = genPlayer(gm, 58 + u.facilities.academy * 3, 66 + u.facilities.academy * 3, 16, 17);
    p.pot = clamp(p.rating + randi(10, 20), 0, 97); p.years = 0; addPlayer(p);
    const aca = academyOf(gm);
    joinClub(p, aca || u, 300, 3);
    mail("🎓 Pépite de l'académie", `${flag(p.nat)} <b>${p.handle}</b> (${p.age} ans, ${GAMES[gm].short}, note ${p.rating}) sort de votre centre de formation et signe son premier contrat pro${aca ? ` avec ${aca.name}` : ""}.`, "info");
  }
  aiFillRoster.pool = {};
  for (const c of Object.values(S.clubs)) if (c.ai) for (const gm of Object.keys(c.divisions)) aiFillRoster(c.id, gm);
  aiFillRoster.pool = null;
  // la notoriété tend vers le niveau de la meilleure division du club
  for (const c of Object.values(S.clubs)) {
    const ts = Object.values(c.divisions).map(d => d.tier);
    if (!ts.length) continue;
    c.fame = clamp(c.fame + (TIER_FAME_TARGET[Math.min(...ts) - 1] - c.fame) * (c.ai ? 0.08 : 0.15), 1, 100);
  }
  S.tourResults = (S.tourResults || []).filter(t => t.season >= S.season - 1);
  // rachat de franchise conclu pendant la saison : la place change de mains maintenant
  if (S.franchiseDeal) { const F = S.franchiseDeal; S.franchiseDeal = null; applyFranchise(F.game, F.zone, F.sellerId, F.price); moves.push(`🔒 ${GAMES[F.game].short} : votre club entre en ${tierName(F.game, 1, F.zone)} (franchise).`); }
  S.season++;
  newSeasonSetup(false);
  return { ok, moves };
}

// ---------- mercato de l'IA ----------
// mouvements de la saison : [saison, semaine, jeu, pseudo, id joueur, club quitté (ou null), club rejoint, indemnité, note]
function logMove(p, fromId, toId, fee) {
  (S.moves = S.moves || []).push([S.season, S.week, p.game, p.handle, p.id, fromId || null, toId, Math.round(fee || 0), p.rating]);
  if (S.moves.length > 1500) S.moves.splice(0, S.moves.length - 1500);
  (S.movesWeek = S.movesWeek || []).push(S.moves[S.moves.length - 1]);
}
// Pendant les fenêtres de chaque jeu, les clubs de l'IA se renforcent : plus leurs résultats sont mauvais, plus ils bougent
// (un club en tête change rarement une équipe qui gagne). Ils remplacent leur joueur le plus faible par un agent libre
// ou par un joueur d'un club de même niveau ou plus modeste, s'ils peuvent payer l'indemnité.
function aiMercato() {
  const pools = {}, perGame = {};
  const poolOf = (g, zone) => {
    const k = g + "|" + zone;
    if (!pools[k]) pools[k] = Object.values(S.players).filter(p => p.game === g && p.rating >= 55 && !isMine(p.club) && !(p.club && S.clubs[p.club] && (S.clubs[p.club].solo || !S.clubs[p.club].ai)) && playerZone(p, g) === zone && !(p.suspendedUntil > nowIndex()));
    return pools[k];
  };
  for (const L of Object.values(S.leagues)) {
    const g = L.game, G = GAMES[g];
    if (G.size < 2 || !mercatoOpen(g) || (perGame[g] || 0) >= 8) continue;
    const order = finalOrder(L), n = order.length, offseason = !matchday(S.week);
    const byStr = L.teams.slice().sort((a, b) => teamStrength(b, g).str - teamStrength(a, g).str);
    for (const id of shuffle(L.teams.slice())) {
      const c = S.clubs[id];
      if (!c || !c.ai || c.solo || c.filler || c.parent || isMine(id) || (perGame[g] || 0) >= 8) continue;
      // résultats : le classement actuel si la saison a assez avancé, sinon celui de la saison passée (ou le niveau de l'équipe)
      const row = L.table[id] || {}, played = (row.w || 0) + (row.l || 0) + (row.games || 0);
      const pos = played >= 4 && n > 1 ? order.indexOf(id) / (n - 1) : c.lastPos && c.lastPos[g] !== undefined ? c.lastPos[g] : n > 1 ? byStr.indexOf(id) / (n - 1) : 0.5;
      // jeux au mercato toujours ouvert (CS2, Fortnite…) : l'essentiel des mouvements se fait pendant leurs périodes chaudes
      const calm = mercatoRules(g).always && !windowAt(g) ? 0.25 : 1;
      const chance = (pos < 0.2 ? 0.006 : pos < 0.45 ? 0.025 : pos < 0.7 ? 0.05 : 0.12) * (offseason ? 1.6 : 1) * calm;
      if (Math.random() > chance) continue;
      const roster = clubPlayers(id, g); if (!roster.length) continue;
      const weakest = roster.slice().sort((a, b) => a.rating - b.rating)[0], need = weakest.rating + 3, zone = L.zone || "W";
      const cands = poolOf(g, zone).filter(p => p.club !== id && p.rating >= need && p.rating <= need + 12 && (!p.club || (S.clubs[p.club] && divOf(p.club, g) && divOf(p.club, g).tier >= L.tier && S.clubs[p.club] !== c)))
        .map(p => ({ p, fee: p.club ? askingPrice(p) : 0 })).filter(x => !x.fee || x.fee <= Math.max(0, c.budget || 0) * 0.6)
        .sort((a, b) => b.p.rating - a.p.rating).slice(0, 3);
      if (!cands.length) continue;
      const { p, fee } = pick(cands), from = p.club, seller = from && S.clubs[from];
      if (seller) { removeFromClub(p); seller.budget = (seller.budget || 0) + fee; c.budget = (c.budget || 0) - fee; aiFillRoster(seller.id, g); }
      joinClub(p, c, salaryDemand(p, c), randi(1, 3));
      logMove(p, from, id, fee);
      // effectif trop large : le plus faible est libéré
      if (clubPlayers(id, g).length > G.size + 2) { const out = clubPlayers(id, g).sort((a, b) => a.rating - b.rating)[0]; removeFromClub(out); out.years = 0; logMove(out, id, null, 0); }
      autoStarters(id, g);
      const i = poolOf(g, zone).indexOf(p); if (i >= 0) poolOf(g, zone).splice(i, 1);
      perGame[g] = (perGame[g] || 0) + 1;
    }
  }
}
// récap hebdomadaire des transferts de l'IA dans les jeux du club (les plus gros d'abord)
function mercatoDigest() {
  const W = S.movesWeek || []; S.movesWeek = [];
  const mine = W.filter(m => user().divisions[m[2]] && m[6]);
  if (!mine.length) return;
  const nm = id => id ? (S.clubs[id] ? clubLabel(id, mine[0][2]) : "?") : "agent libre";
  const top = mine.slice().sort((a, b) => b[8] - a[8]).slice(0, 8);
  mail(`📰 Mercato : ${mine.length} transfert(s) cette semaine`, top.map(m => `${GAMES[m[2]].icon} <b>${esc0(m[3])}</b> (${m[8]}) : ${m[5] ? esc0(S.clubs[m[5]] ? S.clubs[m[5]].name : "?") : "agent libre"} → <b>${esc0(S.clubs[m[6]] ? S.clubs[m[6]].name : "?")}</b>${m[7] ? ` (${money(m[7])})` : ""}`).join("<br>") + (mine.length > 8 ? `<br>… et ${mine.length - 8} autre(s) : tout est dans Mercato → 📰 Mouvements.` : "<br>Tous les transferts : Mercato → 📰 Mouvements."), "transfer");
}
function aiMarket() {
  if (Math.random() > 0.15) return;
  const fas = shuffle(Object.values(S.players).filter(p => !p.club && p.rating >= 72));
  for (const p of fas.slice(0, 1)) {
    const cands = Object.values(S.clubs).filter(c => c.ai && !c.solo && c.divisions[p.game]);
    if (!cands.length) continue;
    const c = pick(cands);
    const worst = clubPlayers(c.id, p.game).sort((a, b) => a.rating - b.rating)[0];
    if (worst && worst.rating < p.rating - 2) {
      removeFromClub(worst); worst.years = 0;
      joinClub(p, c, salaryDemand(p, c), randi(1, 3));
      logMove(p, null, c.id, 0);
    }
  }
}

// ---------- événements ----------
const EVENTS = [
  () => mainGame() ? { title: "🎤 Conférence de presse", body: "Les journalistes vous attendent pour faire le point sur la saison.", choices: [{ label: "Y aller", fx: () => ({ text: "Vous entrez en salle de presse.", next: pressConference("season") }) }, { label: "Envoyer le porte-parole", fx: () => { fanBump(-0.002); return "Les journalistes regrettent votre absence."; } }] } : null,
  () => ({ title: "Offre de sponsoring", sponsor: sponsorOffer() }),
  () => {
    const u = user(); const b = pick(["CryptoMoon", "BetZilla", "QuickCasino", "NFT Arena"]);
    const lump = Math.round((15000 + u.fame * 8000) / 1000) * 1000;
    return { title: `Sponsor controversé : ${b}`, body: `<b>${b}</b> offre ${money(lump)} immédiatement pour apparaître sur vos maillots. Les fans risquent de mal le prendre.`,
      choices: [{ label: "Accepter 💰", fx: () => { book("events", lump, "", "Sponsor controversé : " + b); u.imageBonus = (u.imageBonus || 0) - 6; const lost = Math.round(u.fans * 0.03); u.fans -= lost; u.fame = Math.max(1, u.fame - 2); return `+${money(lump)}, mais les fans grondent (-${lost.toLocaleString("fr-FR")} fans) et l'image du club en prend un coup.`; } },
                { label: "Refuser", fx: () => { u.fame = Math.min(100, u.fame + 0.5); u.imageBonus = (u.imageBonus || 0) + 2; return "Les fans saluent votre intégrité (image du club en hausse)."; } }] };
  },
  () => {
    const p = randomUserPlayer(); if (!p) return null;
    const raise = Math.round(p.salary * 0.25 / 50) * 50;
    return { title: `${p.handle} veut une augmentation`, body: `${flag(p.nat)} <b>${p.handle}</b> estime mériter +${money(raise)}/semaine (actuellement ${money(p.salary)}).`,
      choices: [{ label: "Accepter", fx: () => { p.salary += raise; p.morale = clamp(p.morale + 25, 0, 100); return `${p.handle} est ravi.`; } },
                { label: "Refuser", fx: () => { p.morale = clamp(p.morale - 25, 0, 100); return `${p.handle} est très déçu (moral en baisse).`; } }] };
  },
  () => {
    const p = randomUserPlayer(); if (!p) return null; const u = user();
    const fine = round50(p.salary * 2), mood = d => p.morale = clamp(p.morale + d, 0, 100), img = d => u.imageBonus = (u.imageBonus || 0) + d;
    return { title: `Polémique : ${p.handle}`, body: `Un clip de <b>${p.handle}</b> (${GAMES[p.game].short}) tenant des propos déplacés en stream circule sur les réseaux. Les fans attendent une réaction du club.`,
      choices: [{ label: `💸 Amende (${money(fine)})`, fx: () => { book("fines", fine, p.game, "Amende : " + p.handle); mood(-10); img(1); return `${p.handle} paie une amende de deux semaines de salaire. Il grogne, mais la communauté approuve.`; } },
                { label: "⛔ Suspension 2 semaines", fx: () => { p.suspendedUntil = nowIndex() + 2; mood(-18); img(2); return `${p.handle} est suspendu deux semaines : il ne jouera pas. Sanction saluée par la communauté, mais il est furieux.`; } },
                { label: "🙏 Excuses publiques", fx: () => { mood(-5); img(1); fanBump(0.003); return `${p.handle} publie des excuses. L'affaire retombe vite.`; } },
                { label: "🎤 Le défendre en conférence de presse", fx: () => ({ text: "Vous convoquez la presse.", next: pressConference("polemic", p) }) },
                { label: "🤐 Ne rien dire", fx: () => { img(-3); fanBump(-0.01); return "Le silence du club est mal perçu : des fans se désabonnent."; } }] };
  },
  () => {
    const u = user(); if (!Object.keys(u.divisions).length) return null;
    const big = u.fame >= 40;
    const cost = Math.round(((big ? 20000 : 2000) + Object.keys(u.divisions).length * (big ? 15000 : 1500)) / 500) * 500;
    return { title: big ? "Bootcamp à Séoul" : "Bootcamp LAN le week-end", body: `Un bootcamp intensif est disponible pour ${money(cost)}. Forme de tous les joueurs boostée.`,
      choices: [{ label: "Réserver ✈️", fx: () => { if (u.budget < cost) return "Budget insuffisant."; book("staff", -cost, "", "Bootcamp"); allUserPlayers().forEach(p => p.form = clamp(p.form + 18, 0, 100)); return "Les joueurs reviennent affûtés !"; } },
                { label: "Non merci", fx: () => "Bootcamp annulé." }] };
  },
  () => {
    const u = user();
    const s = u.fame < 30 ? pick(["un petit streamer Twitch (2 000 viewers)", "un TikTokeur gaming local", "un YouTubeur FIFA de 50 k abonnés"])
      : pick(["Gotaga", "Kameto", "Squeezie", "Ibai", "xQc", "Pokimane", "TheGrefg", "Domingo", "Zerator", "Locklear", "Ninja", "Shroud"]);
    const cost = Math.round((u.fame < 30 ? 3000 + u.fame * 300 : 80000 + u.fame * 3000) / 500) * 500;
    return { title: `Un créateur veut rejoindre le club`, body: `<b>${s}</b> propose de devenir ambassadeur du club pour ${money(cost)} par saison.`,
      choices: [{ label: "Signer 🎙️", fx: () => { if (u.budget < cost) return "Budget insuffisant."; book("staff", -cost, "", "Ambassadeur : " + s); u.fans = Math.round(u.fans * 1.05 + (u.fame < 30 ? 400 : 3000)); u.fame = Math.min(100, u.fame + (u.fame < 30 ? 1.5 : 3)); return `Accord signé ! Ses abonnés découvrent le club (+5 % de fans).`; } },
                { label: "Décliner", fx: () => "Peut-être une autre fois." }] };
  },
  () => {
    const u = user(); const gain = Math.round(u.fans * 0.07 + 150);
    return { title: "Clip viral 🔥", body: `Une action de votre équipe fait le tour d'Internet : +${gain.toLocaleString("fr-FR")} fans !`, auto: () => { u.fans += gain; } };
  },
  () => {
    const u = user(); const amount = Math.round((50000 + u.fame * 15000) / 5000) * 5000;
    return { title: "Investisseur intéressé", body: `Un business angel propose d'injecter ${money(amount)} contre 10 % des parts du club. Le conseil exigera plus de résultats.`,
      choices: [{ label: "Accepter", fx: () => { book("investors", amount, "", "Entrée d'un investisseur (10 % des parts)"); S.board.confidence = clamp(S.board.confidence - 10, 0, 100); return `+${money(amount)} dans les caisses.`; } },
                { label: "Refuser", fx: () => { S.board.confidence = clamp(S.board.confidence + 3, 0, 100); return "Le conseil apprécie votre indépendance."; } }] };
  },
];
// conférence de presse façon FM : trois questions, chaque réponse plaît ou non aux fans, au conseil et aux joueurs
function fanBump(pct) { const u = user(), d = Math.round(u.fans * pct); u.fans = Math.max(100, u.fans + d); weekReport().fans.push([pct >= 0 ? "Communication du club" : "Communication du club (mal reçue)", d]); return d; }
function pressConference(topic, p) {
  const u = user(), game = p ? p.game : mainGame(), { n, wins } = game ? teamResults(game) : { n: 0, wins: 0 }, team = game ? gamePlayers(game) : [];
  const fx = (o, txt) => () => { if (o.img) u.imageBonus = (u.imageBonus || 0) + o.img; if (o.fans) fanBump(o.fans); if (o.board) S.board.confidence = clamp(S.board.confidence + o.board, 0, 100);
    if (o.me && p) p.morale = clamp(p.morale + o.me, 0, 100); if (o.team) team.forEach(x => x.morale = clamp(x.morale + o.team, 0, 100)); return txt; };
  const Q = topic === "polemic" ? [
    [`« Les propos de ${p.handle} sont-ils acceptables ? »`, [["Il a fait une erreur et va s'excuser.", { img: 2, me: -3 }, "Réponse jugée responsable."], ["Ses propos ont été sortis de leur contexte.", { img: -2, me: 6, fans: -0.004 }, `${p.handle} apprécie votre soutien, une partie du public beaucoup moins.`], ["Pas de commentaire.", { img: -1 }, "Les journalistes restent sur leur faim."]]],
    [`« Allez-vous le sanctionner ? »`, [["Une sanction interne a été prise.", { img: 2, me: -5, board: 2 }, "Le conseil apprécie la fermeté."], ["Non, il reste titulaire.", { me: 6, img: -2, fans: -0.005 }, "Le vestiaire est soudé, les fans moins."], ["On en parlera en privé.", {}, "Réponse neutre."]]],
    [`« Un message pour les fans ? »`, [["Nous partageons leur colère et allons faire mieux.", { fans: 0.004, img: 1 }, "Les fans saluent le message."], ["Concentrons-nous sur le jeu.", { board: 2, team: 1 }, "Message recentré sur le sportif."], ["Les critiques ne nous atteignent pas.", { fans: -0.007, team: 3 }, "Les joueurs aiment, les fans détestent."]]],
  ] : [
    [`« ${n ? `${wins} victoire(s) sur les ${n} derniers matchs : ` : ""}êtes-vous satisfait du début de saison ? »`, [["Très satisfait, l'équipe progresse.", { team: 4, board: n && wins / n < 0.4 ? -3 : 2 }, "Les joueurs se sentent soutenus."], ["On peut faire beaucoup mieux.", { team: -3, board: 2 }, "Message reçu par le vestiaire."], ["Je ne commente pas les résultats.", { fans: -0.003 }, "Réponse jugée froide."]]],
    [`« Quel est l'objectif de la saison ? »`, [["Le titre, rien d'autre.", { fans: 0.006, board: -2, team: 2 }, "Les fans rêvent, le conseil vous attend au tournant."], ["Progresser match après match.", { board: 2 }, "Réponse prudente."], ["Celui du conseil : " + objectiveText() + ".", { board: 3 }, "Le conseil apprécie."]]],
    [`« Un mot sur vos sponsors et vos fans ? »`, [["Merci à eux, on joue pour eux.", { fans: 0.005, img: 1 }, "Les fans adorent."], ["On se concentre sur le jeu.", { team: 1 }, "Réponse neutre."], ["Le club a besoin de plus de moyens.", { board: -3, img: -1 }, "Le conseil n'apprécie pas d'être mis en cause publiquement."]]],
  ];
  const build = i => ({ title: `🎤 Conférence de presse (${i + 1}/${Q.length})`, body: Q[i][0],
    choices: Q[i][1].map(([label, o, txt]) => ({ label, fx: () => { const t = fx(o, txt)(); return i + 1 < Q.length ? { text: t, next: build(i + 1) } : t + " Fin de la conférence de presse."; } })) });
  return build(0);
}
function randomUserPlayer() { const ps = allUserPlayers(); return ps.length ? pick(ps) : null; }
function randomEvent() {
  const ev = pick(EVENTS)();
  if (!ev) return null;
  if (ev.auto) { ev.auto(); mail(ev.title, ev.body, "event"); return null; }
  return ev;
}

// ---------- sponsors ----------
const round50 = v => Math.round(v / 50) * 50;
// catalogue des marques : [nom, secteur, éthique, taille] ; taille 1 = commerce local, 2 = marque nationale, 3 = marque internationale.
// Éthique : « ethique » (réemploi, énergie verte, sport, mobilité), « neutre », « controverse » (paris, crypto, casinos, pétrole, vape).
const BRANDS = [
  ["Le Kebab du Coin", "Restauration", "neutre", 1], ["Garage Auto Martin", "Automobile", "neutre", 1], ["Boulangerie du Centre", "Alimentation", "neutre", 1], ["PC Shop Local", "Informatique", "neutre", 1],
  ["Cybercafé Pixel", "Gaming", "neutre", 1], ["Salle de sport FitZone", "Sport", "neutre", 1], ["Pizzeria Napoli", "Restauration", "neutre", 1], ["Imprimerie Express", "Services", "neutre", 1],
  ["Recyclerie du Quartier", "Réemploi", "ethique", 1], ["Coopérative Bio Locale", "Alimentation bio", "ethique", 1], ["Vélo Atelier", "Mobilité douce", "ethique", 1], ["Librairie Le Pixel", "Culture", "ethique", 1],
  ["PariFoot Express", "Paris sportifs", "controverse", 1], ["VapeCloud", "Cigarette électronique", "controverse", 1], ["CryptoBros", "Cryptomonnaies", "controverse", 1],
  ["LDLC", "Informatique", "neutre", 2], ["Materiel.net", "Informatique", "neutre", 2], ["Konix", "Périphériques", "neutre", 2], ["Glorious", "Périphériques", "neutre", 2], ["Cooler Master", "Matériel PC", "neutre", 2],
  ["NZXT", "Matériel PC", "neutre", 2], ["Fnac", "Distribution", "neutre", 2], ["Boulanger", "Distribution", "neutre", 2], ["Uber Eats", "Livraison", "neutre", 2], ["Deliveroo", "Livraison", "neutre", 2],
  ["Back Market", "Réemploi", "ethique", 2], ["Ecosia", "Moteur de recherche", "ethique", 2], ["Too Good To Go", "Anti-gaspillage", "ethique", 2], ["Fairphone", "Téléphonie", "ethique", 2], ["Veja", "Mode", "ethique", 2],
  ["BetZilla", "Paris sportifs", "controverse", 2], ["QuickCasino", "Casino en ligne", "controverse", 2], ["NFT Arena", "NFT", "controverse", 2], ["FastCrédit", "Crédit rapide", "controverse", 2],
  ["HyperX", "Périphériques", "neutre", 3], ["Red Bull", "Boisson énergisante", "neutre", 3], ["Logitech G", "Périphériques", "neutre", 3], ["Monster Energy", "Boisson énergisante", "neutre", 3], ["Secretlab", "Chaises gaming", "neutre", 3],
  ["Razer", "Périphériques", "neutre", 3], ["Alienware", "Matériel PC", "neutre", 3], ["Intel", "Processeurs", "neutre", 3], ["Corsair", "Matériel PC", "neutre", 3], ["Mercedes-Benz", "Automobile", "neutre", 3],
  ["BMW", "Automobile", "neutre", 3], ["Orange", "Télécoms", "neutre", 3], ["Lacoste", "Mode", "neutre", 3], ["Puma", "Équipementier", "neutre", 3], ["Adidas", "Équipementier", "neutre", 3],
  ["Coca-Cola", "Boissons", "neutre", 3], ["Samsung", "Électronique", "neutre", 3],
  ["Decathlon", "Sport", "ethique", 3], ["SNCF Connect", "Transport ferroviaire", "ethique", 3], ["Patagonia", "Mode responsable", "ethique", 3], ["La Poste", "Services", "ethique", 3], ["Engie Énergies Vertes", "Énergie renouvelable", "ethique", 3],
  ["CryptoMoon Exchange", "Cryptomonnaies", "controverse", 3], ["Royal Spin Casino", "Casino en ligne", "controverse", 3], ["PetroGulf Energy", "Pétrole", "controverse", 3], ["MegaBet", "Paris sportifs", "controverse", 3],
];
const BRAND_SIZE = ["", "Local", "National", "International"];
// exclusivité par secteur : une marque nationale ou internationale refuse un club qui a déjà un concurrent du même
// secteur (Red Bull et Monster, Logitech et Razer…) ; les commerces locaux peuvent se cumuler. Renvoie le concurrent.
function sectorRival(name) {
  const b = brandOf(name); if (b.size < 2) return null;
  const d = user().sponsorDeals.find(x => x.name !== name && x.sector === b.sector && (x.size || 1) >= 2);
  return d ? d.name : null;
}
// ce que valent les sections du club pour un sponsor : tier, audience du jeu et attrait pour les marques
function sponsorWeight(u = user()) {
  return Object.entries(u.divisions).reduce((s, [g, d]) => { const e = ecoOf(g); return s + [3000, 600, 80][d.tier - 1] * e.spon * (0.4 + 1.2 * Math.sqrt(e.view / 100)); }, 0);
}
// une marque paie plus si le club joue aux jeux qu'elle vise (automobile en Rocket League, périphériques en CS2…)
function brandFit(sector) { const gs = SECTOR_GAMES[sector]; if (!gs) return 1; return Object.keys(user().divisions).some(g => gs.includes(g)) ? 1.15 : 0.85; }
const brandOf = name => { const b = BRANDS.find(x => x[0] === name); return b ? { brand: b[0], sector: b[1], ethic: b[2], size: b[3] } : { brand: name, sector: "Divers", ethic: "neutre", size: 1 }; };
// taille des marques que le club peut attirer, d'après sa notoriété
const brandReach = () => user().fame >= 55 ? 3 : user().fame >= 25 ? 2 : 1;
// jeu phare du club (celui que regardent les sponsors) : le mieux placé et le plus populaire
function mainGame() {
  const u = user(), gs = Object.keys(u.divisions);
  return gs.sort((a, b) => GAMES[b].mult * [3, 1.6, 1][u.divisions[b].tier - 1] - GAMES[a].mult * [3, 1.6, 1][u.divisions[a].tier - 1])[0] || null;
}
// place actuelle de l'équipe principale dans sa ligue, et place « attendue » d'après son niveau
function leagueRank(game) { const L = leagueOf(S.userId, game); if (!L) return 0; return finalOrder(L).indexOf(S.userId) + 1; }
function expectedRank(game) {
  const L = leagueOf(S.userId, game); if (!L) return 0;
  const me = teamStrength(S.userId, game).str;
  return L.teams.filter(id => S.clubs[id] && teamStrength(id, game).str > me).length + 1;
}
// clauses proposées par la marque : un objectif de classement (trois niveaux au choix), parfois un titre ou une hausse de fans
function sponsorClauses(o) {
  const game = mainGame(), out = { levels: [], extra: [] };
  if (game) {
    const L = leagueOf(S.userId, game), n = L.teams.length, e = clamp(expectedRank(game), 1, n), pot = o.weekly * o.weeks;
    out.levels = [
      { label: "Prudent", target: Math.min(n, e + 2), bonus: round50(pot * 0.12) },
      { label: "Standard", target: e, bonus: round50(pot * 0.25) },
      { label: "Ambitieux", target: Math.max(1, e - 2), bonus: round50(pot * 0.5) },
    ];
    out.game = game;
  }
  if (o.size === 3) out.extra.push({ kind: "title", label: "Remporter au moins un titre (ligue ou tournoi) pendant le contrat", bonus: round50(o.weekly * 6) });
  if (o.ethic === "ethique") out.extra.push({ kind: "fans", pct: 5, label: "Gagner au moins 5 % de fans pendant le contrat", bonus: round50(o.weekly * 4) });
  return out;
}
function sponsorOffer(arg) {
  const u = user();
  // arg : nom de marque, ou type de marque (« ethique », « neutre », « controverse ») pour une marque au hasard
  let b;
  if (arg && !["ethique", "neutre", "controverse"].includes(arg)) b = brandOf(arg);
  else {
    // le type de marque dépend du jeu phare du club : beaucoup de paris en CS2, des marques grand public en LoL ou Rocket League
    const e = ecoOf(mainGame()), x = Math.random();
    const reach = brandReach(), ethic = arg || (x < e.eth ? "ethique" : x < e.eth + e.bet ? "controverse" : "neutre");
    b = brandOf(pick(BRANDS.filter(x => x[2] === ethic && x[3] === reach && !u.sponsorDeals.some(d => d.name === x[0]) && !sectorRival(x[0])).map(x => x[0]).concat(["PC Shop Local"])));
  }
  const tierBonus = sponsorWeight(u), fit = brandFit(b.sector);
  // les marques controversées paient bien plus cher, les marques éthiques un peu moins (et regardent l'image du club) ; une grande marque paie plus qu'un commerce local
  const mult = (b.ethic === "controverse" ? rand(1.6, 2.2) : b.ethic === "ethique" ? rand(0.8, 0.95) * (0.7 + (u.image ?? 60) / 200) : 1) * [0, 0.6, 0.9, 1.2][b.size];
  const weekly = round50((200 + u.fame * u.fame * rand(1.5, 3) + tierBonus * rand(0.5, 1)) * mult * fit);
  // plafond secret de la marque : plus le club a de fans, plus elle est prête à payer
  const max = weekly * rand(1.1, 1.45) * (1 + Math.min(0.3, u.fans / 3e6));
  const o = { ...b, weekly, weeks: randi(20, 40), max, patience: randi(2, 4), round: 0, history: [], level: 1 };
  o.clauses = sponsorClauses(o);
  return o;
}
// ask : montant hebdo demandé ; weeks : durée demandée. Un contrat plus long fait baisser le plafond hebdo de la marque ;
// un objectif ambitieux la rend plus généreuse, un objectif prudent moins.
function negotiateSponsor(o, ask, weeks, level = o.level) {
  o.level = level;
  const lim = o.max * (1 - (weeks - o.weeks) * 0.006) * [0.92, 1, 1.08][level];
  o.round++;
  o.history.push({ ask, weeks });
  if (ask <= o.weekly) return { status: "accept", weekly: ask, weeks };
  if (ask <= lim) return { status: "accept", weekly: round50(ask), weeks };
  if (ask > lim * 1.6 || o.round > o.patience) return { status: "walk" };
  // la marque fait un pas vers vous, sans dépasser son plafond
  o.weekly = round50(Math.min(lim * 0.98, o.weekly + (ask - o.weekly) * rand(0.3, 0.6)));
  o.weeks = weeks;
  return { status: "counter", weekly: o.weekly, weeks, last: o.round >= o.patience };
}
function signSponsor(o, weekly, weeks) {
  // les primes des clauses suivent le montant et la durée finalement signés
  o.weekly = weekly; o.weeks = weeks; o.clauses = sponsorClauses(o);
  const u = user(), C = o.clauses || { levels: [], extra: [] }, lv = C.levels[o.level ?? 1];
  const clauses = (lv ? [{ kind: "rank", game: C.game, target: lv.target, bonus: lv.bonus, label: `Finir ${lv.target === 1 ? "1er" : "dans le top " + lv.target} de ${divName(S.userId, C.game)}`, status: "pending", main: true }] : [])
    .concat(C.extra.map(x => ({ ...x, status: "pending" })));
  u.sponsorDeals.push({ name: o.brand, sector: o.sector, size: o.size, weekly, weeks, total: weeks, ethic: o.ethic || "neutre", clauses, start: nowIndex(), fans0: u.fans, titles0: u.titles.length, renewals: o.renewals || 0 });
  S.sponsorMarket && (S.sponsorMarket.list = S.sponsorMarket.list.filter(x => x.brand !== o.brand));
  mail(`Sponsor signé : ${o.brand}`, `<b>${o.brand}</b> (${o.sector}) devient partenaire du club : ${money(weekly)}/semaine pendant ${weeks} semaines (${money(weekly * weeks)} au total).` +
    (clauses.length ? `<br>Clauses : ${clauses.map(c => `${c.label} → prime de ${money(c.bonus)}`).join(" ; ")}.${lv ? " Si l'objectif de classement est atteint, la marque proposera de renouveler le contrat." : ""}` : "") +
    (o.ethic === "controverse" ? `<br>⚠️ Marque controversée : l'image du club va se dégrader tant que le contrat court. Les fans seront moins nombreux à vous rejoindre après les victoires et plus nombreux à partir après les défaites.` : o.ethic === "ethique" ? `<br>🌱 Marque éthique : l'image du club s'améliore, vos victoires attireront plus de fans.` : ""), "sponsor");
}
// vérifie une clause ; final : fin du contrat ou fin de la saison de ligue
function checkClause(d, c, final) {
  const u = user();
  if (c.status !== "pending") return;
  let met = null;
  if (c.kind === "rank") { const pos = leagueRank(c.game); if (final) met = pos > 0 && pos <= c.target; c.pos = pos; }
  else if (c.kind === "title") { if (u.titles.length > d.titles0) met = true; else if (final) met = false; }
  else if (c.kind === "fans") { const pct = (u.fans / d.fans0 - 1) * 100; c.pos = Math.round(pct * 10) / 10; if (pct >= c.pct) met = true; else if (final) met = false; }
  if (met === null) return;
  c.status = met ? "met" : "failed";
  if (met) { book("sponsors", c.bonus, c.game || "", `${d.name} : prime d'objectif`); mail(`✅ Objectif atteint : ${d.name}`, `${c.label} : prime de <b>${money(c.bonus)}</b> versée.`, "sponsor"); }
  else mail(`❌ Objectif manqué : ${d.name}`, `${c.label} : objectif manqué, pas de prime.${c.main ? " La marque ne renouvellera sans doute pas le contrat." : ""}`, "sponsor");
}
// clause en danger : le club n'est pas en voie de la respecter (texte de l'alerte), sinon null
function clauseRisk(d, c) {
  if (c.status !== "pending") return null;
  const u = user(), done = d.total ? (d.total - d.weeks) / d.total : 0;
  if (c.kind === "rank") { const pos = leagueRank(c.game); return pos > c.target ? `vous êtes ${pos}e, il faut finir ${c.target === 1 ? "1er" : "dans le top " + c.target}` : null; }
  if (c.kind === "fans") { const pct = (u.fans / d.fans0 - 1) * 100; return done >= 0.3 && pct < c.pct * done * 0.8 ? `+${Math.max(0, Math.round(pct * 10) / 10)} % de fans pour l'instant, objectif +${c.pct} %` : null; }
  if (c.kind === "title") return done >= 0.6 && u.titles.length <= d.titles0 ? "aucun titre pour l'instant" : null;
  return null;
}
// clauses non respectées (alertes) : liste [contrat, clause, texte]
const sponsorAlerts = () => user().sponsorDeals.flatMap(d => (d.clauses || []).map(c => [d, c, clauseRisk(d, c)]).filter(x => x[2]));
// joueurs du club dont le contrat se termine à la fin de la saison
const expiringPlayers = () => allUserPlayers().filter(p => p.years <= 1);
// chaque semaine : paiements, clauses, fins de contrat et propositions de renouvellement, marques intéressées
function sponsorWeek(report) {
  const u = user();
  for (const d of u.sponsorDeals) book("sponsors", d.weekly, "", d.name);
  for (const d of u.sponsorDeals) for (const c of d.clauses || []) checkClause(d, c, c.kind === "rank" && S.week === PO_FINAL);
  // alertes : une clause qui n'est plus respectée (rappel toutes les 6 semaines), puis qui l'est de nouveau
  for (const d of u.sponsorDeals) for (const c of d.clauses || []) {
    const risk = clauseRisk(d, c);
    if (risk && (!c.warnedAt || nowIndex() - c.warnedAt >= 6)) { c.warnedAt = nowIndex(); mail(`⚠️ Clause en danger : ${d.name}`, `<b>${esc0(c.label)}</b> : ${risk}. Si l'objectif n'est pas atteint, pas de prime de ${money(c.bonus)}${c.main ? " et la marque ne renouvellera sans doute pas" : ""}.`, "sponsor"); }
    else if (!risk && c.warnedAt && c.status === "pending") { delete c.warnedAt; mail(`✅ Clause de nouveau respectée : ${d.name}`, `<b>${esc0(c.label)}</b> : vous êtes de nouveau dans les clous. Il faut tenir jusqu'au bout.`, "sponsor"); }
  }
  for (const d of u.sponsorDeals) {
    --d.weeks;
    if (d.weeks === 4) mail(`⏳ Fin de contrat dans 4 semaines : ${d.name}`, `Le contrat avec <b>${d.name}</b> (${money(d.weekly)}/sem) se termine dans 4 semaines. Dans 2 semaines, vous pourrez décider de le renouveler ou non.`, "sponsor");
    // deux semaines avant la fin : le CEO décide s'il veut renouveler, puis la marque répond
    if (d.weeks === 2 && !d.renew) {
      const main = (d.clauses || []).find(c => c.main), good = !main || main.status === "met" || (main.status === "pending" && !clauseRisk(d, main));
      report.events.push({ title: `🤝 Renouveler le contrat avec ${d.name} ?`, body: `Le contrat avec <b>${esc0(d.name)}</b> (${money(d.weekly)}/sem) se termine dans 2 semaines. ${good ? "Les objectifs sont en bonne voie : la marque est plutôt ouverte à une prolongation." : "Les objectifs ne sont pas atteints : la marque hésite à continuer."}`,
        choices: [{ label: "Proposer de renouveler", fx: () => { const yes = Math.random() < (good ? 0.88 : 0.3); d.renew = yes ? "yes" : "refused";
            return yes ? `${d.name} accepte de discuter d'une prolongation : vous négocierez les termes à la fin du contrat.` : `${d.name} décline : la marque ne souhaite pas prolonger.`; } },
          { label: "Laisser le contrat se terminer", fx: () => { d.renew = "no"; return `Le contrat avec ${d.name} prendra fin dans 2 semaines.`; } }] });
    }
    if (d.weeks > 0) continue;
    for (const c of d.clauses || []) checkClause(d, c, true);
    const main = (d.clauses || []).find(c => c.main), ok = !main || main.status === "met";
    if (d.renew === "no" || d.renew === "refused") { mail(`Fin de contrat : ${d.name}`, `Le contrat avec <b>${d.name}</b> est terminé${d.renew === "no" ? " : vous avez choisi de ne pas le renouveler" : " : la marque n'a pas souhaité prolonger"}.`, "sponsor"); continue; }
    if (d.renew === "yes" || (ok && Math.random() < 0.9)) {
      const o = sponsorOffer(d.name);
      o.weekly = round50(d.weekly * rand(1.08, 1.25)); o.max = Math.max(o.max, o.weekly * 1.2); o.weeks = d.total; o.renewals = (d.renewals || 0) + 1; o.clauses = sponsorClauses(o);
      report.events.push({ title: `Renouvellement : ${d.name}`, sponsor: o, intro: `<b>${esc0(d.name)}</b> est satisfait du partenariat et propose de le renouveler, avec une hausse : <b>${money(o.weekly)}/sem</b>.` });
    } else mail(`Fin de contrat : ${d.name}`, `Le contrat avec <b>${d.name}</b> est terminé. ${ok ? "La marque change de stratégie et ne renouvelle pas." : "Objectifs manqués : la marque ne renouvelle pas."}`, "sponsor");
  }
  // joueurs en fin de contrat : rappels en cours de saison
  const exp = expiringPlayers();
  if (exp.length && [30, 38, 44, SEASON_LAST - 2].includes(S.week)) mail(`⏳ ${exp.length} joueur(s) en fin de contrat`, `Ces contrats se terminent à la fin de la saison : ${exp.map(p => `${GAMES[p.game].icon} <b>${esc0(p.handle)}</b> (${p.rating})`).join(", ")}. Sans prolongation, ils quitteront le club et vos équipes risquent de se retrouver incomplètes. Prolongez-les depuis l'onglet Effectifs (💬 → Renégocier son contrat).`, "transfer");
  u.sponsorDeals = u.sponsorDeals.filter(d => d.weeks > 0);
  // marché des sponsors : de nouvelles marques s'intéressent au club toutes les 4 semaines
  const M = S.sponsorMarket;
  if (!M || nowIndex() - M.at >= 4 || M.season !== S.season) refreshSponsorMarket();
}
const esc0 = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function refreshSponsorMarket() {
  const u = user(), reach = brandReach(), taken = new Set(u.sponsorDeals.map(d => d.name));
  const e = ecoOf(mainGame()), w = b => (b[2] === "controverse" ? e.bet : b[2] === "ethique" ? e.eth : 1 - e.bet - e.eth) * (brandFit(b[1]) > 1 ? 1.6 : 1);
  // tirage pondéré : les marques qui visent les jeux du club et le profil de sponsors de son jeu phare d'abord
  const pool = BRANDS.filter(b => !taken.has(b[0]) && !sectorRival(b[0]) && b[3] <= reach && b[3] >= reach - 1 && !(b[2] === "ethique" && (u.image ?? 60) < 40))
    .map(b => [b, Math.random() ** (1 / Math.max(0.01, w(b)))]).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  S.sponsorMarket = { at: nowIndex(), season: S.season, list: pool.slice(0, randi(3, 5)).map(b => ({ brand: b[0], interest: randi(45, 95) })) };
}
// fiche d'une marque : chiffres indicatifs générés par le jeu (stables d'une partie à l'autre), jeux visés, exigences, offre estimée
const SECTOR_GAMES = { "Périphériques": ["cs2", "val", "lol"], "Matériel PC": ["cs2", "lol", "dota"], "Informatique": ["lol", "cs2", "val"], "Processeurs": ["cs2", "lol", "dota"],
  "Chaises gaming": ["lol", "val", "fn"], "Boisson énergisante": ["fn", "rl", "cs2"], "Boissons": ["fc", "lol", "fn"], "Automobile": ["rl", "lol", "fc"], "Équipementier": ["fc", "lol", "val"],
  "Sport": ["fc", "rl", "lol"], "Paris sportifs": ["cs2", "lol", "fc"], "Casino en ligne": ["cs2", "val", "dota"], "Cryptomonnaies": ["cs2", "dota", "val"], "NFT": ["fn", "val", "cs2"],
  "Télécoms": ["lol", "fn", "fc"], "Électronique": ["lol", "pubgm", "mlbb"], "Livraison": ["lol", "fn", "val"], "Distribution": ["lol", "fc", "fn"], "Mode": ["lol", "val", "fn"] };
const SECTOR_AUDIENCE = { "Paris sportifs": "18-35 ans, fans de sport et de compétition", "Casino en ligne": "adultes 18-40 ans", "Cryptomonnaies": "18-30 ans, technophiles",
  "Boisson énergisante": "15-30 ans, gamers et sportifs", "Périphériques": "joueurs PC 14-30 ans", "Matériel PC": "joueurs PC passionnés", "Automobile": "25-45 ans, fans de vitesse",
  "Mode": "15-30 ans, culture urbaine", "Équipementier": "15-35 ans, sportifs" };
function brandStats(name) {
  const b = brandOf(name), h = hashOf(name), r = k => ((h >>> (k * 3)) % 1000) / 1000;
  const rev = [0, 0.2e6 + r(1) * 2.8e6, 50e6 + r(1) * 1.95e9, 5e9 + r(1) * 75e9][b.size];
  const margin = (b.ethic === "controverse" ? 0.14 : b.ethic === "ethique" ? 0.05 : 0.08) + r(2) * 0.1;
  const followers = Math.round([0, 500 + r(3) * 19500, 50e3 + r(3) * 2.95e6, 2e6 + r(3) * 58e6][b.size]);
  const esport = Math.round([0, 5e3 + r(4) * 25e3, 0.3e6 + r(4) * 2.7e6, 4e6 + r(4) * 36e6][b.size] / 1000) * 1000;
  const growth = Math.round((r(5) * 30 - 8) * 10) / 10;
  const games = SECTOR_GAMES[b.sector] || ["lol", "fn", "fc"];
  // clubs déjà partenaires (les mieux classés pour une grande marque, des clubs modestes pour un commerce local)
  const pool = Object.values(S.clubs).filter(c => !c.filler && !c.solo && !c.parent && c.id !== S.userId && Object.keys(c.divisions).length)
    .filter(c => b.size === 3 ? c.fame >= 65 : b.size === 2 ? c.fame >= 30 && c.fame < 75 : c.fame < 35).sort((x, y) => x.id < y.id ? -1 : 1);
  const partners = pool.length ? [0, 1, 2].slice(0, 1 + h % 3).map(k => pool[(h + k * 7919) % pool.length]).filter((c, i, a) => a.indexOf(c) === i) : [];
  // offre estimée pour le club du joueur (sans la part de hasard de la négociation)
  const u = user(), tierBonus = sponsorWeight(u);
  const mult = (b.ethic === "controverse" ? 1.9 : b.ethic === "ethique" ? 0.87 * (0.7 + (u.image ?? 60) / 200) : 1) * [0, 0.6, 0.9, 1.2][b.size] * brandFit(b.sector);
  const mid = (200 + u.fame * u.fame * 2.25 + tierBonus * 0.75) * mult;
  return { ...b, revenue: rev, profit: rev * margin, margin, followers, esport, growth, games, partners, offer: [round50(mid * 0.75), round50(mid * 1.35)],
    minFame: [0, 0, 25, 55][b.size], minImage: b.ethic === "ethique" ? 50 : 0, audience: SECTOR_AUDIENCE[b.sector] || "grand public, 15-45 ans" };
}
// démarchage : chance qu'une marque accepte de discuter (taille de la marque, notoriété, image du club)
function contactChance(name) {
  const u = user(), b = brandOf(name), reach = brandReach();
  let c = b.size < reach ? 0.85 : b.size === reach ? 0.35 + u.fame / 250 : b.size === reach + 1 ? 0.12 : 0.02;
  if (b.ethic === "ethique") c *= 0.4 + (u.image ?? 60) / 100;
  if (b.ethic === "controverse") c *= 1.4;
  return clamp(c, 0.02, 0.95);
}
function contactBrand(name) {
  const u = user(), key = S.season + "-" + S.week;
  S.contacts = S.contacts && S.contacts.key === key ? S.contacts : { key, n: 0 };
  S.brandCooldown = S.brandCooldown || {};
  if (u.sponsorDeals.some(d => d.name === name)) return { error: `${name} est déjà partenaire du club.` };
  const rival = sectorRival(name); if (rival) return { error: `${name} exige l'exclusivité dans son secteur (${brandOf(name).sector}) : vous êtes déjà partenaire de ${rival}.` };
  if (S.brandCooldown[name] && S.brandCooldown[name] > nowIndex()) return { error: `${name} vous a déjà répondu non récemment. Réessayez plus tard.` };
  if (S.contacts.n >= 2) return { error: "Votre équipe commerciale a déjà contacté 2 marques cette semaine." };
  S.contacts.n++;
  if (Math.random() > contactChance(name)) { S.brandCooldown[name] = nowIndex() + 8; return { error: `${name} décline : ${brandOf(name).size > brandReach() ? "votre club n'est pas encore assez connu pour cette marque." : brandOf(name).ethic === "ethique" && (u.image ?? 60) < 55 ? "l'image du club ne correspond pas à ses valeurs." : "pas de budget pour l'esport en ce moment."} Nouvelle tentative possible dans 8 semaines.` }; }
  return { offer: sponsorOffer(name) };
}

// ---------- installations ----------
function facilityCost(lvl) { return 25000 * (lvl + 1) * (lvl + 1); }
function upgradeFacility(key) {
  const u = user(), lvl = u.facilities[key];
  if (lvl >= MAX_FAC) return "Niveau maximum atteint.";
  const cost = facilityCost(lvl);
  if (u.budget < cost) return "Budget insuffisant.";
  book("upgrades", -cost, "", `${FACILITIES[key].name} niveau ${lvl + 1}`); u.facilities[key]++;
  mail(`Installation améliorée`, `${FACILITIES[key].icon} ${FACILITIES[key].name} → niveau ${u.facilities[key]} (${money(cost)}).`, "info");
  return null;
}

// ---------- messagerie ----------
// jeu d'un message, deviné d'après son texte quand il n'est pas précisé (le nom le plus long d'abord : « Valorant Game Changers » avant « Valorant »)
function mailGame(title, body) {
  const keys = mailGame.k || (mailGame.k = Object.keys(GAMES).sort((a, b) => GAMES[b].name.length - GAMES[a].name.length));
  const t = title + " " + body;
  return keys.find(k => t.includes(GAMES[k].name)) || keys.find(k => new RegExp("(^|[^A-Za-z])" + GAMES[k].short.replace(/ /g, " ") + "([^A-Za-z]|$)").test(title)) || null;
}
function mail(title, body, type = "info", game = null) {
  if (!game) game = mailGame(title, body);
  S.inbox.unshift({ id: uid("m"), season: S.season, week: S.week, title, body, type, game, read: false });
  if (S.inbox.length > 300) S.inbox.pop();
}
function news(text) { mail("📰 " + text, text, "news"); }

// ---------- sauvegarde ----------
// ---------- sauvegarde compressée ----------
// Le navigateur limite le stockage à ~5 Mo : la partie (plusieurs Mo de JSON) est compressée en LZW
// (octets UTF-8 -> codes jusqu'à 55 000, un code par caractère UTF-16, hors zone des surrogates).
const LZW_MAX = 0xD7FF - 0x20;
function packSave(str) {
  const bytes = new TextEncoder().encode(str), dict = new Map(), out = [];
  let next = 256, w = -1;
  for (const b of bytes) {
    if (w < 0) { w = b; continue; }
    const k = w * 256 + b, c = dict.get(k);
    if (c !== undefined) { w = c; continue; }
    out.push(w);
    if (next < LZW_MAX) dict.set(k, next++);
    else { out.push(LZW_MAX); dict.clear(); next = 256; }   // dictionnaire plein : on repart de zéro
    w = b;
  }
  if (w >= 0) out.push(w);
  let s = "";
  for (let i = 0; i < out.length; i += 8192) s += String.fromCharCode(...out.slice(i, i + 8192).map(c => c + 0x20));
  return "Z1:" + s;
}
function unpackSave(s) {
  if (!s.startsWith("Z1:")) return s;   // ancienne sauvegarde en JSON brut
  const fresh = () => Array.from({ length: 256 }, (_, i) => Uint8Array.of(i));
  let dict = fresh(), prev = null;
  const chunks = [];
  let size = 0;
  for (let i = 3; i < s.length; i++) {
    const code = s.charCodeAt(i) - 0x20;
    if (code === LZW_MAX) { dict = fresh(); prev = null; continue; }
    let entry;
    if (code < dict.length) entry = dict[code];
    else { entry = new Uint8Array(prev.length + 1); entry.set(prev); entry[prev.length] = prev[0]; }
    chunks.push(entry); size += entry.length;
    if (prev && dict.length < LZW_MAX) { const e = new Uint8Array(prev.length + 1); e.set(prev); e[prev.length] = entry[0]; dict.push(e); }
    prev = entry;
  }
  const all = new Uint8Array(size);
  let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
  return new TextDecoder().decode(all);
}
// la sauvegarde (sérialisation + compression, ~0,3 s pour un monde complet) part juste après l'affichage de la semaine
function scheduleSave() {
  if (typeof setTimeout !== "function") return save();
  clearTimeout(scheduleSave.t);
  scheduleSave.t = setTimeout(save, 30);
}
if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("beforeunload", () => { if (scheduleSave.t) save(); });
function readSave() { const s = localStorage.getItem(SAVE_KEY); return s ? unpackSave(s) : null; }
function save() {
  try { localStorage.removeItem("esports-manager-save-v2"); } catch (e) { }   // ancienne version incompatible : libère la place
  try { localStorage.setItem(SAVE_KEY, packSave(JSON.stringify(S))); S.saveError = false; }
  catch (e) { if (!S.saveError) { S.saveError = true; if (typeof toast === "function") toast("⚠️ Sauvegarde impossible : stockage du navigateur plein ou bloqué."); } }
}
function load() { try { const s = readSave(); if (s) { S = JSON.parse(s); applySeasonFormats(); return true; } } catch (e) { } return false; }
// empreinte de la base de données : une partie créée avant une mise à jour des effectifs garde l'ancien monde
function dataVersion() {
  const txt = JSON.stringify([ORGS, ROSTERS, SOLOS, typeof EXTRA_DIVS !== "undefined" ? EXTRA_DIVS : 0]);
  let h = 0; for (let i = 0; i < txt.length; i++) h = (h * 31 + txt.charCodeAt(i)) | 0;
  return h;
}
function saveIsOutdated() {
  try { const s = readSave(); return !!s && JSON.parse(s).dataVersion !== dataVersion(); } catch (e) { return false; }
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function wipeSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } }
