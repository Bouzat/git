// =====================================================================
//  ESPORTS MANAGER — Moteur de simulation (état, matchs, économie)
// =====================================================================

const SAVE_KEY = "esports-manager-save-v1";
const FACILITIES = {
  house:     { name: "Gaming House",        icon: "🏠", desc: "Moral et forme des joueurs." },
  coaching:  { name: "Staff de coaching",   icon: "🧠", desc: "Bonus de performance en match + progression." },
  analytics: { name: "Cellule d'analyse",   icon: "📊", desc: "Bonus de performance en match." },
  content:   { name: "Studio de contenu",   icon: "🎥", desc: "Croissance des fans et revenus merch/stream." },
  academy:   { name: "Académie",            icon: "🎓", desc: "Révèle des jeunes talents chaque saison." },
};
const MAX_FAC = 5;

let S = null; // état global

// ---------- utilitaires ----------
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uid = (() => { let n = 0; return p => p + "_" + Date.now().toString(36) + "_" + (n++).toString(36); })();

function flag(cc) {
  if (!cc || cc.length !== 2) return "🏳️";
  return String.fromCodePoint(...[...cc.toUpperCase()].map(c => 127397 + c.charCodeAt(0)));
}
function money(n) {
  const neg = n < 0; n = Math.abs(n);
  let s;
  if (n >= 1e6) s = (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(".", ",") + " M€";
  else if (n >= 1e3) s = Math.round(n / 1e3) + " k€";
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

// ---------- joueurs ----------
function playerValue(p) {
  const g = GAMES[p.game];
  const af = p.age <= 20 ? 1.3 : p.age <= 24 ? 1.15 : p.age <= 28 ? 1 : p.age <= 31 ? 0.7 : 0.45;
  const potBonus = 1 + Math.max(0, p.pot - p.rating) * 0.02;
  return Math.max(5000, Math.round(25000 * Math.pow(1.13, p.rating - 60) * af * g.mult * potBonus / 1000) * 1000);
}
function salaryDemand(p, club) {
  const base = playerValue(p) * 0.011;
  // les petits clubs doivent payer plus cher pour attirer les stars
  const prestige = club ? 1 + Math.max(0, p.rating - 50 - club.fame) / 100 : 1;
  return Math.max(300, Math.round(base * prestige / 100) * 100);
}
function makePlayer(handle, nat, rating, age, game, roleIdx, club) {
  const g = GAMES[game];
  const p = {
    id: uid("p"), handle, nat, game, rating, age,
    role: g.roles[roleIdx % g.roles.length],
    pot: clamp(rating + (age <= 20 ? randi(3, 10) : age <= 23 ? randi(1, 6) : age <= 26 ? randi(0, 2) : 0), rating, 99),
    form: randi(55, 80), morale: randi(60, 85), club: club || null,
    salary: 0, years: randi(1, 3), starter: false, stats: { w: 0, l: 0, mvp: 0 },
  };
  p.salary = Math.round(salaryDemand(p) * rand(0.85, 1.1) / 100) * 100;
  return p;
}
function genPlayer(game, minR, maxR, ageMin = 17, ageMax = 28, club = null, roleIdx = null) {
  const g = GAMES[game];
  const nats = Object.keys(COUNTRIES);
  const age = randi(ageMin, ageMax);
  return makePlayer(genHandle(), pick(nats), randi(minR, maxR), age, game, roleIdx ?? randi(0, g.roles.length - 1), club);
}

// ---------- création du monde ----------
function newWorld(opts) {
  S = {
    version: 1, ceo: opts.ceo, mode: opts.mode, season: 2026, week: 1, over: false,
    clubs: {}, players: {}, leagues: {}, inbox: [], finance: [], titles: [],
    userId: null, board: { confidence: 60, objective: "" }, lastWeek: null,
  };
  // clubs réels
  for (const c of CLUBS) {
    const club = baseClub(c.id, c.name, c.tag, c.country, c.color, c.fame, true);
    for (const [game, list] of Object.entries(c.rosters)) {
      club.divisions[game] = [];
      list.forEach(([h, n, r, a], i) => {
        const p = makePlayer(h, n, r, a, game, i, club.id);
        p.starter = true; addPlayer(p); club.divisions[game].push(p.id);
      });
      // un remplaçant généré
      const sub = genPlayer(game, 66, 76, 17, 24, club.id);
      addPlayer(sub); club.divisions[game].push(sub.id);
    }
    S.clubs[club.id] = club;
  }
  // agents libres réels
  for (const [game, list] of Object.entries(FREE_AGENTS)) {
    list.forEach(([h, n, r, a], i) => {
      const p = makePlayer(h, n, r, a, game, i);
      p.years = 0; addPlayer(p);
    });
  }
  // agents libres générés pour tous les jeux
  for (const game of Object.keys(GAMES)) {
    const n = GAMES[game].size * 6 + 6;
    for (let i = 0; i < n; i++) { const p = genPlayer(game, 55, 80, 16, 30); p.years = 0; addPlayer(p); }
  }
  // club du joueur
  if (opts.mode === "create") {
    const c = baseClub("user", opts.name, opts.tag, opts.country, opts.color, 8, false);
    c.budget = 2000000; c.fans = 2500;
    S.clubs.user = c; S.userId = "user";
  } else {
    S.userId = opts.clubId; S.clubs[opts.clubId].ai = false;
  }
  // circuits
  for (const game of Object.keys(GAMES)) buildLeague(game);
  if (opts.mode === "create" && opts.firstGame) openDivision(opts.firstGame, true);
  newSeasonSetup(true);
  const u = user();
  mail("Bienvenue, " + S.ceo + " !",
    opts.mode === "create"
      ? `Vous venez de fonder <b>${u.name}</b>. Le conseil d'administration vous confie un budget de départ de ${money(u.budget)}.<br>Recrutez des joueurs dans le <b>Mercato</b>, ouvrez des divisions dans l'onglet <b>Effectif</b> et cliquez sur <b>Semaine suivante</b> pour jouer.`
      : `Vous êtes le nouveau CEO de <b>${u.name}</b>. Les attentes sont élevées : ${S.board.objective}.<br>Les supporters vous attendent au tournant !`, "info");
  save();
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
function addPlayer(p) { S.players[p.id] = p; }
const user = () => S.clubs[S.userId];
const clubPlayers = (clubId, game) => (S.clubs[clubId].divisions[game] || []).map(id => S.players[id]).filter(Boolean);

function buildLeague(game) {
  const teams = Object.values(S.clubs).filter(c => c.divisions[game] && c.id !== "user").map(c => c.id);
  // complète avec des clubs fictifs jusqu'à 8 équipes
  const fillers = FILLER_CLUBS.slice().sort(() => Math.random() - 0.5);
  let i = 0;
  while (teams.length < 8) {
    const [name, tag, color, cc] = fillers[i++];
    const id = "f_" + game + "_" + tag.toLowerCase();
    const fame = randi(30, 60);
    const c = baseClub(id, name, tag, cc, color, fame, true);
    c.filler = true;
    c.divisions[game] = [];
    const g = GAMES[game];
    const lo = 70 + Math.floor(fame / 12), hi = lo + 10;
    for (let r = 0; r < g.size + 1; r++) {
      const p = genPlayer(game, lo, hi, 17, 29, id, r);
      p.starter = r < g.size; addPlayer(p); c.divisions[game].push(p.id);
    }
    S.clubs[id] = c; teams.push(id);
  }
  S.leagues[game] = { game, teams, schedule: [], table: {}, results: [], playoffs: null, champion: null };
}

function roundRobin(teams, double) {
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
  if (double) return rounds.concat(rounds.map(rd => rd.map(([a, b]) => [b, a])));
  return rounds;
}

function newSeasonSetup(first) {
  for (const L of Object.values(S.leagues)) {
    L.teams = L.teams.filter(id => S.clubs[id] && S.clubs[id].divisions[L.game]);
    L.schedule = roundRobin(L.teams.slice().sort(() => Math.random() - 0.5), L.teams.length <= 8);
    L.table = {};
    L.teams.forEach(id => L.table[id] = { w: 0, l: 0, mw: 0, ml: 0 });
    L.results = []; L.playoffs = null; L.champion = null;
  }
  S.regularWeeks = Math.max(...Object.values(S.leagues).map(L => L.schedule.length));
  S.week = 1;
  // objectif du conseil
  const u = user();
  if (u.fame >= 92) S.board.objective = "remporter au moins un titre cette saison";
  else if (u.fame >= 80) S.board.objective = "atteindre la finale d'au moins un circuit";
  else if (u.fame >= 30) S.board.objective = "se qualifier pour les playoffs (top 4) d'au moins un circuit";
  else S.board.objective = "terminer la saison avec un budget positif et au moins une division active";
  if (!first) mail(`Saison ${S.season} : objectif du conseil`, `Le conseil d'administration fixe l'objectif : <b>${S.board.objective}</b>.`, "board");
}

// ---------- divisions ----------
function openDivision(game, free) {
  const u = user(), g = GAMES[game];
  if (u.divisions[game]) return "Division déjà ouverte.";
  if (!free && u.budget < g.entry) return "Budget insuffisant.";
  if (!free) u.budget -= g.entry;
  u.divisions[game] = [];
  const L = S.leagues[game];
  // le club remplace un club fictif (ou s'ajoute)
  const fi = L.teams.findIndex(id => S.clubs[id].filler);
  if (fi >= 0) {
    const fid = L.teams[fi], fc = S.clubs[fid];
    for (const pid of fc.divisions[game]) { const p = S.players[pid]; p.club = null; p.starter = false; p.years = 0; }
    delete S.clubs[fid];
    L.teams[fi] = u.id;
  } else L.teams.push(u.id);
  if (L.table && !L.table[u.id]) L.table[u.id] = { w: 0, l: 0, mw: 0, ml: 0 };
  // si la saison est en cours, remplace le club fictif dans le calendrier
  if (fi >= 0 && L.schedule.length) {
    const fid = Object.keys(L.table).find(id => !S.clubs[id] && id !== u.id);
    for (const rd of L.schedule) for (const m of rd) for (let k = 0; k < 2; k++) if (!S.clubs[m[k]]) m[k] = u.id;
    if (fid) { L.table[u.id] = L.table[fid]; delete L.table[fid]; }
  }
  if (!free) mail(`Nouvelle division : ${g.name}`, `Votre club rejoint le <b>${g.league}</b> (frais d'entrée : ${money(g.entry)}). Il vous faut ${g.size} joueur(s) titulaire(s).`, "info");
  return null;
}
function closeDivision(game) {
  const u = user();
  for (const p of clubPlayers(u.id, game)) releasePlayer(p.id, true);
  delete u.divisions[game];
  const L = S.leagues[game];
  // un club fictif reprend la place
  const tag = "R" + randi(10, 99);
  const id = "f_" + game + "_" + tag.toLowerCase() + randi(0, 999);
  const c = baseClub(id, pick(FILLER_CLUBS)[0] + " Academy", tag, "FR", "#888", 35, true);
  c.filler = true; c.divisions[game] = [];
  for (let r = 0; r < GAMES[game].size + 1; r++) {
    const p = genPlayer(game, 70, 78, 17, 26, id, r); p.starter = r < GAMES[game].size; addPlayer(p); c.divisions[game].push(p.id);
  }
  S.clubs[id] = c;
  const i = L.teams.indexOf(u.id); if (i >= 0) L.teams[i] = id;
  for (const rd of L.schedule) for (const m of rd) for (let k = 0; k < 2; k++) if (m[k] === u.id) m[k] = id;
  if (L.table[u.id]) { L.table[id] = L.table[u.id]; delete L.table[u.id]; }
  user().fame = Math.max(1, user().fame - 2);
}

// ---------- mercato ----------
function askingPrice(p) {
  if (!p.club) return 0;
  const c = S.clubs[p.club];
  return Math.round(playerValue(p) * (p.starter ? 1.6 : 1.2) * (0.8 + c.fame / 250) / 1000) * 1000;
}
function signFreeAgent(pid, salary, years) {
  const p = S.players[pid], u = user();
  if (p.club) return "Ce joueur n'est pas libre.";
  if (!u.divisions[p.game]) return `Ouvrez d'abord une division ${GAMES[p.game].name}.`;
  const demand = salaryDemand(p, u);
  if (salary < demand * 0.9) { p.morale = clamp(p.morale - 5, 0, 100); return `${p.handle} refuse : il demande au moins ${money(demand * 0.9)}/sem.`; }
  const bonus = Math.round(salary * 4); // prime à la signature
  if (u.budget < bonus) return "Budget insuffisant pour la prime de signature (" + money(bonus) + ").";
  u.budget -= bonus;
  joinClub(p, u, salary, years);
  mail(`Signature : ${p.handle}`, `${flag(p.nat)} <b>${p.handle}</b> (${GAMES[p.game].short}, ${p.rating}) rejoint ${u.name} pour ${years} an(s) à ${money(salary)}/sem. Prime de signature : ${money(bonus)}.`, "transfer");
  return null;
}
function makeOffer(pid, fee) {
  const p = S.players[pid], u = user();
  if (!p.club || p.club === u.id) return "Offre impossible.";
  if (!u.divisions[p.game]) return `Ouvrez d'abord une division ${GAMES[p.game].name}.`;
  if (u.budget < fee) return "Budget insuffisant.";
  const ask = askingPrice(p);
  const seller = S.clubs[p.club];
  if (fee < ask * rand(0.88, 1.08)) return `${seller.name} refuse votre offre de ${money(fee)}. (Prix estimé : ~${money(ask)})`;
  const salary = salaryDemand(p, u);
  u.budget -= fee; seller.budget += fee;
  removeFromClub(p);
  joinClub(p, u, salary, randi(2, 3));
  aiFillRoster(seller.id, p.game);
  mail(`Transfert : ${p.handle}`, `${flag(p.nat)} <b>${p.handle}</b> quitte ${seller.name} pour ${money(fee)}. Salaire : ${money(salary)}/sem.`, "transfer");
  u.fame = clamp(u.fame + Math.max(0, (p.rating - 80) * 0.15), 0, 100);
  return null;
}
function sellPlayer(pid) {
  const p = S.players[pid], u = user();
  const L = S.leagues[p.game];
  const buyers = L.teams.filter(id => id !== u.id && S.clubs[id]);
  const buyer = S.clubs[pick(buyers)];
  const fee = Math.round(playerValue(p) * rand(0.75, 1.1) / 1000) * 1000;
  removeFromClub(p);
  joinClub(p, buyer, salaryDemand(p, buyer), randi(1, 3));
  u.budget += fee;
  // l'acheteur se sépare de son pire joueur si l'effectif est trop large
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
  removeFromClub(p); p.years = 0;
  p.morale = 60;
  if (!silent) mail(`Libération : ${p.handle}`, `Le contrat de ${p.handle} est résilié. Indemnité versée : ${money(cost)}.`, "transfer");
  return cost;
}
function renewPlayer(pid, years) {
  const p = S.players[pid], u = user();
  const demand = Math.round(salaryDemand(p, u) * (p.morale < 40 ? 1.3 : 1.05) / 100) * 100;
  p.salary = demand; p.years = years; p.morale = clamp(p.morale + 10, 0, 100);
  mail(`Prolongation : ${p.handle}`, `${p.handle} prolonge de ${years} an(s) à ${money(demand)}/sem.`, "transfer");
}
function joinClub(p, club, salary, years) {
  p.club = club.id; p.salary = salary; p.years = years; p.starter = false;
  p.morale = clamp(p.morale + 15, 0, 100);
  club.divisions[p.game] = club.divisions[p.game] || [];
  club.divisions[p.game].push(p.id);
  if (club.ai) autoStarters(club.id, p.game);
  else {
    const starters = clubPlayers(club.id, p.game).filter(x => x.starter).length;
    if (starters < GAMES[p.game].size) p.starter = true;
  }
}
function removeFromClub(p) {
  const c = S.clubs[p.club];
  if (c && c.divisions[p.game]) c.divisions[p.game] = c.divisions[p.game].filter(id => id !== p.id);
  p.club = null; p.starter = false;
}
function autoStarters(clubId, game) {
  const ps = clubPlayers(clubId, game).sort((a, b) => effRating(b) - effRating(a));
  ps.forEach((p, i) => p.starter = i < GAMES[game].size);
}
function aiFillRoster(clubId, game) {
  const c = S.clubs[clubId], g = GAMES[game];
  if (!c || !c.divisions[game]) return;
  while (clubPlayers(clubId, game).length < g.size + 1) {
    const fa = Object.values(S.players).filter(p => !p.club && p.game === game && p.rating <= 60 + c.fame / 2.6)
      .sort((a, b) => b.rating - a.rating)[0];
    const p = fa || genPlayer(game, 66, 78, 17, 26);
    if (!fa) addPlayer(p);
    joinClub(p, c, salaryDemand(p, c), randi(1, 3));
  }
  autoStarters(clubId, game);
}
function toggleStarter(pid) {
  const p = S.players[pid];
  if (p.starter) { p.starter = false; return null; }
  const st = clubPlayers(p.club, p.game).filter(x => x.starter);
  if (st.length >= GAMES[p.game].size) return `Déjà ${GAMES[p.game].size} titulaire(s). Passez d'abord un joueur sur le banc.`;
  p.starter = true; return null;
}

// ---------- match ----------
function effRating(p) {
  return p.rating * (0.88 + 0.12 * p.form / 100) * (0.92 + 0.08 * p.morale / 100);
}
function teamStrength(clubId, game) {
  const c = S.clubs[clubId], g = GAMES[game];
  let ps = clubPlayers(clubId, game);
  let st = ps.filter(p => p.starter);
  if (st.length < g.size) st = st.concat(ps.filter(p => !p.starter).sort((a, b) => b.rating - a.rating)).slice(0, g.size);
  st = st.slice(0, g.size);
  let sum = st.reduce((s, p) => s + effRating(p), 0) + (g.size - st.length) * 35;
  const bonus = c.facilities.coaching * 0.6 + c.facilities.analytics * 0.4;
  return { str: sum / g.size + bonus, lineup: st };
}
function playSeries(game, a, b, bestOf) {
  const g = GAMES[game];
  const A = teamStrength(a, game), B = teamStrength(b, game);
  const need = Math.ceil(bestOf / 2);
  let wa = 0, wb = 0; const maps = [];
  while (wa < need && wb < need) {
    const sa = A.str + rand(-4, 4), sb = B.str + rand(-4, 4);
    const pa = 1 / (1 + Math.pow(10, -(sa - sb) / 9));
    const aWin = Math.random() < pa;
    aWin ? wa++ : wb++;
    if (g.rounds) {
      const lose = randi(Math.round(g.rounds * 0.2), g.rounds - 2);
      maps.push(aWin ? `${g.rounds}-${lose}` : `${lose}-${g.rounds}`);
    }
  }
  const winner = wa > wb ? a : b, loser = winner === a ? b : a;
  const wl = winner === a ? A.lineup : B.lineup, ll = winner === a ? B.lineup : A.lineup;
  // forme, moral, stats
  wl.forEach(p => { p.form = clamp(p.form + randi(1, 5), 0, 100); p.morale = clamp(p.morale + 2, 0, 100); p.stats.w++; });
  ll.forEach(p => { p.form = clamp(p.form - randi(1, 4), 0, 100); p.morale = clamp(p.morale - 2, 0, 100); p.stats.l++; });
  const mvp = wl.slice().sort((x, y) => effRating(y) * rand(0.9, 1.1) - effRating(x) * rand(0.9, 1.1))[0];
  if (mvp) mvp.stats.mvp++;
  for (const id of [winner, loser]) {
    const c = S.clubs[id];
    c.fame = clamp(c.fame + (id === winner ? 0.25 : -0.15), 1, 100);
    c.fans = Math.max(100, Math.round(c.fans * (id === winner ? 1.002 : 0.999) + (id === winner ? 60 : 0)));
  }
  return { a, b, sa: wa, sb: wb, winner, loser, maps, mvp: mvp ? mvp.handle : null, bestOf };
}

// ---------- semaine ----------
function advanceWeek() {
  if (S.over) return;
  const u = user();
  const report = { matches: [], income: {}, expenses: {}, events: [] };
  const w = S.week, R = S.regularWeeks;

  for (const L of Object.values(S.leagues)) {
    const g = GAMES[L.game];
    if (w <= L.schedule.length) {
      for (const [a, b] of L.schedule[w - 1]) {
        if (!S.clubs[a] || !S.clubs[b]) continue;
        const r = playSeries(L.game, a, b, 3);
        r.week = w; r.stage = "Saison régulière";
        L.results.push(r);
        const ta = L.table[a] || (L.table[a] = { w: 0, l: 0, mw: 0, ml: 0 });
        const tb = L.table[b] || (L.table[b] = { w: 0, l: 0, mw: 0, ml: 0 });
        ta.mw += r.sa; ta.ml += r.sb; tb.mw += r.sb; tb.ml += r.sa;
        r.winner === a ? (ta.w++, tb.l++) : (tb.w++, ta.l++);
        S.clubs[r.winner].budget += g.prize * 0.01;
        if (a === u.id || b === u.id) { report.matches.push({ ...r, game: L.game }); report.income.prize = (report.income.prize || 0) + (r.winner === u.id ? g.prize * 0.01 : 0); }
      }
    } else if (w === R + 1) {
      const st = standings(L.game).slice(0, 4).map(x => x.id);
      L.playoffs = { semis: [playSeries(L.game, st[0], st[3], 3), playSeries(L.game, st[1], st[2], 3)], final: null };
      L.playoffs.semis.forEach(r => { r.stage = "Demi-finale"; r.week = w; if (r.a === u.id || r.b === u.id) report.matches.push({ ...r, game: L.game }); });
    } else if (w === R + 2 && L.playoffs) {
      const [s1, s2] = L.playoffs.semis;
      const f = playSeries(L.game, s1.winner, s2.winner, 5);
      f.stage = "Grande finale"; f.week = w;
      L.playoffs.final = f; L.champion = f.winner;
      if (f.a === u.id || f.b === u.id) report.matches.push({ ...f, game: L.game });
      // dotations
      const pay = (id, part) => { S.clubs[id].budget += g.prize * part; if (id === u.id) report.income.prize = (report.income.prize || 0) + g.prize * part; };
      pay(f.winner, 0.4); pay(f.loser, 0.2); pay(s1.loser, 0.1); pay(s2.loser, 0.1);
      const champ = S.clubs[f.winner];
      champ.fame = clamp(champ.fame + 5, 0, 100); champ.fans = Math.round(champ.fans * 1.08);
      champ.titles.push(`${g.league} ${S.season}`);
      S.titles.push({ season: S.season, game: L.game, club: champ.name, clubId: champ.id });
      if (f.winner === u.id) mail(`🏆 CHAMPIONS ${g.league} !`, `${u.name} remporte le <b>${g.league} ${S.season}</b> ${f.sa}-${f.sb} face à ${S.clubs[f.loser].name} ! Dotation : ${money(g.prize * 0.4)}. MVP : ${f.mvp}.`, "trophy");
    }
  }

  // économie du club joueur
  const fac = u.facilities;
  const nDiv = Object.keys(u.divisions).length;
  const sponsors = Math.round(4000 + 3.6 * u.fame * u.fame + 3000 * nDiv * (u.fame / 100)) + u.sponsorDeals.reduce((s, d) => s + d.weekly, 0);
  const merch = Math.round(u.fans * (0.012 + fac.content * 0.003));
  const salaries = Object.keys(u.divisions).flatMap(gm => clubPlayers(u.id, gm)).reduce((s, p) => s + p.salary, 0);
  const opCost = Object.keys(u.divisions).reduce((s, gm) => s + 1500 * GAMES[gm].size * GAMES[gm].mult, 0);
  const upkeep = Object.values(fac).reduce((s, l) => s + l * 2500, 0);
  report.income.sponsors = sponsors; report.income.merch = merch;
  report.expenses.salaries = salaries; report.expenses.operations = Math.round(opCost); report.expenses.facilities = upkeep;
  const inc = Object.values(report.income).reduce((a, b) => a + b, 0);
  const exp = Object.values(report.expenses).reduce((a, b) => a + b, 0);
  u.budget += sponsors + merch - salaries - opCost - upkeep;
  u.fans = Math.round(u.fans * (1 + fac.content * 0.0015) + fac.content * 40);
  u.sponsorDeals = u.sponsorDeals.filter(d => --d.weeks > 0);
  S.finance.push({ label: `S${S.season % 100}-W${w}`, inc: Math.round(inc), exp: Math.round(exp), budget: Math.round(u.budget) });
  if (S.finance.length > 60) S.finance.shift();

  // entraînement, forme, moral
  for (const p of Object.values(S.players)) {
    if (!p.club) continue;
    const c = S.clubs[p.club];
    if (!c) continue;
    const tr = c.facilities.coaching;
    if (p.rating < p.pot && Math.random() < 0.06 + tr * 0.025 + (p.age <= 21 ? 0.05 : 0)) p.rating++;
    p.form = clamp(p.form + (65 - p.form) * 0.08 + rand(-3, 3) + c.facilities.house * 0.3, 20, 100);
    let dm = (70 - p.morale) * 0.05 + c.facilities.house * 0.3;
    if (!p.starter && p.rating >= 80) dm -= 2;
    p.morale = clamp(p.morale + dm + rand(-2, 2), 5, 100);
  }

  // conseil d'administration
  if (u.budget < 0) {
    S.board.confidence = clamp(S.board.confidence - 6, 0, 100);
    if (w % 2) mail("⚠️ Budget dans le rouge", `Le budget est négatif (${money(u.budget)}). Le conseil s'inquiète. Vendez des joueurs ou réduisez la masse salariale.`, "board");
  }

  // événements aléatoires
  if (Math.random() < 0.3) { const ev = randomEvent(); if (ev) report.events.push(ev); }

  // activité IA sur le marché
  aiMarket();

  report.week = w; report.season = S.season;
  S.lastWeek = report;

  // fin de saison
  if (w === R + 2) endSeason();
  else S.week++;

  if (S.board.confidence <= 0 || u.budget < -1500000) {
    S.over = true;
    mail("❌ Licencié", `Le conseil d'administration a perdu confiance. ${S.ceo} est démis de ses fonctions de CEO de ${u.name}.`, "board");
  }
  save();
  return report;
}

function standings(game) {
  const L = S.leagues[game];
  return Object.entries(L.table).filter(([id]) => S.clubs[id])
    .map(([id, t]) => ({ id, ...t, diff: t.mw - t.ml }))
    .sort((a, b) => b.w - a.w || b.diff - a.diff || b.mw - a.mw);
}

function endSeason() {
  const u = user();
  // bilan objectif
  let best = 99, titles = 0, finals = 0;
  for (const gm of Object.keys(u.divisions)) {
    const L = S.leagues[gm];
    const pos = standings(gm).findIndex(x => x.id === u.id) + 1;
    if (pos) best = Math.min(best, pos);
    if (L.champion === u.id) titles++;
    if (L.playoffs && L.playoffs.final && (L.playoffs.final.a === u.id || L.playoffs.final.b === u.id)) finals++;
  }
  const playoffs = best <= 4;
  let ok;
  const o = S.board.objective;
  if (o.startsWith("remporter")) ok = titles > 0;
  else if (o.startsWith("atteindre")) ok = finals > 0;
  else if (o.startsWith("se qualifier")) ok = playoffs;
  else ok = u.budget > 0 && Object.keys(u.divisions).length > 0;
  S.board.confidence = clamp(S.board.confidence + (ok ? 20 : playoffs ? -10 : -22) + titles * 8, 0, 100);
  mail(`Bilan de la saison ${S.season}`,
    `Titres : <b>${titles}</b> · Finales : <b>${finals}</b> · Meilleur classement régulier : <b>${best === 99 ? "-" : best + "e"}</b><br>
     Objectif (${o}) : ${ok ? "<b style='color:var(--ok)'>atteint ✅</b>" : "<b style='color:var(--bad)'>manqué ❌</b>"}<br>
     Confiance du conseil : <b>${Math.round(S.board.confidence)}%</b>`, "board");

  // contrats, âge, retraites
  const leaving = [];
  for (const p of Object.values(S.players)) {
    p.age++;
    if (p.age >= 28 && Math.random() < 0.5) p.rating = Math.max(50, p.rating - randi(0, p.age >= 31 ? 3 : 1));
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
  }
  if (leaving.length) mail("Fins de contrat", `Ont quitté le club (contrat expiré) : <b>${leaving.join(", ")}</b>.`, "transfer");

  // académie & nouveaux talents
  for (const gm of Object.keys(GAMES)) {
    for (let i = 0; i < GAMES[gm].size + 2; i++) { const p = genPlayer(gm, 58, 76, 16, 19); p.years = 0; p.pot = clamp(p.rating + randi(5, 18), 0, 96); addPlayer(p); }
  }
  if (u.facilities.academy > 0 && Object.keys(u.divisions).length) {
    const gm = pick(Object.keys(u.divisions));
    const p = genPlayer(gm, 62 + u.facilities.academy * 2, 70 + u.facilities.academy * 2, 16, 17);
    p.pot = clamp(p.rating + randi(10, 20), 0, 97); p.years = 0; addPlayer(p);
    joinClub(p, u, 500, 3);
    mail("🎓 Pépite de l'académie", `${flag(p.nat)} <b>${p.handle}</b> (${p.age} ans, ${GAMES[gm].short}, note ${p.rating}) sort de votre académie et signe son premier contrat pro.`, "info");
  }
  // les IA complètent leurs effectifs
  for (const c of Object.values(S.clubs)) if (c.ai) for (const gm of Object.keys(c.divisions)) aiFillRoster(c.id, gm);
  // érosion de la notoriété
  for (const c of Object.values(S.clubs)) c.fame = clamp(c.fame * 0.97 + 1.5, 1, 100);

  S.season++;
  newSeasonSetup(false);
}

function aiMarket() {
  if (Math.random() > 0.35) return;
  // un gros club IA recrute un bon agent libre
  const fas = Object.values(S.players).filter(p => !p.club && p.rating >= 80).sort(() => Math.random() - 0.5);
  for (const p of fas.slice(0, 1)) {
    const cands = Object.values(S.clubs).filter(c => c.ai && c.divisions[p.game]);
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
  () => {
    const brands = ["HyperX", "Red Bull", "Logitech G", "Monster Energy", "Secretlab", "Razer", "Alienware", "Intel", "Corsair", "Mercedes-Benz", "BMW", "Crédit Mutuel", "Orange", "Free", "Lacoste", "Puma", "Adidas"];
    const u = user(); const b = pick(brands);
    const weekly = Math.round((3000 + u.fame * u.fame * rand(2, 4)) / 100) * 100, weeks = randi(10, 26);
    return { title: `Offre de sponsoring : ${b}`, body: `<b>${b}</b> propose un partenariat de ${money(weekly)}/semaine pendant ${weeks} semaines.`,
      choices: [{ label: "Signer ✍️", fx: () => { u.sponsorDeals.push({ name: b, weekly, weeks }); return `Contrat ${b} signé.`; } },
                { label: "Refuser", fx: () => "Offre déclinée." }] };
  },
  () => {
    const u = user(); const b = pick(["CryptoMoon", "BetZilla", "QuickCasino", "NFT Arena"]);
    const lump = Math.round((150000 + u.fame * 8000) / 1000) * 1000;
    return { title: `Sponsor controversé : ${b}`, body: `<b>${b}</b> offre ${money(lump)} immédiatement pour apparaître sur vos maillots. Les fans risquent de mal le prendre.`,
      choices: [{ label: "Accepter 💰", fx: () => { u.budget += lump; u.fans = Math.round(u.fans * 0.94); u.fame = Math.max(1, u.fame - 2); return `+${money(lump)}, mais les fans grondent (-6 % de fans).`; } },
                { label: "Refuser", fx: () => { u.fame = Math.min(100, u.fame + 0.5); return "Les fans saluent votre intégrité."; } }] };
  },
  () => {
    const p = randomUserPlayer(); if (!p) return null; const u = user();
    const raise = Math.round(p.salary * 0.25 / 100) * 100;
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
    const u = user(); const cost = Math.round((20000 + Object.keys(u.divisions).length * 15000) / 1000) * 1000;
    if (!Object.keys(u.divisions).length) return null;
    return { title: "Bootcamp à Séoul", body: `Un bootcamp intensif de 10 jours est disponible pour ${money(cost)}. Forme de tous les joueurs boostée.`,
      choices: [{ label: "Réserver ✈️", fx: () => { if (u.budget < cost) return "Budget insuffisant."; u.budget -= cost; Object.keys(u.divisions).flatMap(g => clubPlayers(u.id, g)).forEach(p => p.form = clamp(p.form + 18, 0, 100)); return "Les joueurs reviennent affûtés !"; } },
                { label: "Non merci", fx: () => "Bootcamp annulé." }] };
  },
  () => {
    const u = user(); const streamers = ["Gotaga", "Kameto", "Squeezie", "Ibai", "xQc", "Pokimane", "TheGrefg", "Domingo", "Zerator", "Locklear", "Ninja", "Shroud"];
    const s = pick(streamers); const cost = Math.round((80000 + u.fame * 3000) / 1000) * 1000;
    return { title: `${s} veut rejoindre le club`, body: `Le créateur de contenu <b>${s}</b> propose de devenir ambassadeur du club pour ${money(cost)} par saison. Gros boost de visibilité.`,
      choices: [{ label: "Signer 🎙️", fx: () => { if (u.budget < cost) return "Budget insuffisant."; u.budget -= cost; u.fans = Math.round(u.fans * 1.15 + 5000); u.fame = Math.min(100, u.fame + 3); return `${s} rejoint l'aventure ! Fans +15 %.`; } },
                { label: "Décliner", fx: () => "Peut-être une autre fois." }] };
  },
  () => {
    const u = user(); const gain = Math.round(u.fans * 0.07 + 1500);
    return { title: "Clip viral 🔥", body: `Un ace de votre équipe fait le tour d'Internet : +${gain.toLocaleString("fr-FR")} fans !`, auto: () => { u.fans += gain; } };
  },
  () => {
    const u = user(); const amount = Math.round((300000 + u.fame * 15000) / 10000) * 10000;
    return { title: "Investisseur intéressé", body: `Un fonds d'investissement propose d'injecter ${money(amount)} contre 10 % des parts du club. Le conseil exigera plus de résultats.`,
      choices: [{ label: "Accepter", fx: () => { u.budget += amount; S.board.confidence = clamp(S.board.confidence - 10, 0, 100); return `+${money(amount)} dans les caisses.`; } },
                { label: "Refuser", fx: () => { S.board.confidence = clamp(S.board.confidence + 3, 0, 100); return "Le conseil apprécie votre indépendance."; } }] };
  },
];
function randomUserPlayer() {
  const u = user(); const ps = Object.keys(u.divisions).flatMap(g => clubPlayers(u.id, g));
  return ps.length ? pick(ps) : null;
}
function randomEvent() {
  const ev = pick(EVENTS)();
  if (!ev) return null;
  if (ev.auto) { ev.auto(); mail(ev.title, ev.body, "event"); return null; }
  return ev;
}

// ---------- installations ----------
function facilityCost(lvl) { return 100000 * (lvl + 1) * (lvl + 1); }
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
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function wipeSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } }

if (typeof module !== "undefined") module.exports = { newWorld, advanceWeek, standings, get S() { return S; }, user, clubPlayers, openDivision, signFreeAgent, makeOffer, playerValue, salaryDemand, upgradeFacility, teamStrength };
