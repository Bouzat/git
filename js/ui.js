// =====================================================================
//  ESPORTS MANAGER — Interface
// =====================================================================

const UI = { screen: "home", view: "dash", rosterGame: null, compGame: null, compTier: null,
  market: { game: "all", q: "", status: "all", min: 0, sort: "rating" }, pickClub: null, mailOpen: null };
const $app = document.getElementById("app");

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function ratingColor(r) { return r >= 90 ? "#ffd166" : r >= 85 ? "#06d6a0" : r >= 80 ? "#4cc9f0" : r >= 72 ? "#a0aec0" : "#e07a5f"; }
const R = r => `<span class="rating" style="background:${ratingColor(r)}">${r}</span>`;
const bar = (v, c) => `<span class="bar"><i style="width:${v}%;background:${c || (v > 70 ? "var(--ok)" : v > 45 ? "var(--warn)" : "var(--bad)")}"></i></span>`;
const badge = c => `<div class="badge" style="background:${c.color}">${esc(c.tag)}</div>`;
const gchip = g => `<span class="chip" style="border-color:${GAMES[g].color}">${GAMES[g].icon} ${GAMES[g].short}</span>`;
const tchip = t => `<span class="chip tier t${t}">${TIER_LABEL[t - 1]}</span>`;
function displayName(id, game) { const c = S.clubs[id]; if (!c) return "?"; return esc(c.solo ? soloName(c, game) : c.name); }
const FMT_LABEL = { team: "Équipes", br: "Battle royale", duel: "1 contre 1" };
function lobbyText(g) { const G = GAMES[g]; return `${G.lobby} ${G.unit}s · ${G.lobby * G.size} joueurs`; }

function toast(msg) {
  const t = document.getElementById("toast");
  t.innerHTML = msg; t.classList.remove("hidden");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add("hidden"), 3200);
}
function modal(html) { document.getElementById("modal-box").innerHTML = html; document.getElementById("modal").classList.remove("hidden"); }
function closeModal() { document.getElementById("modal").classList.add("hidden"); }

// =====================================================================
//  Écran titre
// =====================================================================
function realPlayerCount() {
  return Object.values(ROSTERS).reduce((s, l) => s + l.reduce((a, [, r]) => a + r.length, 0), 0)
    + Object.values(SOLOS).reduce((s, l) => s + l.reduce((a, x) => a + (typeof x[0] === "string" && Array.isArray(x[1]) ? x[1].length : Array.isArray(x[0]) ? x.length : 1), 0), 0);
}
// orgs reprenables, avec le tier de départ de chaque division
function takeoverList() {
  const map = {};
  for (const [game, list] of Object.entries(ROSTERS)) list.forEach(([id], i) => {
    (map[id] = map[id] || { id, divs: [] }).divs.push([game, Math.min(3, Math.floor(i / LEAGUE_SIZE) + 1)]);
  });
  return Object.values(map).map(o => ({ ...o, name: ORGS[o.id][0], cc: ORGS[o.id][2], color: ORGS[o.id][3], fame: ORGS[o.id][4] })).sort((a, b) => b.fame - a.fame);
}
function renderHome() {
  const strip = Object.values(GAMES).map(g => `<span class="chip">${g.icon} ${g.name}</span>`).join("");
  let body = "";
  if (UI.screen === "home") {
    body = `
    <div class="mode-cards">
      <div class="card mode-card" data-act="screen" data-v="create">
        <div class="big">🚀</div><h2>Créer un club</h2>
        <p class="muted">Partez de rien avec ${money(START_BUDGET)} sur une petite scène (tier 3). Recrutez des amateurs, montez de division en division jusqu'aux plus grands tournois.</p>
        <span class="chip">Difficulté : difficile</span>
      </div>
      <div class="card mode-card" data-act="screen" data-v="takeover">
        <div class="big">👔</div><h2>Reprendre un club</h2>
        <p class="muted">Prenez les rênes de T1, G2, Karmine Corp, Vitality, NAVI, Fnatic, FURIA, Team Liquid… Budget confortable, mais un conseil exigeant.</p>
        <span class="chip">Difficulté : normale</span>
      </div>
    </div>
    ${hasSave() ? `<div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap"><button class="primary" data-act="continue">▶ Continuer la partie sauvegardée</button><button class="danger" data-act="wipe">Effacer la sauvegarde</button></div>` : ""}`;
  } else if (UI.screen === "create") {
    const cc = Object.entries(COUNTRIES).map(([k, v]) => `<option value="${k}" ${k === "FR" ? "selected" : ""}>${flag(k)} ${v}</option>`).join("");
    const gs = Object.entries(GAMES).map(([k, g]) => `<option value="${k}">${g.icon} ${g.name} — ${g.tiers[2]} · cashprize ${money(tierPrize(k, 3))}</option>`).join("");
    body = `<div class="card" style="width:100%;max-width:600px">
      <h2>🚀 Fonder votre club</h2>
      <div class="form-row"><label for="f-ceo">Votre nom (CEO)</label><input id="f-ceo" placeholder="Ex : Kameto"></div>
      <div class="form-row"><label for="f-name">Nom du club</label><input id="f-name" placeholder="Ex : Phoenix Esports"></div>
      <div style="display:flex;gap:12px">
        <div class="form-row" style="flex:1"><label for="f-tag">Tag (2-4 lettres)</label><input id="f-tag" maxlength="4" placeholder="PHX"></div>
        <div class="form-row"><label for="f-color">Couleur</label><input id="f-color" type="color" value="#7c5cff"></div>
      </div>
      <div class="form-row"><label for="f-country">Pays</label><select id="f-country">${cc}</select></div>
      <div class="form-row"><label for="f-game">Première scène (tier 3, entrée offerte)</label><select id="f-game">${gs}</select></div>
      <p class="muted" style="font-size:13px">Budget de départ : <b>${money(START_BUDGET)}</b>. Les 2 premiers de chaque tier montent, les 2 derniers descendent. Les places en tier 2 et tier 1 peuvent aussi s'acheter une fois le club assez connu.</p>
      <div style="display:flex;gap:8px;justify-content:space-between">
        <button data-act="screen" data-v="home">← Retour</button><button class="primary" data-act="start-create">Fonder le club</button>
      </div></div>`;
  } else {
    const list = takeoverList().map(c => `
      <div class="club-pick ${UI.pickClub === c.id ? "sel" : ""}" style="--c:${c.color}" data-act="pick-club" data-v="${c.id}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px"><b>${esc(c.name)}</b><span>${flag(c.cc)}</span></div>
        <div class="muted" style="font-size:12px;margin:4px 0">Notoriété ${c.fame} · Budget ${money(c.fame * 45000)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">${c.divs.map(([g, t]) => `<span class="chip" style="border-color:${GAMES[g].color}">${GAMES[g].icon} ${GAMES[g].short} <small class="muted">T${t}</small></span>`).join("")}</div>
      </div>`).join("");
    body = `<div class="card" style="width:100%;max-width:1000px">
      <h2>👔 Reprendre un club</h2>
      <div class="form-row" style="max-width:320px"><label for="f-ceo">Votre nom (CEO)</label><input id="f-ceo" placeholder="Ex : Kameto"></div>
      <div class="club-grid">${list}</div>
      <div style="display:flex;gap:8px;justify-content:space-between;margin-top:14px">
        <button data-act="screen" data-v="home">← Retour</button><button class="primary" data-act="start-takeover" ${UI.pickClub ? "" : "disabled"}>Prendre les commandes</button>
      </div></div>`;
  }
  $app.innerHTML = `<div class="title-screen">
    <div class="logo">ESPORTS MANAGER<small>CEO EDITION</small></div>
    <div class="games-strip">${strip}</div>
    <p class="muted" style="margin-top:-12px;margin-bottom:24px;text-align:center">${Object.keys(GAMES).length} jeux · 3 tiers par jeu (${Object.keys(GAMES).length * 3} circuits) · ${Object.keys(ORGS).length} organisations réelles · ${realPlayerCount()} joueurs pros réels + des milliers de talents générés</p>
    ${body}
  </div>`;
}

