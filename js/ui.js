// =====================================================================
//  ESPORTS MANAGER — Interface
// =====================================================================

const UI = { screen: "home", view: "dash", rosterGame: null, compGame: null, compTier: null,
  market: { game: "all", q: "", status: "all", min: 0, sort: "rating", region: "all", page: 0, per: 50 }, pickClub: null, mailOpen: null };
const $app = document.getElementById("app");

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
function lobbyText(g) { const G = GAMES[g]; if (G.open && S && S.leagues[lkey(g, 1)]) { const n = S.leagues[lkey(g, 1)].teams.length; return `tout le circuit · ${n} ${G.unit}s, ${n * G.size} joueurs`; } return G.size > 1 ? `${G.lobby} ${G.unit}s · ${G.lobby * G.size} joueurs` : `${G.lobby} ${G.unit}s`; }

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
  const navs = [["dash", "🏠 Tableau de bord"], ["roster", "👥 Effectifs"], ["market", "💱 Mercato"], ["calendar", "🗓️ Calendrier"], ["comp", "🏆 Compétitions"], ["tours", "📅 Tournois"],
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
      ${({ dash: viewDash, roster: viewRoster, market: viewMarket, calendar: viewCalendar, comp: viewComp, tours: viewTours, finance: viewFinance, facilities: viewFacilities, inbox: viewInbox, world: viewWorld })[UI.view]()}
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
      <div style="margin:6px 0;display:flex;gap:6px;align-items:center;flex-wrap:wrap">${lchip(L)}<span class="muted">${leagueName(L)}</span></div>
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
      <div style="display:flex;gap:4px;flex-wrap:wrap">${(GAMES[g].open ? [3] : [3, 2, 1]).map(t => `<button class="small" data-act="open-div" data-v="${g}|${t}" ${canJoin(g, t) ? "disabled" : ""} title="${esc(canJoin(g, t) || (GAMES[g].open ? GAMES[g].circuit : tierName(g, t)))}">${GAMES[g].open ? "Circuit ouvert" : "T" + t} · ${money(tierEntry(g, t))}</button>`).join("")}</div></div>`).join("")}</div></div>`;
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
  return `<h2>Effectifs</h2><div class="tabs">${tabs}</div>
    <div class="card"><div class="toolbar"><div style="flex:1;min-width:0"><h3 style="margin:0">${g.icon} ${g.name}${d.label ? ` (${esc(d.label)})` : ""} — Titulaires ${nSt}/${g.size}${teamRegion(u.id, UI.rosterGame) ? " · " + REGIONS[teamRegion(u.id, UI.rosterGame)] : ""} · Force ${R(Math.round(teamStrength(u.id, UI.rosterGame).str))}</h3>
      <div style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">${tchip(d.tier, UI.rosterGame)}<span class="muted">${GAMES[UI.rosterGame].open ? GAMES[UI.rosterGame].circuit : tierName(UI.rosterGame, d.tier)}</span></div></div>
      <button class="small" data-act="auto-lineup">⚡ Composition auto</button>
      <button class="small" data-act="goto-market" data-v="${UI.rosterGame}">🔎 Recruter</button>
      <button class="small danger" data-act="close-div">Fermer la division</button></div>
    <div class="table-wrap"><table><tr><th></th><th>Joueur</th><th>Rôle</th><th>Âge</th><th>Note</th><th>Potentiel</th><th>Forme</th><th>Moral</th><th>Salaire</th><th>Contrat</th><th>Clause</th><th>Valeur</th><th></th></tr>${rows || `<tr><td colspan="13" class="muted">Aucun joueur. Rendez-vous au mercato !</td></tr>`}</table></div></div>
    ${academyCard(UI.rosterGame)}
    ${open}`;
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
  const L = S.leagues[lkey(game, ad.tier)], pos = standings(L.key).findIndex(r => r.id === aca.id) + 1;
  return `<div class="card" style="margin-top:20px"><div class="toolbar"><div style="flex:1;min-width:0"><h3 style="margin:0">🎓 ${esc(aca.name)} — Force ${R(Math.round(teamStrength(aca.id, game).str))}</h3>
      <div style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">${tchip(ad.tier)}<span class="muted">${tierName(game, ad.tier)}${pos ? ` · ${pos}e` : ""} · composition automatique (les meilleurs jouent)</span></div></div>
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
  const sorters = { rating: (a, b) => b.rating - a.rating, age: (a, b) => a.age - b.age, value: (a, b) => playerValue(a) - playerValue(b), pot: (a, b) => b.pot - a.pot, salary: (a, b) => salaryDemand(a, u) - salaryDemand(b, u) };
  ps.sort(sorters[m.sort]);
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
      <td>${where}</td><td>${money(playerValue(p))}</td><td>${money(salaryDemand(p, u))}/sem</td><td>${btn}</td></tr>`;
  }).join("");
  return `<h2>Mercato</h2>
    <div class="toolbar">
      <select id="m-game" data-change="m-game" aria-label="Jeu">${gameOpts}</select>
      <input id="m-q" data-change="m-q" placeholder="Rechercher joueur ou club…" value="${esc(m.q)}" aria-label="Recherche">
      <select id="m-status" data-change="m-status" aria-label="Statut">${[["all", "Tous les statuts"], ["free", "Agents libres"], ["solo", "Pros indépendants"], ["club", "Sous contrat en club"]].map(([k, l]) => `<option value="${k}" ${m.status === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <select id="m-min" data-change="m-min" aria-label="Note minimale">${[0, 60, 70, 75, 80, 85, 90].map(v => `<option value="${v}" ${m.min == v ? "selected" : ""}>${v ? "Note ≥ " + v : "Toutes notes"}</option>`).join("")}</select>
      <select id="m-sort" data-change="m-sort" aria-label="Tri">${[["rating", "Tri : note"], ["pot", "Tri : potentiel"], ["age", "Tri : âge"], ["value", "Tri : prix"], ["salary", "Tri : salaire"]].map(([k, l]) => `<option value="${k}" ${m.sort === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <select id="m-region" data-change="m-region" aria-label="Région">${[["all", "Toutes les régions"], ...Object.entries(REGIONS)].map(([k, l]) => `<option value="${k}" ${m.region === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <select id="m-per" data-change="m-per" aria-label="Joueurs par page">${[25, 50, 100, 200].map(v => `<option value="${v}" ${(m.per || 50) === v ? "selected" : ""}>${v} par page</option>`).join("")}</select>
      <span class="muted">${total} joueur(s)${total ? ` · ${first + 1}–${Math.min(total, first + per)} · page ${m.page + 1}/${pages}` : ""}</span>
    </div>
    ${pager}
    <p class="muted" style="font-size:12px;margin-top:-4px">Agent libre : sans contrat, signature directe. Indépendant : pro sans organisation, il demande une prime. Sous contrat : il faut payer une indemnité de transfert à son club.</p>
    <div class="card table-wrap"><table><tr><th>Joueur</th><th>Jeu</th><th>Rôle</th><th>Âge</th><th>Note</th><th>Potentiel</th><th>Statut</th><th>Valeur</th><th>Salaire demandé</th><th></th></tr>${rows || `<tr><td colspan="10" class="muted">Aucun joueur ne correspond à ces filtres.</td></tr>`}</table></div>${pager}`;
}

// ---------- compétitions ----------
function viewComp() {
  const u = user();
  if (!UI.compGame) UI.compGame = Object.keys(u.divisions)[0] || "lol";
  const ud = u.divisions[UI.compGame];
  if (!UI.compTier) UI.compTier = ud ? ud.tier : 1;
  const g = GAMES[UI.compGame], L = S.leagues[lkey(UI.compGame, UI.compTier)], br = g.fmt === "br";
  const tabs = Object.keys(GAMES).map(k => `<button class="tab small ${UI.compGame === k ? "active" : ""}" data-act="comp-game" data-v="${k}">${GAMES[k].icon} ${GAMES[k].short}${u.divisions[k] ? " ★" : ""}</button>`).join("");
  if (g.open) UI.compTier = 1;
  const ttabs = g.open ? "" : [1, 2, 3].map(t => `<button class="tab small ${UI.compTier === t ? "active" : ""}" data-act="comp-tier" data-v="${t}">${TIER_LABEL[t - 1]}${ud && ud.tier === t ? " ★" : ""}</button>`).join("");
  const st = standings(L.key), n = st.length;
  const cut = g.open ? g.tierSizes : null;
  const zone = i => cut ? (i < 8 ? "<span class='ok' title='Grande finale'>●</span>" : i === cut[0] - 1 ? "<span class='ok' title='Dernière place Élite'>▲</span>" : i === cut[0] + cut[1] - 1 ? "<span class='warn' title='Dernière place Pro'>▲</span>" : "") : i < 2 && UI.compTier > 1 ? "<span class='ok' title='Montée'>▲</span>" : i >= n - 2 && UI.compTier < 3 ? "<span class='bad' title='Relégation'>▼</span>" : (br ? i < 8 : i < 4) ? "<span class='ok'>●</span>" : "";
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
  return `<h2>${g.icon} ${g.open ? g.circuit : tierName(UI.compGame, UI.compTier)}</h2><div class="tabs">${tabs}</div><div class="tabs">${ttabs}</div>
    <div class="grid g2">
      <div class="card"><h3>Classement · ${FMT_LABEL[g.fmt]}</h3><div class="table-wrap"><table>${table}</table></div>
        <p class="muted" style="font-size:12px">${cut ? `circuit ouvert : le top ${cut[0]} obtient le statut Élite et le top ${cut[0] + cut[1]} le statut Pro pour la saison suivante (invitations, sponsors) · ` : ""}${!cut && UI.compTier > 1 ? "▲ montée · " : ""}${!cut && UI.compTier < 3 ? "▼ relégation · " : ""}cashprize ${money(tierPrize(UI.compGame, UI.compTier))} (40 % au champion)</p></div>
      <div>
        <div class="card"><h3>${br ? "Grande finale" : "Playoffs"}</h3>${po}</div>
        <div class="card" style="margin-top:16px">${br ? "<h3>Dernières journées</h3>" : ""}${side}</div>
      </div>
    </div>`;
}

// ---------- calendrier ----------
// ce que le club joue (ou a joué) dans une ligue la semaine w
function leagueEntry(L, w) {
  const u = user(), g = GAMES[L.game], R = REGULAR_WEEKS;
  const name = `${g.icon} ${g.short} ${g.open ? "circuit" : "T" + L.tier}`;
  if (g.fmt === "br") {
    if (w <= R) { const r = L.results.find(x => x.week === w); return { name, what: `Journée ${w} — lobby de ${lobbyText(L.game)}`, res: r ? (r.top.includes(u.id) ? `${["🥇", "🥈", "🥉"][r.top.indexOf(u.id)]} du lobby` : "joué") : "" }; }
    return { name, what: `Grande finale (top 8) — jour ${w - R}`, res: L.playoffs && L.playoffs.finalists && !L.playoffs.finalists.includes(u.id) ? "non qualifié" : "" };
  }
  if (w <= L.schedule.length) {
    const m = L.schedule[w - 1].find(m => m.includes(u.id));
    if (!m) return { name, what: "Repos", res: "" };
    const opp = m[0] === u.id ? m[1] : m[0];
    const r = L.results.find(x => x.week === w && (x.a === u.id || x.b === u.id));
    return { name, what: `vs <b>${displayName(opp, L.game)}</b> (BO3)`, res: r ? resTxt(r) : "" };
  }
  if (w === R + 1) {
    const s = L.playoffs && L.playoffs.semis.find(x => x.a === u.id || x.b === u.id);
    return { name, what: "Demi-finales des playoffs (top 4)", res: s ? resTxt(s) : L.playoffs ? "non qualifié" : "" };
  }
  const f = L.playoffs && L.playoffs.final;
  return { name, what: "Grande finale (BO5)", res: f ? (f.a === u.id || f.b === u.id ? resTxt(f) : "non qualifié") : "" };
}
function resTxt(r) {
  const u = S.userId, me = r.a === u ? r.sa : r.sb, them = r.a === u ? r.sb : r.sa;
  return `<b class="${r.winner === u ? "win" : "bad"}">${r.winner === u ? "V" : "D"} ${me}-${them}</b>`;
}
function viewCalendar() {
  const u = user();
  if (!UI.calMode) UI.calMode = "mine";
  const myGames = Object.keys(u.divisions);
  const modes = [["mine", "Mes matchs et mes tournois"], ["eligible", "+ tournois de mes jeux"], ["all", "Tous les tournois"]]
    .map(([k, l]) => `<button class="tab small ${UI.calMode === k ? "active" : ""}" data-act="cal-mode" data-v="${k}">${l}</button>`).join("");
  const weeks = [];
  for (let w = 1; w <= REGULAR_WEEKS + 2; w++) {
    const items = [];
    for (const L of userLeagues()) items.push({ kind: "league", ...leagueEntry(L, w) });
    const games = UI.calMode === "all" ? Object.keys(GAMES) : myGames;
    for (const g of games) for (const [name, week, prize, tiers, size, region] of allTournaments(g)) {
      if (week !== w) continue;
      const d = u.divisions[g];
      const eligible = d && tiers.includes(String(d.tier)) && inRegion(S.userId, g, region);
      const r = tourStatus(g, name, week);
      const playing = r ? !!r.mine : eligible && (!invitational(tiers) || tournamentField(g, tiers, size, region).includes(S.userId));
      if (UI.calMode === "mine" && !playing) continue;
      items.push({ kind: name.startsWith("EWC") ? "ewc" : "tour", name: `${GAMES[g].icon} ${GAMES[g].short}`, what: `<b>${esc(name)}</b> · ${money(prize)}`,
        res: r ? (r.mine ? (r.mine === 1 ? "<b class='win'>🏆 Vainqueur</b>" : `<b>${r.mine}e</b> / ${r.n}`) : `🏆 ${displayName(r.top[0], g)}`) : playing ? "<span class='ok'>inscrit</span>" : "" });
    }
    const label = w <= REGULAR_WEEKS ? `Semaine ${w}` : w === REGULAR_WEEKS + 1 ? `Semaine ${w} · Playoffs` : `Semaine ${w} · Finales`;
    const tags = (w >= 7 && w <= EWC_LAST_WEEK ? "<span class='chip ewc'>🌍 EWC</span>" : "") + (w === REGULAR_WEEKS + 2 ? "<span class='chip'>🏁 Fin de saison</span>" : "");
    weeks.push(`<div class="card cal-week ${w === S.week ? "now" : w < S.week ? "past" : ""}">
      <div class="cal-head"><b>${label}</b>${w === S.week ? "<span class='chip now'>Cette semaine</span>" : ""}${tags}</div>
      ${items.length ? items.map(it => `<div class="cal-item ${it.kind}"><span class="cal-game">${it.name}</span><span class="cal-what">${it.what}</span><span class="cal-res">${it.res}</span></div>`).join("") : "<p class='muted'>Rien de prévu.</p>"}
    </div>`);
  }
  return `<h2>🗓️ Calendrier de la saison ${S.season}</h2>
    <p class="muted" style="margin-top:-6px">Tous tes matchs de ligue, les playoffs et les tournois, semaine par semaine. Les semaines passées affichent les résultats.</p>
    <div class="tabs">${modes}</div><div class="cal-grid">${weeks.join("")}</div>`;
}

// ---------- tournois ----------
const accessLabel = t => ({ "1": "Invitation (tier 1)", "12": "Tiers 1 et 2", "2": "Tier 2", "23": "Open (tiers 2-3)", "3": "Open (tier 3)", "123": "Meilleurs de la région", "1230": "Open régional (tous tiers)" }[t] || t);
function tourStatus(game, name, week) {
  const r = (S.tourResults || []).find(x => x.season === S.season && x.game === game && x.name === name && x.week === week);
  if (!r) return null;
  return r;
}
function myEligibility(game, tiers, size, region) {
  const d = user().divisions[game];
  if (!d) return "<span class='muted'>—</span>";
  if (!inRegion(S.userId, game, region)) return `<span class='muted' title='Tournoi réservé à : ${REGION_LABEL(region)}'>Autre région</span>`;
  if (!tiers.includes(String(d.tier))) return "<span class='muted'>Non éligible</span>";
  if (!invitational(tiers)) return "<span class='ok'>Qualifié</span>";
  return tournamentField(game, tiers, size, region).includes(S.userId) ? "<span class='ok'>Invité</span>" : "<span class='warn'>Hors invitations</span>";
}
function upcomingTours(limit) {
  const u = user(), rows = [];
  for (const g of Object.keys(u.divisions)) for (const [name, week, prize, tiers, size, region] of allTournaments(g))
    if (week >= S.week && tiers.includes(String(u.divisions[g].tier)) && inRegion(S.userId, g, region)) rows.push({ g, name, week, prize, tiers, size, region });
  return rows.sort((a, b) => a.week - b.week).slice(0, limit).map(t => `<div class="match-br">S${t.week} · ${GAMES[t.g].icon} <b>${esc(t.name)}</b> · ${money(t.prize)} · ${myEligibility(t.g, t.tiers, t.size, t.region)}</div>`).join("");
}
function ewcCard() {
  const u = user(), done = S.ewcResult && S.ewcResult.season === S.season;
  const list = done ? S.ewcResult.ranking : ewcStandings();
  const rows = list.slice(0, 12).map((x, i) => `<tr class="${x.id === u.id ? "me" : ""}"><td>${i + 1}</td><td>${displayName(x.id)}</td><td>${x.pts}</td><td>${x.top8}</td><td>${x.wins}</td><td>${done ? money(x.prize || 0) : x.ok ? "<span class='ok'>Éligible</span>" : "<span class='muted'>1 top 8</span>"}</td></tr>`).join("");
  const me = list.findIndex(x => x.id === u.id);
  return `<div class="card" style="margin-bottom:16px"><h3>🌍 EWC Club Championship ${S.season} ${done ? "— terminé" : `— semaines 7 à ${EWC_LAST_WEEK}`}</h3>
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
  const rows = games.flatMap(g => allTournaments(g).map(t => [g, ...t])).filter(t => UI.tourSize === "all" || (UI.tourSize === "big") === !(S.smallTours || []).some(x => x[5] === t[0] && x[0] === t[1] && x[1] === t[2])).sort((a, b) => a[2] - b[2] || b[3] - a[3]).map(([g, name, week, prize, tiers, size, region]) => {
    const r = tourStatus(g, name, week);
    const status = r ? `🏆 ${displayName(r.top[0], g)}${r.mine ? ` · <b>vous : ${r.mine}e</b>` : ""}` : week < S.week ? "<span class='muted'>Annulé</span>" : week === S.week ? "<b class='warn'>Cette semaine</b>" : "À venir";
    return `<tr class="${r && r.mine === 1 ? "me" : ""}"><td>S${week}</td><td>${gchip(g)}</td><td><b>${esc(name)}</b>${typeof region === "string" && region ? ` <small class="muted">${REGION_LABEL(region)}</small>` : ""}</td><td>${prize ? money(prize) : "<span class='muted' title='Pas de cashprize : qualification et prestige'>—</span>"}</td><td>${accessLabel(tiers)}</td><td>${r ? r.n : tournamentField(g, tiers, size, typeof region === "string" ? region : "").length}${GAMES[g].fmt === "br" ? " " + GAMES[g].unit + "s" : ""}</td><td>${myEligibility(g, tiers, size, typeof region === "string" ? region : "")}</td><td>${status}</td></tr>`;
  }).join("");
  if (!UI.tourSize) UI.tourSize = "all";
  const stabs = [["all", "Tous les tournois"], ["big", "Grands tournois"], ["small", "Petits tournois & cash cups"]].map(([k, l]) => `<button class="tab small ${UI.tourSize === k ? "active" : ""}" data-act="tour-size" data-v="${k}">${l}</button>`).join("");
  return `<h2>📅 Tournois de la saison ${S.season}</h2>${ewcCard()}
    <p class="muted" style="margin-top:-6px">En plus des ligues, les grands tournois à cashprize. Les tournois sur invitation prennent les meilleures équipes du tier 1 ; les opens accueillent tous les clubs des tiers admis. Dotations approximatives ; le club touche 50 % des gains, le reste revient aux joueurs.</p>
    <div class="tabs">${tabs}</div><div class="tabs">${stabs}</div>
    <div class="card table-wrap"><table><tr><th>Sem.</th><th>Jeu</th><th>Tournoi</th><th>Dotation</th><th>Accès</th><th>Places</th><th>Vous</th><th>Résultat</th></tr>${rows}</table></div>`;
}

// ---------- finances ----------
function viewFinance() {
  const u = user(), last = S.lastWeek;
  const lines = (o, labels) => Object.entries(o || {}).map(([k, v]) => `<tr><td>${labels[k] || k}</td><td style="text-align:right">${money(v)}</td></tr>`).join("");
  const incL = { sponsors: "Sponsors", merch: "Merch & streaming", prize: "Cashprize (part du club)", ewc: "EWC Club Championship" };
  const expL = { salaries: "Salaires", operations: "Frais de divisions", facilities: "Entretien des infrastructures", bonuses: "Primes de victoire" };
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
  <div class="card" style="margin-top:16px"><div class="toolbar"><h3 style="margin:0;flex:1">Contrats de sponsoring</h3><button class="small primary" data-act="prospect">📞 Démarcher un sponsor</button></div>${deals ? `<table>${deals}</table>` : "<p class='muted'>Aucun contrat spécifique. Les offres arrivent au fil des semaines selon votre notoriété.</p>"}</div>`;
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
  const clubs = Object.values(S.clubs).filter(c => ((!c.filler && !c.solo) || c.titles.length || c.id === S.userId) && !c.sister).sort((a, b) => b.fame - a.fame).slice(0, 100);
  const divs = c => Object.entries(c.divisions).map(([g, d]) => `<span class="chip" style="border-color:${GAMES[g].color}">${GAMES[g].icon} ${GAMES[g].short} <small class="muted">${tshort(g, d.tier)}</small></span>`).join(" ");
  const rows = clubs.map((c, i) => `<tr class="${c.id === S.userId ? "me" : ""}"><td>${i + 1}</td><td><span style="color:${c.color}">■</span> <b data-act="club-info" data-v="${c.id}" style="cursor:pointer">${esc(c.name)}</b></td><td>${flag(c.country)}</td>
    <td>${c.fame.toFixed(1)}</td><td>${c.fans.toLocaleString("fr-FR")}</td><td>${divs(c)}</td><td>${c.titles.length ? "🏆 × " + c.titles.length : ""}</td></tr>`).join("");
  const hist = S.titles.slice().reverse().slice(0, 80).map(t => `<tr><td>${t.season}</td><td>${GAMES[t.game] ? gchip(t.game) : "<span class='chip'>🌍 EWC</span>"}</td><td>${t.tier ? (GAMES[t.game] && GAMES[t.game].open ? "<span class='chip'>Circuit</span>" : tchip(t.tier) + " Ligue") : `<span class="chip">🏆 ${esc(t.name)}</span>`}</td><td class="${t.clubId === S.userId ? "ok" : ""}"><b>${esc(t.club)}</b></td></tr>`).join("");
  return `<h2>Clubs & palmarès</h2><div class="grid g2">
    <div class="card table-wrap"><h3>Classement mondial des clubs (notoriété)</h3><table><tr><th>#</th><th>Club</th><th></th><th>Notoriété</th><th>Fans</th><th>Divisions</th><th>Titres</th></tr>${rows}</table></div>
    <div class="card table-wrap"><h3>Palmarès</h3>${hist ? `<table><tr><th>Saison</th><th>Jeu</th><th>Compétition</th><th>Champion</th></tr>${hist}</table>` : "<p class='muted'>Aucun titre décerné pour l'instant.</p>"}</div></div>`;
}
function clubInfo(id) {
  const c = S.clubs[id];
  const divs = Object.entries(c.divisions).map(([g, d]) => `<h3 style="margin-top:12px">${GAMES[g].icon} ${GAMES[g].name}${d.label ? ` — ${esc(d.label)}` : ""} · ${GAMES[g].open ? "statut " : ""}${tierLabel(g, d.tier)} ${d.generated ? "<span class='warn' title='Le club a bien une équipe dans ce jeu, mais son effectif réel est introuvable'>* joueurs inventés</span>" : d.verified ? "<span class='ok' title='Effectif recoupé dans des sources 2026'>✓ 2026</span>" : c.filler ? "" : "<span class='muted' title='Effectif établi de mémoire, peut être dépassé'>≈ non vérifié</span>"}</h3><div class="table-wrap"><table>${clubPlayers(id, g).sort((a, b) => b.starter - a.starter || b.rating - a.rating).map(p => `<tr><td>${p.starter ? "⭐" : ""}</td><td>${flag(p.nat)} ${esc(p.handle)}</td><td class="muted">${p.role}</td><td>${ageTxt(p)} ans</td><td>${R(p.rating)}</td><td>${potTxt(p)}</td></tr>`).join("")}</table></div>`).join("");
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
  "tour-game": v => { UI.tourGame = v; render(); },
  "tour-size": v => { UI.tourSize = v; render(); },
  "cal-mode": v => { UI.calMode = v; render(); },
  "goto-market": v => { UI.market.game = v; UI.market.page = 0; UI.view = "market"; render(); },
  "open-div": v => {
    const [game, t] = v.split("|"), tier = +t, g = GAMES[game];
    modal(`<h2>${g.icon} ${g.name} · ${tierLabel(game, tier)}</h2><p>Entrée dans le <b>${g.open ? g.circuit : tierName(game, tier)}</b> : <b>${money(tierEntry(game, tier))}</b>.<br>
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
  "open-mail": v => { const m = S.inbox.find(x => x.id === v); if (m) { m.read = true; UI.mailOpen = UI.mailOpen === v ? null : v; } if (UI.view !== "inbox") UI.view = "inbox"; render(); },
  "read-all": () => { S.inbox.forEach(m => m.read = true); render(); },
  "club-info": v => clubInfo(v),
  "close-modal": () => closeModal(),
};

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
  modal(`<h2>🤝 ${esc(o.brand)}</h2><p>${intro}</p>
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
ACTIONS["prospect"] = () => {
  const r = prospectSponsor();
  if (r.error) return toast(r.error);
  sponsorModal(r.offer, `Votre équipe commerciale a décroché un rendez-vous avec <b>${esc(r.offer.brand)}</b>.`);
};

// ---------- boucle hebdomadaire ----------
let pendingEvents = [];
function playWeek() {
  const u = user();
  const missing = Object.keys(u.divisions).filter(g => clubPlayers(u.id, g).length < GAMES[g].size);
  const rep = advanceWeek();
  pendingEvents = rep.events.slice();
  const res = rep.tournaments.map(tourRow).join("") + rep.matches.map(matchRow).join("") + rep.lobbies.map(lobbyRow).join("") || "<p class='muted'>Pas de match pour votre club cette semaine.</p>";
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
  const m = UI.market;
  if (k === "m-game") m.game = e.target.value;
  if (k === "m-min") m.min = +e.target.value;
  if (k === "m-sort") m.sort = e.target.value;
  if (k === "m-status") m.status = e.target.value;
  if (k === "m-q") m.q = e.target.value;
  if (k === "m-region") m.region = e.target.value;
  if (k === "m-per") m.per = +e.target.value;
  if (k.startsWith("m-")) m.page = 0;   // nouveau filtre : retour à la première page
  render();
});
document.addEventListener("keydown", e => {
  // Entrée valide la recherche : on quitte le champ, ce qui déclenche « change » (un seul rafraîchissement)
  if (e.key === "Enter" && e.target.dataset && e.target.dataset.change === "m-q") { e.preventDefault(); e.target.blur(); }
});

renderHome();
