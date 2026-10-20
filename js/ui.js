// =====================================================================
//  ESPORTS MANAGER — Interface
// =====================================================================

// filtres du mercato (valeurs par défaut, aussi utilisées par « Réinitialiser »)
const MARKET_DEFAULT = { game: "all", q: "", status: "all", min: 0, sort: "rating", dir: 1, region: "all", page: 0, per: 50,
  nat: "all", role: "all", ageMin: 0, ageMax: 99, potMin: 0, tier: "all", maxPrice: 0, budgetOnly: false, keenOnly: false };
const UI = { screen: "home", view: "dash", rosterGame: null, compGame: null, compTier: null,
  market: { ...MARKET_DEFAULT }, pickClub: null, mailOpen: null };
const $app = document.getElementById("app");
const ACTIONS = {};   // actions des boutons (data-act), complétées plus bas

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function ratingColor(r) { return r >= 90 ? "#ffd166" : r >= 85 ? "#06d6a0" : r >= 80 ? "#4cc9f0" : r >= 72 ? "#a0aec0" : "#e07a5f"; }
const R = r => `<span class="rating" style="background:${ratingColor(r)}">${r}</span>`;
const bar = (v, c) => `<span class="bar"><i style="width:${v}%;background:${c || (v > 70 ? "var(--ok)" : v > 45 ? "var(--warn)" : "var(--bad)")}"></i></span>`;
const badge = c => `<div class="badge" style="background:${c.color}">${esc(c.tag)}</div>`;
const gchip = g => `<span class="chip" style="border-color:${GAMES[g].color}">${GAMES[g].icon} ${GAMES[g].short}</span>`;
const tchip = (t, g) => `<span class="chip tier t${t}">${g ? tierLabel(g, t) : TIER_LABEL[t - 1]}</span>`;
// abrégé : « T2 », ou le statut dans un circuit ouvert (« Pro »)
const tshort = (g, t) => GAMES[g] && GAMES[g].open ? tierLabel(g, t) : "T" + t;
// puce d'une ligue : son tier, ou « Circuit ouvert »
const lchip = L => GAMES[L.game].open ? `<span class="chip tier t1">Circuit ouvert</span>` : tchip(L.tier);
function displayName(id, game) {
  const c = S.clubs[id]; if (!c) return "?";
  if (c.solo) return esc(soloName(c, game));
  // équipe au nom propre dans ce jeu (« G2 Gozen », « Karmine Corp GC »)
  if (game && c.divisions[game] && c.divisions[game].label) return esc(c.divisions[game].label);
  // jeux en solo ou en duo : on affiche le joueur, avec son club
  if (game && GAMES[game] && (GAMES[game].size <= 2 || GAMES[game].formats) && c.divisions[game]) return `${esc(c.name)} <small class="muted">(${esc(soloName(c, game))})</small>`;
  return esc(c.name);
}
const FMT_LABEL = { team: "Équipes", br: "Battle royale", duel: "1 contre 1" };
function lobbyText(g) { const G = GAMES[g], L = G.open && S && S.userId ? leagueOf(S.userId, g) : null; if (L) { const n = L.teams.length; return `tout le circuit de la région · ${n} ${G.unit}s, ${n * G.size} joueurs`; } return G.size > 1 ? `${G.lobby} ${G.unit}s · ${G.lobby * G.size} joueurs` : `${G.lobby} ${G.unit}s`; }

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
  // même répartition que la création du monde : tier d'après le rang de l'équipe dans sa zone (LEC, LCK…)
  for (const game of Object.keys(ROSTERS)) for (const e of planTiers(game)) if (e.orgId && ORGS[e.orgId] && (GAMES[game].fmt === "team" || !(map[e.orgId] && map[e.orgId].divs.some(d => d[0] === game))))
    (map[e.orgId] = map[e.orgId] || { id: e.orgId, divs: [] }).divs.push([game, e.tier]);
  for (const [game, list] of Object.entries(SOLOS)) list.forEach(x => {
    if (typeof x[0] === "string" && Array.isArray(x[1]) && ORGS[x[0]]) { const m = map[x[0]] = map[x[0]] || { id: x[0], divs: [] }; if (!m.divs.some(d => d[0] === game)) m.divs.push([game, 1]); }
  });
  for (const [id, games] of Object.entries(EXTRA_DIVS)) {
    if (!ORGS[id]) continue;
    const m = map[id] = map[id] || { id, divs: [] };
    for (const g of games) if (!m.divs.some(d => d[0] === g)) m.divs.push([g, ORGS[id][4] >= 70 ? 1 : 2, true]);
  }
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
    ${typeof LIVE_BUILD === "undefined" || LIVE_BUILD !== LIVE_EXPECTED ? `<div class="card" style="margin-top:20px;border-color:var(--bad)">⚠️ <b>Les effectifs à jour ne sont pas chargés</b> : votre navigateur utilise une ancienne copie du fichier de données (équipes Fortnite et Valorant, âges). Rechargez la page en vidant le cache (Ctrl + F5, ou Cmd + Maj + R sur Mac), puis lancez une nouvelle partie.</div>` : ""}
    ${hasSave() && saveIsOutdated() ? `<div class="card" style="margin-top:20px;border-color:var(--warn,#e0a030)">⚠️ <b>La base de données a été mise à jour</b> (équipes, joueurs, nationalités) depuis le début de votre partie sauvegardée. Elle garde l'ancien monde : lancez une nouvelle partie pour profiter des effectifs à jour.</div>` : ""}
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
        <div style="display:flex;flex-wrap:wrap;gap:4px">${c.divs.map(([g, t, gen]) => `<span class="chip" style="border-color:${GAMES[g].color}${gen ? ";border-style:dashed" : ""}" title="${gen ? "Division réelle, joueurs inventés" : "Effectif réel"}">${GAMES[g].icon} ${GAMES[g].short}${gen ? "*" : ""} <small class="muted">${gen ? "" : tshort(g, t)}</small></span>`).join("")}</div>
      </div>`).join("");
    body = `<div class="card" style="width:100%;max-width:1000px">
      <h2>👔 Reprendre un club</h2>
      <div class="form-row" style="max-width:320px"><label for="f-ceo">Votre nom (CEO)</label><input id="f-ceo" placeholder="Ex : Kameto"></div>
      <p class="muted" style="font-size:12px">* pointillés : division réelle du club, mais effectif réel introuvable, donc joueurs inventés.</p>
      <div class="club-grid">${list}</div>
      <div style="display:flex;gap:8px;justify-content:space-between;margin-top:14px">
        <button data-act="screen" data-v="home">← Retour</button><button class="primary" data-act="start-takeover" ${UI.pickClub ? "" : "disabled"}>Prendre les commandes</button>
      </div></div>`;
  }
  $app.innerHTML = `<div class="title-screen">
    <div class="logo">ESPORTS MANAGER<small>CEO EDITION</small></div>
    <div class="games-strip">${strip}</div>
    <p class="muted" style="margin-top:-12px;margin-bottom:24px;text-align:center">${Object.keys(GAMES).length} jeux · 3 tiers par jeu, ligues régionales (${Object.keys(GAMES).reduce((s, g) => s + gameZones(g).length * (GAMES[g].open ? 1 : 3), 0)} ligues : LEC, LCK, LPL, VCT EMEA…) · ${Object.keys(ORGS).length} organisations réelles · ${realPlayerCount()} joueurs pros réels + des milliers de talents générés</p>
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
  const navs = [["dash", "🏠 Tableau de bord"], ["roster", "👥 Effectifs"], ["market", "💱 Mercato"], ["calendar", "🗓️ Calendrier"], ["comp", "🏆 Compétitions"], ["tours", "📅 Tournois"],
    ["finance", "💰 Finances"], ["facilities", "🏗️ Infrastructures"], ["inbox", "✉️ Messagerie"], ["world", "🌍 Clubs & palmarès"]];
  const pending = S.over ? [] : weekEvents().filter(e => !e.done);
  $app.innerHTML = `<div class="game">
    <aside class="side">
      <div class="club-badge">${badge(u)}<div><b>${esc(u.name)}</b><div class="muted" style="font-size:12px">CEO : ${esc(S.ceo)}</div></div></div>
      ${navs.map(([k, l]) => `<button class="nav ${UI.view === k ? "active" : ""}" data-act="view" data-v="${k}"><span>${l}</span>${k === "inbox" && unread ? `<span class="pill">${unread}</span>` : ""}</button>`).join("")}
      <div style="flex:1"></div>
      <button class="nav" data-act="quit">🚪 Menu principal</button>
    </aside>
    <main class="main">
      <div class="topbar">
        <div class="stat"><b>${weekLabel(S.season, S.week, true)}</b><span>${seasonPhase()}</span></div>
        <div class="stat"><b class="${u.budget < 0 ? "bad" : ""}">${money(u.budget)}</b><span>Budget</span></div>
        <div class="stat"><b>${u.fame.toFixed(1)}</b><span>Notoriété</span></div>
        <div class="stat"><b>${u.fans.toLocaleString("fr-FR")}</b><span>Fans</span></div>
        <div class="stat"><b class="${S.board.confidence < 30 ? "bad" : S.board.confidence < 55 ? "warn" : "ok"}">${Math.round(S.board.confidence)}%</b><span>Confiance du conseil</span></div>
        <div class="spacer"></div>
        ${S.over ? `<button class="danger" data-act="quit">Partie terminée — Menu</button>` : `<button data-act="skip" title="Joue cette semaine puis passe les semaines sans match jusqu'au prochain">⏭ Prochain match</button>
          <button class="primary" data-act="next">${pending.length ? `🎮 Jour de match (${pending.length})` : "Semaine suivante ▶"}</button>`}
      </div>
      ${({ dash: viewDash, roster: viewRoster, market: viewMarket, calendar: viewCalendar, comp: viewComp, tours: viewTours, finance: viewFinance, facilities: viewFacilities, inbox: viewInbox, world: viewWorld })[UI.view]()}
    </main></div>`;
}