// =====================================================================
//  Jeu
// =====================================================================
function render() {
  if (!S) return renderHome();
  const u = user();
  document.documentElement.style.setProperty("--club", u.color);
  const unread = S.inbox.filter(m => !m.read).length;
  const navs = [["dash", "🏠 Tableau de bord"], ["roster", "👥 Effectifs"], ["market", "💱 Mercato"], ["comp", "🏆 Compétitions"],
    ["finance", "💰 Finances"], ["facilities", "🏗️ Infrastructures"], ["inbox", "✉️ Messagerie"], ["world", "🌍 Clubs & palmarès"]];
  const phase = S.week <= REGULAR_WEEKS ? `Semaine ${S.week}/${REGULAR_WEEKS}` : S.week === REGULAR_WEEKS + 1 ? "Playoffs" : "Grandes finales";
  $app.innerHTML = `<div class="game">
    <aside class="side">
      <div class="club-badge">${badge(u)}<div><b>${esc(u.name)}</b><div class="muted" style="font-size:12px">CEO : ${esc(S.ceo)}</div></div></div>
      ${navs.map(([k, l]) => `<button class="nav ${UI.view === k ? "active" : ""}" data-act="view" data-v="${k}"><span>${l}</span>${k === "inbox" && unread ? `<span class="pill">${unread}</span>` : ""}</button>`).join("")}
      <div style="flex:1"></div>
      <button class="nav" data-act="quit">🚪 Menu principal</button>
    </aside>
    <main class="main">
      <div class="topbar">
        <div class="stat"><b>Saison ${S.season}</b><span>${phase}</span></div>
        <div class="stat"><b class="${u.budget < 0 ? "bad" : ""}">${money(u.budget)}</b><span>Budget</span></div>
        <div class="stat"><b>${u.fame.toFixed(1)}</b><span>Notoriété</span></div>
        <div class="stat"><b>${u.fans.toLocaleString("fr-FR")}</b><span>Fans</span></div>
        <div class="stat"><b class="${S.board.confidence < 30 ? "bad" : S.board.confidence < 55 ? "warn" : "ok"}">${Math.round(S.board.confidence)}%</b><span>Confiance du conseil</span></div>
        <div class="spacer"></div>
        ${S.over ? `<button class="danger" data-act="quit">Partie terminée — Menu</button>` : `<button class="primary" data-act="next">Semaine suivante ▶</button>`}
      </div>
      ${({ dash: viewDash, roster: viewRoster, market: viewMarket, comp: viewComp, finance: viewFinance, facilities: viewFacilities, inbox: viewInbox, world: viewWorld })[UI.view]()}
    </main></div>`;
}

