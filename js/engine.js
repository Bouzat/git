// =====================================================================
//  ESPORTS MANAGER — Moteur de simulation (état, matchs, économie)
// =====================================================================

const SAVE_KEY = "esports-manager-save-v2";
const FACILITIES = {
  house:     { name: "Gaming House",        icon: "🏠", desc: "Moral et forme des joueurs." },
  coaching:  { name: "Staff de coaching",   icon: "🧠", desc: "Bonus de performance en match + progression." },
  analytics: { name: "Cellule d'analyse",   icon: "📊", desc: "Bonus de performance en match." },
  content:   { name: "Studio de contenu",   icon: "🎥", desc: "Croissance des fans et revenus merch/stream." },
  academy:   { name: "Académie",            icon: "🎓", desc: "Révèle des jeunes talents chaque saison." },
};
const MAX_FAC = 5;
const LEAGUE_SIZE = 12;          // équipes (ou joueurs) par circuit
const REGULAR_WEEKS = 11;        // saison régulière ; puis demies (S12) et finale (S13)
const START_BUDGET = 250000;     // budget d'un club créé de zéro
const TIER_LABEL = ["Tier 1", "Tier 2", "Tier 3"];
const TIER_PRIZE = [1, 0.08, 0.012];        // part du cashprize du jeu
const TIER_FAME_REQ = [65, 30, 0];          // notoriété requise pour acheter une place
const TIER_OP = [3500, 700, 100];            // frais hebdo par joueur
const TIER_SPONSOR = [6000, 2000, 500];    // revenus sponsors liés à la division
const TIER_RATING = [[80, 88], [70, 80], [61, 74]]; // niveau des joueurs générés
const TIER_FAME_TARGET = [75, 40, 15];

let S = null; // état global

// ---------- utilitaires ----------
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const uid = (() => { let n = 0; return p => p + "_" + Date.now().toString(36) + "_" + (n++).toString(36); })();
// une seule ligue pour les jeux en circuit ouvert (Fortnite), quel que soit le statut du club
const lkey = (game, tier) => game + ":" + (GAMES[game] && GAMES[game].open ? 1 : tier);
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
function tierName(game, tier) { return GAMES[game].tiers[tier - 1]; }
function leagueName(L) { return GAMES[L.game].open ? GAMES[L.game].circuit : tierName(L.game, L.tier); }