// période de la saison (barre du haut)
function seasonPhase() {
  const w = S.week, md = matchday(w);
  if (md) return `Saison ${S.season} · ${md <= 11 ? "split 1" : "split 2"}, journée ${md}/${LEAGUE_DAYS.length}`;
  if (w < LEAGUE_DAYS[0]) return `Saison ${S.season} · pré-saison`;
  if (w >= EWC_FIRST && w <= EWC_LAST_WEEK) return `Saison ${S.season} · Esports World Cup`;
  if (w === PO_SEMI) return `Saison ${S.season} · playoffs (demi-finales)`;
  if (w === PO_FINAL) return `Saison ${S.season} · playoffs (finales)`;
  if (w > PO_FINAL) return `Saison ${S.season} · Mondiaux et fin de saison`;
  return `Saison ${S.season} · pause entre les splits`;
}
// ---------- tableau de bord ----------
function nextMatch(L) {
  const g = GAMES[L.game], br = g.fmt === "br";
  const w = LEAGUE_DAYS.find(x => x >= S.week && (br || matchday(x) <= L.schedule.length));
  if (w) {
    const md = matchday(w), when = w === S.week ? "cette semaine" : weekLabel(S.season, w);
    if (br) return `Journée ${md} (${when}) : lobby de ${L.teams.length} ${g.unit}s, ${g.gamesPerWeek} parties`;
    const m = L.schedule[md - 1].find(m => m.some(isMine));
    return m ? `Journée ${md} (${when}) : contre <b>${displayName(isMine(m[0]) ? m[1] : m[0], L.game)}</b> (BO3)` : `Journée ${md} (${when}) : repos`;
  }
  const st = standings(L.key);
  if (S.week <= PO_SEMI) {
    const cut = br ? 8 : 4, ok = st.slice(0, cut).some(x => isMine(x.id));
    return ok ? `🔥 Qualifié pour ${br ? "la grande finale (top 8)" : "les playoffs"} : ${weekLabel(S.season, PO_SEMI)}` : `Hors du top ${cut} : pas de ${br ? "grande finale" : "playoffs"}`;
  }
  if (S.week === PO_FINAL && L.playoffs) {
    const alive = br ? (L.playoffs.finalists || []).some(isMine) : L.playoffs.semis.some(x => isMine(x.winner));
    return alive ? `🏆 ${br ? "Grande finale, jour 2" : "GRANDE FINALE (BO5)"} cette semaine` : "Éliminé — saison de ligue terminée";
  }
  return "Saison de ligue terminée — place aux tournois";
}
function viewDash() {
  const u = user(), Ls = userLeagues();
  const divCards = Ls.length ? Ls.map(L => {
    const g = GAMES[L.game], st = standings(L.key), pos = st.findIndex(x => x.id === u.id) + 1, row = st[pos - 1] || {};
    const n = gamePlayers(L.game).length;
    const rec = g.fmt === "br" ? `${row.pts || 0} pts · ${row.top1 || 0} Top 1` : `${row.w || 0}V - ${row.l || 0}D`;
    return `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0">${g.icon} ${g.name}</h3>${R(Math.round(teamStrength(u.id, L.game).str))}</div>
      <div style="margin:6px 0;display:flex;gap:6px;align-items:center;flex-wrap:wrap">${lchip(L)}<span class="muted">${leagueName(L)}</span></div>
      <div>Classement : <b>${pos ? pos + "e" : "-"}</b> / ${st.length} · <b>${rec}</b></div>
      <div>Prochain : ${nextMatch(L)}</div>
      ${(unitGame(L.game) ? n === 0 : n < g.size) ? `<div class="bad" style="margin-top:6px">⚠️ Effectif incomplet (${n}/${g.size}) — recrutez au Mercato !</div>` : ""}
    </div>`;
  }).join("") : `<div class="card"><h3>Aucune division</h3><p class="muted">Ouvrez une division dans l'onglet <b>Effectifs</b> pour entrer en compétition.</p><button class="primary" data-act="view" data-v="roster">Ouvrir une division</button></div>`;
  const last = S.lastWeek;
  const lastHtml = last && (last.matches.length || last.lobbies.length) ? last.matches.map(matchRow).join("") + last.lobbies.map(lobbyRow).join("") : `<p class="muted">Aucun match joué la semaine dernière.</p>`;
  const mails = S.inbox.slice(0, 5).map(m => `<div class="mail ${m.read ? "" : "unread"}" data-act="open-mail" data-v="${m.id}"><div class="t">${m.title}</div><div class="muted" style="font-size:12px">${weekLabel(m.season, m.week, true)}</div></div>`).join("");
  const obj = objectiveText();
  return `<div class="grid g2">
    <div class="card"><h3>🎯 Objectif du conseil</h3><p style="font-size:16px"><b>${obj[0].toUpperCase() + obj.slice(1)}</b></p>
      <div>Confiance ${bar(S.board.confidence)} ${Math.round(S.board.confidence)}%</div>
      <p class="muted" style="font-size:12px">À la fin de chaque saison, les 2 premiers d'un tier montent et les 2 derniers descendent. Si la confiance tombe à 0 % ou si les dettes deviennent trop lourdes, vous êtes licencié.</p></div>
    <div class="card"><h3>📅 Résultats de la semaine passée</h3>${lastHtml}</div>
  </div>
  <h3 style="margin-top:20px">Divisions</h3><div class="grid g3">${divCards}</div>
  <h3 style="margin-top:20px">Prochains tournois</h3><div class="card">${upcomingTours(5) || "<p class='muted'>Aucun tournoi à venir pour vos jeux cette saison.</p>"}</div>
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
  return `<div class="lobby"><div><b>${g.icon} ${g.short}${g.open ? "" : " T" + l.tier}</b> — ${l.stage} · lobby de ${l.lobby} ${g.unit}s${g.size > 1 ? ` (${l.lobby * g.size} joueurs)` : ""}</div>
    <div>Placements : ${places}</div>
    <div><b>${m.pts} pts</b> · ${m.kills} éliminations · <b>${l.rank}e</b> du circuit cette semaine${l.mvp ? " · meilleur joueur : " + esc(l.mvp) : ""}</div></div>`;
}

// ---------- effectifs ----------
function viewRoster() {
  const u = user(), divs = Object.keys(u.divisions);
  if (!UI.rosterGame || !u.divisions[UI.rosterGame]) UI.rosterGame = divs[0] || null;
  const tabs = divs.map(g => `<button class="tab ${UI.rosterGame === g ? "active" : ""}" data-act="roster-game" data-v="${g}">${GAMES[g].icon} ${GAMES[g].short} · ${tshort(g, u.divisions[g].tier)}</button>`).join("");
  const others = Object.keys(GAMES).filter(g => !u.divisions[g]);
  const open = `<div class="card" style="margin-top:20px"><h3>➕ Ouvrir une nouvelle division</h3>
    <p class="muted" style="margin-top:-6px">Le tier 3 est ouvert à tous. Acheter une place plus haut demande de la notoriété : ${TIER_FAME_REQ[1]} pour le tier 2, ${TIER_FAME_REQ[0]} pour le tier 1 (vous êtes à ${u.fame.toFixed(0)}).</p>
    <div class="grid g3">${others.map(g => `
    <div class="open-div"><div><b>${GAMES[g].icon} ${GAMES[g].name}</b><div class="muted" style="font-size:12px">${FMT_LABEL[GAMES[g].fmt]} · ${GAMES[g].size} joueur(s)${GAMES[g].fmt === "br" ? " · lobbies de " + lobbyText(g) : ""}</div></div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">${(GAMES[g].open ? [3] : [3, 2, 1]).map(t => `<button class="small" data-act="open-div" data-v="${g}|${t}" ${canJoin(g, t) ? "disabled" : ""} title="${esc(canJoin(g, t) || tierName(g, GAMES[g].open ? 1 : t, zoneFrom(g, REGION_OF[u.country] || "EU", u.country)))}">${GAMES[g].open ? "Circuit ouvert" : "T" + t} · ${money(tierEntry(g, t))}</button>`).join("")}</div></div>`).join("")}</div></div>`;
  if (!UI.rosterGame) return `<h2>Effectifs</h2><p class="muted">Votre club n'a encore aucune division.</p>${open}`;
  const g = GAMES[UI.rosterGame], d = u.divisions[UI.rosterGame];
  const ps = clubPlayers(u.id, UI.rosterGame).sort((a, b) => (b.starter - a.starter) || b.rating - a.rating);
  const nSt = ps.filter(p => p.starter).length;
  const rows = ps.map(p => `<tr>
    <td>${p.starter ? "⭐" : "<span class='muted'>banc</span>"}</td>
    <td>${flag(p.nat)} <b>${esc(p.handle)}</b> <small class="muted" title="Région de jeu">${playRegion(p)}</small>${adaptFactor(p) < 1 ? ` <small class="warn" title="Adaptation à sa nouvelle région">✈️</small>` : ""}</td><td>${p.role}</td><td>${ageTxt(p)}</td><td>${R(p.rating)}</td>
    <td>${potTxt(p)}</td>
    <td>${bar(p.form)}</td><td>${bar(p.morale)}</td>
    <td>${money(p.salary)}/sem</td><td class="${p.years <= 1 ? "warn" : ""}">${p.years} an(s)</td><td>${p.clause ? money(p.clause) : "<span class='muted'>—</span>"}</td><td>${money(playerValue(p))}</td>
    <td style="white-space:nowrap">
      <button class="small" data-act="starter" data-v="${p.id}">${p.starter ? "→ Banc" : "→ Titulaire"}</button>
      <button class="small" data-act="contract" data-v="${p.id}">Contrat</button>
      ${academyOf(p.game) ? `<button class="small" data-act="to-academy" data-v="${p.id}" title="Envoyer le joueur dans l'académie (même contrat)">↓ Académie</button>` : ""}
      <button class="small" data-act="sell" data-v="${p.id}">Vendre</button>
      <button class="small danger" data-act="release" data-v="${p.id}">Libérer</button></td></tr>`).join("");
  if (unitGame(UI.rosterGame)) return `<h2>Effectifs</h2><div class="tabs">${tabs}</div>${unitRoster(UI.rosterGame)}${open}`;
  return `<h2>Effectifs</h2><div class="tabs">${tabs}</div>
    <div class="card"><div class="toolbar"><div style="flex:1;min-width:0"><h3 style="margin:0">${g.icon} ${g.name}${d.label ? ` (${esc(d.label)})` : ""} — Titulaires ${nSt}/${g.size}${teamRegion(u.id, UI.rosterGame) ? " · " + REGIONS[teamRegion(u.id, UI.rosterGame)] : ""} · Force ${R(Math.round(teamStrength(u.id, UI.rosterGame).str))}</h3>
      <div style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">${tchip(d.tier, UI.rosterGame)}<span class="muted">${esc(divName(u.id, UI.rosterGame))}</span></div></div>
      <button class="small" data-act="auto-lineup">⚡ Composition auto</button>
      <button class="small" data-act="goto-market" data-v="${UI.rosterGame}">🔎 Recruter</button>
      <button class="small danger" data-act="close-div">Fermer la division</button></div>
    <div class="table-wrap"><table><tr><th></th><th>Joueur</th><th>Rôle</th><th>Âge</th><th>Note</th><th>Potentiel</th><th>Forme</th><th>Moral</th><th>Salaire</th><th>Contrat</th><th>Clause</th><th>Valeur</th><th></th></tr>${rows || `<tr><td colspan="13" class="muted">Aucun joueur. Rendez-vous au mercato !</td></tr>`}</table></div></div>
    ${academyCard(UI.rosterGame)}
    ${open}`;
}
// Fortnite : les duos/trios du club, chacun dans sa région ; pas de banc
function unitRoster(game) {
  arrangeUnits(game);
  const g = GAMES[game], u = user(), teams = userTeams(game).filter(id => !S.clubs[id].academyOf);
  const cards = teams.map((id, k) => {
    const d = divOf(id, game), L = leagueOf(id, game), ps = clubPlayers(id, game), mates = unitMates(id, game);
    const pos = standings(L.key).findIndex(r => r.id === id) + 1;
    const opts = p => teams.filter(t => t !== id && divOf(t, game).zone === playerZone(p) && clubPlayers(t, game).length < g.size)
      .map(t => `<option value="${t}">→ ${g.unit} ${teams.indexOf(t) + 1} (${esc(soloName(S.clubs[t], game))})</option>`).join("") + (ps.length > 1 ? `<option value="new">→ nouveau ${g.unit} (${ZONE_NAMES[playerZone(p)]})</option>` : "");
    const rows = ps.map(p => `<tr><td>${flag(p.nat)} <b>${esc(p.handle)}</b> <small class="muted">${playRegion(p)}</small>${adaptFactor(p) < 1 ? ` <small class="warn" title="Adaptation à sa nouvelle région">✈️</small>` : ""}</td><td>${p.role}</td><td>${ageTxt(p)}</td><td>${R(p.rating)}</td><td>${potTxt(p)}</td><td>${bar(p.form)}</td><td>${bar(p.morale)}</td>
      <td>${money(p.salary)}/sem</td><td class="${p.years <= 1 ? "warn" : ""}">${p.years} an(s)</td>
      <td style="white-space:nowrap">${opts(p) ? `<select class="small-sel" data-change="unit-move" data-pid="${p.id}" aria-label="Changer d'équipe"><option value="">Changer d'équipe…</option>${opts(p)}</select>` : ""}
        <button class="small" data-act="contract" data-v="${p.id}">Contrat</button><button class="small" data-act="sell" data-v="${p.id}">Vendre</button><button class="small danger" data-act="release" data-v="${p.id}">Libérer</button></td></tr>`).join("")
      + mates.map(p => `<tr class="mate"><td>${flag(p.nat)} ${esc(p.handle)}* </td><td>${p.role}</td><td>${ageTxt(p)}</td><td>${R(p.rating)}</td><td colspan="6" class="muted">Partenaire extérieur au club : il joue avec votre joueur, vous ne le payez pas.</td></tr>`).join("");
    return `<div class="card" style="margin-bottom:14px"><div class="toolbar"><div style="flex:1;min-width:0"><h3 style="margin:0">${g.icon} ${g.unit[0].toUpperCase() + g.unit.slice(1)} ${k + 1} · ${ZONE_NAMES[d.zone]} — Force ${R(Math.round(teamStrength(id, game).str))}</h3>
      <div style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">${tchip(d.tier, game)}<span class="muted">${esc(leagueName(L))}${pos ? ` · ${pos}e / ${L.teams.length}` : ""}</span></div></div></div>
      <div class="table-wrap"><table><tr><th>Joueur</th><th>Rôle</th><th>Âge</th><th>Note</th><th>Potentiel</th><th>Forme</th><th>Moral</th><th>Salaire</th><th>Contrat</th><th></th></tr>${rows || `<tr><td colspan="10" class="muted">Aucun joueur.</td></tr>`}</table></div></div>`;
  }).join("");
  return `<div class="card" style="margin-bottom:14px"><div class="toolbar"><div style="flex:1;min-width:0"><h3 style="margin:0">${g.icon} ${g.name} ${S.season} — ${g.unit}s (${g.size} joueurs)</h3>
      <p class="muted" style="margin:6px 0 0;font-size:13px">Pas de banc : chacun de vos joueurs joue dans un ${g.unit}. Vous pouvez aligner plusieurs ${g.unit}s, chacun dans la FNCS de sa région (un ${g.unit} américain en Amérique du Nord, un ${g.unit} européen en Europe). Un joueur seul se trouve un partenaire hors du club, que vous ne payez pas (marqué d'un astérisque). Pour changer un joueur de région, renégociez son contrat.</p></div>
      <button class="small" data-act="goto-market" data-v="${game}">🔎 Recruter</button><button class="small danger" data-act="close-div">Fermer la division</button></div></div>${cards}`;
}
// équipe réserve d'un jeu par équipes
function academyCard(game) {
  if (!canHaveAcademy(game)) return "";
  const g = GAMES[game], aca = academyOf(game);
  if (!aca) {
    const e = canCreateAcademy(game);
    return `<div class="card" style="margin-top:20px"><h3>🎓 Académie ${g.name}</h3>
      <p class="muted" style="margin-top:-6px">Une seconde équipe de jeunes (16-19 ans, gros potentiel, petits salaires) qui joue sa propre ligue, toujours sous l'équipe première. Les jeunes qui jouent y progressent plus vite ; faites monter les meilleurs, envoyez-y les joueurs qui manquent de temps de jeu. L'académie ne peut jamais monter dans la division de l'équipe première.</p>
      <p>Création : <b>${money(academyCost(game))}</b> · entrée en tier 3 · frais de fonctionnement réduits.</p>
      ${e ? `<p class="warn">${esc(e)}</p>` : ""}<div class="actions" style="justify-content:flex-start"><button class="primary" data-act="create-academy" ${e ? "disabled" : ""}>Créer l'académie</button></div></div>`;
  }
  const ad = aca.divisions[game];
  const ps = clubPlayers(aca.id, game).sort((a, b) => (b.starter - a.starter) || b.rating - a.rating);
  const rows = ps.map(p => `<tr><td>${p.starter ? "⭐" : "<span class='muted'>banc</span>"}</td>
    <td>${flag(p.nat)} <b>${esc(p.handle)}</b> <small class="muted">${playRegion(p)}</small></td><td>${p.role}</td><td>${ageTxt(p)}</td><td>${R(p.rating)}</td><td>${potTxt(p)}</td>
    <td>${bar(p.form)}</td><td>${bar(p.morale)}</td><td>${money(p.salary)}/sem</td><td class="${p.years <= 1 ? "warn" : ""}">${p.years} an(s)</td>
    <td style="white-space:nowrap"><button class="small primary" data-act="to-academy" data-v="${p.id}">↑ Équipe première</button>
      <button class="small" data-act="contract" data-v="${p.id}">Contrat</button>
      <button class="small danger" data-act="release" data-v="${p.id}">Libérer</button></td></tr>`).join("");
  const L = leagueOf(aca.id, game), pos = standings(L.key).findIndex(r => r.id === aca.id) + 1;
  return `<div class="card" style="margin-top:20px"><div class="toolbar"><div style="flex:1;min-width:0"><h3 style="margin:0">🎓 ${esc(aca.name)} — Force ${R(Math.round(teamStrength(aca.id, game).str))}</h3>
      <div style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">${tchip(ad.tier)}<span class="muted">${esc(leagueName(L))}${pos ? ` · ${pos}e` : ""} · composition automatique (les meilleurs jouent)</span></div></div>
      <button class="small danger" data-act="close-academy">Fermer l'académie</button></div>
    <div class="table-wrap"><table><tr><th></th><th>Joueur</th><th>Rôle</th><th>Âge</th><th>Note</th><th>Potentiel</th><th>Forme</th><th>Moral</th><th>Salaire</th><th>Contrat</th><th></th></tr>${rows || `<tr><td colspan="11" class="muted">Aucun joueur.</td></tr>`}</table></div></div>`;
}
// le potentiel affiché est une estimation : plus le staff est bon, plus elle est précise
const ageTxt = p => p.ageKnown === false ? `<span class="muted" title="Âge réel inconnu, estimé">~${p.age}</span>` : p.age;
function potTxt(p) {
  const e = estPot(p);
  return e > p.rating ? `<span class="pot" title="Potentiel estimé par votre staff (plus précis avec un meilleur coaching)">↗ ${e}</span>` : `<span class="muted" title="A atteint son plafond">${e}</span>`;
}
function estPot(p) {
  const h = [...p.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const err = Math.max(0, 3 - user().facilities.coaching);
  return clamp(p.pot + (h % (2 * err + 1)) - err, p.rating, 99);
}

// ---------- mercato ----------
function viewMarket() {
  const u = user(), m = UI.market;
  let ps = Object.values(S.players).filter(p => p.club !== u.id && !(S.clubs[p.club] && S.clubs[p.club].parent === u.id));
  if (m.game !== "all") ps = ps.filter(p => p.game === m.game);
  if (m.status === "free") ps = ps.filter(p => !p.club);
  if (m.status === "solo") ps = ps.filter(p => p.club && S.clubs[p.club] && S.clubs[p.club].solo && !S.clubs[p.club].filler);
  if (m.status === "club") ps = ps.filter(p => p.club && S.clubs[p.club] && !S.clubs[p.club].solo);
  if (m.q) { const q = m.q.toLowerCase(); ps = ps.filter(p => p.handle.toLowerCase().includes(q) || (p.club && S.clubs[p.club] && S.clubs[p.club].name.toLowerCase().includes(q))); }
  if (m.min) ps = ps.filter(p => p.rating >= m.min);
  if (m.region && m.region !== "all") ps = ps.filter(p => playRegion(p) === m.region);
  // liste des nationalités / rôles disponibles avant les filtres qui les concernent
  const natCount = {}; ps.forEach(p => { natCount[p.nat] = (natCount[p.nat] || 0) + 1; });
  const roleSet = [...new Set(m.game !== "all" ? GAMES[m.game].roles : ps.map(p => p.role))].sort();
  if (m.nat !== "all") ps = ps.filter(p => p.nat === m.nat);
  if (m.role !== "all") ps = ps.filter(p => p.role === m.role);
  if (m.ageMin) ps = ps.filter(p => p.age >= m.ageMin);
  if (m.ageMax < 99) ps = ps.filter(p => p.age <= m.ageMax);
  if (m.potMin) ps = ps.filter(p => p.pot >= m.potMin);
  if (m.tier !== "all") ps = ps.filter(p => { const c = S.clubs[p.club]; return m.tier === "0" ? !c : c && !c.solo && c.divisions[p.game] && c.divisions[p.game].tier === +m.tier; });
  const cost = p => askingPrice(p) + (p.club ? 0 : salaryDemand(p, u) * 4);   // indemnité ou prime de signature
  if (m.maxPrice) ps = ps.filter(p => cost(p) <= m.maxPrice);
  if (m.budgetOnly) ps = ps.filter(p => cost(p) <= u.budget);
  if (m.keenOnly) ps = ps.filter(p => !p.club || interestCheck(p));
  const where = p => { const c = S.clubs[p.club]; return !c ? "" : c.solo ? "~" : c.name.toLowerCase(); };
  const sorters = { rating: (a, b) => b.rating - a.rating, age: (a, b) => a.age - b.age, value: (a, b) => playerValue(a) - playerValue(b), pot: (a, b) => b.pot - a.pot, salary: (a, b) => salaryDemand(a, u) - salaryDemand(b, u),
    name: (a, b) => a.handle.localeCompare(b.handle), game: (a, b) => a.game.localeCompare(b.game) || b.rating - a.rating, role: (a, b) => a.role.localeCompare(b.role) || b.rating - a.rating,
    club: (a, b) => where(a).localeCompare(where(b)) || b.rating - a.rating, nat: (a, b) => (COUNTRIES[a.nat] || a.nat).localeCompare(COUNTRIES[b.nat] || b.nat) || b.rating - a.rating, price: (a, b) => cost(a) - cost(b) };
  const sorter = sorters[m.sort] || sorters.rating;
  ps.sort((a, b) => sorter(a, b) * (m.dir || 1));
  // pagination : tous les joueurs sont accessibles, page par page
  const total = ps.length, per = m.per || 50, pages = Math.max(1, Math.ceil(total / per));
  m.page = clamp(m.page || 0, 0, pages - 1);
  const first = m.page * per;
  ps = ps.slice(first, first + per);
  const pageBtn = (pg, label, dis) => `<button class="small" data-act="m-page" data-v="${pg}" ${dis ? "disabled" : ""}>${label}</button>`;
  const near = [...new Set([0, m.page - 2, m.page - 1, m.page, m.page + 1, m.page + 2, pages - 1])].filter(x => x >= 0 && x < pages).sort((a, b) => a - b);
  const pager = pages <= 1 ? "" : `<div class="toolbar" style="justify-content:center;gap:6px;margin:10px 0">${pageBtn(0, "«", m.page === 0)}${pageBtn(m.page - 1, "‹ Précédente", m.page === 0)}
    ${near.map((x, i) => (i && x - near[i - 1] > 1 ? "<span class='muted'>…</span>" : "") + `<button class="small ${x === m.page ? "primary" : ""}" data-act="m-page" data-v="${x}">${x + 1}</button>`).join("")}
    ${pageBtn(m.page + 1, "Suivante ›", m.page >= pages - 1)}${pageBtn(pages - 1, "»", m.page >= pages - 1)}</div>`;
  const gameOpts = `<option value="all">Tous les jeux</option>` + Object.entries(GAMES).map(([k, g]) => `<option value="${k}" ${m.game === k ? "selected" : ""}>${g.icon} ${g.name}</option>`).join("");
  const rows = ps.map(p => {
    const c = p.club ? S.clubs[p.club] : null, d = c && c.divisions[p.game];
    const where = !c ? "<span class='ok'>Agent libre</span>" : c.solo ? `<span class="warn">Indépendant</span> <small class="muted">${tshort(p.game, d.tier)}</small>` : `${esc(c.name)} <small class="muted">${tshort(p.game, d.tier)}</small>`;
    const keen = interestCheck(p);
    const btn = !c ? `<button class="small primary" data-act="sign" data-v="${p.id}">Signer</button>`
      : `<button class="small" data-act="offer" data-v="${p.id}" ${keen ? "" : "disabled title='Votre club n&#39;est pas assez connu pour ce joueur'"}>${keen ? (c.solo ? "Recruter" : "Offre") + " (~" + money(askingPrice(p)) + ")" : "🔒 Hors de portée"}</button>`;
    return `<tr><td>${flag(p.nat)} <b>${esc(p.handle)}</b></td><td>${gchip(p.game)}</td><td>${p.role}</td><td>${ageTxt(p)}</td><td>${R(p.rating)}</td><td>${potTxt(p)}</td>
      <td>${where}</td><td>${money(playerValue(p))}</td><td>${money(salaryDemand(p, u))}/sem</td><td class="${cost(p) > u.budget ? "bad" : ""}">${money(cost(p))}</td><td>${btn}</td></tr>`;
  }).join("");
  const head = [["name", "Joueur"], ["game", "Jeu"], ["role", "Rôle"], ["age", "Âge"], ["rating", "Note"], ["pot", "Potentiel"], ["club", "Statut"], ["value", "Valeur"], ["salary", "Salaire demandé"], ["price", "Coût"]]
    .map(([k, l]) => `<th class="sortable" data-act="m-sort-col" data-v="${k}" title="Trier (cliquer à nouveau pour inverser)">${l}${m.sort === k ? (m.dir === 1 ? " ▼" : " ▲") : ""}</th>`).join("") + "<th></th>";
  const opt = (cur, list) => list.map(([k, l]) => `<option value="${k}" ${String(cur) === String(k) ? "selected" : ""}>${l}</option>`).join("");
  const natOpts = Object.keys(natCount).sort((a, b) => (COUNTRIES[a] || a).localeCompare(COUNTRIES[b] || b)).map(cc => [cc, `${flag(cc)} ${COUNTRIES[cc] || cc} (${natCount[cc]})`]);
  const ages = [0, 16, 18, 20, 22, 24, 26, 28, 30, 99];
  const active = Object.keys(MARKET_DEFAULT).some(k => !["page", "per", "sort", "dir"].includes(k) && m[k] !== MARKET_DEFAULT[k]);
  return `<h2>Mercato</h2>
    <div class="toolbar">
      <select id="m-game" data-change="m-game" aria-label="Jeu">${gameOpts}</select>
      <input id="m-q" data-change="m-q" placeholder="Rechercher joueur ou club…" value="${esc(m.q)}" aria-label="Recherche">
      <select id="m-status" data-change="m-status" aria-label="Statut">${[["all", "Tous les statuts"], ["free", "Agents libres"], ["solo", "Pros indépendants"], ["club", "Sous contrat en club"]].map(([k, l]) => `<option value="${k}" ${m.status === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <select id="m-min" data-change="m-min" aria-label="Note minimale">${[0, 60, 70, 75, 80, 85, 90].map(v => `<option value="${v}" ${m.min == v ? "selected" : ""}>${v ? "Note ≥ " + v : "Toutes notes"}</option>`).join("")}</select>
      <select id="m-sort" data-change="m-sort" aria-label="Tri">${[["rating", "Tri : note"], ["pot", "Tri : potentiel"], ["age", "Tri : âge"], ["value", "Tri : valeur"], ["price", "Tri : coût"], ["salary", "Tri : salaire"], ["name", "Tri : nom"], ["nat", "Tri : nationalité"], ["role", "Tri : rôle"], ["club", "Tri : club"]].map(([k, l]) => `<option value="${k}" ${m.sort === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <select id="m-region" data-change="m-region" aria-label="Région">${[["all", "Toutes les régions"], ...Object.entries(REGIONS)].map(([k, l]) => `<option value="${k}" ${m.region === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <select id="m-per" data-change="m-per" aria-label="Joueurs par page">${[25, 50, 100, 200].map(v => `<option value="${v}" ${(m.per || 50) === v ? "selected" : ""}>${v} par page</option>`).join("")}</select>
    </div>
    <div class="toolbar">
      <select id="m-nat" data-change="m-nat" aria-label="Nationalité">${opt(m.nat, [["all", "Toutes nationalités"], ...natOpts])}</select>
      <select id="m-role" data-change="m-role" aria-label="Rôle">${opt(m.role, [["all", "Tous les rôles"], ...roleSet.map(r => [r, r])])}</select>
      <select id="m-agemin" data-change="m-agemin" aria-label="Âge minimum">${opt(m.ageMin, ages.slice(0, -1).map(a => [a, a ? "Âge ≥ " + a : "Âge min."]))}</select>
      <select id="m-agemax" data-change="m-agemax" aria-label="Âge maximum">${opt(m.ageMax, ages.slice(1).map(a => [a, a < 99 ? "Âge ≤ " + a : "Âge max."]))}</select>
      <select id="m-potmin" data-change="m-potmin" aria-label="Potentiel minimum">${opt(m.potMin, [0, 70, 75, 80, 85, 90].map(v => [v, v ? "Potentiel ≥ " + v : "Tout potentiel"]))}</select>
      <select id="m-tier" data-change="m-tier" aria-label="Niveau du club actuel">${opt(m.tier, [["all", "Tous niveaux de club"], ["0", "Sans club"], ["1", "Club " + TIER_LABEL[0]], ["2", "Club " + TIER_LABEL[1]], ["3", "Club " + TIER_LABEL[2]]])}</select>
      <select id="m-maxprice" data-change="m-maxprice" aria-label="Coût maximum">${opt(m.maxPrice, [0, 50000, 100000, 250000, 500000, 1e6, 2.5e6, 5e6].map(v => [v, v ? "Coût ≤ " + money(v) : "Tout coût"]))}</select>
      <label class="muted"><input type="checkbox" data-change="m-budget" ${m.budgetOnly ? "checked" : ""}> Dans mon budget</label>
      <label class="muted"><input type="checkbox" data-change="m-keen" ${m.keenOnly ? "checked" : ""}> Intéressés par mon club</label>
      ${active ? `<button class="small" data-act="m-reset">✕ Réinitialiser les filtres</button>` : ""}
      <span class="muted">${total} joueur(s)${total ? ` · ${first + 1}–${Math.min(total, first + per)} · page ${m.page + 1}/${pages}` : ""}</span>
    </div>
    ${pager}
    <p class="muted" style="font-size:12px;margin-top:-4px">Agent libre : sans contrat, signature directe. Indépendant : pro sans organisation, il demande une prime. Sous contrat : il faut payer une indemnité de transfert à son club.</p>
    <div class="card table-wrap"><table><tr>${head}</tr>${rows || `<tr><td colspan="11" class="muted">Aucun joueur ne correspond à ces filtres.</td></tr>`}</table></div>${pager}`;
}

// ---------- compétitions ----------
function viewComp() {
  const u = user();
  if (!UI.compGame) UI.compGame = Object.keys(u.divisions)[0] || "lol";
  const ud = u.divisions[UI.compGame];
  if (!UI.compTier) UI.compTier = ud ? ud.tier : 1;
  const zones = gameZones(UI.compGame);
  if (!UI.compZone || !zones.includes(UI.compZone)) UI.compZone = ud && ud.zone ? ud.zone : zones[0];
  const g = GAMES[UI.compGame], br = g.fmt === "br";
  if (g.open) UI.compTier = 1;
  const L = S.leagues[lkey(UI.compGame, UI.compTier, UI.compZone)];
  const mineIn = (t, z) => leaguesOf(UI.compGame).some(x => x.tier === t && x.zone === z && x.teams.some(isMine));
  const tabs = Object.keys(GAMES).map(k => `<button class="tab small ${UI.compGame === k ? "active" : ""}" data-act="comp-game" data-v="${k}">${GAMES[k].icon} ${GAMES[k].short}${u.divisions[k] ? " ★" : ""}</button>`).join("");
  const ztabs = zones.length < 2 ? "" : zones.map(z => `<button class="tab small ${UI.compZone === z ? "active" : ""}" data-act="comp-zone" data-v="${z}">${ZONE_NAMES[z]}${leaguesOf(UI.compGame).some(x => x.zone === z && x.teams.some(isMine)) ? " ★" : ""}</button>`).join("");
  const ttabs = g.open ? "" : [1, 2, 3].map(t => `<button class="tab small ${UI.compTier === t ? "active" : ""}" data-act="comp-tier" data-v="${t}">${TIER_LABEL[t - 1]} · ${esc(tierName(UI.compGame, t, UI.compZone))}${mineIn(t, UI.compZone) ? " ★" : ""}</button>`).join("");
  const st = standings(L.key), n = st.length;
  const cut = g.open ? statusCuts(n) : null;
  const zone = i => cut ? (i < 8 ? "<span class='ok' title='Grande finale'>●</span>" : i === cut[0] - 1 ? "<span class='ok' title='Dernière place Élite'>▲</span>" : i === cut[1] - 1 ? "<span class='warn' title='Dernière place Pro'>▲</span>" : "") : i < 2 && UI.compTier > 1 ? "<span class='ok' title='Montée'>▲</span>" : i >= n - 2 && UI.compTier < 3 ? "<span class='bad' title='Relégation'>▼</span>" : (br ? i < 8 : i < 4) ? "<span class='ok'>●</span>" : "";
  const name = id => `<span style="color:${S.clubs[id].color}">■</span> <b data-act="club-info" data-v="${id}" style="cursor:pointer">${displayName(id, UI.compGame)}</b>`;
  const table = br
    ? `<tr><th>#</th><th>${g.unit === "duo" ? "Duo" : "Équipe"}</th><th>Pts</th><th>Top 1</th><th>Élims</th><th>Place moy.</th><th>Force</th></tr>` + st.map((r, i) => `<tr class="${r.id === u.id ? "me" : ""}"><td>${i + 1} ${zone(i)}</td><td>${name(r.id)}</td><td><b>${r.pts}</b></td><td>${r.top1}</td><td>${r.kills}</td><td>${r.games ? (r.place / r.games).toFixed(1) : "-"}</td><td>${R(Math.round(teamStrength(r.id, UI.compGame).str))}</td></tr>`).join("")
    : `<tr><th>#</th><th>${g.fmt === "duel" ? "Joueur / club" : "Club"}</th><th>V</th><th>D</th><th>Maps</th><th>Diff</th><th>Force</th></tr>` + st.map((r, i) => `<tr class="${r.id === u.id ? "me" : ""}"><td>${i + 1} ${zone(i)}</td><td>${name(r.id)}</td><td>${r.w}</td><td>${r.l}</td><td>${r.mw}-${r.ml}</td><td class="${r.diff > 0 ? "ok" : r.diff < 0 ? "bad" : ""}">${r.diff > 0 ? "+" : ""}${r.diff}</td><td>${R(Math.round(teamStrength(r.id, UI.compGame).str))}</td></tr>`).join("");
  let po, side;
  if (br) {
    po = `<p class="muted">Chaque journée : un lobby avec tout le circuit de la région (${n} ${g.unit}s) et ${g.gamesPerWeek} parties. Points = placement (25 pour le Top 1) + éliminations. Le top 8 dispute la grande finale sur 2 semaines en septembre.</p>`;
    if (L.playoffs) {
      const P = L.playoffs, order = P.finalists.filter(id => S.clubs[id]).sort((a, b) => (P.pts[b] || 0) - (P.pts[a] || 0));
      po = `<table><tr><th>#</th><th>Finaliste</th><th>Pts finale</th></tr>${order.map((id, i) => `<tr class="${id === u.id ? "me" : ""}"><td>${i + 1}</td><td>${name(id)}</td><td>${P.pts[id] || 0}</td></tr>`).join("")}</table>${L.champion ? `<p style="text-align:center;font-size:18px">🏆 <b>${displayName(L.champion, UI.compGame)}</b></p>` : ""}`;
    }
    side = L.results.slice(-5).reverse().map(r => `<div class="match-br"><b>Journée ${r.day || r.week}</b> : ${r.top.map((id, i) => `${["🥇", "🥈", "🥉"][i]} ${displayName(id, UI.compGame)} (${r.pts[i]})`).join(" · ")}</div>`).join("") || `<p class="muted">Aucun résultat.</p>`;
  } else {
    po = `<p class="muted">${LEAGUE_DAYS.length} journées en matchs aller-retour (split 1 de janvier à mars, split 2 d'avril à juin). Les 4 premiers jouent les playoffs en septembre (demi-finales BO3, finale BO5).</p>`;
    if (L.playoffs) po = `<div class="bracket"><div>${L.playoffs.semis.map(matchRow).join("")}</div><div>${L.playoffs.final ? matchRow(L.playoffs.final) + `<p style="text-align:center;font-size:18px">🏆 <b>${displayName(L.champion, UI.compGame)}</b></p>` : "<p class='muted'>Finale à venir</p>"}</div></div>`;
    const nw = LEAGUE_DAYS.find(x => x >= S.week && matchday(x) <= L.schedule.length), nd = nw ? matchday(nw) : 0;
    const fixtures = nd ? L.schedule[nd - 1].map(([a, b]) => `<div class="match"><div class="r">${displayName(a, UI.compGame)}</div><div class="score muted">vs</div><div>${displayName(b, UI.compGame)}</div></div>`).join("") : `<p class="muted">Saison régulière terminée.</p>`;
    side = `<h3>${nd ? `Journée ${nd} — ${weekLabel(S.season, nw)}` : "Affiches"}</h3>${fixtures}<h3 style="margin-top:16px">Derniers résultats</h3>${L.results.slice(-6).reverse().map(matchRow).join("") || "<p class='muted'>Aucun résultat.</p>"}`;
  }
  return `<h2>${g.icon} ${esc(leagueName(L))} <small class="muted">${g.open ? "circuit ouvert" : TIER_LABEL[L.tier - 1]}${L.zone !== "W" ? " · " + ZONE_NAMES[L.zone] : ""}</small></h2><div class="tabs">${tabs}</div>${ztabs ? `<div class="tabs">${ztabs}</div>` : ""}<div class="tabs">${ttabs}</div>
    <div class="grid g2">
      <div class="card"><h3>Classement · ${FMT_LABEL[g.fmt]}</h3><div class="table-wrap"><table>${table}</table></div>
        <p class="muted" style="font-size:12px">${cut ? `circuit ouvert : dans cette région, le top ${cut[0]} obtient le statut Élite et le top ${cut[1]} le statut Pro pour la saison suivante (invitations, sponsors) · ` : ""}${!cut && UI.compTier > 1 ? "▲ montée · " : ""}${!cut && UI.compTier < 3 ? "▼ relégation · " : ""}cashprize ${money(tierPrize(UI.compGame, UI.compTier))} (40 % au champion)</p></div>
      <div>
        <div class="card"><h3>${br ? "Grande finale" : "Playoffs"}</h3>${po}</div>
        <div class="card" style="margin-top:16px">${br ? "<h3>Dernières journées</h3>" : ""}${side}</div>
      </div>
    </div>`;
}

// ---------- calendrier ----------
// ce que le club joue (ou a joué) dans une ligue la semaine w (null si rien)
function leagueEntry(L, w) {
  const g = GAMES[L.game], md = matchday(w), name = `${g.icon} ${esc(leagueName(L))}`;
  if (g.fmt === "br") {
    if (md) { const r = L.results.find(x => x.week === w); const top = r ? r.top.findIndex(isMine) : -1; return { name, what: `Journée ${md} — lobby de ${L.teams.length} ${g.unit}s`, res: r ? (top >= 0 ? `${["🥇", "🥈", "🥉"][top]} du lobby` : "joué") : "" }; }
    if (w === PO_SEMI || w === PO_FINAL) return { name, what: `Grande finale (top 8) — jour ${w - PO_SEMI + 1}`, res: L.playoffs && L.playoffs.finalists && !L.playoffs.finalists.some(isMine) ? "non qualifié" : "" };
    return null;
  }
  if (md) {
    if (md > L.schedule.length) return null;
    const m = L.schedule[md - 1].find(m => m.some(isMine));
    if (!m) return { name, what: `Journée ${md} : repos`, res: "" };
    const r = L.results.find(x => x.week === w && (isMine(x.a) || isMine(x.b)));
    return { name, what: `Journée ${md} : contre <b>${displayName(isMine(m[0]) ? m[1] : m[0], L.game)}</b> (BO3)`, res: r ? resTxt(r) : "" };
  }
  if (w === PO_SEMI) { const sm = L.playoffs && L.playoffs.semis.find(x => isMine(x.a) || isMine(x.b)); return { name, what: "Demi-finales des playoffs (top 4)", res: sm ? resTxt(sm) : L.playoffs ? "non qualifié" : "" }; }
  if (w === PO_FINAL) { const f = L.playoffs && L.playoffs.final; return { name, what: "Grande finale des playoffs (BO5)", res: f ? (isMine(f.a) || isMine(f.b) ? resTxt(f) : "non qualifié") : "" }; }
  return null;
}
function resTxt(r) {
  const me = isMine(r.a) ? r.sa : r.sb, them = isMine(r.a) ? r.sb : r.sa, won = isMine(r.winner);
  return `<b class="${won ? "win" : "bad"}">${won ? "V" : "D"} ${me}-${them}</b>`;
}
// inscription du club à un tournoi : état et bouton pour s'inscrire ou décliner
function tourState(game, t) {
  const [name, week, prize, tiers, size, region] = t;
  if (!user().divisions[game]) return { st: "none" };
  const pool = tournamentPool(game, tiers, region);
  if (!pool.some(isMine)) {
    const anyRegion = tournamentPool(game, tiers, "").some(isMine);
    return { st: "no", html: anyRegion ? `<span class='muted' title='Réservé à : ${REGION_LABEL(region)}'>Autre région</span>` : "<span class='muted'>Non éligible</span>" };
  }
  const out = declined(game, name), past = week < S.week || (week === S.week && weekReport().done[tourKey(game, name)]);
  if (out) return { st: "out", html: `<span class="warn">Décliné</span>${past ? "" : ` <button class="small" data-act="tour-toggle" data-v="${esc(game + "|" + name)}">S'inscrire</button>`}` };
  if (invitational(tiers) && !tournamentField(game, tiers, size, region, name).some(isMine)) return { st: "noinv", html: "<span class='warn'>Hors invitations</span>" };
  return { st: "in", html: `<span class="ok">${invitational(tiers) ? "Invité" : "Inscrit"}</span>${past ? "" : ` <button class="small" data-act="tour-toggle" data-v="${esc(game + "|" + name)}" title="Ne pas participer : pas de frais de déplacement, les joueurs se reposent">Décliner</button>`}` };
}
function viewCalendar() {
  const u = user();
  if (!UI.calMode) UI.calMode = "mine";
  const myGames = Object.keys(u.divisions);
  const modes = [["mine", "Mes matchs et mes tournois"], ["eligible", "+ tournois de mes jeux"], ["all", "Tous les tournois"]]
    .map(([k, l]) => `<button class="tab small ${UI.calMode === k ? "active" : ""}" data-act="cal-mode" data-v="${k}">${l}</button>`).join("");
  const months = {};
  for (let w = SEASON_FIRST; w <= SEASON_LAST; w++) {
    const items = [];
    for (const L of userLeagues()) { const e = leagueEntry(L, w); if (e) items.push({ kind: "league", ...e }); }
    const games = UI.calMode === "all" ? Object.keys(GAMES) : myGames;
    for (const g of games) for (const t of allTournaments(g)) {
      if (t[1] !== w) continue;
      const r = tourStatus(g, t[0], w), state = tourState(g, t);
      const playing = r ? !!r.mine : state.st === "in";
      if (UI.calMode === "mine" && !playing && state.st !== "out") continue;
      items.push({ kind: t[0].startsWith("EWC") ? "ewc" : "tour", name: `${GAMES[g].icon} ${GAMES[g].short}`, what: `<b>${esc(t[0])}</b>${t[5] ? ` <small class="muted">${REGION_LABEL(t[5])}</small>` : ""} · ${t[2] ? money(t[2]) : "sans dotation"}`,
        res: r ? (r.mine ? (r.mine === 1 ? "<b class='win'>🏆 Vainqueur</b>" : `<b>${r.mine}e</b> / ${r.n}`) : `🏆 ${displayName(r.top[0], g)}`) : state.html || "" });
    }
    if (UI.calMode === "mine" && !items.length && w !== S.week) continue;
    const md = matchday(w);
    const tags = (md ? `<span class='chip'>${md <= 11 ? "Split 1" : "Split 2"} · J${md}</span>` : "") + (w >= EWC_FIRST && w <= EWC_LAST_WEEK ? "<span class='chip ewc'>🌍 EWC</span>" : "")
      + (w === PO_SEMI || w === PO_FINAL ? "<span class='chip'>🔥 Playoffs</span>" : "") + (w === SEASON_LAST ? "<span class='chip'>🏁 Fin de saison</span>" : "");
    const mo = weekMonday(S.season, w).getUTCMonth();
    (months[mo] = months[mo] || []).push(`<div class="card cal-week ${w === S.week ? "now" : w < S.week ? "past" : ""}" ${w === S.week ? 'id="cal-now"' : ""}>
      <div class="cal-head"><b>${weekLabel(S.season, w)}</b>${w === S.week ? "<span class='chip now'>Cette semaine</span>" : ""}${tags}</div>
      ${items.length ? items.map(it => `<div class="cal-item ${it.kind}"><span class="cal-game">${it.name}</span><span class="cal-what">${it.what}</span><span class="cal-res">${it.res}</span></div>`).join("") : "<p class='muted'>Rien de prévu.</p>"}
    </div>`);
  }
  const MONTH_FULL = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  return `<h2>🗓️ Calendrier ${S.season}</h2>
    <p class="muted" style="margin-top:-6px">La saison suit le vrai calendrier : split 1 de mi-janvier à fin mars, split 2 d'avril à mi-juin, Esports World Cup en juillet-août, playoffs en septembre, puis les championnats du monde jusqu'en décembre. Vous pouvez décliner un tournoi (pas de frais de déplacement, vos joueurs se reposent) ou vous y inscrire.</p>
    <div class="tabs">${modes}</div>${Object.entries(months).map(([m, ws]) => `<h3 style="margin-top:18px">${MONTH_FULL[m]} ${S.season}</h3><div class="cal-grid">${ws.join("")}</div>`).join("")}`;
}
ACTIONS["tour-toggle"] = v => {
  const k = v; S.tourChoice = S.tourChoice || {};
  if (S.tourChoice[k] === "out") delete S.tourChoice[k]; else S.tourChoice[k] = "out";
  // un tournoi de la semaine en cours : son plateau est retiré
  const rep = weekReport(); delete rep.fields["T:" + k];
  toast(S.tourChoice[k] === "out" ? "Tournoi décliné : pas de déplacement, vos joueurs se reposeront." : "Inscription confirmée.");
  scheduleSave(); render();
};

// ---------- tournois ----------
const accessLabel = t => ({ "1": "Invitation (tier 1)", "12": "Tiers 1 et 2", "2": "Tier 2", "23": "Open (tiers 2-3)", "3": "Open (tier 3)", "123": "Meilleurs de la région", "1230": "Open régional (tous tiers)" }[t] || t);
function tourStatus(game, name, week) {
  const r = (S.tourResults || []).find(x => x.season === S.season && x.game === game && x.name === name && x.week === week);
  if (!r) return null;
  return r;
}
function upcomingTours(limit) {
  const u = user(), rows = [];
  for (const g of Object.keys(u.divisions)) for (const t of allTournaments(g)) if (t[1] >= S.week) { const st = tourState(g, t); if (st.st === "in" || st.st === "out") rows.push({ g, t, st }); }
  return rows.sort((a, b) => a.t[1] - b.t[1]).slice(0, limit).map(({ g, t, st }) => `<div class="match-br">${weekLabel(S.season, t[1])} · ${GAMES[g].icon} <b>${esc(t[0])}</b> · ${t[2] ? money(t[2]) : "—"} · ${st.html}</div>`).join("");
}
function ewcCard() {
  const u = user(), done = S.ewcResult && S.ewcResult.season === S.season;
  const list = done ? S.ewcResult.ranking : ewcStandings();
  const rows = list.slice(0, 12).map((x, i) => `<tr class="${x.id === u.id ? "me" : ""}"><td>${i + 1}</td><td>${displayName(x.id)}</td><td>${x.pts}</td><td>${x.top8}</td><td>${x.wins}</td><td>${done ? money(x.prize || 0) : x.ok ? "<span class='ok'>Éligible</span>" : "<span class='muted'>1 top 8</span>"}</td></tr>`).join("");
  const me = list.findIndex(x => x.id === u.id);
  return `<div class="card" style="margin-bottom:16px"><h3>🌍 EWC Club Championship ${S.season} ${done ? "— terminé" : `— du ${weekLabel(S.season, EWC_FIRST)} au ${weekLabel(S.season, EWC_LAST_WEEK)}`}</h3>
    <p class="muted" style="margin-top:-6px;font-size:13px">L'Esports World Cup regroupe un tournoi par jeu. Chaque top 8 rapporte des points au club (1 000 pour un titre). Pour être classé, il faut un top 8 dans au moins 2 jeux ; 24 clubs se partagent 30 M€ (7 M€ pour le champion).</p>
    ${rows ? `<div class="table-wrap"><table><tr><th>#</th><th>Club</th><th>Pts</th><th>Top 8</th><th>Titres</th><th>${done ? "Dotation" : "Statut"}</th></tr>${rows}</table></div>${me >= 12 ? `<p>Vous : ${me + 1}e (${list[me].pts} pts)</p>` : ""}` : "<p class='muted'>Aucun point attribué pour l'instant.</p>"}</div>`;
}
function tourRow(t) {
  const g = GAMES[t.game];
  return `<div class="lobby"><div><b>${g.icon} ${esc(t.name)}</b> — ${t.place === 1 ? "<b class='win'>🏆 VAINQUEUR</b>" : `<b>${t.place}e</b> sur ${t.n}`}</div>
    <div>Gains : <b>${money(t.prize)}</b>${t.place > 1 ? ` · vainqueur : ${displayName(t.winner, t.game)}` : ""}</div></div>`;
}
function viewTours() {
  const u = user();
  if (!UI.tourGame) UI.tourGame = "mine";
  const games = UI.tourGame === "mine" ? (Object.keys(u.divisions).length ? Object.keys(u.divisions) : Object.keys(GAMES)) : UI.tourGame === "all" ? Object.keys(GAMES) : [UI.tourGame];
  const tabs = [["mine", "Mes jeux"], ["all", "Tous"]].concat(Object.keys(GAMES).map(k => [k, GAMES[k].icon + " " + GAMES[k].short]))
    .map(([k, l]) => `<button class="tab small ${UI.tourGame === k ? "active" : ""}" data-act="tour-game" data-v="${k}">${l}</button>`).join("");
  const rows = games.flatMap(g => allTournaments(g).map(t => [g, t])).filter(([g, t]) => UI.tourSize === "all" || (UI.tourSize === "big") === !(S.smallTours || []).some(x => x[5] === g && x[0] === t[0] && x[1] === t[1]))
    .sort((a, b) => a[1][1] - b[1][1] || b[1][2] - a[1][2]).map(([g, t]) => {
    const [name, week, prize, tiers, size, region] = t;
    const r = tourStatus(g, name, week);
    const status = r ? `🏆 ${displayName(r.top[0], g)}${r.mine ? ` · <b>vous : ${r.mine}e</b>` : ""}` : week < S.week ? "<span class='muted'>Annulé</span>" : week === S.week ? "<b class='warn'>Cette semaine</b>" : "À venir";
    const st = tourState(g, t);
    return `<tr class="${r && r.mine === 1 ? "me" : ""}"><td style="white-space:nowrap">${weekLabel(S.season, week)}</td><td>${gchip(g)}</td><td><b>${esc(name)}</b>${region ? ` <small class="muted">${REGION_LABEL(region)}</small>` : ""}</td><td>${prize ? money(prize) : "<span class='muted' title='Pas de cashprize : qualification et prestige'>—</span>"}</td><td>${accessLabel(tiers)}</td><td>${r ? r.n : tournamentField(g, tiers, size, region || "", name).length}${GAMES[g].fmt === "br" ? " " + GAMES[g].unit + "s" : ""}</td><td style="white-space:nowrap">${st.html || "<span class='muted'>—</span>"}</td><td>${status}</td></tr>`;
  }).join("");
  if (!UI.tourSize) UI.tourSize = "all";
  const stabs = [["all", "Tous les tournois"], ["big", "Grands tournois"], ["small", "Petits tournois & cash cups"]].map(([k, l]) => `<button class="tab small ${UI.tourSize === k ? "active" : ""}" data-act="tour-size" data-v="${k}">${l}</button>`).join("");
  return `<h2>📅 Tournois de la saison ${S.season}</h2>${ewcCard()}
    <p class="muted" style="margin-top:-6px">En plus des ligues, les tournois à cashprize, à leurs vraies dates. Les tournois sur invitation prennent les meilleures équipes ; les opens accueillent tous les clubs des tiers admis. Vous pouvez décliner un tournoi (pas de déplacement à payer, vos joueurs se reposent). Les gains sont partagés avec les joueurs selon leurs contrats.</p>
    <div class="tabs">${tabs}</div><div class="tabs">${stabs}</div>
    <div class="card table-wrap"><table><tr><th>Dates</th><th>Jeu</th><th>Tournoi</th><th>Dotation</th><th>Accès</th><th>Places</th><th>Vous</th><th>Résultat</th></tr>${rows}</table></div>`;
}

// ---------- finances ----------
const ETHIC = { ethique: ["🌱", "Éthique", "ok"], neutre: ["🤝", "Neutre", "muted"], controverse: ["🎰", "Controversée", "bad"] };
const imageTxt = v => v >= 80 ? "Excellente" : v >= 65 ? "Bonne" : v >= 50 ? "Correcte" : v >= 35 ? "Abîmée" : "Désastreuse";
function viewFinance() {
  const u = user(), season = S.season;
  if (!UI.finGame) UI.finGame = "all";
  const led = (S.ledger || []).filter(e => e[0] === season);
  // compte de résultat de la saison, par catégorie
  const byCat = {}; for (const [, , cat, amt] of led) byCat[cat] = (byCat[cat] || 0) + amt;
  const inc = Object.entries(byCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]), exp = Object.entries(byCat).filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);
  const tot = l => l.reduce((s, [, v]) => s + v, 0);
  const catRows = l => l.map(([k, v]) => `<tr><td>${BOOK_LABELS[k] || k}</td><td style="text-align:right" class="${v >= 0 ? "ok" : "bad"}">${money(v)}</td></tr>`).join("") || "<tr><td class='muted'>—</td></tr>";
  // par jeu : ce que chaque section rapporte et coûte, et son budget mercato
  const games = Object.keys(u.divisions);
  const gameRows = games.map(g => {
    const e = led.filter(x => x[4] === g), plus = e.filter(x => x[3] > 0).reduce((s, x) => s + x[3], 0), minus = e.filter(x => x[3] < 0).reduce((s, x) => s + x[3], 0);
    const a = allocOf(g), room = transferRoom(g), wages = gameWages(g);
    return `<tr><td>${gchip(g)}</td><td class="ok" style="text-align:right">${money(plus)}</td><td class="bad" style="text-align:right">${money(minus)}</td><td style="text-align:right" class="${plus + minus >= 0 ? "ok" : "bad"}"><b>${money(plus + minus)}</b></td>
      <td style="text-align:right">${money(a.transfer)}</td><td style="text-align:right" class="${room < 0 ? "bad" : ""}">${money(room)}</td><td style="text-align:right" class="${wages > a.wages ? "bad" : ""}">${money(wages)} / ${money(a.wages)}</td></tr>`;
  }).join("");
  const F = S.finance.slice(-52);
  let chart = "<p class='muted'>Jouez quelques semaines pour voir l'évolution.</p>";
  if (F.length > 1) {
    const max = Math.max(...F.map(f => f.budget)), min = Math.min(0, ...F.map(f => f.budget));
    const W = 600, H = 170, x = i => 10 + i * (W - 20) / (F.length - 1), y = v => H - 10 - (v - min) / ((max - min) || 1) * (H - 20);
    const path = F.map((f, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(f.budget).toFixed(1)}`).join("");
    chart = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Évolution du budget">
      <line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line)" stroke-dasharray="4"/>
      <path d="${path}" fill="none" stroke="${u.color}" stroke-width="3" vector-effect="non-scaling-stroke"/></svg>
      <div class="muted" style="display:flex;justify-content:space-between;font-size:12px"><span>${F[0].label}${F[0].season ? " " + F[0].season : ""}</span><span>max ${money(max)}</span><span>${F[F.length - 1].label}</span></div>`;
  }
  const ps = allUserPlayers();
  const fans0 = (S.finance.find(f => f.season === season) || {}).fans;
  const deals = u.sponsorDeals.map(d => { const e = ETHIC[d.ethic || "neutre"]; return `<tr><td>${e[0]} <b>${esc(d.name)}</b></td><td class="${e[2]}">${e[1]}</td><td>${money(d.weekly)}/sem</td><td>${d.weeks} sem. restantes</td><td>${money(d.weekly * d.weeks)} à venir</td></tr>`; }).join("");
  const gameSel = `<select data-change="fin-game" aria-label="Filtrer par jeu"><option value="all">Toutes les sections</option><option value="" ${UI.finGame === "" ? "selected" : ""}>Club (général)</option>${games.map(g => `<option value="${g}" ${UI.finGame === g ? "selected" : ""}>${GAMES[g].icon} ${GAMES[g].short}</option>`).join("")}</select>`;
  const ledRows = led.filter(e => UI.finGame === "all" || e[4] === UI.finGame).slice(-60).reverse().map(([sn, w, cat, amt, g, label]) => `<tr><td style="white-space:nowrap">${weekLabel(sn, w)}</td><td>${g ? gchip(g) : "<span class='muted'>Club</span>"}</td><td>${BOOK_LABELS[cat] || cat}</td><td>${esc(label)}</td><td style="text-align:right" class="${amt >= 0 ? "ok" : "bad"}">${amt >= 0 ? "+" : ""}${money(amt)}</td></tr>`).join("");
  return `<h2>Finances — saison ${season}</h2><div class="grid g3">
    <div class="card"><h3>Budget</h3><div class="kpi ${u.budget < 0 ? "bad" : ""}">${money(u.budget)}</div><div class="muted">Résultat de la saison : <b class="${tot(inc) + tot(exp) >= 0 ? "ok" : "bad"}">${money(tot(inc) + tot(exp))}</b></div></div>
    <div class="card"><h3>Masse salariale</h3><div class="kpi">${money(ps.reduce((s, p) => s + p.salary, 0))}<span class="muted" style="font-size:14px">/sem</span></div><div class="muted">${money(ps.reduce((s, p) => s + p.salary, 0) * SEASON_WEEKS)} sur la saison · valeur de l'effectif ${money(ps.reduce((s, p) => s + playerValue(p), 0))}</div></div>
    <div class="card"><h3>Image & fans</h3><div class="kpi">${imageTxt(u.image ?? 60)} <span class="muted" style="font-size:14px">${Math.round(u.image ?? 60)}/100</span></div>${bar(u.image ?? 60)}<div class="muted">${u.fans.toLocaleString("fr-FR")} fans${fans0 ? ` · <b class="${u.fans >= fans0 ? "ok" : "bad"}">${u.fans >= fans0 ? "+" : ""}${(u.fans - fans0).toLocaleString("fr-FR")}</b> cette saison` : ""}</div></div>
  </div>
  <div class="card" style="margin-top:16px"><h3>Évolution du budget</h3>${chart}</div>
  <div class="card" style="margin-top:16px"><div class="toolbar"><h3 style="margin:0;flex:1">Budget par section</h3><button class="small primary" data-act="alloc">⚖️ Répartir le budget mercato</button></div>
    <p class="muted" style="margin-top:-4px;font-size:13px">Chaque section dispose d'une enveloppe mercato (indemnités, primes à la signature, commissions d'agents ; les ventes la renflouent) et d'un plafond de masse salariale. Les signatures qui les dépassent sont refusées : vous respectez ainsi votre budget total.</p>
    <div class="table-wrap"><table><tr><th>Jeu</th><th style="text-align:right">Recettes</th><th style="text-align:right">Dépenses</th><th style="text-align:right">Résultat</th><th style="text-align:right">Enveloppe mercato</th><th style="text-align:right">Reste</th><th style="text-align:right">Salaires / plafond (sem.)</th></tr>${gameRows || "<tr><td colspan='7' class='muted'>Aucune section.</td></tr>"}</table></div></div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>Recettes de la saison <span class="ok">${money(tot(inc))}</span></h3><table>${catRows(inc)}</table></div>
    <div class="card"><h3>Dépenses de la saison <span class="bad">${money(tot(exp))}</span></h3><table>${catRows(exp)}</table></div>
  </div>
  <div class="card" style="margin-top:16px"><div class="toolbar"><h3 style="margin:0;flex:1">Contrats de sponsoring</h3>
    <button class="small" data-act="prospect" data-v="ethique" title="Moins bien payé, améliore l'image : vos victoires attirent plus de fans">🌱 Marque éthique</button>
    <button class="small" data-act="prospect" data-v="neutre">🤝 Marque classique</button>
    <button class="small" data-act="prospect" data-v="controverse" title="Paris, crypto, casinos : très bien payé, mais l'image du club se dégrade et les fans fuient">🎰 Marque controversée</button></div>
    <p class="muted" style="margin-top:-4px;font-size:13px">L'image du club dépend de vos sponsors. Avec une bonne image, chaque victoire attire plus de fans et les défaites en font moins partir ; avec des sponsors controversés, c'est l'inverse, et des fans partent chaque semaine.</p>
    ${deals ? `<div class="table-wrap"><table>${deals}</table></div>` : "<p class='muted'>Aucun contrat spécifique. Démarchez une marque (une tentative par semaine) ou attendez les offres.</p>"}</div>
  <div class="card" style="margin-top:16px"><div class="toolbar"><h3 style="margin:0;flex:1">Grand livre</h3>${gameSel}</div>
    <div class="table-wrap"><table><tr><th>Semaine</th><th>Section</th><th>Catégorie</th><th>Détail</th><th style="text-align:right">Montant</th></tr>${ledRows || "<tr><td colspan='5' class='muted'>Aucune opération.</td></tr>"}</table></div>
    ${led.length > 60 ? `<p class="muted" style="font-size:12px">Les 60 dernières opérations sont affichées.</p>` : ""}</div>`;
}
// répartition du budget mercato entre les sections (début de saison, ou à tout moment)
function allocModal(intro) {
  const u = user(), games = Object.keys(u.divisions);
  if (!games.length) return;
  const rows = games.map(g => { const a = allocOf(g); return `<tr><td>${gchip(g)} <small class="muted">${esc(divName(u.id, g))}</small></td>
    <td><input type="number" min="0" step="10000" id="al-t-${g}" data-change="al-t" value="${a.transfer}" style="width:130px"><div class="muted" style="font-size:11px">déjà dépensé : ${money(Math.max(0, a.spent))}</div></td>
    <td><input type="number" min="0" step="500" id="al-w-${g}" data-change="al-w" value="${a.wages}" style="width:110px"><div class="muted" style="font-size:11px">actuel : ${money(gameWages(g))}/sem</div></td></tr>`; }).join("");
  modal(`<h2>⚖️ Budget mercato ${S.season}</h2>${intro ? `<p>${intro}</p>` : ""}
    <p class="muted" style="font-size:13px">Budget du club : <b>${money(u.budget)}</b>. Gardez de quoi payer les salaires et les frais de la saison (environ ${money(Math.max(0, allUserPlayers().reduce((s, p) => s + p.salary, 0) * 10))} pour 10 semaines de salaires) : le reste peut être réparti entre vos sections.</p>
    <div class="table-wrap"><table><tr><th>Section</th><th>Enveloppe mercato (€)</th><th>Plafond salarial (€/sem)</th></tr>${rows}</table></div>
    <p id="al-sum" class="muted"></p>
    <div class="actions"><button data-act="close-modal">Plus tard</button><button data-act="alloc-auto">Répartition conseillée</button><button class="primary" data-act="alloc-save">Valider</button></div>`);
  allocSum();
}
function allocSum() {
  const el = document.getElementById("al-sum"); if (!el) return;
  const total = Object.keys(user().divisions).reduce((s, g) => s + (+document.getElementById("al-t-" + g).value || 0), 0);
  el.innerHTML = `Total réparti : <b class="${total > user().budget ? "bad" : "ok"}">${money(total)}</b> sur ${money(user().budget)}.`;
}
ACTIONS["alloc"] = () => allocModal();
ACTIONS["alloc-auto"] = () => { const d = defaultAlloc(); for (const g of Object.keys(d.games)) { document.getElementById("al-t-" + g).value = d.games[g].transfer; document.getElementById("al-w-" + g).value = d.games[g].wages; } allocSum(); };
ACTIONS["alloc-save"] = () => {
  const map = {}; for (const g of Object.keys(user().divisions)) map[g] = { transfer: +document.getElementById("al-t-" + g).value || 0, wages: +document.getElementById("al-w-" + g).value || 0 };
  const e = setAlloc(map); if (e) return toast(e);
  closeModal(); toast("Budget réparti entre vos sections."); scheduleSave(); render();
};

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
// boîte de réception façon Football Manager : catégories et jeux (filtres combinables), recherche, volet de lecture
const MAIL_CATS = [["all", "📥", "Tous les messages", null], ["unread", "🔵", "Non lus", null], ["match", "📋", "Résultats", ["match", "trophy"]], ["transfer", "✍️", "Mercato & contrats", ["transfer"]],
  ["sponsor", "💰", "Sponsors & finances", ["sponsor"]], ["board", "👔", "Conseil d'administration", ["board"]], ["club", "🏠", "Vie du club", ["event", "info"]], ["news", "📰", "Actualités", ["news"]]];
const MAIL_ICON = { match: "📋", trophy: "🏆", transfer: "✍️", sponsor: "💰", board: "👔", event: "⚡", info: "ℹ️", news: "📰" };
const MAIL_ACTION = { transfer: ["market", "Aller au mercato"], sponsor: ["finance", "Voir les finances"], board: ["dash", "Tableau de bord"], match: ["comp", "Voir le classement"], trophy: ["world", "Palmarès"] };
function viewInbox() {
  const I = UI.inbox || (UI.inbox = { cat: "all", game: "all", q: "" });
  const inCat = (m, k) => { const c = MAIL_CATS.find(x => x[0] === k); return k === "all" || (k === "unread" ? !m.read : c && c[3].includes(m.type)); };
  const inGame = m => I.game === "all" || (I.game === "" ? !m.game : m.game === I.game);
  const q = I.q.toLowerCase();
  const list = S.inbox.filter(m => inCat(m, I.cat) && inGame(m) && (!q || (m.title + " " + m.body).toLowerCase().includes(q)));
  const cats = MAIL_CATS.map(([k, ic, l]) => { const n = S.inbox.filter(m => inCat(m, k) && inGame(m) && !m.read).length;
    return `<button class="inbox-cat ${I.cat === k ? "active" : ""}" data-act="mail-cat" data-v="${k}"><span>${ic} ${l}</span>${n ? `<span class="pill">${n}</span>` : ""}</button>`; }).join("");
  const present = [...new Set(S.inbox.map(m => m.game).filter(Boolean))];
  const gameList = [...new Set(Object.keys(user().divisions).concat(present))];
  const games = [["all", "🎮 Tous les jeux"], ["", "🏢 Club (général)"]].concat(gameList.map(g => [g, `${GAMES[g].icon} ${GAMES[g].short}`]))
    .map(([k, l]) => { const n = S.inbox.filter(m => (k === "all" || (k === "" ? !m.game : m.game === k)) && inCat(m, I.cat) && !m.read).length;
      return `<button class="inbox-cat ${I.game === k ? "active" : ""}" data-act="mail-game" data-v="${k}"><span>${l}</span>${n ? `<span class="pill">${n}</span>` : ""}</button>`; }).join("");
  if (!UI.mailOpen || !list.some(m => m.id === UI.mailOpen)) UI.mailOpen = list[0] ? list[0].id : null;
  const open = S.inbox.find(m => m.id === UI.mailOpen);
  let lastDay = "";
  const rows = list.slice(0, 200).map(m => {
    const day = weekLabel(m.season, m.week, true), head = day !== lastDay ? `<div class="inbox-day">${day}</div>` : ""; lastDay = day;
    return `${head}<div class="inbox-item ${m.read ? "" : "unread"} ${m.id === UI.mailOpen ? "sel" : ""}" data-act="open-mail" data-v="${m.id}">
      ${/^[A-Za-zÀ-ÿ0-9]/.test(m.title) ? `<span class="inbox-ic">${MAIL_ICON[m.type] || "✉️"}</span>` : ""}<div style="min-width:0;flex:1"><div class="t">${m.title}</div></div>${m.game && GAMES[m.game] ? `<span class="chip" style="border-color:${GAMES[m.game].color}">${GAMES[m.game].icon} ${GAMES[m.game].short}</span>` : ""}</div>`;
  }).join("");
  const act = open && MAIL_ACTION[open.type];
  const reader = open ? `<div class="inbox-meta">${MAIL_ICON[open.type] || "✉️"} ${(MAIL_CATS.find(c => c[3] && c[3].includes(open.type)) || [, , "Message"])[2]} · ${weekLabel(open.season, open.week, true)}${open.game && GAMES[open.game] ? ` · ${gchip(open.game)}` : ""}</div>
    <h3 class="inbox-title">${open.title}</h3><div class="inbox-body">${open.body}</div>
    <div class="actions" style="justify-content:flex-start">${act ? `<button class="small primary" data-act="mail-go" data-v="${act[0]}">${act[1]}</button>` : ""}<button class="small" data-act="mail-unread" data-v="${open.id}">Marquer comme non lu</button><button class="small danger" data-act="mail-del" data-v="${open.id}">Supprimer</button></div>`
    : `<p class="muted">Aucun message ne correspond à ces filtres.</p>`;
  return `<div class="toolbar"><h2 style="margin:0;flex:1">Messagerie</h2><input data-change="mail-q" placeholder="Rechercher…" value="${esc(I.q)}" aria-label="Rechercher dans les messages"><button class="small" data-act="read-all">Tout marquer comme lu</button></div>
    <div class="inbox">
      <aside class="inbox-side card"><div class="inbox-h">Catégories</div>${cats}<div class="inbox-h" style="margin-top:12px">Jeux</div>${games}</aside>
      <div class="inbox-list card">${rows || "<p class='muted' style='padding:12px'>Vide.</p>"}</div>
      <div class="inbox-read card">${reader}</div>
    </div>`;
}
ACTIONS["mail-cat"] = v => { UI.inbox.cat = v; UI.mailOpen = null; render(); };
ACTIONS["mail-game"] = v => { UI.inbox.game = v; UI.mailOpen = null; render(); };
ACTIONS["mail-go"] = v => { if (v === "market" && UI.inbox && UI.inbox.game) UI.market.game = UI.inbox.game; if (v === "comp") { const m = S.inbox.find(x => x.id === UI.mailOpen); if (m && m.game) ACTIONS["comp-game"](m.game); } UI.view = v; render(); };
ACTIONS["mail-unread"] = v => { const m = S.inbox.find(x => x.id === v); if (m) m.read = false; render(); };
ACTIONS["mail-del"] = v => { S.inbox = S.inbox.filter(x => x.id !== v); UI.mailOpen = null; scheduleSave(); render(); };

// ---------- monde ----------
function viewWorld() {
  const clubs = Object.values(S.clubs).filter(c => ((!c.filler && !c.solo) || c.titles.length || c.id === S.userId) && !c.sister).sort((a, b) => b.fame - a.fame).slice(0, 100);
  const divs = c => Object.entries(c.divisions).map(([g, d]) => `<span class="chip" style="border-color:${GAMES[g].color}">${GAMES[g].icon} ${GAMES[g].short} <small class="muted">${tshort(g, d.tier)}</small></span>`).join(" ");
  const rows = clubs.map((c, i) => `<tr class="${c.id === S.userId ? "me" : ""}"><td>${i + 1}</td><td><span style="color:${c.color}">■</span> <b data-act="club-info" data-v="${c.id}" style="cursor:pointer">${esc(c.name)}</b></td><td>${flag(c.country)}</td>
    <td>${c.fame.toFixed(1)}</td><td>${c.fans.toLocaleString("fr-FR")}</td><td>${divs(c)}</td><td>${c.titles.length ? "🏆 × " + c.titles.length : ""}</td></tr>`).join("");
  const hist = S.titles.slice().reverse().slice(0, 80).map(t => `<tr><td>${t.season}</td><td>${GAMES[t.game] ? gchip(t.game) : "<span class='chip'>🌍 EWC</span>"}</td><td>${t.tier ? (GAMES[t.game] && GAMES[t.game].open ? "<span class='chip'>Circuit</span>" : tchip(t.tier)) + (t.name ? " " + esc(t.name) : " Ligue") : `<span class="chip">🏆 ${esc(t.name)}</span>`}</td><td class="${t.clubId === S.userId ? "ok" : ""}"><b>${esc(t.club)}</b></td></tr>`).join("");
  return `<h2>Clubs & palmarès</h2><div class="grid g2">
    <div class="card table-wrap"><h3>Classement mondial des clubs (notoriété)</h3><table><tr><th>#</th><th>Club</th><th></th><th>Notoriété</th><th>Fans</th><th>Divisions</th><th>Titres</th></tr>${rows}</table></div>
    <div class="card table-wrap"><h3>Palmarès</h3>${hist ? `<table><tr><th>Saison</th><th>Jeu</th><th>Compétition</th><th>Champion</th></tr>${hist}</table>` : "<p class='muted'>Aucun titre décerné pour l'instant.</p>"}</div></div>`;
}
function clubInfo(id) {
  const c = S.clubs[id];
  const divs = Object.entries(c.divisions).map(([g, d]) => `<h3 style="margin-top:12px">${GAMES[g].icon} ${GAMES[g].name}${d.label ? ` — ${esc(d.label)}` : ""} · ${esc(divName(id, g))} · ${GAMES[g].open ? "statut " : ""}${tierLabel(g, d.tier)} ${d.generated ? "<span class='warn' title='Le club a bien une équipe dans ce jeu, mais son effectif réel est introuvable'>* joueurs inventés</span>" : d.verified ? "<span class='ok' title='Effectif recoupé dans des sources 2026'>✓ 2026</span>" : c.filler ? "" : "<span class='muted' title='Effectif établi de mémoire, peut être dépassé'>≈ non vérifié</span>"}</h3><div class="table-wrap"><table>${clubPlayers(id, g).sort((a, b) => b.starter - a.starter || b.rating - a.rating).map(p => `<tr><td>${p.starter ? "⭐" : ""}</td><td>${flag(p.nat)} ${esc(p.handle)}</td><td class="muted">${p.role}</td><td>${ageTxt(p)} ans</td><td>${R(p.rating)}</td><td>${potTxt(p)}</td></tr>`).join("")}</table></div>`).join("");
  modal(`<div style="display:flex;gap:12px;align-items:center">${badge(c)}<div><h2 style="margin:0">${esc(c.name)} ${flag(c.country)}</h2><span class="muted">${c.solo ? "Pro indépendant · " : ""}Notoriété ${c.fame.toFixed(1)} · ${c.fans.toLocaleString("fr-FR")} fans${c.titles.length ? " · 🏆 " + c.titles.map(esc).join(", ") : ""}</span></div></div>${divs}<div class="actions"><button data-act="close-modal">Fermer</button></div>`);
}

// =====================================================================
//  Actions
// =====================================================================
Object.assign(ACTIONS, {
  "screen": v => { UI.screen = v; renderHome(); },
  "pick-club": v => { UI.pickClub = v; const ceo = document.getElementById("f-ceo").value; renderHome(); document.getElementById("f-ceo").value = ceo; },
  "start-create": () => {
    const val = id => document.getElementById(id).value.trim();
    const name = val("f-name"), tag = val("f-tag").toUpperCase();
    if (!name || tag.length < 2) return toast("Indiquez un nom de club et un tag de 2 à 4 lettres.");
    newWorld({ ceo: val("f-ceo") || "Le CEO", mode: "create", name, tag, country: val("f-country"), color: val("f-color"), firstGame: val("f-game") });
    UI.view = "dash"; UI.market.status = "free"; UI.market.game = val("f-game"); render(); maybeAlloc();
  },
  "start-takeover": () => {
    newWorld({ ceo: document.getElementById("f-ceo").value.trim() || "Le CEO", mode: "takeover", clubId: UI.pickClub });
    UI.view = "dash"; render(); maybeAlloc();
  },
  "continue": () => { if (load()) { UI.view = "dash"; render(); } },
  "wipe": () => modal(`<h2>Effacer la sauvegarde ?</h2><p>La partie en cours sera définitivement perdue.</p><div class="actions"><button data-act="close-modal">Annuler</button><button class="danger" data-act="do-wipe">Effacer</button></div>`),
  "do-wipe": () => { wipeSave(); closeModal(); renderHome(); },
  "quit": () => { save(); S = null; UI.screen = "home"; UI.compGame = UI.compTier = UI.rosterGame = null; renderHome(); },
  "view": v => { UI.view = v; render(); window.scrollTo(0, 0); },
  "roster-game": v => { UI.rosterGame = v; render(); },
  "comp-game": v => { UI.compGame = v; const d = user().divisions[v]; UI.compTier = d ? d.tier : 1; UI.compZone = d ? d.zone : null; render(); },
  "comp-tier": v => { UI.compTier = +v; render(); },
  "comp-zone": v => { UI.compZone = v; render(); },
  "tour-game": v => { UI.tourGame = v; render(); },
  "tour-size": v => { UI.tourSize = v; render(); },
  "cal-mode": v => { UI.calMode = v; render(); },
  "goto-market": v => { UI.market.game = v; UI.market.page = 0; UI.view = "market"; render(); },
  "open-div": v => {
    const [game, t] = v.split("|"), tier = +t, g = GAMES[game];
    const z = zoneFrom(game, REGION_OF[user().country] || "EU", user().country);
    modal(`<h2>${g.icon} ${g.name} · ${tierLabel(game, tier)}</h2><p>Entrée dans le <b>${esc(tierName(game, g.open ? 1 : tier, z))}</b> (${ZONE_NAMES[z]}) : <b>${money(tierEntry(game, tier))}</b>.<br>
      Il vous faudra ${g.size} joueur(s) titulaire(s). Frais de fonctionnement : ${money(TIER_OP[tier - 1] * g.size * g.mult)}/sem. Cashprize du circuit : ${money(tierPrize(game, tier))}.</p>
      <div class="actions"><button data-act="close-modal">Annuler</button><button class="primary" data-act="confirm-open" data-v="${v}">Confirmer</button></div>`);
  },
  "confirm-open": v => { const [game, t] = v.split("|"); const e = openDivision(game, +t); closeModal(); if (e) toast(e); else { UI.rosterGame = game; toast("Division ouverte !"); } render(); },
  "close-div": () => modal(`<h2>Fermer la division ${GAMES[UI.rosterGame].name} ?</h2><p>Tous les joueurs seront libérés (indemnités de rupture) et le club perdra en notoriété.</p><div class="actions"><button data-act="close-modal">Annuler</button><button class="danger" data-act="confirm-close">Fermer la division</button></div>`),
  "create-academy": () => { const e = createAcademy(UI.rosterGame); toast(e || "🎓 Académie créée !"); save(); render(); },
  "to-academy": v => { toast(moveToAcademy(v)); save(); render(); },
  "close-academy": () => modal(`<h2>Fermer l'académie ${GAMES[UI.rosterGame].name} ?</h2><p>Ses joueurs seront libérés (indemnités de rupture). Faites d'abord monter ceux que vous voulez garder.</p><div class="actions"><button data-act="close-modal">Annuler</button><button class="danger" data-act="confirm-close-academy">Fermer l'académie</button></div>`),
  "confirm-close-academy": () => { closeAcademy(UI.rosterGame); closeModal(); save(); render(); },
  "confirm-close": () => { closeDivision(UI.rosterGame); UI.rosterGame = null; closeModal(); render(); },
  "starter": v => { const e = toggleStarter(v); if (e) toast(e); render(); },
  "m-sort-col": v => { const m = UI.market; m.dir = m.sort === v ? -m.dir : 1; m.sort = v; m.page = 0; render(); },
  "m-reset": () => { UI.market = { ...MARKET_DEFAULT, game: UI.market.game, per: UI.market.per, sort: UI.market.sort, dir: UI.market.dir }; render(); },
  "m-page": v => { UI.market.page = +v; render(); window.scrollTo(0, 0); },
  "auto-lineup": () => { autoStarters(S.userId, UI.rosterGame); render(); },
  "renew": v => openNego(startNegotiation(v, "renew")),
  "contract": v => contractModal(v),
  "sell": v => { const p = S.players[v]; modal(`<h2>Vendre ${esc(p.handle)} ?</h2><p>Un club est prêt à payer environ <b>${money(playerValue(p) * 0.9)}</b>.</p><div class="actions"><button data-act="close-modal">Annuler</button><button class="primary" data-act="do-sell" data-v="${v}">Vendre</button></div>`); },
  "do-sell": v => { const fee = sellPlayer(v); closeModal(); toast("Vendu pour " + money(fee)); render(); },
  "release": v => { const p = S.players[v]; modal(`<h2>Libérer ${esc(p.handle)} ?</h2><p>Indemnité de rupture : <b>${money(Math.round(p.salary * 52 * p.years * 0.25))}</b>.</p><div class="actions"><button data-act="close-modal">Annuler</button><button class="danger" data-act="do-release" data-v="${v}">Libérer</button></div>`); },
  "do-release": v => { releasePlayer(v); closeModal(); render(); },
  "sign": v => {
    const u = user(), p = S.players[v];
    if (!u.divisions[p.game]) return toast(`Ouvrez d'abord une division ${GAMES[p.game].name} (onglet Effectifs).`);
    openNego(startNegotiation(v, "sign"));
  },
  "offer": v => {
    const p = S.players[v], u = user(), c = S.clubs[p.club];
    if (!u.divisions[p.game]) return toast(`Ouvrez d'abord une division ${GAMES[p.game].name} (onglet Effectifs).`);
    const ask = askingPrice(p);
    modal(`<h2>${c.solo ? "Recruter" : "Offre pour"} ${flag(p.nat)} ${esc(p.handle)}</h2><p>${c.solo ? "Pro indépendant" : esc(c.name)} · ${GAMES[p.game].name} · ${p.role} · ${ageTxt(p)} ans · ${R(p.rating)} · potentiel ${potTxt(p)}</p>
      <p>Valeur estimée : ${money(playerValue(p))} · ${c.solo ? "Prime demandée" : "Le club en attend"} environ <b>${money(ask)}</b>.${p.clause ? `<br>Clause libératoire : <b>${money(p.clause)}</b> (le club ne peut pas refuser si vous la payez).` : ""}</p>
      <div class="form-row"><label for="f-fee">${c.solo ? "Prime de recrutement" : "Indemnité de transfert"} (€)</label><input id="f-fee" type="number" step="500" value="${ask}"></div>
      <p class="muted" style="font-size:12px">Si l'offre est acceptée, vous négocierez ensuite le contrat avec le joueur et son agent.</p>
      <div class="actions"><button data-act="close-modal">Annuler</button>${p.clause ? `<button data-act="pay-clause" data-v="${v}">Payer la clause</button>` : ""}<button class="primary" data-act="do-offer" data-v="${v}">Envoyer l'offre</button></div>`);
  },
  "do-offer": v => {
    const fee = +document.getElementById("f-fee").value, e = transferFeeCheck(v, fee);
    if (e) { closeModal(); return toast(e); }
    openNego(startNegotiation(v, "transfer", fee), `Offre acceptée par le club (${money(fee)}). Place à la négociation avec le joueur.`);
  },
  "pay-clause": v => openNego(payClause(v), `Vous payez la clause libératoire (${money(S.players[v].clause)}). Il reste à convaincre le joueur.`),
  "upgrade": v => { const e = upgradeFacility(v); if (e) toast(e); render(); },
  "open-mail": v => { const m = S.inbox.find(x => x.id === v); if (m) { m.read = true; UI.mailOpen = v; } if (UI.view !== "inbox") { UI.view = "inbox"; UI.inbox = { cat: "all", game: "all", q: "" }; } render(); },
  "read-all": () => { S.inbox.forEach(m => m.read = true); render(); },
  "club-info": v => clubInfo(v),
  "close-modal": () => closeModal(),
});

// ---------- négociation de contrats ----------
let NEGO = null;
const CTX_LABEL = { sign: "Signature", transfer: "Transfert", renew: "Prolongation" };
function openNego(N, intro) {
  if (!N || N.error) { closeModal(); return toast(N ? N.error : "Négociation impossible."); }
  NEGO = N;
  const d = N.dem;
  // première proposition pré-remplie avec les demandes, à vous de les ajuster
  NEGO.draft = { region: d.region, status: d.status, salary: d.salary, years: d.years[0] === 1 ? 2 : d.years[0], bonus: d.bonus, agentFee: d.agentFee, prizeShare: d.prizeShare, winBonus: d.winBonus, clause: d.clauseMax || 0 };
  negoModal(intro || "");
}
function negoModal(reply, tone) {
  const N = NEGO, p = S.players[N.pid], d = N.dem, o = N.draft, pers = personalityOf(p);
  const mood = N.patience / N.maxPatience;
  const moodTxt = mood > 0.7 ? "😊 Ouvert" : mood > 0.45 ? "😐 Agacé" : mood > 0.2 ? "😠 Énervé" : "🤬 Au bord de la rupture";
  const field = (id, label, val, want, step = 50, extra = "") => `<div class="form-row nego-f"><label for="${id}">${label}</label><input id="${id}" type="number" min="0" step="${step}" value="${val}" ${extra}><small class="muted">Demande : ${want}</small></div>`;
  const log = N.log.map((l, i) => `<li>Offre ${i + 1} : ${money(l.offer.salary)}/sem, ${l.offer.years} an(s), ${l.offer.prizeShare} % des gains</li>`).join("");
  modal(`<h2>✍️ ${CTX_LABEL[N.ctx]} — ${flag(p.nat)} ${esc(p.handle)}</h2>
    <p class="muted" style="margin-top:-6px">${GAMES[p.game].icon} ${GAMES[p.game].short} · ${p.role} · ${ageTxt(p)} ans · note ${R(p.rating)} · potentiel ${potTxt(p)}${N.ctx === "transfer" ? ` · indemnité ${money(N.fee)}` : ""}</p>
    <div class="nego-head"><div><span class="muted">Personnalité</span><b>${pers}</b><small class="muted">${PERSONALITIES[pers].desc}</small></div>
      <div><span class="muted">Patience</span><b>${moodTxt}</b>${bar(mood * 100)}</div></div>
    ${reply ? `<div class="reply ${tone || ""}">${reply}</div>` : ""}
    <div class="nego-grid">
      <div class="form-row nego-f"><label for="n-region">Région de jeu</label><select id="n-region">${Object.entries(REGIONS).map(([k, l]) => `<option value="${k}" ${k === (o.region || d.region) ? "selected" : ""}>${l}</option>`).join("")}</select><small class="muted">Originaire de : ${REGIONS[homeRegion(p)]}${d.region !== homeRegion(p) ? ` · joue en ${REGIONS[d.region]}` : ""}</small></div>
      <div class="form-row nego-f"><label for="n-status">Statut promis</label><select id="n-status">${STATUSES.slice().reverse().map(x => `<option ${x === o.status ? "selected" : ""}>${x}</option>`).join("")}</select><small class="muted">Demande : ${d.status}</small></div>
      <div class="form-row nego-f"><label for="n-years">Durée</label><select id="n-years">${[1, 2, 3, 4].map(y => `<option value="${y}" ${y === o.years ? "selected" : ""}>${y} an${y > 1 ? "s" : ""}</option>`).join("")}</select><small class="muted">Souhaite : ${d.years[0]} à ${d.years[1]} ans</small></div>
      ${field("n-salary", "Salaire (€/semaine)", o.salary, money(d.salary))}
      ${field("n-bonus", "Prime à la signature (€)", o.bonus, money(d.bonus), 500)}
      ${field("n-agent", "Commission de l'agent (€)", o.agentFee, money(d.agentFee), 100)}
      ${field("n-share", "Part du cashprize pour le joueur (%)", o.prizeShare, d.prizeShare + " %", 1, 'max="100"')}
      ${field("n-win", "Prime par victoire (€)", o.winBonus, money(d.winBonus))}
      ${field("n-clause", "Clause libératoire (€, 0 = aucune)", o.clause, d.clauseMax ? "≤ " + money(d.clauseMax) : "indifférent", 10000)}
    </div>
    <p class="muted" style="font-size:12px">À payer à la signature : prime + commission${N.ctx === "transfer" ? " + indemnité" : ""}. Une clause basse rassure le joueur mais un autre club pourra le racheter à ce prix. Une offre trop basse vexe l'agent et fait fondre sa patience ; à zéro, le joueur claque la porte pour un mois. Demander à un joueur de jouer dans une autre région : certains refusent net, d'autres veulent un meilleur salaire pour s'installer, et il lui faudra ${ADAPT_WEEKS} semaines d'adaptation. Règlement : tous les titulaires d'une équipe jouent dans la même région.</p>
    ${log ? `<ul class="muted" style="font-size:12px">${log}</ul>` : ""}
    <div class="actions"><button data-act="nego-quit">Abandonner</button><button class="primary" data-act="nego-propose">Faire l'offre</button></div>`);
}
function readOffer() {
  const n = id => Math.max(0, +document.getElementById(id).value || 0);
  return { region: document.getElementById("n-region").value, status: document.getElementById("n-status").value, years: +document.getElementById("n-years").value, salary: n("n-salary"), bonus: n("n-bonus"),
    agentFee: n("n-agent"), prizeShare: clamp(Math.round(n("n-share")), 0, 100), winBonus: n("n-win"), clause: n("n-clause") };
}
function contractModal(pid) {
  const p = S.players[pid];
  const row = (k, v) => `<tr><td class="muted">${k}</td><td style="text-align:right"><b>${v}</b></td></tr>`;
  modal(`<h2>📄 Contrat — ${flag(p.nat)} ${esc(p.handle)}</h2>
    <p class="muted" style="margin-top:-6px">${GAMES[p.game].icon} ${GAMES[p.game].short} · ${p.role} · ${ageTxt(p)} ans · ${R(p.rating)} · potentiel ${potTxt(p)} · ${personalityOf(p)}</p>
    <table>${row("Région de jeu", REGIONS[playRegion(p)] + (playRegion(p) !== homeRegion(p) ? ` <span class="muted">(originaire de ${REGIONS[homeRegion(p)]})</span>` : "") + (adaptFactor(p) < 1 ? ` <span class="warn">· en adaptation (${Math.max(0, ADAPT_WEEKS - weeksSince(p.movedAt))} sem.)</span>` : ""))}${row("Statut promis", (p.status || "Titulaire") + (p.promiseBroken >= 3 ? " <span class='bad'>(promesse non tenue)</span>" : ""))}${row("Salaire", money(p.salary) + "/sem")}${row("Durée restante", p.years + " an(s)")}
      ${row("Part du cashprize", (p.prizeShare ?? 50) + " %")}${row("Prime par victoire", money(p.winBonus || 0))}${row("Clause libératoire", p.clause ? money(p.clause) : "aucune")}
      ${row("Moral", Math.round(p.morale) + " / 100")}${row("Valeur estimée", money(playerValue(p)))}</table>
    <div class="actions"><button data-act="close-modal">Fermer</button><button class="primary" data-act="renew" data-v="${pid}">Renégocier / prolonger</button></div>`);
}
ACTIONS["nego-propose"] = () => {
  const offer = readOffer(); NEGO.draft = offer;
  const r = proposeContract(NEGO, offer);
  if (r.status === "accept") {
    const e = acceptContract(NEGO, offer);
    if (e) return negoModal(e, "bad");
    const h = S.players[NEGO.pid].handle; NEGO = null; closeModal(); toast(`${h} signe ! ✍️ ${r.msg}`); save(); return render();
  }
  if (r.status === "walk") { mail(`Négociations rompues : ${S.players[NEGO.pid].handle}`, r.msg, "transfer"); NEGO = null; closeModal(); toast("Le joueur a quitté la table des négociations."); save(); return render(); }
  negoModal(r.msg, r.tone);
};
ACTIONS["nego-quit"] = () => { NEGO = null; closeModal(); };

// ---------- négociation de sponsors ----------
let SP = null;
function sponsorModal(o, intro) {
  SP = o;
  const total = o.weekly * o.weeks;
  const hist = o.history.map((h, i) => `<li>Tour ${i + 1} : vous demandez ${money(h.ask)}/sem sur ${h.weeks} sem.</li>`).join("");
  const e = ETHIC[o.ethic || "neutre"];
  modal(`<h2>${e[0]} ${esc(o.brand)}</h2><p>${intro}</p>
    <p><span class="chip ${e[2]}">${e[0]} Marque ${e[1].toLowerCase()}</span> ${o.ethic === "controverse" ? "<span class='bad'>Très bien payé, mais l'image du club va se dégrader : vos victoires rapporteront moins de fans, vos défaites en feront partir plus, et des fans partiront chaque semaine.</span>" : o.ethic === "ethique" ? "<span class='ok'>Un peu moins payé, mais l'image du club s'améliore : vos victoires attireront plus de fans.</span>" : "<span class='muted'>Sans effet sur l'image du club.</span>"}</p>
    <div class="offer"><div><span class="muted">Offre actuelle</span><b>${money(o.weekly)}/sem</b></div><div><span class="muted">Durée</span><b>${o.weeks} semaines</b></div><div><span class="muted">Total</span><b>${money(total)}</b></div></div>
    ${hist ? `<ul class="muted" style="font-size:13px">${hist}</ul>` : ""}
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <div class="form-row" style="flex:1;min-width:140px"><label for="sp-ask">Votre demande (€/semaine)</label><input id="sp-ask" type="number" step="50" min="0" value="${round50(o.weekly * 1.25)}"></div>
      <div class="form-row"><label for="sp-weeks">Durée</label><select id="sp-weeks">${[8, 13, 20, 26, 39, 52].map(w => `<option value="${w}" ${Math.abs(w - o.weeks) < 4 ? "selected" : ""}>${w} semaines</option>`).join("")}</select></div>
    </div>
    <p class="muted" style="font-size:12px">Demander trop peut faire fuir la marque. Un contrat plus long rapporte plus au total, mais la marque paiera un peu moins par semaine.</p>
    <div class="actions"><button data-act="sp-refuse">Refuser</button><button data-act="sp-counter">Contre-proposer</button><button class="primary" data-act="sp-accept">Accepter ${money(o.weekly)}/sem</button></div>`);
}
ACTIONS["sp-accept"] = () => { signSponsor(SP, SP.weekly, SP.weeks); toast(`Contrat ${SP.brand} signé !`); SP = null; save(); render(); ACTIONS["next-event"](); };
ACTIONS["sp-refuse"] = () => { mail(`Offre déclinée : ${SP.brand}`, `Vous avez refusé l'offre de ${SP.brand} (${money(SP.weekly)}/sem).`, "event"); SP = null; save(); render(); ACTIONS["next-event"](); };
ACTIONS["sp-counter"] = () => {
  const ask = +document.getElementById("sp-ask").value, weeks = +document.getElementById("sp-weeks").value;
  const r = negotiateSponsor(SP, ask, weeks);
  if (r.status === "accept") { signSponsor(SP, r.weekly, r.weeks); toast(`${SP.brand} accepte : ${money(r.weekly)}/sem !`); SP = null; save(); render(); return ACTIONS["next-event"](); }
  if (r.status === "walk") { mail(`Négociation rompue : ${SP.brand}`, `${SP.brand} a mis fin aux discussions.`, "event"); toast(`${SP.brand} quitte la table des négociations.`); SP = null; save(); render(); return ACTIONS["next-event"](); }
  sponsorModal(SP, `<b>${esc(SP.brand)}</b> fait une contre-proposition.${r.last ? " <b class='warn'>La marque prévient que c'est sa dernière offre.</b>" : ""}`);
};
ACTIONS["prospect"] = v => {
  const r = prospectSponsor(v || "neutre");
  if (r.error) return toast(r.error);
  sponsorModal(r.offer, `Votre équipe commerciale a décroché un rendez-vous avec <b>${esc(r.offer.brand)}</b>.`);
};

// ---------- boucle hebdomadaire ----------
let pendingEvents = [];
// récapitulatif des fans : les raisons sont regroupées, du plus gros gain à la plus grosse perte
function fanRecap(list, title = "📈 Fans") {
  if (!list.length) return "";
  const total = list.reduce((s, [, d]) => s + d, 0);
  const top = list.slice().sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 8);
  const fmt = d => `<b class="${d >= 0 ? "ok" : "bad"}">${d >= 0 ? "+" : ""}${d.toLocaleString("fr-FR")}</b>`;
  return `<div class="recap"><div class="recap-h"><span>${title}</span>${fmt(total)}</div>${top.map(([l, d]) => `<div class="recap-r"><span>${esc(l)}</span>${fmt(d)}</div>`).join("")}${list.length > top.length ? `<div class="muted" style="font-size:12px">… et ${list.length - top.length} autre(s) ligne(s)</div>` : ""}</div>`;
}
function moneyRecap(income, expenses) {
  const rows = Object.entries(income).map(([k, v]) => [k, v]).concat(Object.entries(expenses).map(([k, v]) => [k, -v])).filter(([, v]) => Math.round(v));
  if (!rows.length) return "";
  const net = rows.reduce((s, [, v]) => s + v, 0);
  return `<div class="recap"><div class="recap-h"><span>💰 Finances</span><b class="${net >= 0 ? "ok" : "bad"}">${net >= 0 ? "+" : ""}${money(net)}</b></div>${rows.sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="recap-r"><span>${BOOK_LABELS[k] || k}</span><span class="${v >= 0 ? "ok" : "bad"}">${v >= 0 ? "+" : ""}${money(v)}</span></div>`).join("")}</div>`;
}
const resultsHtml = r => r.tournaments.map(tourRow).join("") + r.matches.map(matchRow).join("") + r.lobbies.map(lobbyRow).join("");
// jour de match : les rencontres du club cette semaine, à lancer une par une
function matchDayModal(last) {
  const evs = weekEvents(), left = evs.filter(e => !e.done);
  const rows = evs.map(e => `<div class="md-ev ${e.done ? "done" : ""}"><div style="min-width:0">${gchip(e.game)} <b>${esc(e.title)}</b><div class="muted" style="font-size:13px">${esc(e.what)}</div></div>
    ${e.done ? "<span class='ok'>✓ Joué</span>" : `<button class="primary small" data-act="md-play" data-v="${esc(e.id)}">▶ Lancer</button>`}</div>`).join("");
  modal(`<h2>🎮 Jour de match — ${weekLabel(S.season, S.week, true)}</h2>
    ${last || ""}
    <div class="md-list">${rows}</div>
    <p class="muted" style="font-size:12px">Lancez vos matchs un par un pour suivre chaque résultat, ou simulez tout le reste de la semaine d'un coup (pratique avec beaucoup de jeux). Vous pouvez fermer cette fenêtre pour changer une composition avant de jouer.</p>
    <div class="actions"><button data-act="close-modal">Fermer</button><button class="primary" data-act="md-finish">${left.length ? `⏩ Simuler le reste de la semaine (${left.length})` : "Terminer la semaine ▶"}</button></div>`);
}
ACTIONS["md-play"] = v => {
  const r = playEvent(v);
  const res = resultsHtml(r) || "<p class='muted'>Votre équipe n'a pas joué.</p>";
  const fans = r.fans.reduce((s, [, d]) => s + d, 0);
  render();
  matchDayModal(`<div class="card md-result">${res}${fanRecap(r.fans, "📈 Fans après ce match")}${r.money ? `<p>Gains : <b class="${r.money >= 0 ? "ok" : "bad"}">${r.money >= 0 ? "+" : ""}${money(r.money)}</b></p>` : ""}</div>`);
};
ACTIONS["md-finish"] = () => playWeek();
// bouton principal : jour de match s'il reste des rencontres à lancer, sinon semaine suivante
ACTIONS["next"] = () => { if (weekEvents().some(e => !e.done)) matchDayModal(); else playWeek(); };
// avance jusqu'à la prochaine semaine où le club joue (les semaines vides passent d'un coup)
ACTIONS["skip"] = () => {
  const reps = [];
  for (let i = 0; i < 20; i++) {
    const rep = advanceWeek(); reps.push(rep);
    if (rep.events.length || rep.seasonEnd || S.over || weekEvents().length) break;
  }
  showSummary(reps);
};
function playWeek() { showSummary([advanceWeek()]); }
// bilan d'une ou plusieurs semaines jouées
function showSummary(reps) {
  const u = user(), last = reps[reps.length - 1];
  const missing = Object.keys(u.divisions).filter(g => gamePlayers(g).length < GAMES[g].size);
  pendingEvents = reps.flatMap(r => r.events);
  const merge = k => reps.reduce((o, r) => { for (const [c, v] of Object.entries(r[k])) o[c] = (o[c] || 0) + v; return o; }, {});
  const res = reps.map(resultsHtml).join("") || "<p class='muted'>Pas de match pour votre club.</p>";
  const se = last.seasonEnd;
  const title = se ? "🏁 Fin de la saison " + last.season : reps.length > 1 ? `${weekLabel(reps[0].season, reps[0].week)} → ${weekLabel(last.season, last.week, true)}` : `Semaine du ${weekLabel(last.season, last.week, true)}`;
  modal(`<h2>${title}</h2>${reps.length > 1 ? `<p class="muted" style="margin-top:-6px">${reps.length} semaines jouées.</p>` : ""}${res}
    <div class="grid g2" style="margin-top:12px">${fanRecap(reps.flatMap(r => r.fans))}${moneyRecap(merge("income"), merge("expenses"))}</div>
    ${missing.length ? `<p class="bad">⚠️ Effectif incomplet en ${missing.map(g => GAMES[g].short).join(", ")} : vos équipes jouent en sous-nombre !</p>` : ""}
    ${se ? `<p>${se.moves.length ? se.moves.join("<br>") : "Pas de changement de division."}</p><p>Objectif du conseil ${se.ok ? "<b class='ok'>atteint ✅</b>" : "<b class='bad'>manqué ❌</b>"}. Le bilan complet est dans la messagerie.</p>` : ""}
    ${S.over ? `<p class="bad"><b>Vous avez été licencié. Fin de partie.</b></p>` : ""}
    <div class="actions"><button class="primary" data-act="next-event">Continuer</button></div>`);
  render();
}
// nouvelle saison : le CEO répartit d'abord son budget mercato entre ses sections
function maybeAlloc() {
  if (S.over || !Object.keys(user().divisions).length) return false;
  allocOf(Object.keys(user().divisions)[0]);
  if (S.alloc.set || S.alloc.asked) return false;
  S.alloc.asked = true;
  allocModal(`Début de la saison ${S.season} : comme en Football Manager, répartissez votre budget de transferts entre vos sections et fixez leur masse salariale. Vous pourrez le modifier à tout moment dans l'onglet Finances.`);
  return true;
}
ACTIONS["next-event"] = () => {
  const ev = pendingEvents.shift();
  if (!ev) { if (!maybeAlloc()) closeModal(); return; }
  if (ev.sponsor) return sponsorModal(ev.sponsor, `<b>${esc(ev.sponsor.brand)}</b> vous contacte pour un partenariat.`);
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
  if (e.target.id === "modal" && !pendingEvents.length && !document.querySelector('#modal [data-act="ev-choice"], #modal [data-act="next-event"], #modal [data-act="sp-counter"], #modal [data-act="nego-propose"]')) closeModal();
});
document.addEventListener("change", e => {
  const k = e.target.dataset.change; if (!k) return;
  if (k === "unit-move") { if (e.target.value) { const err = assignUnit(e.target.dataset.pid, e.target.value); if (err) toast(err); scheduleSave(); } return render(); }
  if (k.startsWith("al-")) return allocSum();
  if (k === "fin-game") { UI.finGame = e.target.value; return render(); }
  if (k === "mail-q") { UI.inbox.q = e.target.value; UI.mailOpen = null; return render(); }
  const m = UI.market;
  if (k === "m-game") { m.game = e.target.value; m.role = "all"; }
  if (k === "m-min") m.min = +e.target.value;
  if (k === "m-sort") { m.sort = e.target.value; m.dir = 1; }
  if (k === "m-nat") m.nat = e.target.value;
  if (k === "m-role") m.role = e.target.value;
  if (k === "m-agemin") m.ageMin = +e.target.value;
  if (k === "m-agemax") m.ageMax = +e.target.value;
  if (k === "m-potmin") m.potMin = +e.target.value;
  if (k === "m-tier") m.tier = e.target.value;
  if (k === "m-maxprice") m.maxPrice = +e.target.value;
  if (k === "m-budget") m.budgetOnly = e.target.checked;
  if (k === "m-keen") m.keenOnly = e.target.checked;
  if (k === "m-status") m.status = e.target.value;
  if (k === "m-q") m.q = e.target.value;
  if (k === "m-region") m.region = e.target.value;
  if (k === "m-per") m.per = +e.target.value;
  if (k.startsWith("m-")) m.page = 0;   // nouveau filtre : retour à la première page
  render();
});
document.addEventListener("keydown", e => {
  // Entrée valide la recherche : on quitte le champ, ce qui déclenche « change » (un seul rafraîchissement)
  if (e.key === "Enter" && e.target.dataset && ["m-q", "mail-q"].includes(e.target.dataset.change)) { e.preventDefault(); e.target.blur(); }
});

renderHome();