// ---------- tableau de bord ----------
function nextMatch(L) {
  const u = user(), g = GAMES[L.game], R = REGULAR_WEEKS;
  if (g.fmt === "br") {
    if (S.week <= R) return `Journée ${S.week} : lobby de ${lobbyText(L.game)}, ${g.gamesPerWeek} parties`;
    const fin = S.week === R + 1 ? standings(L.key).slice(0, 8).map(x => x.id) : (L.playoffs ? L.playoffs.finalists : []);
    return fin.includes(u.id) ? `🏆 Grande finale (top 8) — jour ${S.week - R}` : "Non qualifié pour la grande finale";
  }
  if (S.week <= L.schedule.length) {
    const m = L.schedule[S.week - 1].find(m => m.includes(u.id));
    return m ? `vs <b>${displayName(m[0] === u.id ? m[1] : m[0], L.game)}</b> (BO3)` : "Repos cette semaine";
  }
  if (S.week === R + 1) return standings(L.key).slice(0, 4).some(x => x.id === u.id) ? "🔥 Demi-finale des playoffs" : "Éliminé — fin de saison";
  if (S.week === R + 2 && L.playoffs) return L.playoffs.semis.some(s => s.winner === u.id) ? "🏆 GRANDE FINALE (BO5)" : "Éliminé — fin de saison";
  return "Saison régulière terminée";
}
function viewDash() {
  const u = user(), Ls = userLeagues();
  const divCards = Ls.length ? Ls.map(L => {
    const g = GAMES[L.game], st = standings(L.key), pos = st.findIndex(x => x.id === u.id) + 1, row = st[pos - 1] || {};
    const n = clubPlayers(u.id, L.game).length;
    const rec = g.fmt === "br" ? `${row.pts || 0} pts · ${row.top1 || 0} Top 1` : `${row.w || 0}V - ${row.l || 0}D`;
    return `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0">${g.icon} ${g.name}</h3>${R(Math.round(teamStrength(u.id, L.game).str))}</div>
      <div style="margin:6px 0;display:flex;gap:6px;align-items:center;flex-wrap:wrap">${tchip(L.tier)}<span class="muted">${tierName(L.game, L.tier)}</span></div>
      <div>Classement : <b>${pos ? pos + "e" : "-"}</b> / ${st.length} · <b>${rec}</b></div>
      <div>Prochain : ${nextMatch(L)}</div>
      ${n < g.size ? `<div class="bad" style="margin-top:6px">⚠️ Effectif incomplet (${n}/${g.size}) — recrutez au Mercato !</div>` : ""}
    </div>`;
  }).join("") : `<div class="card"><h3>Aucune division</h3><p class="muted">Ouvrez une division dans l'onglet <b>Effectifs</b> pour entrer en compétition.</p><button class="primary" data-act="view" data-v="roster">Ouvrir une division</button></div>`;
  const last = S.lastWeek;
  const lastHtml = last && (last.matches.length || last.lobbies.length) ? last.matches.map(matchRow).join("") + last.lobbies.map(lobbyRow).join("") : `<p class="muted">Aucun match joué la semaine dernière.</p>`;
  const mails = S.inbox.slice(0, 5).map(m => `<div class="mail ${m.read ? "" : "unread"}" data-act="open-mail" data-v="${m.id}"><div class="t">${m.title}</div><div class="muted" style="font-size:12px">Saison ${m.season} · Semaine ${m.week}</div></div>`).join("");
  const obj = objectiveText();
  return `<div class="grid g2">
    <div class="card"><h3>🎯 Objectif du conseil</h3><p style="font-size:16px"><b>${obj[0].toUpperCase() + obj.slice(1)}</b></p>
      <div>Confiance ${bar(S.board.confidence)} ${Math.round(S.board.confidence)}%</div>
      <p class="muted" style="font-size:12px">À la fin de chaque saison, les 2 premiers d'un tier montent et les 2 derniers descendent. Si la confiance tombe à 0 % ou si les dettes deviennent trop lourdes, vous êtes licencié.</p></div>
    <div class="card"><h3>📅 Résultats de la semaine passée</h3>${lastHtml}</div>
  </div>
  <h3 style="margin-top:20px">Divisions</h3><div class="grid g3">${divCards}</div>
  <h3 style="margin-top:20px">Derniers messages</h3><div class="card" style="padding:0">${mails || "<p class='muted' style='padding:12px'>Rien de neuf.</p>"}</div>`;
}
function matchRow(r) {
  const g = r.game ? GAMES[r.game] : null, game = r.game || UI.compGame;
  return `<div class="match">
    <div class="r ${r.winner === r.a ? "win" : "lose"}">${displayName(r.a, game)}</div>
    <div class="score">${r.sa} - ${r.sb}</div>
    <div class="${r.winner === r.b ? "win" : "lose"}">${displayName(r.b, game)}</div>
  </div><div class="muted sub">${g ? g.icon + " " + g.short + (r.tier ? " T" + r.tier : "") + " · " : ""}${r.stage || ""} (BO${r.bestOf})${r.maps && r.maps.length ? " · " + r.maps.join(", ") : ""}${r.mvp ? " · MVP " + esc(r.mvp) : ""}</div>`;
}
function lobbyRow(l) {
  const g = GAMES[l.game], m = l.mine;
  const places = m.places.map(p => p === 1 ? "<b class='win'>👑 1er</b>" : p <= 10 ? `<b>${p}e</b>` : `${p}e`).join(" · ");
  return `<div class="lobby"><div><b>${g.icon} ${g.short} T${l.tier}</b> — ${l.stage} · lobby de ${l.lobby} ${g.unit}s (${l.lobby * g.size} joueurs)</div>
    <div>Placements : ${places}</div>
    <div><b>${m.pts} pts</b> · ${m.kills} éliminations · <b>${l.rank}e</b> du circuit cette semaine${l.mvp ? " · meilleur joueur : " + esc(l.mvp) : ""}</div></div>`;
}

// ---------- effectifs ----------
function viewRoster() {
  const u = user(), divs = Object.keys(u.divisions);
  if (!UI.rosterGame || !u.divisions[UI.rosterGame]) UI.rosterGame = divs[0] || null;
  const tabs = divs.map(g => `<button class="tab ${UI.rosterGame === g ? "active" : ""}" data-act="roster-game" data-v="${g}">${GAMES[g].icon} ${GAMES[g].short} · T${u.divisions[g].tier}</button>`).join("");
  const others = Object.keys(GAMES).filter(g => !u.divisions[g]);
  const open = `<div class="card" style="margin-top:20px"><h3>➕ Ouvrir une nouvelle division</h3>
    <p class="muted" style="margin-top:-6px">Le tier 3 est ouvert à tous. Acheter une place plus haut demande de la notoriété : ${TIER_FAME_REQ[1]} pour le tier 2, ${TIER_FAME_REQ[0]} pour le tier 1 (vous êtes à ${u.fame.toFixed(0)}).</p>
    <div class="grid g3">${others.map(g => `
    <div class="open-div"><div><b>${GAMES[g].icon} ${GAMES[g].name}</b><div class="muted" style="font-size:12px">${FMT_LABEL[GAMES[g].fmt]} · ${GAMES[g].size} joueur(s)${GAMES[g].fmt === "br" ? " · lobbies de " + lobbyText(g) : ""}</div></div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">${[3, 2, 1].map(t => `<button class="small" data-act="open-div" data-v="${g}|${t}" ${canJoin(g, t) ? "disabled" : ""} title="${esc(canJoin(g, t) || tierName(g, t))}">T${t} · ${money(tierEntry(g, t))}</button>`).join("")}</div></div>`).join("")}</div></div>`;
  if (!UI.rosterGame) return `<h2>Effectifs</h2><p class="muted">Votre club n'a encore aucune division.</p>${open}`;
  const g = GAMES[UI.rosterGame], d = u.divisions[UI.rosterGame];
  const ps = clubPlayers(u.id, UI.rosterGame).sort((a, b) => (b.starter - a.starter) || b.rating - a.rating);
  const nSt = ps.filter(p => p.starter).length;
  const rows = ps.map(p => `<tr>
    <td>${p.starter ? "⭐" : "<span class='muted'>banc</span>"}</td>
    <td>${flag(p.nat)} <b>${esc(p.handle)}</b></td><td>${p.role}</td><td>${p.age}</td><td>${R(p.rating)}</td>
    <td class="muted">${p.pot > p.rating + 2 ? "↗ " + estPot(p) : "—"}</td>
    <td>${bar(p.form)}</td><td>${bar(p.morale)}</td>
    <td>${money(p.salary)}/sem</td><td class="${p.years <= 1 ? "warn" : ""}">${p.years} an(s)</td><td>${money(playerValue(p))}</td>
    <td style="white-space:nowrap">
      <button class="small" data-act="starter" data-v="${p.id}">${p.starter ? "→ Banc" : "→ Titulaire"}</button>
      <button class="small" data-act="renew" data-v="${p.id}">Prolonger</button>
      <button class="small" data-act="sell" data-v="${p.id}">Vendre</button>
      <button class="small danger" data-act="release" data-v="${p.id}">Libérer</button></td></tr>`).join("");
  return `<h2>Effectifs</h2><div class="tabs">${tabs}</div>
    <div class="card"><div class="toolbar"><div style="flex:1;min-width:0"><h3 style="margin:0">${g.icon} ${g.name} — Titulaires ${nSt}/${g.size} · Force ${R(Math.round(teamStrength(u.id, UI.rosterGame).str))}</h3>
      <div style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">${tchip(d.tier)}<span class="muted">${tierName(UI.rosterGame, d.tier)}</span></div></div>
      <button class="small" data-act="auto-lineup">⚡ Composition auto</button>
      <button class="small" data-act="goto-market" data-v="${UI.rosterGame}">🔎 Recruter</button>
      <button class="small danger" data-act="close-div">Fermer la division</button></div>
    <div class="table-wrap"><table><tr><th></th><th>Joueur</th><th>Rôle</th><th>Âge</th><th>Note</th><th>Potentiel</th><th>Forme</th><th>Moral</th><th>Salaire</th><th>Contrat</th><th>Valeur</th><th></th></tr>${rows || `<tr><td colspan="12" class="muted">Aucun joueur. Rendez-vous au mercato !</td></tr>`}</table></div></div>
    ${open}`;
}
// le potentiel affiché est une estimation : plus le staff est bon, plus elle est précise
function estPot(p) {
  const h = [...p.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const err = Math.max(0, 3 - user().facilities.coaching);
  return clamp(p.pot + (h % (2 * err + 1)) - err, p.rating, 99);
}

// ---------- mercato ----------
function viewMarket() {
  const u = user(), m = UI.market;
  let ps = Object.values(S.players).filter(p => p.club !== u.id);
  if (m.game !== "all") ps = ps.filter(p => p.game === m.game);
  if (m.status === "free") ps = ps.filter(p => !p.club);
  if (m.status === "solo") ps = ps.filter(p => p.club && S.clubs[p.club] && S.clubs[p.club].solo && !S.clubs[p.club].filler);
  if (m.status === "club") ps = ps.filter(p => p.club && S.clubs[p.club] && !S.clubs[p.club].solo);
  if (m.q) { const q = m.q.toLowerCase(); ps = ps.filter(p => p.handle.toLowerCase().includes(q) || (p.club && S.clubs[p.club] && S.clubs[p.club].name.toLowerCase().includes(q))); }
  if (m.min) ps = ps.filter(p => p.rating >= m.min);
  const sorters = { rating: (a, b) => b.rating - a.rating, age: (a, b) => a.age - b.age, value: (a, b) => playerValue(a) - playerValue(b), pot: (a, b) => b.pot - a.pot, salary: (a, b) => salaryDemand(a, u) - salaryDemand(b, u) };
  ps.sort(sorters[m.sort]);
  const total = ps.length; ps = ps.slice(0, 150);
  const gameOpts = `<option value="all">Tous les jeux</option>` + Object.entries(GAMES).map(([k, g]) => `<option value="${k}" ${m.game === k ? "selected" : ""}>${g.icon} ${g.name}</option>`).join("");
  const rows = ps.map(p => {
    const c = p.club ? S.clubs[p.club] : null, d = c && c.divisions[p.game];
    const where = !c ? "<span class='ok'>Agent libre</span>" : c.solo ? `<span class="warn">Indépendant</span> <small class="muted">T${d.tier}</small>` : `${esc(c.name)} <small class="muted">T${d.tier}</small>`;
    const keen = interestCheck(p);
    const btn = !c ? `<button class="small primary" data-act="sign" data-v="${p.id}">Signer</button>`
      : `<button class="small" data-act="offer" data-v="${p.id}" ${keen ? "" : "disabled title='Votre club n&#39;est pas assez connu pour ce joueur'"}>${keen ? (c.solo ? "Recruter" : "Offre") + " (~" + money(askingPrice(p)) + ")" : "🔒 Hors de portée"}</button>`;
    return `<tr><td>${flag(p.nat)} <b>${esc(p.handle)}</b></td><td>${gchip(p.game)}</td><td>${p.role}</td><td>${p.age}</td><td>${R(p.rating)}</td>
      <td>${where}</td><td>${money(playerValue(p))}</td><td>${money(salaryDemand(p, u))}/sem</td><td>${btn}</td></tr>`;
  }).join("");
  return `<h2>Mercato</h2>
    <div class="toolbar">
      <select id="m-game" data-change="m-game" aria-label="Jeu">${gameOpts}</select>
      <input id="m-q" data-change="m-q" placeholder="Rechercher joueur ou club…" value="${esc(m.q)}" aria-label="Recherche">
      <select id="m-status" data-change="m-status" aria-label="Statut">${[["all", "Tous les statuts"], ["free", "Agents libres"], ["solo", "Pros indépendants"], ["club", "Sous contrat en club"]].map(([k, l]) => `<option value="${k}" ${m.status === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <select id="m-min" data-change="m-min" aria-label="Note minimale">${[0, 60, 70, 75, 80, 85, 90].map(v => `<option value="${v}" ${m.min == v ? "selected" : ""}>${v ? "Note ≥ " + v : "Toutes notes"}</option>`).join("")}</select>
      <select id="m-sort" data-change="m-sort" aria-label="Tri">${[["rating", "Tri : note"], ["pot", "Tri : potentiel"], ["age", "Tri : âge"], ["value", "Tri : prix"], ["salary", "Tri : salaire"]].map(([k, l]) => `<option value="${k}" ${m.sort === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <span class="muted">${total} joueur(s)${total > 150 ? " (150 affichés)" : ""}</span>
    </div>
    <p class="muted" style="font-size:12px;margin-top:-4px">Agent libre : sans contrat, signature directe. Indépendant : pro sans organisation, il demande une prime. Sous contrat : il faut payer une indemnité de transfert à son club.</p>
    <div class="card table-wrap"><table><tr><th>Joueur</th><th>Jeu</th><th>Rôle</th><th>Âge</th><th>Note</th><th>Statut</th><th>Valeur</th><th>Salaire demandé</th><th></th></tr>${rows}</table></div>`;
}

// ---------- compétitions ----------
function viewComp() {
  const u = user();
  if (!UI.compGame) UI.compGame = Object.keys(u.divisions)[0] || "lol";
  const ud = u.divisions[UI.compGame];
  if (!UI.compTier) UI.compTier = ud ? ud.tier : 1;
  const g = GAMES[UI.compGame], L = S.leagues[lkey(UI.compGame, UI.compTier)], br = g.fmt === "br";
  const tabs = Object.keys(GAMES).map(k => `<button class="tab small ${UI.compGame === k ? "active" : ""}" data-act="comp-game" data-v="${k}">${GAMES[k].icon} ${GAMES[k].short}${u.divisions[k] ? " ★" : ""}</button>`).join("");
  const ttabs = [1, 2, 3].map(t => `<button class="tab small ${UI.compTier === t ? "active" : ""}" data-act="comp-tier" data-v="${t}">${TIER_LABEL[t - 1]}${ud && ud.tier === t ? " ★" : ""}</button>`).join("");
  const st = standings(L.key), n = st.length;
  const zone = i => i < 2 && UI.compTier > 1 ? "<span class='ok' title='Montée'>▲</span>" : i >= n - 2 && UI.compTier < 3 ? "<span class='bad' title='Relégation'>▼</span>" : (br ? i < 8 : i < 4) ? "<span class='ok'>●</span>" : "";
  const name = id => `<span style="color:${S.clubs[id].color}">■</span> <b data-act="club-info" data-v="${id}" style="cursor:pointer">${displayName(id, UI.compGame)}</b>`;
  const table = br
    ? `<tr><th>#</th><th>${g.unit === "duo" ? "Duo" : "Équipe"}</th><th>Pts</th><th>Top 1</th><th>Élims</th><th>Place moy.</th><th>Force</th></tr>` + st.map((r, i) => `<tr class="${r.id === u.id ? "me" : ""}"><td>${i + 1} ${zone(i)}</td><td>${name(r.id)}</td><td><b>${r.pts}</b></td><td>${r.top1}</td><td>${r.kills}</td><td>${r.games ? (r.place / r.games).toFixed(1) : "-"}</td><td>${R(Math.round(teamStrength(r.id, UI.compGame).str))}</td></tr>`).join("")
    : `<tr><th>#</th><th>${g.fmt === "duel" ? "Joueur / club" : "Club"}</th><th>V</th><th>D</th><th>Maps</th><th>Diff</th><th>Force</th></tr>` + st.map((r, i) => `<tr class="${r.id === u.id ? "me" : ""}"><td>${i + 1} ${zone(i)}</td><td>${name(r.id)}</td><td>${r.w}</td><td>${r.l}</td><td>${r.mw}-${r.ml}</td><td class="${r.diff > 0 ? "ok" : r.diff < 0 ? "bad" : ""}">${r.diff > 0 ? "+" : ""}${r.diff}</td><td>${R(Math.round(teamStrength(r.id, UI.compGame).str))}</td></tr>`).join("");
  let po, side;
  if (br) {
    po = `<p class="muted">Chaque semaine : un lobby de ${lobbyText(UI.compGame)} et ${g.gamesPerWeek} parties. Points = placement (25 pour le Top 1) + éliminations. Le top 8 dispute la grande finale sur 2 semaines.</p>`;
    if (L.playoffs) {
      const P = L.playoffs, order = P.finalists.filter(id => S.clubs[id]).sort((a, b) => (P.pts[b] || 0) - (P.pts[a] || 0));
      po = `<table><tr><th>#</th><th>Finaliste</th><th>Pts finale</th></tr>${order.map((id, i) => `<tr class="${id === u.id ? "me" : ""}"><td>${i + 1}</td><td>${name(id)}</td><td>${P.pts[id] || 0}</td></tr>`).join("")}</table>${L.champion ? `<p style="text-align:center;font-size:18px">🏆 <b>${displayName(L.champion, UI.compGame)}</b></p>` : ""}`;
    }
    side = L.results.slice(-5).reverse().map(r => `<div class="match-br"><b>Journée ${r.week}</b> : ${r.top.map((id, i) => `${["🥇", "🥈", "🥉"][i]} ${displayName(id, UI.compGame)} (${r.pts[i]})`).join(" · ")}</div>`).join("") || `<p class="muted">Aucun résultat.</p>`;
  } else {
    po = `<p class="muted">Les 4 premiers se qualifient pour les playoffs (demi-finales BO3, finale BO5) à l'issue des ${REGULAR_WEEKS} semaines de saison régulière.</p>`;
    if (L.playoffs) po = `<div class="bracket"><div>${L.playoffs.semis.map(matchRow).join("")}</div><div>${L.playoffs.final ? matchRow(L.playoffs.final) + `<p style="text-align:center;font-size:18px">🏆 <b>${displayName(L.champion, UI.compGame)}</b></p>` : "<p class='muted'>Finale à venir</p>"}</div></div>`;
    const fixtures = S.week <= L.schedule.length ? L.schedule[S.week - 1].map(([a, b]) => `<div class="match"><div class="r">${displayName(a, UI.compGame)}</div><div class="score muted">vs</div><div>${displayName(b, UI.compGame)}</div></div>`).join("") : `<p class="muted">Saison régulière terminée.</p>`;
    side = `<h3>Semaine ${S.week} — Affiches</h3>${fixtures}<h3 style="margin-top:16px">Derniers résultats</h3>${L.results.slice(-6).reverse().map(matchRow).join("") || "<p class='muted'>Aucun résultat.</p>"}`;
  }
  return `<h2>${g.icon} ${tierName(UI.compGame, UI.compTier)}</h2><div class="tabs">${tabs}</div><div class="tabs">${ttabs}</div>
    <div class="grid g2">
      <div class="card"><h3>Classement · ${FMT_LABEL[g.fmt]}</h3><div class="table-wrap"><table>${table}</table></div>
        <p class="muted" style="font-size:12px">${UI.compTier > 1 ? "▲ montée · " : ""}${UI.compTier < 3 ? "▼ relégation · " : ""}cashprize ${money(tierPrize(UI.compGame, UI.compTier))} (40 % au champion)</p></div>
      <div>
        <div class="card"><h3>${br ? "Grande finale" : "Playoffs"}</h3>${po}</div>
        <div class="card" style="margin-top:16px">${br ? "<h3>Dernières journées</h3>" : ""}${side}</div>
      </div>
    </div>`;
}

// ---------- finances ----------
function viewFinance() {
  const u = user(), last = S.lastWeek;
  const lines = (o, labels) => Object.entries(o || {}).map(([k, v]) => `<tr><td>${labels[k] || k}</td><td style="text-align:right">${money(v)}</td></tr>`).join("");
  const incL = { sponsors: "Sponsors", merch: "Merch & streaming", prize: "Cashprize" };
  const expL = { salaries: "Salaires", operations: "Frais de divisions", facilities: "Entretien des infrastructures" };
  const F = S.finance.slice(-30);
  let chart = "<p class='muted'>Jouez quelques semaines pour voir l'évolution.</p>";
  if (F.length > 1) {
    const max = Math.max(...F.map(f => f.budget)), min = Math.min(0, ...F.map(f => f.budget));
    const W = 600, H = 170, x = i => 10 + i * (W - 20) / (F.length - 1), y = v => H - 10 - (v - min) / ((max - min) || 1) * (H - 20);
    const path = F.map((f, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(f.budget).toFixed(1)}`).join("");
    chart = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line)" stroke-dasharray="4"/>
      <path d="${path}" fill="none" stroke="${u.color}" stroke-width="3" vector-effect="non-scaling-stroke"/></svg>
      <div class="muted" style="display:flex;justify-content:space-between;font-size:12px"><span>${F[0].label}</span><span>max ${money(max)}</span><span>${F[F.length - 1].label}</span></div>`;
  }
  const ps = allUserPlayers();
  const deals = u.sponsorDeals.map(d => `<tr><td>${esc(d.name)}</td><td>${money(d.weekly)}/sem</td><td>${d.weeks} sem. restantes</td></tr>`).join("");
  return `<h2>Finances</h2><div class="grid g3">
    <div class="card"><h3>Budget</h3><div class="kpi ${u.budget < 0 ? "bad" : ""}">${money(u.budget)}</div></div>
    <div class="card"><h3>Masse salariale</h3><div class="kpi">${money(ps.reduce((s, p) => s + p.salary, 0))}<span class="muted" style="font-size:14px">/sem</span></div></div>
    <div class="card"><h3>Valeur de l'effectif</h3><div class="kpi">${money(ps.reduce((s, p) => s + playerValue(p), 0))}</div></div>
  </div>
  <div class="card" style="margin-top:16px"><h3>Évolution du budget</h3>${chart}</div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>Revenus (semaine passée)</h3><table>${lines(last && last.income, incL) || "<tr><td class='muted'>-</td></tr>"}</table></div>
    <div class="card"><h3>Dépenses (semaine passée)</h3><table>${lines(last && last.expenses, expL) || "<tr><td class='muted'>-</td></tr>"}</table></div>
  </div>
  <div class="card" style="margin-top:16px"><h3>Contrats de sponsoring</h3>${deals ? `<table>${deals}</table>` : "<p class='muted'>Aucun contrat spécifique. Les offres arrivent au fil des semaines selon votre notoriété.</p>"}</div>`;
}

// ---------- infrastructures ----------
function viewFacilities() {
  const u = user();
  return `<h2>Infrastructures</h2><div class="grid g3">${Object.entries(FACILITIES).map(([k, f]) => {
    const lvl = u.facilities[k], cost = facilityCost(lvl);
    return `<div class="card fac"><div style="font-size:30px">${f.icon}</div><b>${f.name}</b><span class="muted">${f.desc}</span>
      <div class="lvl">${Array.from({ length: MAX_FAC }, (_, i) => `<i class="${i < lvl ? "on" : ""}"></i>`).join("")}</div>
      <span class="muted" style="font-size:12px">Niveau ${lvl}/${MAX_FAC} · entretien ${money(lvl * 800)}/sem</span>
      ${lvl < MAX_FAC ? `<button data-act="upgrade" data-v="${k}" ${u.budget < cost ? "disabled" : ""}>Améliorer — ${money(cost)}</button>` : `<span class="ok">Niveau maximum</span>`}</div>`;
  }).join("")}</div>`;
}

// ---------- messagerie ----------
function viewInbox() {
  const list = S.inbox.map(m => `<div class="mail ${m.read ? "" : "unread"}" data-act="open-mail" data-v="${m.id}">
    <div class="t">${m.title}</div><div class="muted" style="font-size:12px">Saison ${m.season} · Semaine ${m.week}</div>
    ${UI.mailOpen === m.id ? `<div class="b">${m.body}</div>` : ""}</div>`).join("");
  return `<div class="toolbar"><h2 style="margin:0;flex:1">Messagerie</h2><button class="small" data-act="read-all">Tout marquer comme lu</button></div><div class="card" style="padding:0">${list || "<p class='muted' style='padding:12px'>Vide.</p>"}</div>`;
}

// ---------- monde ----------
function viewWorld() {
  const clubs = Object.values(S.clubs).filter(c => (!c.filler && !c.solo) || c.titles.length || c.id === S.userId).sort((a, b) => b.fame - a.fame).slice(0, 100);
  const divs = c => Object.entries(c.divisions).map(([g, d]) => `<span class="chip" style="border-color:${GAMES[g].color}">${GAMES[g].icon} ${GAMES[g].short} <small class="muted">T${d.tier}</small></span>`).join(" ");
  const rows = clubs.map((c, i) => `<tr class="${c.id === S.userId ? "me" : ""}"><td>${i + 1}</td><td><span style="color:${c.color}">■</span> <b data-act="club-info" data-v="${c.id}" style="cursor:pointer">${esc(c.name)}</b></td><td>${flag(c.country)}</td>
    <td>${c.fame.toFixed(1)}</td><td>${c.fans.toLocaleString("fr-FR")}</td><td>${divs(c)}</td><td>${c.titles.length ? "🏆 × " + c.titles.length : ""}</td></tr>`).join("");
  const hist = S.titles.slice().reverse().slice(0, 80).map(t => `<tr><td>${t.season}</td><td>${gchip(t.game)}</td><td>${tchip(t.tier)}</td><td class="${t.clubId === S.userId ? "ok" : ""}"><b>${esc(t.club)}</b></td></tr>`).join("");
  return `<h2>Clubs & palmarès</h2><div class="grid g2">
    <div class="card table-wrap"><h3>Classement mondial des clubs (notoriété)</h3><table><tr><th>#</th><th>Club</th><th></th><th>Notoriété</th><th>Fans</th><th>Divisions</th><th>Titres</th></tr>${rows}</table></div>
    <div class="card table-wrap"><h3>Palmarès</h3>${hist ? `<table><tr><th>Saison</th><th>Jeu</th><th>Tier</th><th>Champion</th></tr>${hist}</table>` : "<p class='muted'>Aucun titre décerné pour l'instant.</p>"}</div></div>`;
}
function clubInfo(id) {
  const c = S.clubs[id];
  const divs = Object.entries(c.divisions).map(([g, d]) => `<h3 style="margin-top:12px">${GAMES[g].icon} ${GAMES[g].name} · ${TIER_LABEL[d.tier - 1]}</h3><div class="table-wrap"><table>${clubPlayers(id, g).sort((a, b) => b.starter - a.starter || b.rating - a.rating).map(p => `<tr><td>${p.starter ? "⭐" : ""}</td><td>${flag(p.nat)} ${esc(p.handle)}</td><td class="muted">${p.role}</td><td>${p.age} ans</td><td>${R(p.rating)}</td></tr>`).join("")}</table></div>`).join("");
  modal(`<div style="display:flex;gap:12px;align-items:center">${badge(c)}<div><h2 style="margin:0">${esc(c.name)} ${flag(c.country)}</h2><span class="muted">${c.solo ? "Pro indépendant · " : ""}Notoriété ${c.fame.toFixed(1)} · ${c.fans.toLocaleString("fr-FR")} fans${c.titles.length ? " · 🏆 " + c.titles.map(esc).join(", ") : ""}</span></div></div>${divs}<div class="actions"><button data-act="close-modal">Fermer</button></div>`);
}

// =====================================================================
//  Actions
// =====================================================================
const ACTIONS = {
  "screen": v => { UI.screen = v; renderHome(); },
  "pick-club": v => { UI.pickClub = v; const ceo = document.getElementById("f-ceo").value; renderHome(); document.getElementById("f-ceo").value = ceo; },
  "start-create": () => {
    const val = id => document.getElementById(id).value.trim();
    const name = val("f-name"), tag = val("f-tag").toUpperCase();
    if (!name || tag.length < 2) return toast("Indiquez un nom de club et un tag de 2 à 4 lettres.");
    newWorld({ ceo: val("f-ceo") || "Le CEO", mode: "create", name, tag, country: val("f-country"), color: val("f-color"), firstGame: val("f-game") });
    UI.view = "dash"; UI.market.status = "free"; UI.market.game = val("f-game"); render();
  },
  "start-takeover": () => {
    newWorld({ ceo: document.getElementById("f-ceo").value.trim() || "Le CEO", mode: "takeover", clubId: UI.pickClub });
    UI.view = "dash"; render();
  },
  "continue": () => { if (load()) { UI.view = "dash"; render(); } },
  "wipe": () => modal(`<h2>Effacer la sauvegarde ?</h2><p>La partie en cours sera définitivement perdue.</p><div class="actions"><button data-act="close-modal">Annuler</button><button class="danger" data-act="do-wipe">Effacer</button></div>`),
  "do-wipe": () => { wipeSave(); closeModal(); renderHome(); },
  "quit": () => { save(); S = null; UI.screen = "home"; UI.compGame = UI.compTier = UI.rosterGame = null; renderHome(); },
  "view": v => { UI.view = v; render(); window.scrollTo(0, 0); },
  "next": () => playWeek(),
  "roster-game": v => { UI.rosterGame = v; render(); },
  "comp-game": v => { UI.compGame = v; const d = user().divisions[v]; UI.compTier = d ? d.tier : 1; render(); },
  "comp-tier": v => { UI.compTier = +v; render(); },
  "goto-market": v => { UI.market.game = v; UI.view = "market"; render(); },
  "open-div": v => {
    const [game, t] = v.split("|"), tier = +t, g = GAMES[game];
    modal(`<h2>${g.icon} ${g.name} · ${TIER_LABEL[tier - 1]}</h2><p>Entrée dans le <b>${tierName(game, tier)}</b> : <b>${money(tierEntry(game, tier))}</b>.<br>
      Il vous faudra ${g.size} joueur(s) titulaire(s). Frais de fonctionnement : ${money(TIER_OP[tier - 1] * g.size * g.mult)}/sem. Cashprize du circuit : ${money(tierPrize(game, tier))}.</p>
      <div class="actions"><button data-act="close-modal">Annuler</button><button class="primary" data-act="confirm-open" data-v="${v}">Confirmer</button></div>`);
  },
  "confirm-open": v => { const [game, t] = v.split("|"); const e = openDivision(game, +t); closeModal(); if (e) toast(e); else { UI.rosterGame = game; toast("Division ouverte !"); } render(); },
  "close-div": () => modal(`<h2>Fermer la division ${GAMES[UI.rosterGame].name} ?</h2><p>Tous les joueurs seront libérés (indemnités de rupture) et le club perdra en notoriété.</p><div class="actions"><button data-act="close-modal">Annuler</button><button class="danger" data-act="confirm-close">Fermer la division</button></div>`),
  "confirm-close": () => { closeDivision(UI.rosterGame); UI.rosterGame = null; closeModal(); render(); },
  "starter": v => { const e = toggleStarter(v); if (e) toast(e); render(); },
  "auto-lineup": () => { autoStarters(S.userId, UI.rosterGame); render(); },
  "renew": v => {
    const p = S.players[v], d = renewDemand(p);
    modal(`<h2>Prolonger ${esc(p.handle)}</h2><p>${esc(p.handle)} demande <b>${money(d)}/sem</b> (actuellement ${money(p.salary)}).</p>
      <div class="actions"><button data-act="close-modal">Annuler</button>${[1, 2, 3].map(y => `<button class="primary" data-act="do-renew" data-v="${v}|${y}">${y} an(s)</button>`).join("")}</div>`);
  },
  "do-renew": v => { const [id, y] = v.split("|"); renewPlayer(id, +y); closeModal(); render(); },
  "sell": v => { const p = S.players[v]; modal(`<h2>Vendre ${esc(p.handle)} ?</h2><p>Un club est prêt à payer environ <b>${money(playerValue(p) * 0.9)}</b>.</p><div class="actions"><button data-act="close-modal">Annuler</button><button class="primary" data-act="do-sell" data-v="${v}">Vendre</button></div>`); },
  "do-sell": v => { const fee = sellPlayer(v); closeModal(); toast("Vendu pour " + money(fee)); render(); },
  "release": v => { const p = S.players[v]; modal(`<h2>Libérer ${esc(p.handle)} ?</h2><p>Indemnité de rupture : <b>${money(Math.round(p.salary * 52 * p.years * 0.25))}</b>.</p><div class="actions"><button data-act="close-modal">Annuler</button><button class="danger" data-act="do-release" data-v="${v}">Libérer</button></div>`); },
  "do-release": v => { releasePlayer(v); closeModal(); render(); },
  "sign": v => {
    const p = S.players[v], u = user(), d = salaryDemand(p, u);
    if (!u.divisions[p.game]) return toast(`Ouvrez d'abord une division ${GAMES[p.game].name} (onglet Effectifs).`);
    modal(`<h2>Signer ${flag(p.nat)} ${esc(p.handle)}</h2><p>${GAMES[p.game].icon} ${GAMES[p.game].name} · ${p.role} · ${p.age} ans · note ${R(p.rating)}</p>
      <div class="form-row"><label for="f-sal">Salaire proposé (€/semaine) — demande : ${money(d)}</label><input id="f-sal" type="number" step="50" value="${d}"></div>
      <div class="form-row"><label for="f-yrs">Durée</label><select id="f-yrs"><option value="1">1 an</option><option value="2" selected>2 ans</option><option value="3">3 ans</option></select></div>
      <p class="muted">Prime de signature : 4 semaines de salaire.</p>
      <div class="actions"><button data-act="close-modal">Annuler</button><button class="primary" data-act="do-sign" data-v="${v}">Proposer le contrat</button></div>`);
  },
  "do-sign": v => { const e = signFreeAgent(v, +document.getElementById("f-sal").value, +document.getElementById("f-yrs").value); closeModal(); toast(e || "Contrat signé ! ✍️"); render(); },
  "offer": v => {
    const p = S.players[v], u = user(), c = S.clubs[p.club];
    if (!u.divisions[p.game]) return toast(`Ouvrez d'abord une division ${GAMES[p.game].name} (onglet Effectifs).`);
    const ask = askingPrice(p);
    modal(`<h2>${c.solo ? "Recruter" : "Offre pour"} ${flag(p.nat)} ${esc(p.handle)}</h2><p>${c.solo ? "Pro indépendant" : esc(c.name)} · ${GAMES[p.game].name} · ${p.role} · ${p.age} ans · ${R(p.rating)}</p>
      <p>Valeur estimée : ${money(playerValue(p))} · ${c.solo ? "Prime demandée" : "Le club en attend"} environ <b>${money(ask)}</b>.<br>Salaire demandé : ${money(salaryDemand(p, u))}/sem.</p>
      <div class="form-row"><label for="f-fee">Montant (€)</label><input id="f-fee" type="number" step="500" value="${ask}"></div>
      <div class="actions"><button data-act="close-modal">Annuler</button><button class="primary" data-act="do-offer" data-v="${v}">Envoyer l'offre</button></div>`);
  },
  "do-offer": v => { const e = makeOffer(v, +document.getElementById("f-fee").value); closeModal(); toast(e || "Transfert bouclé ! 🤝"); render(); },
  "upgrade": v => { const e = upgradeFacility(v); if (e) toast(e); render(); },
  "open-mail": v => { const m = S.inbox.find(x => x.id === v); if (m) { m.read = true; UI.mailOpen = UI.mailOpen === v ? null : v; } if (UI.view !== "inbox") UI.view = "inbox"; render(); },
  "read-all": () => { S.inbox.forEach(m => m.read = true); render(); },
  "club-info": v => clubInfo(v),
  "close-modal": () => closeModal(),
};

// ---------- boucle hebdomadaire ----------
let pendingEvents = [];
function playWeek() {
  const u = user();
  const missing = Object.keys(u.divisions).filter(g => clubPlayers(u.id, g).length < GAMES[g].size);
  const rep = advanceWeek();
  pendingEvents = rep.events.slice();
  const res = rep.matches.map(matchRow).join("") + rep.lobbies.map(lobbyRow).join("") || "<p class='muted'>Pas de match pour votre club cette semaine.</p>";
  const fin = Object.values(rep.income).reduce((a, b) => a + b, 0) - Object.values(rep.expenses).reduce((a, b) => a + b, 0);
  const se = rep.seasonEnd;
  modal(`<h2>${se ? "🏁 Fin de la saison " + rep.season : `Saison ${rep.season} · Semaine ${rep.week}`}</h2>${res}
    <p>Bilan financier de la semaine : <b class="${fin >= 0 ? "ok" : "bad"}">${fin >= 0 ? "+" : ""}${money(fin)}</b></p>
    ${missing.length ? `<p class="bad">⚠️ Effectif incomplet en ${missing.map(g => GAMES[g].short).join(", ")} : vos équipes jouent en sous-nombre !</p>` : ""}
    ${se ? `<p>${se.moves.length ? se.moves.join("<br>") : "Pas de changement de division."}</p><p>Objectif du conseil ${se.ok ? "<b class='ok'>atteint ✅</b>" : "<b class='bad'>manqué ❌</b>"}. Le bilan complet est dans la messagerie.</p>` : ""}
    ${S.over ? `<p class="bad"><b>Vous avez été licencié. Fin de partie.</b></p>` : ""}
    <div class="actions"><button class="primary" data-act="next-event">Continuer</button></div>`);
  render();
}
ACTIONS["next-event"] = () => {
  const ev = pendingEvents.shift();
  if (!ev) { closeModal(); return; }
  window._ev = ev;
  modal(`<h2>${ev.title}</h2><p>${ev.body}</p><div class="actions">${ev.choices.map((c, i) => `<button class="${i ? "" : "primary"}" data-act="ev-choice" data-v="${i}">${c.label}</button>`).join("")}</div>`);
};
ACTIONS["ev-choice"] = v => {
  const ev = window._ev, txt = ev.choices[+v].fx();
  mail(ev.title, ev.body + "<br><i>Décision : " + ev.choices[+v].label + " — " + txt + "</i>", "event");
  save(); toast(txt); render();
  ACTIONS["next-event"]();
};

// ---------- délégation d'événements ----------
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (el && !el.disabled) { ACTIONS[el.dataset.act] && ACTIONS[el.dataset.act](el.dataset.v); return; }
  if (e.target.id === "modal" && !pendingEvents.length && !document.querySelector('#modal [data-act="ev-choice"], #modal [data-act="next-event"]')) closeModal();
});
document.addEventListener("change", e => {
  const k = e.target.dataset.change; if (!k) return;
  const m = UI.market;
  if (k === "m-game") m.game = e.target.value;
  if (k === "m-min") m.min = +e.target.value;
  if (k === "m-sort") m.sort = e.target.value;
  if (k === "m-status") m.status = e.target.value;
  if (k === "m-q") m.q = e.target.value;
  render();
});
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.dataset && e.target.dataset.change === "m-q") { UI.market.q = e.target.value; render(); }
});

renderHome();