// ---------- joueurs ----------
function playerValue(p) {
  const g = GAMES[p.game];
  const af = p.age <= 20 ? 1.3 : p.age <= 24 ? 1.15 : p.age <= 28 ? 1 : p.age <= 31 ? 0.7 : 0.45;
  const potBonus = 1 + Math.max(0, p.pot - p.rating) * 0.02;
  return Math.max(2000, Math.round(25000 * Math.pow(1.13, p.rating - 60) * af * g.mult * potBonus / 500) * 500);
}
function salaryDemand(p, club) {
  // courbe exponentielle : ~200 €/sem pour un amateur noté 60, ~15 k€/sem pour une superstar notée 95
  const base = (150 + 15 * Math.pow(1.17, p.rating - 50)) * Math.max(0.5, GAMES[p.game].mult);
  // les petits clubs doivent payer plus cher pour attirer les stars
  const prestige = club ? 1 + Math.max(0, p.rating - 50 - club.fame) / 100 : 1;
  return Math.max(150, Math.round(base * prestige / 50) * 50);
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
const allUserPlayers = () => Object.keys(user().divisions).flatMap(g => clubPlayers(S.userId, g));
function soloName(club, game) { return clubPlayers(club.id, game).map(p => p.handle).join(" & ") || club.name; }

// ---------- clubs ----------
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
function addDivision(club, game, tier, roster) {
  club.divisions[game] = { tier, players: [] };
  roster.forEach(([h, n, r, a], i) => {
    const p = makePlayer(h, n, r, a, game, i, club.id);
    p.starter = i < GAMES[game].size; addPlayer(p); club.divisions[game].players.push(p.id);
  });
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
function soloClub(game, tier, roster) {
  const id = uid("solo");
  const avg = roster.reduce((s, p) => s + p[2], 0) / roster.length;
  const c = baseClub(id, roster.map(p => p[0]).join(" & "), roster[0][0].slice(0, 4).toUpperCase(), roster[0][1],
    `hsl(${randi(0, 359)} 55% 55%)`, clamp(Math.round((avg - 55) * 1.5), 5, 70), true);
  c.solo = true;
  addDivision(c, game, tier, roster);
  S.clubs[id] = c;
  return c;
}
// club fictif : réutilise un nom libre pour ce jeu (un même club fictif peut avoir plusieurs divisions)
function fillerClub(game, tier) {
  const g = GAMES[game];
  const [lo, hi] = TIER_RATING[tier - 1];
  if (g.fmt === "duel" || (g.fmt === "br" && g.size <= 2)) {
    const roster = Array.from({ length: g.size }, () => [genHandle(), pick(Object.keys(COUNTRIES)), randi(lo, hi), randi(16, 27)]);
    const c = soloClub(game, tier, roster); c.filler = true; return c;
  }
  let cand = shuffle(FILLER_NAMES).find(([n, tag]) => { const c = S.clubs["f_" + tag]; return !c || !c.divisions[game]; });
  let c;
  if (cand) {
    const [name, tag, color, cc] = cand, id = "f_" + tag;
    c = S.clubs[id] || (S.clubs[id] = baseClub(id, name, tag, cc, color, randi(...[[45, 60], [20, 40], [5, 20]][tier - 1]), true));
  } else {
    const tag = "X" + randi(100, 999);
    c = S.clubs["f_" + tag] = baseClub("f_" + tag, pick(FILLER_NAMES)[0] + " " + tag, tag, "FR", "#888", 15, true);
  }
  c.filler = true;
  const roster = Array.from({ length: g.size }, (_, r) => [genHandle(), pick(Object.keys(COUNTRIES)), randi(lo, hi), randi(17, 29)]);
  addDivision(c, game, tier, roster);
  return c;
}

// ---------- création du monde ----------
function newWorld(opts) {
  S = {
    version: 2, dataVersion: dataVersion(), ceo: opts.ceo, mode: opts.mode, season: 2026, week: 1, over: false,
    clubs: {}, players: {}, leagues: {}, inbox: [], finance: [], titles: [],
    userId: null, board: { confidence: 60, objective: null }, lastWeek: null,
  };
  for (const game of Object.keys(GAMES)) {
    const entries = [];
    for (const [orgId, roster, verified] of (ROSTERS[game] || [])) entries.push({ orgId, roster, verified: !!verified, avg: roster.reduce((s, p) => s + p[2], 0) / roster.length });
    // entrée SOLOS : un joueur, un duo, ou [org, duo] pour un duo signé dans une organisation
    const solos = (SOLOS[game] || []).map(x => typeof x[0] === "string" && Array.isArray(x[1]) && Array.isArray(x[1][0]) ? { orgId: x[0], roster: x[1] } : { roster: Array.isArray(x[0]) ? x : [x] })
      .map(e => ({ ...e, avg: e.roster.reduce((s, p) => s + p[2], 0) / e.roster.length }));
    solos.sort((a, b) => b.avg - a.avg);
    const all = entries.concat(solos); // les orgs sont déjà classées
    const byTier = [[], [], []];
    const sizes = GAMES[game].tierSizes || [LEAGUE_SIZE, LEAGUE_SIZE];
    all.forEach((e, i) => {
      const tier = i < sizes[0] ? 1 : i < sizes[0] + sizes[1] ? 2 : 3;
      // une org peut aligner plusieurs duos/joueurs dans un jeu solo : les suivants jouent dans une équipe « sœur » à ses couleurs
      let c = e.orgId ? orgClub(e.orgId) : null;
      if (c && c.divisions[game]) c = GAMES[game].size <= 2 ? sisterClub(e.orgId, game) : null;
      if (c) { addDivision(c, game, tier, e.roster); c.divisions[game].verified = e.verified || !!SOLOS[game]; }
      const club = c || soloClub(game, tier, e.roster);
      byTier[tier - 1].push(club.id);
    });
    // divisions réelles sans effectif connu : joueurs inventés au niveau du club
    for (const [orgId, games] of Object.entries(EXTRA_DIVS)) {
      if (!games.includes(game) || !ORGS[orgId]) continue;
      const c = orgClub(orgId);
      if (c.divisions[game]) continue;
      const t1Max = (GAMES[game].tierSizes || [LEAGUE_SIZE])[0] + 2;
      const tier = c.fame >= 70 && byTier[0].length < t1Max ? 1 : 2;
      const [lo, hi] = TIER_RATING[tier - 1], g = GAMES[game];
      const roster = Array.from({ length: g.size }, () => [genHandle(), c.country, randi(lo + 2, hi), randi(18, 26)]);
      addDivision(c, game, tier, roster);
      c.divisions[game].generated = true;
      byTier[tier - 1].push(c.id);
    }
    for (let t = 1; t <= 3; t++) {
      if (GAMES[game].open && t > 1) break;
      const L = S.leagues[lkey(game, t)] = { key: lkey(game, t), game, tier: t, teams: GAMES[game].open ? byTier.flat() : byTier[t - 1], schedule: [], table: {}, results: [], playoffs: null, champion: null };
      while (L.teams.length < LEAGUE_SIZE) L.teams.push(fillerClub(game, t).id);
    }
  }
  // un remplaçant pour chaque équipe d'au moins 3 joueurs
  for (const c of Object.values(S.clubs)) for (const [game, d] of Object.entries(c.divisions)) {
    if (GAMES[game].size >= 3) {
      const [lo, hi] = TIER_RATING[d.tier - 1];
      const sub = genPlayer(game, lo - 4, hi - 6, 17, 24, c.id); addPlayer(sub); d.players.push(sub.id);
    }
  }
  // effectifs incomplets (joueur parti, info manquante) : on complète
  for (const c of Object.values(S.clubs)) for (const game of Object.keys(c.divisions)) aiFillRoster(c.id, game);
  // agents libres : uniquement des joueurs générés (les pros réels ont tous une équipe)
  for (const game of Object.keys(GAMES)) {
    const n = GAMES[game].size * 14 + 8;
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      const p = r < 0.65 ? genPlayer(game, 48, 64, 16, 26) : r < 0.95 ? genPlayer(game, 62, 72, 17, 28) : genPlayer(game, 72, 77, 19, 30);
      p.years = 0; addPlayer(p);
    }
  }
  // club du joueur
  if (opts.mode === "create") {
    const c = baseClub("user", opts.name, opts.tag, opts.country, opts.color, 5, false);
    c.budget = START_BUDGET; c.fans = 800;
    S.clubs.user = c; S.userId = "user";
    joinLeague(opts.firstGame, 3);
  } else {
    S.userId = opts.clubId; S.clubs[opts.clubId].ai = false;
  }
  newSeasonSetup(true);
  const u = user();
  mail("Bienvenue, " + S.ceo + " !",
    opts.mode === "create"
      ? `Vous venez de fonder <b>${u.name}</b> avec ${money(u.budget)} en poche. Votre club démarre en <b>${tierLabel(opts.firstGame, 3)}</b> du ${GAMES[opts.firstGame].name} (${GAMES[opts.firstGame].open ? GAMES[opts.firstGame].circuit : tierName(opts.firstGame, 3)}).<br>
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

function newSeasonSetup(first) {
  for (const L of Object.values(S.leagues)) {
    L.teams = L.teams.filter(id => S.clubs[id] && divOf(id, L.game));
    const fmt = GAMES[L.game].fmt;
    L.schedule = fmt === "br" ? [] : roundRobin(shuffle(L.teams)).slice(0, REGULAR_WEEKS);
    L.table = {};
    L.teams.forEach(id => L.table[id] = emptyRow(fmt));
    L.results = []; L.playoffs = null; L.champion = null;
  }
  S.regularWeeks = REGULAR_WEEKS;
  S.week = 1;
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
// rang à atteindre dans un circuit ouvert pour obtenir le statut t (1 = Élite : top 20, 2 = Pro : top 80)
function statusCut(game, t) { const [a, b] = GAMES[game].tierSizes; return t === 1 ? a : a + b; }
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
function userLeagues() { const u = user(); return Object.entries(u.divisions).map(([g, d]) => S.leagues[lkey(g, d.tier)]); }

// ---------- divisions ----------
function canJoin(game, tier) {
  const u = user();
  if (u.divisions[game]) return "Division déjà ouverte.";
  if (GAMES[game].open && tier < 3) return `${GAMES[game].name} est un circuit ouvert : tout le monde y entre en statut ${tierLabel(game, 3)}, le statut ${tierLabel(game, tier)} se gagne au classement.`;
  if (u.fame < TIER_FAME_REQ[tier - 1]) return `Notoriété ${TIER_FAME_REQ[tier - 1]} requise pour acheter une place en ${TIER_LABEL[tier - 1]}.`;
  if (u.budget < tierEntry(game, tier)) return "Budget insuffisant.";
  return null;
}
function openDivision(game, tier) {
  const e = canJoin(game, tier); if (e) return e;
  const fee = tierEntry(game, tier);
  user().budget -= fee;
  const late = joinLeague(game, tier);
  mail(`Nouvelle division : ${GAMES[game].name}`, `Votre club rejoint le <b>${GAMES[game].open ? GAMES[game].circuit : tierName(game, tier)}</b> (${tierLabel(game, tier)}) pour ${money(fee)}. Il vous faut ${GAMES[game].size} joueur(s) titulaire(s).${late ? "<br>Le calendrier étant déjà fixé, vos matchs commenceront la saison prochaine." : ""}`, "info");
  return null;
}
// place le club du joueur dans un circuit, en prenant si possible la place d'un club fictif
function joinLeague(game, tier) {
  const u = user(), L = S.leagues[lkey(game, tier)];
  u.divisions[game] = { tier, players: [] };
  const fid = L.teams.find(id => S.clubs[id].filler);
  if (fid) {
    swapInLeague(L, fid, u.id);
    dissolveDivision(fid, game);
    return false;
  }
  L.teams.push(u.id); L.table[u.id] = emptyRow(GAMES[game].fmt);
  return L.schedule.length > 0 && GAMES[game].fmt !== "br";
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
  const u = user(), tier = u.divisions[game].tier;
  for (const p of clubPlayers(u.id, game)) releasePlayer(p.id, true);
  const L = S.leagues[lkey(game, tier)];
  const f = fillerClub(game, tier);
  swapInLeague(L, u.id, f.id);
  delete u.divisions[game];
  u.fame = Math.max(1, u.fame - 2);
}

// ---------- mercato ----------
function askingPrice(p) {
  if (!p.club) return 0;
  const c = S.clubs[p.club];
  if (c.solo) return Math.round(playerValue(p) * 0.8 / 500) * 500; // prime versée au joueur indépendant
  return Math.round(playerValue(p) * (p.starter ? 1.6 : 1.2) * (0.8 + c.fame / 250) / 500) * 500;
}
function signFreeAgent(pid, salary, years) {
  const p = S.players[pid], u = user();
  if (p.club) return "Ce joueur n'est pas libre.";
  if (!u.divisions[p.game]) return `Ouvrez d'abord une division ${GAMES[p.game].name}.`;
  const demand = salaryDemand(p, u);
  if (salary < demand * 0.9) { p.morale = clamp(p.morale - 5, 0, 100); return `${p.handle} refuse : il demande au moins ${money(demand * 0.9)}/sem.`; }
  const bonus = Math.round(salary * 4);
  if (u.budget < bonus) return "Budget insuffisant pour la prime de signature (" + money(bonus) + ").";
  u.budget -= bonus;
  joinClub(p, u, salary, years);
  mail(`Signature : ${p.handle}`, `${flag(p.nat)} <b>${p.handle}</b> (${GAMES[p.game].short}, ${p.rating}) rejoint ${u.name} pour ${years} an(s) à ${money(salary)}/sem. Prime de signature : ${money(bonus)}.`, "transfer");
  return null;
}
// une star ne rejoint pas un club trop modeste
function interestCheck(p) {
  const d = user().divisions[p.game];
  const bonus = d ? [20, 8, 0][d.tier - 1] : 0;
  return p.rating - 45 <= user().fame + 25 + bonus;
}
function makeOffer(pid, fee) {
  const p = S.players[pid], u = user();
  if (!p.club || p.club === u.id) return "Offre impossible.";
  if (!u.divisions[p.game]) return `Ouvrez d'abord une division ${GAMES[p.game].name}.`;
  if (u.budget < fee) return "Budget insuffisant.";
  const seller = S.clubs[p.club], ask = askingPrice(p);
  if (!interestCheck(p)) return `${p.handle} n'est pas intéressé par le projet : votre club manque de notoriété (${u.fame.toFixed(0)}) ou évolue trop bas.`;
  if (fee < ask * rand(0.88, 1.08)) return `${seller.solo ? p.handle : seller.name} refuse votre offre de ${money(fee)}. (Prix estimé : ~${money(ask)})`;
  const salary = salaryDemand(p, u);
  u.budget -= fee; seller.budget += fee;
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
  if (u.budget < fee) return "Budget insuffisant.";
  if (!interestCheck(p)) return `${p.handle} n'est pas intéressé par le projet : votre club manque de notoriété (${u.fame.toFixed(0)}) ou évolue trop bas.`;
  const seller = S.clubs[p.club], ask = askingPrice(p);
  if (p.offerRefused === nowIndex() + ":" + fee) return `${seller.name} a déjà refusé ce montant.`;
  if (fee < ask * rand(0.88, 1.08)) { p.offerRefused = nowIndex() + ":" + fee; return `${seller.solo ? p.handle : seller.name} refuse votre offre de ${money(fee)}. (Prix estimé : ~${money(ask)})`; }
  return null;
}
function sellPlayer(pid) {
  const p = S.players[pid], u = user();
  const L = S.leagues[lkey(p.game, u.divisions[p.game].tier)];
  const buyers = L.teams.filter(id => id !== u.id && S.clubs[id] && !S.clubs[id].solo);
  const pool = buyers.length ? buyers : Object.values(S.clubs).filter(c => c.ai && !c.solo && c.divisions[p.game]).map(c => c.id);
  const buyer = S.clubs[pick(pool)];
  const fee = Math.round(playerValue(p) * rand(0.75, 1.1) / 500) * 500;
  removeFromClub(p);
  joinClub(p, buyer, salaryDemand(p, buyer), randi(1, 3));
  u.budget += fee;
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
  u.budget -= cost;
  removeFromClub(p); p.years = 0; p.morale = 60;
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
  if (club.ai) autoStarters(club.id, p.game);
  else if (clubPlayers(club.id, p.game).filter(x => x.starter).length < GAMES[p.game].size) p.starter = true;
}
function removeFromClub(p) {
  const d = divOf(p.club, p.game);
  if (d) d.players = d.players.filter(id => id !== p.id);
  p.club = null; p.starter = false;
}
function autoStarters(clubId, game) {
  const ps = clubPlayers(clubId, game).sort((a, b) => effRating(b) - effRating(a));
  ps.forEach((p, i) => p.starter = i < GAMES[game].size);
}
function aiFillRoster(clubId, game) {
  const c = S.clubs[clubId], g = GAMES[game], d = divOf(clubId, game);
  if (!c || !d) return;
  const want = g.size >= 3 ? g.size + 1 : g.size;
  const [lo, hi] = TIER_RATING[d.tier - 1];
  let added = 0;
  while (clubPlayers(clubId, game).length < want) {
    added++;
    const fa = Object.values(S.players).filter(p => !p.club && p.game === game && p.rating <= hi + 2)
      .sort((a, b) => b.rating - a.rating)[0];
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
  if (p.starter) { p.starter = false; return null; }
  if (clubPlayers(p.club, p.game).filter(x => x.starter).length >= GAMES[p.game].size) return `Déjà ${GAMES[p.game].size} titulaire(s). Passez d'abord un joueur sur le banc.`;
  p.starter = true; return null;
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
  const parts = {
    salary: ratio(offer.salary, d.salary), bonus: ratio(offer.bonus, d.bonus),
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
  return { status: "counter", tone, msg: pick(REPLIES[tone]) + (issues.length ? " Il " + issues.slice(0, 3).join(", ") + "." : "") };
}
// applique le contrat signé
function acceptContract(N, offer) {
  const p = S.players[N.pid], u = user();
  const upfront = offer.bonus + offer.agentFee + (N.ctx === "transfer" ? N.fee : 0);
  if (u.budget < upfront) return `Budget insuffisant : il faut ${money(upfront)} tout de suite (prime, commission${N.ctx === "transfer" ? ", transfert" : ""}).`;
  u.budget -= upfront;
  let from = "";
  if (N.ctx === "transfer") {
    const seller = S.clubs[p.club];
    from = seller.solo ? " (indépendant)" : ` (transfert depuis ${seller.name} : ${money(N.fee)})`;
    seller.budget += N.fee;
    removeFromClub(p);
    joinClub(p, u, offer.salary, offer.years);
    aiFillRoster(seller.id, p.game);
    u.fame = clamp(u.fame + Math.max(0, (p.rating - 80) * 0.15), 0, 100);
  } else if (N.ctx === "sign") {
    joinClub(p, u, offer.salary, offer.years);
  }
  Object.assign(p, { salary: offer.salary, years: offer.years, prizeShare: offer.prizeShare, winBonus: offer.winBonus, clause: offer.clause, status: offer.status, promiseBroken: 0 });
  p.morale = clamp(p.morale + 10, 0, 100);
  mail(`${N.ctx === "renew" ? "Prolongation" : "Signature"} : ${p.handle}`,
    `${flag(p.nat)} <b>${p.handle}</b> (${GAMES[p.game].short}, ${p.rating})${from} — ${offer.years} an(s), ${money(offer.salary)}/sem, statut « ${offer.status} ».<br>
     Prime de signature ${money(offer.bonus)} · commission d'agent ${money(offer.agentFee)} · ${offer.prizeShare} % des cashprizes · prime de victoire ${money(offer.winBonus)} · clause libératoire ${offer.clause ? money(offer.clause) : "aucune"}.`, "transfer");
  return null;
}
// prix d'une clause libératoire d'un joueur IA : son club ne peut pas refuser
function payClause(pid) { const p = S.players[pid]; return p.clause > 0 ? startNegotiation(pid, "transfer", p.clause) : { error: "Ce joueur n'a pas de clause libératoire." }; }
// effets hebdomadaires : promesses de statut, clauses activées par d'autres clubs
function weeklyContractEffects() {
  const u = user();
  for (const p of allUserPlayers()) {
    const promised = STATUSES.indexOf(p.status || "Titulaire");
    if (promised >= 3 && !p.starter) {
      p.morale = clamp(p.morale - (promised === 4 ? 4 : 2.5), 0, 100);
      p.promiseBroken = (p.promiseBroken || 0) + 1;
      if (p.promiseBroken === 3) mail(`😠 ${p.handle} se sent trahi`, `On lui avait promis le statut « ${p.status} », mais il est sur le banc depuis 3 semaines. Son moral chute.`, "transfer");
    } else p.promiseBroken = 0;
    // un club plus prestigieux peut payer la clause
    if (p.clause > 0 && p.rating >= 75 && p.clause <= playerValue(p) * 1.6 && Math.random() < 0.04) {
      const myTier = u.divisions[p.game].tier;
      const buyers = Object.values(S.clubs).filter(c => c.ai && !c.solo && c.divisions[p.game] && c.divisions[p.game].tier <= myTier && c.fame > u.fame - 5);
      if (!buyers.length) continue;
      const buyer = pick(buyers);
      u.budget += p.clause;
      removeFromClub(p);
      joinClub(p, buyer, salaryDemand(p, buyer), randi(2, 4));
      const roster = clubPlayers(buyer.id, p.game);
      if (roster.length > GAMES[p.game].size + 2) { const worst = roster.filter(x => x.id !== p.id).sort((a, b) => a.rating - b.rating)[0]; removeFromClub(worst); worst.years = 0; }
      mail(`💸 Clause activée : ${p.handle}`, `<b>${buyer.name}</b> a payé la clause libératoire de ${p.handle} (${money(p.clause)}). Le joueur quitte le club.`, "transfer");
      p.clause = 0;
    }
  }
}

// ---------- matchs ----------
function effRating(p) { return p.rating * (0.88 + 0.12 * p.form / 100) * (0.92 + 0.08 * p.morale / 100); }
function teamStrength(clubId, game) {
  const c = S.clubs[clubId], g = GAMES[game];
  const ps = clubPlayers(clubId, game);
  let st = ps.filter(p => p.starter);
  if (st.length < g.size) st = st.concat(ps.filter(p => !p.starter).sort((a, b) => b.rating - a.rating));
  st = st.slice(0, g.size);
  const sum = st.reduce((s, p) => s + effRating(p), 0) + (g.size - st.length) * 30;
  const bonus = c.facilities.coaching * 0.6 + c.facilities.analytics * 0.4;
  return { str: sum / g.size + bonus, lineup: st };
}
function afterResult(lineup, won) {
  lineup.forEach(p => {
    p.form = clamp(p.form + (won ? randi(1, 5) : -randi(1, 4)), 0, 100);
    p.morale = clamp(p.morale + (won ? 2 : -2), 0, 100);
    won ? p.stats.w++ : p.stats.l++;
  });
}
function clubResult(id, won, weight = 1) {
  const c = S.clubs[id];
  c.fame = clamp(c.fame + (won ? 0.25 : -0.15) * weight, 1, 100);
  c.fans = Math.max(100, Math.round(c.fans * (won ? 1 + 0.002 * weight : 0.999) + (won ? 40 * weight : 0)));
}
function playSeries(game, a, b, bestOf) {
  const g = GAMES[game];
  const A = teamStrength(a, game), B = teamStrength(b, game);
  const need = Math.ceil(bestOf / 2);
  let wa = 0, wb = 0; const maps = [];
  while (wa < need && wb < need) {
    const sa = A.str + rand(-4, 4), sb = B.str + rand(-4, 4);
    const aWin = Math.random() < 1 / (1 + Math.pow(10, -(sa - sb) / 9));
    aWin ? wa++ : wb++;
    if (g.rounds) { const lose = randi(Math.round(g.rounds * 0.2), g.rounds - 2); maps.push(aWin ? `${g.rounds}-${lose}` : `${lose}-${g.rounds}`); }
  }
  const winner = wa > wb ? a : b, loser = winner === a ? b : a;
  const wl = winner === a ? A.lineup : B.lineup;
  afterResult(wl, true); afterResult(winner === a ? B.lineup : A.lineup, false);
  const mvp = wl.slice().sort((x, y) => effRating(y) * rand(0.9, 1.1) - effRating(x) * rand(0.9, 1.1))[0];
  if (mvp) mvp.stats.mvp++;
  clubResult(winner, true); clubResult(loser, false);
  return { a, b, sa: wa, sb: wb, winner, loser, maps, mvp: mvp ? mvp.handle : null, bestOf };
}
// Battle royale : un lobby complet (les places restantes sont prises par des équipes de l'open)
function playLobby(L, entrants, nGames) {
  const g = GAMES[L.game];
  const [lo, hi] = TIER_RATING[L.tier - 1];
  const S0 = entrants.map(id => ({ id, ...teamStrength(id, L.game) }));
  const nOpen = Math.max(0, g.lobby - S0.length);
  const res = {}; entrants.forEach(id => res[id] = { places: [], kills: 0, pts: 0, top1: 0 });
  const gumbel = () => -6 * Math.log(-Math.log(Math.random()));
  for (let k = 0; k < nGames; k++) {
    const field = S0.map(e => ({ id: e.id, perf: e.str + gumbel() }))
      .concat(Array.from({ length: nOpen }, () => ({ id: null, perf: rand(lo - 6, hi - 2) + gumbel() })));
    field.sort((x, y) => y.perf - x.perf);
    const N = field.length, avg = field.reduce((s, f) => s + f.perf, 0) / N;
    field.forEach((f, i) => {
      if (!f.id) return;
      const place = i + 1;
      const kills = Math.max(0, Math.round(rand(0, g.size * 1.6) + (f.perf - avg) / 4));
      const pts = (place === 1 ? 25 : Math.round(18 * Math.pow(1 - (place - 1) / (N - 1), 2))) + kills;
      const r = res[f.id];
      r.places.push(place); r.kills += kills; r.pts += pts; if (place === 1) r.top1++;
    });
  }
  const ranked = entrants.slice().sort((x, y) => res[y].pts - res[x].pts);
  ranked.forEach((id, i) => {
    const good = i < ranked.length / 2;
    afterResult(S0.find(e => e.id === id).lineup, good);
    clubResult(id, good, 0.6);
  });
  const best = S0.flatMap(e => e.lineup).sort((x, y) => effRating(y) * rand(0.85, 1.15) - effRating(x) * rand(0.85, 1.15))[0];
  if (best) best.stats.mvp++;
  return { res, ranked, mvp: best ? best.handle : null, lobby: S0.length + nOpen, games: nGames };
}

// ---------- semaine ----------
function advanceWeek() {
  if (S.over) return;
  const u = user();
  const report = { matches: [], lobbies: [], tournaments: [], income: {}, expenses: {}, events: [] };
  const w = S.week, R = REGULAR_WEEKS;
  // gains : le club du joueur ne garde que la part prévue dans les contrats (le reste revient aux joueurs)
  const pay = (id, amount, game) => {
    if (id === u.id) { amount = Math.round(amount * clubKeep(game)); report.income.prize = (report.income.prize || 0) + amount; }
    S.clubs[id].budget += amount;
  };

  for (const L of Object.values(S.leagues)) {
    const g = GAMES[L.game], prize = tierPrize(L.game, L.tier), mine = L.teams.includes(u.id);
    const payL = (id, amount) => pay(id, amount, L.game);
    if (g.fmt === "br") {
      if (w <= R) {
        const lob = playLobby(L, L.teams.filter(id => S.clubs[id]), g.gamesPerWeek);
        for (const [id, r] of Object.entries(lob.res)) {
          const t = L.table[id] || (L.table[id] = emptyRow("br"));
          t.pts += r.pts; t.kills += r.kills; t.top1 += r.top1; t.games += r.places.length; t.place += r.places.reduce((a, b) => a + b, 0);
        }
        lob.ranked.slice(0, 3).forEach((id, i) => payL(id, prize * [0.02, 0.01, 0.005][i]));
        L.results.push({ week: w, top: lob.ranked.slice(0, 3), pts: lob.ranked.slice(0, 3).map(id => lob.res[id].pts), mvp: lob.mvp });
        if (mine) report.lobbies.push({ game: L.game, tier: L.tier, ...lob, stage: "Journée " + w, mine: lob.res[u.id], rank: lob.ranked.indexOf(u.id) + 1 });
      } else {
        // Grande finale sur 2 semaines : les 8 meilleurs du classement
        if (w === R + 1) L.playoffs = { finalists: standings(L.key).slice(0, 8).map(x => x.id), pts: {}, top1: {} };
        const P = L.playoffs;
        const lob = playLobby(L, P.finalists.filter(id => S.clubs[id]), g.gamesPerWeek + 2);
        for (const [id, r] of Object.entries(lob.res)) { P.pts[id] = (P.pts[id] || 0) + r.pts; P.top1[id] = (P.top1[id] || 0) + r.top1; }
        if (P.finalists.includes(u.id)) report.lobbies.push({ game: L.game, tier: L.tier, ...lob, stage: "Grande finale — jour " + (w - R), mine: lob.res[u.id], rank: lob.ranked.indexOf(u.id) + 1 });
        if (w === R + 2) {
          const order = P.finalists.filter(id => S.clubs[id]).sort((a, b) => (P.pts[b] || 0) - (P.pts[a] || 0));
          P.order = order; L.champion = order[0];
          [0.4, 0.2, 0.1, 0.1].forEach((part, i) => order[i] && payL(order[i], prize * part));
          crown(L, order[0], order[1], `${P.pts[order[0]]} pts sur la finale`);
        }
      }
      continue;
    }
    if (w <= L.schedule.length) {
      for (const [a, b] of L.schedule[w - 1]) {
        if (!S.clubs[a] || !S.clubs[b]) continue;
        const r = playSeries(L.game, a, b, 3);
        r.week = w; r.stage = "Saison régulière";
        L.results.push(r);
        const ta = L.table[a] || (L.table[a] = emptyRow(g.fmt)), tb = L.table[b] || (L.table[b] = emptyRow(g.fmt));
        ta.mw += r.sa; ta.ml += r.sb; tb.mw += r.sb; tb.ml += r.sa;
        r.winner === a ? (ta.w++, tb.l++) : (tb.w++, ta.l++);
        payL(r.winner, prize * 0.005);
        if (a === u.id || b === u.id) report.matches.push({ ...r, game: L.game, tier: L.tier });
      }
    } else if (w === R + 1) {
      const st = standings(L.key).slice(0, 4).map(x => x.id);
      if (st.length < 4) continue;
      L.playoffs = { semis: [playSeries(L.game, st[0], st[3], 3), playSeries(L.game, st[1], st[2], 3)], final: null };
      L.playoffs.semis.forEach(r => { r.stage = "Demi-finale"; r.week = w; if (r.a === u.id || r.b === u.id) report.matches.push({ ...r, game: L.game, tier: L.tier }); });
    } else if (w === R + 2 && L.playoffs) {
      const [s1, s2] = L.playoffs.semis;
      const f = playSeries(L.game, s1.winner, s2.winner, 5);
      f.stage = "Grande finale"; f.week = w;
      L.playoffs.final = f; L.champion = f.winner;
      if (f.a === u.id || f.b === u.id) report.matches.push({ ...f, game: L.game, tier: L.tier });
      payL(f.winner, prize * 0.4); payL(f.loser, prize * 0.2); payL(s1.loser, prize * 0.1); payL(s2.loser, prize * 0.1);
      crown(L, f.winner, f.loser, `${f.sa}-${f.sb} · MVP ${f.mvp}`);
    }
  }

  runTournaments(w, report, pay);
  if (w === EWC_LAST_WEEK) awardEwcClubChampionship(report);

  // primes de victoire prévues dans les contrats
  let winBonuses = 0;
  for (const r of report.matches) if (r.winner === u.id) winBonuses += clubPlayers(u.id, r.game).filter(p => p.starter).reduce((t, p) => t + (p.winBonus || 0), 0);
  if (winBonuses) report.expenses.bonuses = winBonuses;
  weeklyContractEffects();

  // économie du club joueur
  const fac = u.facilities;
  const sponsors = Math.round(300 + 3.6 * u.fame * u.fame + Object.values(u.divisions).reduce((s, d) => s + TIER_SPONSOR[d.tier - 1], 0) * (0.5 + u.fame / 100))
    + u.sponsorDeals.reduce((s, d) => s + d.weekly, 0);
  const merch = Math.round(u.fans * (0.012 + fac.content * 0.003));
  const salaries = allUserPlayers().reduce((s, p) => s + p.salary, 0);
  const opCost = Object.entries(u.divisions).reduce((s, [gm, d]) => s + TIER_OP[d.tier - 1] * GAMES[gm].size * GAMES[gm].mult, 0);
  const upkeep = Object.values(fac).reduce((s, l) => s + l * 800, 0);
  report.income.sponsors = sponsors; report.income.merch = merch;
  report.expenses.salaries = salaries; report.expenses.operations = Math.round(opCost); report.expenses.facilities = upkeep;
  const inc = Object.values(report.income).reduce((a, b) => a + b, 0);
  const exp = Object.values(report.expenses).reduce((a, b) => a + b, 0);
  u.budget += sponsors + merch - salaries - opCost - upkeep - winBonuses;
  u.fans = Math.round(u.fans * (1 + fac.content * 0.0015) + fac.content * 20);
  u.sponsorDeals = u.sponsorDeals.filter(d => --d.weeks > 0);
  S.finance.push({ label: `S${S.season % 100}-W${w}`, inc: Math.round(inc), exp: Math.round(exp), budget: Math.round(u.budget) });
  if (S.finance.length > 60) S.finance.shift();

  // entraînement, forme, moral
  for (const p of Object.values(S.players)) {
    const c = p.club && S.clubs[p.club];
    if (!c) continue;
    if (p.rating < p.pot && Math.random() < 0.06 + c.facilities.coaching * 0.025 + (p.age <= 21 ? 0.05 : 0)) p.rating++;
    p.form = clamp(p.form + (65 - p.form) * 0.08 + rand(-3, 3) + c.facilities.house * 0.3, 20, 100);
    let dm = (70 - p.morale) * 0.05 + c.facilities.house * 0.3;
    if (!p.starter && p.rating >= 80) dm -= 2;
    p.morale = clamp(p.morale + dm + rand(-2, 2), 5, 100);
  }

  if (u.budget < 0) {
    S.board.confidence = clamp(S.board.confidence - 6, 0, 100);
    if (w % 2) mail("⚠️ Budget dans le rouge", `Le budget est négatif (${money(u.budget)}). Le conseil s'inquiète. Vendez des joueurs ou réduisez la masse salariale.`, "board");
  }
  if (w === R) {
    const exp = allUserPlayers().filter(p => p.years <= 1);
    if (exp.length) mail("⏳ Contrats en fin de saison", `Ces joueurs partiront à la fin de la saison si vous ne les prolongez pas : <b>${exp.map(p => p.handle).join(", ")}</b>.`, "transfer");
  }
  if (Math.random() < 0.3) { const ev = randomEvent(); if (ev) report.events.push(ev); }
  aiMarket();

  report.week = w; report.season = S.season;
  S.lastWeek = report;
  if (w === R + 2) report.seasonEnd = endSeason();
  else S.week++;

  if (S.board.confidence <= 0 || u.budget < -Math.max(150000, u.fame * 20000)) {
    S.over = true;
    mail("❌ Licencié", `Le conseil d'administration a perdu confiance. ${S.ceo} est démis de ses fonctions de CEO de ${u.name}.`, "board");
  }
  save();
  return report;
}
function crown(L, winner, runnerUp, detail) {
  const champ = S.clubs[winner], label = `${leagueName(L)} ${S.season}`;
  champ.fame = clamp(champ.fame + [5, 2.5, 1][L.tier - 1], 0, 100); champ.fans = Math.round(champ.fans * [1.08, 1.05, 1.03][L.tier - 1]);
  champ.titles.push(label);
  S.titles.push({ season: S.season, game: L.game, tier: L.tier, club: champ.solo ? soloName(champ, L.game) : champ.name, clubId: champ.id });
  if (winner === S.userId) mail(`🏆 CHAMPIONS ! ${label}`, `${user().name} remporte le <b>${label}</b> (${tierLabel(L.game, L.tier)}) face à ${S.clubs[runnerUp] ? S.clubs[runnerUp].name : "?"} — ${detail}.`, "trophy");
}
// ---------- tournois à cashprize ----------
const EWC_LAST_WEEK = 10;
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
    for (let w = 1; w <= REGULAR_WEEKS; w += (E.every3 || 2)) out.push([name(E.t3), w, prize(E.p3), g.fmt === "team" ? "23" : "3", br ? g.lobby : 16, game]);
    for (let w = 2; w <= REGULAR_WEEKS; w += (E.every2 || 4)) out.push([name(E.t2), w, prize(E.p2), "2", br ? g.lobby : 8, game]);
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
    S.clubs[x.id].budget += prize; x.prize = prize;
    if (x.id === u.id) report.income.ewc = prize;
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
function tournamentPool(game, tiers) {
  const ids = GAMES[game].open ? S.leagues[lkey(game, 1)].teams : [...tiers].flatMap(t => S.leagues[lkey(game, +t)].teams);
  return ids.filter(id => S.clubs[id] && divOf(id, game) && tiers.includes(String(S.clubs[id].divisions[game].tier)));
}
// le club du joueur participe-t-il ? (open : dès qu'il est dans un tier admis ; invitation : s'il fait partie des mieux classés)
function tournamentField(game, tiers, size) {
  const g = GAMES[game], u = user();
  // invitations : les mieux classés ; opens avec le tier 3 : inscriptions libres, donc un plateau tiré au hasard
  const ranked = tournamentPool(game, tiers).map(id => ({ id, s: teamStrength(id, game).str + S.clubs[id].fame * 0.05 })).sort((a, b) => b.s - a.s).map(x => x.id);
  const pool = tiers.includes("3") ? shuffle(ranked) : ranked;
  let n = Math.min(size, pool.length);
  if (g.fmt !== "br") n = n >= 2 ? 2 ** Math.floor(Math.log2(n)) : 0;
  const field = pool.slice(0, n);
  if (tiers !== "1" && n > 1 && pool.includes(u.id) && !field.includes(u.id)) field[n - 1] = u.id;
  return field;
}
function runTournaments(w, report, pay) {
  const u = user();
  S.tourResults = S.tourResults || [];
  for (const game of Object.keys(GAMES)) for (const [name, week, prize, tiers, size] of allTournaments(game)) {
    if (week !== w) continue;
    const g = GAMES[game], field = tournamentField(game, tiers, size);
    if (field.length < 2) continue;
    let order;
    if (g.fmt === "br") {
      const lob = playLobby({ game, tier: Math.max(...[...tiers].map(Number)) }, field, 6);
      order = lob.ranked;
      if (field.includes(u.id)) report.lobbies.push({ game, tier: u.divisions[game].tier, ...lob, stage: name, mine: lob.res[u.id], rank: lob.ranked.indexOf(u.id) + 1 });
    } else {
      // élimination directe : 1er contre dernier, BO3 puis finale en BO5
      let round = field.slice();
      const out = [];
      while (round.length > 1) {
        const next = [], losers = [];
        for (let i = 0; i < round.length / 2; i++) {
          const a = round[i], b = round[round.length - 1 - i];
          const r = playSeries(game, a, b, round.length === 2 ? 5 : 3);
          next.push(r.winner); losers.push(r.loser);
          if (a === u.id || b === u.id) report.matches.push({ ...r, game, tier: u.divisions[game].tier, stage: `${name} — ${ROUND_NAME[round.length] || "Tour"}` });
        }
        out.unshift(losers);
        round = next;
      }
      order = round.concat(out.flat());
    }
    // les clubs IA gardent la moitié des gains ; le vôtre garde ce que prévoient les contrats
    order.forEach((id, i) => { const amt = prize * (PLACE_SHARE[i] || 0); pay(id, Math.round(id === u.id ? amt : amt * CLUB_SHARE), game); });
    const champ = S.clubs[order[0]];
    champ.fame = clamp(champ.fame + (prize >= 1e6 ? 4 : prize >= 1e5 ? 2 : 0.5), 0, 100);
    champ.fans = Math.round(champ.fans * (prize >= 1e6 ? 1.05 : 1.01));
    champ.titles.push(`${name} ${S.season}`);
    S.titles.push({ season: S.season, game, tier: 0, name, club: champ.solo ? soloName(champ, game) : champ.name, clubId: champ.id });
    if (name.startsWith("EWC")) ewcPoints(order, game);
    const mine = order.indexOf(u.id) + 1;
    S.tourResults.push({ season: S.season, week: w, game, name, prize, n: field.length, top: order.slice(0, 4), mine: mine || null });
    if (mine) {
      const won = Math.round(prize * (PLACE_SHARE[mine - 1] || 0) * clubKeep(game));
      report.tournaments.push({ game, name, place: mine, n: field.length, prize: won, winner: order[0] });
      if (mine === 1) mail(`🏆 ${name} remporté !`, `${u.name} remporte le <b>${name} ${S.season}</b> (${GAMES[game].name}) et empoche ${money(won)}.`, "trophy");
    }
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

function endSeason() {
  const u = user();
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
      // circuit ouvert : le statut de chaque club suit son classement de la saison
      const [a, b] = GAMES[game].tierSizes;
      finalOrder(S.leagues[lkey(game, 1)]).forEach((id, i) => {
        const d = S.clubs[id] && S.clubs[id].divisions[game]; if (!d) return;
        const nt = i < a ? 1 : i < a + b ? 2 : 3;
        if (id === u.id && nt !== d.tier) moves.push(`${nt < d.tier ? "⬆️" : "⬇️"} ${GAMES[game].short} : ${i + 1}e du circuit, statut ${tierLabel(game, nt)}${nt < d.tier ? " !" : ""}`);
        d.tier = nt;
      });
      continue;
    }
    for (let t = 1; t <= 2; t++) {
      const up = S.leagues[lkey(game, t)], low = S.leagues[lkey(game, t + 1)];
      const down = finalOrder(up).slice(-2), promo = finalOrder(low).slice(0, 2);
      for (const id of down) {
        up.teams = up.teams.filter(x => x !== id); low.teams.push(id); S.clubs[id].divisions[game].tier = t + 1;
        if (id === u.id) moves.push(`⬇️ ${GAMES[game].short} : relégation en ${TIER_LABEL[t]}`);
      }
      for (const id of promo) {
        if (down.includes(id)) continue;
        low.teams = low.teams.filter(x => x !== id); up.teams.push(id); S.clubs[id].divisions[game].tier = t;
        if (id === u.id) moves.push(`⬆️ ${GAMES[game].short} : MONTÉE en ${TIER_LABEL[t - 1]} !`);
      }
    }
  }
  mail(`Bilan de la saison ${S.season}`,
    `${lines.join("<br>") || "Aucune division."}<br>${moves.length ? "<br>" + moves.join("<br>") + "<br>" : ""}<br>
     Objectif (${objectiveText(o)}) : ${ok ? "<b style='color:var(--ok)'>atteint ✅</b>" : "<b style='color:var(--bad)'>manqué ❌</b>"}<br>
     Confiance du conseil : <b>${Math.round(S.board.confidence)}%</b>`, "board");

  // contrats, âge, retraites
  const leaving = [];
  for (const p of Object.values(S.players)) {
    p.age++;
    if (p.age >= 28 && Math.random() < 0.5) p.rating = Math.max(45, p.rating - randi(0, p.age >= 31 ? 3 : 1));
    if (p.age <= 23 && p.pot > p.rating) p.rating = Math.min(p.pot, p.rating + randi(0, 2));
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
  if (leaving.length) mail("Fins de contrat", `Ont quitté le club (contrat expiré) : <b>${leaving.join(", ")}</b>.`, "transfer");

  // nouveaux talents
  for (const gm of Object.keys(GAMES)) {
    for (let i = 0; i < GAMES[gm].size * 3; i++) { const p = genPlayer(gm, 52, 72, 16, 19); p.years = 0; p.pot = clamp(p.rating + randi(5, 18), 0, 96); addPlayer(p); }
  }
  if (u.facilities.academy > 0 && Object.keys(u.divisions).length) {
    const gm = pick(Object.keys(u.divisions));
    const p = genPlayer(gm, 58 + u.facilities.academy * 3, 66 + u.facilities.academy * 3, 16, 17);
    p.pot = clamp(p.rating + randi(10, 20), 0, 97); p.years = 0; addPlayer(p);
    joinClub(p, u, 300, 3);
    mail("🎓 Pépite de l'académie", `${flag(p.nat)} <b>${p.handle}</b> (${p.age} ans, ${GAMES[gm].short}, note ${p.rating}) sort de votre académie et signe son premier contrat pro.`, "info");
  }
  for (const c of Object.values(S.clubs)) if (c.ai) for (const gm of Object.keys(c.divisions)) aiFillRoster(c.id, gm);
  // la notoriété tend vers le niveau de la meilleure division du club
  for (const c of Object.values(S.clubs)) {
    const ts = Object.values(c.divisions).map(d => d.tier);
    if (!ts.length) continue;
    c.fame = clamp(c.fame + (TIER_FAME_TARGET[Math.min(...ts) - 1] - c.fame) * (c.ai ? 0.08 : 0.15), 1, 100);
  }
  S.tourResults = (S.tourResults || []).filter(t => t.season >= S.season - 1);
  S.season++;
  newSeasonSetup(false);
  return { ok, moves };
}

function aiMarket() {
  if (Math.random() > 0.35) return;
  const fas = shuffle(Object.values(S.players).filter(p => !p.club && p.rating >= 72));
  for (const p of fas.slice(0, 1)) {
    const cands = Object.values(S.clubs).filter(c => c.ai && !c.solo && c.divisions[p.game]);
    if (!cands.length) continue;
    const c = pick(cands);
    const worst = clubPlayers(c.id, p.game).sort((a, b) => a.rating - b.rating)[0];
    if (worst && worst.rating < p.rating - 2) {
      removeFromClub(worst); worst.years = 0;
      joinClub(p, c, salaryDemand(p, c), randi(1, 3));
      news(`${flag(p.nat)} ${p.handle} signe chez ${c.name} (${GAMES[p.game].short}).`);
    }
  }
}

// ---------- événements ----------
const EVENTS = [
  () => ({ title: "Offre de sponsoring", sponsor: sponsorOffer() }),
  () => {
    const u = user(); const b = pick(["CryptoMoon", "BetZilla", "QuickCasino", "NFT Arena"]);
    const lump = Math.round((15000 + u.fame * 8000) / 1000) * 1000;
    return { title: `Sponsor controversé : ${b}`, body: `<b>${b}</b> offre ${money(lump)} immédiatement pour apparaître sur vos maillots. Les fans risquent de mal le prendre.`,
      choices: [{ label: "Accepter 💰", fx: () => { u.budget += lump; u.fans = Math.round(u.fans * 0.94); u.fame = Math.max(1, u.fame - 2); return `+${money(lump)}, mais les fans grondent (-6 % de fans).`; } },
                { label: "Refuser", fx: () => { u.fame = Math.min(100, u.fame + 0.5); return "Les fans saluent votre intégrité."; } }] };
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
    return { title: `Polémique : ${p.handle}`, body: `Un clip de <b>${p.handle}</b> tenant des propos déplacés en stream circule sur les réseaux.`,
      choices: [{ label: "Suspendre 2 sem.", fx: () => { p.morale = clamp(p.morale - 20, 0, 100); p.form = clamp(p.form - 20, 0, 100); u.fame = Math.min(100, u.fame + 1); return "Sanction saluée par la communauté."; } },
                { label: "Le défendre", fx: () => { u.fans = Math.round(u.fans * 0.95); u.fame = Math.max(1, u.fame - 3); p.morale = clamp(p.morale + 10, 0, 100); return "La polémique enfle (-3 notoriété)."; } }] };
  },
  () => {
    const u = user(); if (!Object.keys(u.divisions).length) return null;
    const big = u.fame >= 40;
    const cost = Math.round(((big ? 20000 : 2000) + Object.keys(u.divisions).length * (big ? 15000 : 1500)) / 500) * 500;
    return { title: big ? "Bootcamp à Séoul" : "Bootcamp LAN le week-end", body: `Un bootcamp intensif est disponible pour ${money(cost)}. Forme de tous les joueurs boostée.`,
      choices: [{ label: "Réserver ✈️", fx: () => { if (u.budget < cost) return "Budget insuffisant."; u.budget -= cost; allUserPlayers().forEach(p => p.form = clamp(p.form + 18, 0, 100)); return "Les joueurs reviennent affûtés !"; } },
                { label: "Non merci", fx: () => "Bootcamp annulé." }] };
  },
  () => {
    const u = user();
    const s = u.fame < 30 ? pick(["un petit streamer Twitch (2 000 viewers)", "un TikTokeur gaming local", "un YouTubeur FIFA de 50 k abonnés"])
      : pick(["Gotaga", "Kameto", "Squeezie", "Ibai", "xQc", "Pokimane", "TheGrefg", "Domingo", "Zerator", "Locklear", "Ninja", "Shroud"]);
    const cost = Math.round((u.fame < 30 ? 3000 + u.fame * 300 : 80000 + u.fame * 3000) / 500) * 500;
    return { title: `Un créateur veut rejoindre le club`, body: `<b>${s}</b> propose de devenir ambassadeur du club pour ${money(cost)} par saison.`,
      choices: [{ label: "Signer 🎙️", fx: () => { if (u.budget < cost) return "Budget insuffisant."; u.budget -= cost; u.fans = Math.round(u.fans * 1.15 + (u.fame < 30 ? 600 : 5000)); u.fame = Math.min(100, u.fame + (u.fame < 30 ? 1.5 : 3)); return `Accord signé ! Fans +15 %.`; } },
                { label: "Décliner", fx: () => "Peut-être une autre fois." }] };
  },
  () => {
    const u = user(); const gain = Math.round(u.fans * 0.07 + 150);
    return { title: "Clip viral 🔥", body: `Une action de votre équipe fait le tour d'Internet : +${gain.toLocaleString("fr-FR")} fans !`, auto: () => { u.fans += gain; } };
  },
  () => {
    const u = user(); const amount = Math.round((50000 + u.fame * 15000) / 5000) * 5000;
    return { title: "Investisseur intéressé", body: `Un business angel propose d'injecter ${money(amount)} contre 10 % des parts du club. Le conseil exigera plus de résultats.`,
      choices: [{ label: "Accepter", fx: () => { u.budget += amount; S.board.confidence = clamp(S.board.confidence - 10, 0, 100); return `+${money(amount)} dans les caisses.`; } },
                { label: "Refuser", fx: () => { S.board.confidence = clamp(S.board.confidence + 3, 0, 100); return "Le conseil apprécie votre indépendance."; } }] };
  },
];
function randomUserPlayer() { const ps = allUserPlayers(); return ps.length ? pick(ps) : null; }
function randomEvent() {
  const ev = pick(EVENTS)();
  if (!ev) return null;
  if (ev.auto) { ev.auto(); mail(ev.title, ev.body, "event"); return null; }
  return ev;
}

// ---------- sponsors : offres et négociation ----------
const BRANDS_SMALL = ["Le Kebab du Coin", "Garage Auto Martin", "Boulangerie du Centre", "PC Shop Local", "Cybercafé Pixel", "Salle de sport FitZone", "Pizzeria Napoli", "Imprimerie Express"];
const BRANDS_MID = ["LDLC", "Materiel.net", "Konix", "Glorious", "Cooler Master", "NZXT", "Fnac", "Boulanger", "Uber Eats", "Deliveroo"];
const BRANDS_BIG = ["HyperX", "Red Bull", "Logitech G", "Monster Energy", "Secretlab", "Razer", "Alienware", "Intel", "Corsair", "Mercedes-Benz", "BMW", "Orange", "Lacoste", "Puma", "Adidas", "Coca-Cola", "Samsung"];
const round50 = v => Math.round(v / 50) * 50;
function sponsorOffer() {
  const u = user();
  const brand = pick(u.fame >= 55 ? BRANDS_BIG : u.fame >= 25 ? BRANDS_MID : BRANDS_SMALL);
  const tierBonus = Object.values(u.divisions).reduce((s, d) => s + [3000, 600, 80][d.tier - 1], 0);
  const weekly = round50(200 + u.fame * u.fame * rand(1.5, 3) + tierBonus * rand(0.5, 1));
  // plafond secret de la marque : plus le club a de fans, plus elle est prête à payer
  const max = weekly * rand(1.1, 1.45) * (1 + Math.min(0.3, u.fans / 3e6));
  return { brand, weekly, weeks: randi(10, 26), max, patience: randi(2, 4), round: 0, history: [] };
}
// ask : montant hebdo demandé ; weeks : durée demandée. Un contrat plus long fait baisser le plafond hebdo de la marque.
function negotiateSponsor(o, ask, weeks) {
  const lim = o.max * (1 - (weeks - o.weeks) * 0.006);
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
  const u = user();
  u.sponsorDeals.push({ name: o.brand, weekly, weeks });
  mail(`Sponsor signé : ${o.brand}`, `<b>${o.brand}</b> devient partenaire du club : ${money(weekly)}/semaine pendant ${weeks} semaines (${money(weekly * weeks)} au total).`, "info");
}
// démarchage actif : une tentative par semaine, la réussite dépend de la notoriété
function prospectSponsor() {
  const key = S.season + "-" + S.week;
  if (S.prospect === key) return { error: "Vous avez déjà démarché des marques cette semaine." };
  S.prospect = key;
  if (Math.random() > 0.35 + user().fame / 150) return { error: "Aucune marque n'a donné suite cette semaine. Réessayez la semaine prochaine." };
  return { offer: sponsorOffer() };
}

// ---------- installations ----------
function facilityCost(lvl) { return 25000 * (lvl + 1) * (lvl + 1); }
function upgradeFacility(key) {
  const u = user(), lvl = u.facilities[key];
  if (lvl >= MAX_FAC) return "Niveau maximum atteint.";
  const cost = facilityCost(lvl);
  if (u.budget < cost) return "Budget insuffisant.";
  u.budget -= cost; u.facilities[key]++;
  mail(`Installation améliorée`, `${FACILITIES[key].icon} ${FACILITIES[key].name} → niveau ${u.facilities[key]} (${money(cost)}).`, "info");
  return null;
}

// ---------- messagerie ----------
function mail(title, body, type = "info") {
  S.inbox.unshift({ id: uid("m"), season: S.season, week: S.week, title, body, type, read: false });
  if (S.inbox.length > 150) S.inbox.pop();
}
function news(text) { mail("📰 " + text, text, "news"); }

// ---------- sauvegarde ----------
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* stockage indisponible */ } }
function load() { try { const s = localStorage.getItem(SAVE_KEY); if (s) { S = JSON.parse(s); return true; } } catch (e) { } return false; }
// empreinte de la base de données : une partie créée avant une mise à jour des effectifs garde l'ancien monde
function dataVersion() {
  const txt = JSON.stringify([ORGS, ROSTERS, SOLOS, typeof EXTRA_DIVS !== "undefined" ? EXTRA_DIVS : 0]);
  let h = 0; for (let i = 0; i < txt.length; i++) h = (h * 31 + txt.charCodeAt(i)) | 0;
  return h;
}
function saveIsOutdated() {
  try { const s = localStorage.getItem(SAVE_KEY); return !!s && JSON.parse(s).dataVersion !== dataVersion(); } catch (e) { return false; }
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function wipeSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } }
