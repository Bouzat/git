// =====================================================================
//  ESPORTS MANAGER — Interface
// =====================================================================

// filtres du mercato (valeurs par défaut, aussi utilisées par « Réinitialiser »)
// montant saisi librement : « 50000 », « 50 000 € », « 50k », « 1,5M », « 2 M€ »
function parseMoney(txt) {
  const t = String(txt || "").toLowerCase().replace(/€|\s|\u202f|\u00a0/g, "").replace(",", ".");
  const m = t.match(/^(\d+(?:\.\d+)?)(k|m|md)?$/); if (!m) return 0;
  return Math.round(+m[1] * ({ k: 1e3, m: 1e6, md: 1e9 }[m[2]] || 1));
}
const MARKET_DEFAULT = { game: "all", q: "", status: "all", min: 0, sort: "rating", dir: 1, region: "all", page: 0, per: 50,
  nat: "all", role: "all", ageMin: 0, ageMax: 99, potMin: 0, tier: "all", minPrice: 0, maxPrice: 0, budgetOnly: false, keenOnly: false };
const UI = { screen: "home", view: "dash", rosterGame: null, compGame: null, compTier: null,
  market: { ...MARKET_DEFAULT }, pickClub: null, mailOpen: null };
try { UI.rosterFull = !!localStorage.getItem("em-rosterFull"); } catch (e) { }
// une section repliable garde son état quand l'écran est redessiné
document.addEventListener("toggle", e => { const f = e.target && e.target.dataset && e.target.dataset.fold; if (f) UI[f] = e.target.open; }, true);
// le guide s'ouvre au tout premier lancement d'une partie
function firstHelp() { let seen = false; try { seen = !!localStorage.getItem("em-helpSeen"); localStorage.setItem("em-helpSeen", "1"); } catch (e) { } if (!seen) { helpModal(); return true; } return false; }
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
function modal(html) { const box = document.getElementById("modal-box"); box.innerHTML = html; document.getElementById("modal").classList.remove("hidden"); applyTableSorts(box, "modal"); }
// ---------- tri des tableaux ----------
// Tout tableau avec une ligne d'en-têtes se trie d'un clic sur une colonne (second clic : ordre inverse) ; le tri est gardé
// quand l'écran se redessine. Les tableaux qui trient eux-mêmes (mercato : en-têtes data-act) ne sont pas concernés.
UI.sorts = UI.sorts || {};
// valeur de tri d'une cellule : data-sort, sinon un nombre (montants en k€ / M€ / Md€, %, notes, rangs…), sinon le texte
function cellValue(td) {
  if (!td) return "";
  if (td.dataset.sort !== undefined) return isNaN(+td.dataset.sort) ? td.dataset.sort : +td.dataset.sort;
  const t = td.textContent.replace(/\s+/g, " ").trim();
  const bar = td.querySelector(".bar i");
  if (!t && bar) return parseFloat(bar.style.width) || 0;
  const m = t.replace(/[\u00a0\u202f]/g, " ").match(/^[^\d+-]{0,3}([-+]?\d[\d ]*(?:[.,]\d+)?)\s*(Md€|M€|k€|€|%|e\b|er\b|an|sem|M\b|k\b)?/);
  if (m && /^[^A-Za-zÀ-ÿ]{0,3}[-+]?\d/.test(t)) {
    let v = parseFloat(m[1].replace(/ /g, "").replace(",", "."));
    const unit = m[2] || "";
    if (unit === "Md€") v *= 1e9; else if (unit === "M€" || unit === "M") v *= 1e6; else if (unit === "k€" || unit === "k") v *= 1e3;
    return v;
  }
  return t.toLowerCase();
}
function sortTable(table, col, dir) {
  const rows = [...table.querySelectorAll("tr")], head = rows.find(r => r.querySelector("th"));
  if (!head) return;
  const body = rows.filter(r => r !== head && r.querySelectorAll("td").length > col && !r.querySelector("td[colspan]"));
  if (body.length < 2) return;
  const parent = body[0].parentNode;
  body.map((r, i) => ({ r, i, v: cellValue(r.children[col]) }))
    .sort((a, b) => { const x = a.v, y = b.v; const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "fr", { numeric: true }); return (c || a.i - b.i) * dir; })
    .forEach(o => parent.appendChild(o.r));
  head.querySelectorAll("th").forEach((th, i) => { th.classList.toggle("sorted-asc", i === col && dir > 0); th.classList.toggle("sorted-desc", i === col && dir < 0); });
}
function applyTableSorts(root, scope) {
  root.querySelectorAll("table").forEach((t, i) => {
    const head = [...t.querySelectorAll("tr")].find(r => r.querySelector("th"));
    if (!head || head.querySelector("th[data-act]")) return;
    t.dataset.sortKey = scope + ":" + i;
    head.querySelectorAll("th").forEach(th => { if (th.textContent.trim()) th.classList.add("sortable"); });
    const st = UI.sorts[t.dataset.sortKey];
    if (st) sortTable(t, st.col, st.dir);
  });
}
document.addEventListener("click", e => {
  const th = e.target.closest("th.sortable");
  if (!th || th.dataset.act) return;
  const table = th.closest("table"), key = table.dataset.sortKey, col = [...th.parentNode.children].indexOf(th);
  const cur = UI.sorts[key], dir = cur && cur.col === col ? -cur.dir : (typeof cellValue(table.querySelectorAll("tr")[1] && table.querySelectorAll("tr")[1].children[col]) === "number" ? -1 : 1);
  UI.sorts[key] = { col, dir };
  sortTable(table, col, dir);
});
function closeModal() { document.getElementById("modal").classList.add("hidden"); }

// une partie sauvegardée existe : on demande avant de la remplacer (une copie de secours reste de toute façon)
function confirmReplace(act) {
  if (UI.replaceOk || !hasSave()) return false;
  let info = ""; try { const x = JSON.parse(readSave()); info = `${esc(x.clubs[x.userId].name)} · saison ${x.season}, semaine ${x.week}`; } catch (e) { }
  modal(`<h2>Remplacer la partie en cours ?</h2><p>Une partie est déjà sauvegardée${info ? ` (<b>${info}</b>)` : ""}. La nouvelle partie prendra sa place.</p>
    <p class="muted">Une copie de secours de l'ancienne partie est conservée : vous pourrez la restaurer depuis l'écran d'accueil.</p>
    <div class="actions"><button data-act="close-modal">Annuler</button><button data-act="save-export">💾 Exporter l'ancienne d'abord</button><button class="danger" data-act="replace-ok" data-v="${act}">Remplacer</button></div>`);
  return true;
}
// restaure une partie (copie de secours ou fichier) et la remet en sauvegarde principale
function restoreRaw(raw) {
  if (!raw || !load(raw)) return toast("⚠️ Impossible de lire cette partie : " + (LOAD_ERROR || "fichier invalide"));
  closeModal(); saveNow(); UI.view = "dash"; render(); toast(`✅ Partie restaurée : ${user().name}, saison ${S.season}, semaine ${S.week}.`);
}
// copies de secours trouvées dans IndexedDB (dernière version de chaque partie, puis une par saison)
function listBackups() {
  idbAll().then(list => {
    const el = document.getElementById("backups"); if (!el) return;
    if (!list.length) { el.innerHTML = `<div style="margin-top:14px"><button class="small" data-act="save-import">📂 Importer une partie (.emsave)</button></div>`; return; }
    const games = list.filter(([k]) => k.startsWith("game:")).sort((a, b) => b[1].at - a[1].at);
    const seasons = list.filter(([k]) => k.startsWith("season:")).sort((a, b) => b[1].at - a[1].at);
    const row = ([k, m], tag) => `<div class="bk-row"><div><b>${esc(m.club || "?")}</b> <span class="muted">· saison ${m.season}, semaine ${m.week}${tag ? " · " + tag : ""}</span><div class="muted" style="font-size:12px">enregistrée le ${new Date(m.at).toLocaleString("fr-FR")}</div></div><button class="small" data-act="backup-restore" data-v="${esc(k)}">Restaurer</button></div>`;
    el.innerHTML = `<div class="card" style="margin-top:20px"><h3 style="margin-top:0">💾 Copies de secours</h3>
      <p class="muted" style="margin-top:-6px;font-size:13px">Le jeu garde une copie de chaque partie (et une par saison). Si votre partie a disparu ou a été remplacée, restaurez-la ici.</p>
      ${games.map(x => row(x, "dernière version")).join("")}
      ${UI.backupAll ? seasons.map(x => row(x, "copie de la saison")).join("") : seasons.length ? `<span class="link" data-act="backup-more">Voir aussi les ${seasons.length} copies par saison</span>` : ""}
      <div style="margin-top:10px"><button class="small" data-act="save-import">📂 Importer un fichier .emsave</button></div></div>`;
  });
}

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
    <div id="backups"></div>
    ${hasSave() ? `<div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap"><button class="primary" data-act="continue">▶ Continuer la partie sauvegardée</button><button data-act="save-export">💾 Exporter dans un fichier</button><button class="danger" data-act="wipe">Effacer la sauvegarde</button></div>` : ""}`;
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
        <div class="muted" style="font-size:12px;margin:4px 0">Notoriété ${c.fame}/100 · Budget ${money(c.fame * 45000)}</div>
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
  if (UI.screen === "home") listBackups();
}

// =====================================================================
//  Jeu
// =====================================================================
function render() {
  if (MEMO || !S) return render0();
  MEMO = new Map();
  try { render0(); } finally { MEMO = null; }
  achPopup();
}
function render0() {
  if (!S) return renderHome();
  const u = user();
  document.documentElement.style.setProperty("--club", u.color);
  const unread = S.inbox.filter(m => !m.read).length;
  const navs = [["dash", "🏠 Tableau de bord"], ["roster", "👥 Effectifs"], ["market", "💱 Mercato"], ["calendar", "🗓️ Calendrier"], ["comp", "🏆 Compétitions"], ["tours", "📅 Tournois"], ["ewc", "🌍 EWC"],
    ["finance", "💰 Finances"], ["sponsors", "🤝 Sponsors"], ["staff", "🧑‍🏫 Staff"], ["facilities", "🏗️ Infrastructures"], ["inbox", "✉️ Messagerie"], ["trophies", "🏆 Salle des trophées"], ["world", "🌍 Clubs & palmarès"]];
  const pending = S.over ? [] : weekEvents().filter(e => !e.done);
  $app.innerHTML = `<div class="game">
    <aside class="side">
      <div class="club-badge">${badge(u)}<div><b>${esc(u.name)}</b><div class="muted" style="font-size:12px">CEO : ${esc(S.ceo)}</div></div></div>
      <div class="side-search"><input id="g-search" placeholder="🔎 Équipe ou joueur…" autocomplete="off" aria-label="Rechercher une équipe ou un joueur"><div id="g-results" class="search-res hidden"></div></div>
      ${NAV_GROUPS.map(([title, keys]) => `<div class="nav-h">${title}</div>` + keys.map(k => { const l = navs.find(x => x[0] === k)[1]; return `<button class="nav ${UI.view === k ? "active" : ""}" data-act="view" data-v="${k}"><span>${l}</span>${k === "inbox" && unread ? `<span class="pill">${unread}</span>` : ""}</button>`; }).join("")).join("")}
      <button class="nav" data-act="help">❓ Comment jouer</button>
      <div style="flex:1"></div>
      <button class="nav" data-act="quit">🚪 Menu principal</button>
    </aside>
    <main class="main">
      <div class="topbar">
        <div class="stat"><b>${weekLabel(S.season, S.week, true)}</b><span>${seasonPhase()}</span></div>
        <div class="stat link-row" data-act="explain-budget" title="Comprendre le budget"><b class="${u.budget < 0 ? "bad" : ""}">${money(u.budget)}</b><span>Budget ⓘ</span></div>
        <div class="stat link-row" data-act="explain-fame" title="À quoi sert la notoriété ?"><b>${Math.round(u.fame)}<small class="muted">/100</small></b><span>Notoriété ⓘ</span></div>
        <div class="stat"><b>${u.fans.toLocaleString("fr-FR")}</b><span>Fans</span></div>
        <div class="stat link-row" data-act="explain-board" title="Comment marche la confiance du conseil ?"><b class="${S.board.confidence < 30 ? "bad" : S.board.confidence < 55 ? "warn" : "ok"}">${Math.round(S.board.confidence)}%</b><span>Confiance du conseil ⓘ</span></div>
        ${mercatoChip()}${S.saveError ? `<div class="stat bad" title="Le stockage est plein : la partie n'est plus enregistrée">⚠️ <b>Sauvegarde impossible</b><span>stockage plein</span></div>` : ""}
        <div class="spacer"></div>
        ${S.over ? `<button class="danger" data-act="quit">Partie terminée — Menu</button>` : `<div class="go-bar"><button class="go-skip" data-act="skip" title="Joue cette semaine puis passe les semaines sans match jusqu'au prochain">⏭<span>Aller au prochain match</span></button>
          <button class="primary go-main" data-act="next"><b>▶ Continuer</b><small>${pendingOffers().length ? `📨 ${pendingOffers().length} offre(s) à traiter` : pending.length ? `🎮 ${pending.length} match(s) à jouer cette semaine` : "Passer à la semaine suivante"}</small></button></div>`}
      </div>
      ${({ dash: viewDash, roster: viewRoster, market: viewMarket, calendar: viewCalendar, comp: viewComp, tours: viewTours, ewc: viewEwc, finance: viewFinance, sponsors: viewSponsors, staff: viewStaff, facilities: viewFacilities, inbox: viewInbox, trophies: viewTrophies, world: viewWorld })[UI.view]()}
    </main></div>`;
  applyTableSorts($app, UI.view);
}

// menu : les écrans regroupés par usage
const NAV_GROUPS = [["Jouer", ["dash", "calendar", "comp", "tours", "ewc"]], ["Équipes", ["roster", "market", "staff"]], ["Club", ["finance", "sponsors", "facilities", "trophies"]], ["Infos", ["inbox", "world"]]];
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
// tableau de bord : tout ce qui demande une action (effectifs, contrats, sponsors)
function alertsCard() {
  const u = user(), items = [];
  for (const g of incompleteGames()) items.push(`<div class="bad">⚠️ ${GAMES[g].icon} Effectif incomplet en ${GAMES[g].name} (${gamePlayers(g).length}/${GAMES[g].size}) : vos équipes jouent en sous-nombre. <span class="link" data-act="goto-market" data-v="${g}">Recruter</span></div>`);
  const exp = expiringPlayers();
  if (exp.length && S.week >= 26) items.push(`<div class="warn">⏳ ${exp.length} joueur(s) en fin de contrat à la fin de la saison : ${exp.slice(0, 6).map(p => `${GAMES[p.game].icon} ${esc(p.handle)}`).join(", ")}${exp.length > 6 ? "…" : ""}. <span class="link" data-act="contracts">Prolonger</span></div>`);
  // clauses de sponsors : une seule ligne, seulement quand le verdict approche ; regroupées par situation (même compétition)
  const sa = sponsorAlerts(true);
  if (sa.length) {
    const groups = {};
    for (const [d, c, risk] of sa) { const k = (c.game || "") + "|" + (c.kind === "rank" ? (leagueOf(S.userId, c.game) ? leagueName(leagueOf(S.userId, c.game)) : c.label) : c.kind); (groups[k] = groups[k] || []).push([d, c, risk]); }
    const parts = Object.values(groups).map(list => { const [d, c, risk] = list[0];
      return c.kind === "rank" ? `${c.game ? GAMES[c.game].icon + " " : ""}${esc(leagueOf(S.userId, c.game) ? leagueName(leagueOf(S.userId, c.game)) : c.label)} : vous êtes ${leagueRank(c.game)}e (${[...new Set(list.map(x => x[1].target))].sort().map(t => `${list.filter(x => x[1].target === t).length} ${t === 1 ? "veulent la 1re place" : "le top " + t}`).join(", ")})`
        : `${list.length} objectif(s) ${c.kind === "fans" ? "de fans" : "de titre"} (${esc(risk)})`; });
    const main = sa.filter(x => x[1].main).length;
    items.push(`<div class="warn">📉 ${sa.length} clause(s) de sponsors en danger, ${money(sa.reduce((a, x) => a + x[1].bonus, 0))} de primes en jeu${main ? ` · <b>${main} objectif(s) principal(aux)</b> : sans eux, pas de renouvellement` : ""} — ${parts.join(" · ")}. <span class="link" data-act="view" data-v="sponsors">Voir</span></div>`);
  }
  for (const d of u.sponsorDeals.filter(d => d.weeks <= 4)) items.push(`<div class="warn">🤝 Contrat ${esc(d.name)} : fin dans ${d.weeks} semaine(s)${d.renew === "yes" ? " (prolongation acceptée, à négocier à la fin)" : d.renew === "no" ? " (vous ne renouvelez pas)" : d.renew === "refused" ? " (la marque ne prolonge pas)" : d.weeks <= 2 ? "" : " — décision de renouvellement dans " + (d.weeks - 2) + " semaine(s)"}.</div>`);
  return items;
}
// en haut du tableau de bord : ce qui se passe cette semaine, ce qui arrive, ce qui demande une action
function weekCard() {
  const u = user(), evs = S.over ? [] : weekEvents(), left = evs.filter(e => !e.done), alerts = alertsCard();
  const evRows = evs.map(e => `<div class="wk-ev imp-${e.imp || "normal"}">${gchip(e.game)} ${e.impLabel ? `<span class="imp-chip imp-${e.imp}">${esc(e.impLabel)}</span>` : ""} <b>${esc(e.title)}</b> <span class="muted">${esc(e.what || "")}</span>${e.done ? " <span class='ok'>✓</span>" : ""}</div>`).join("");
  // les grands rendez-vous à venir (finales, S et A-Tier) des jeux du club
  const soon = [];
  for (const g of Object.keys(u.divisions)) for (const t of allTournaments(g)) if (t[1] > S.week && t[1] <= S.week + 6 && "SA".includes(tourTier(t))) { const st = tourState(g, t); if (st.st === "in") soon.push([g, t]); }
  soon.sort((a, b) => a[1][1] - b[1][1]);
  const next = soon.slice(0, 4).map(([g, t]) => `<div class="wk-soon">${gchip(g)} <span class="imp-chip imp-${TIER_IMP[tourTier(t)]}">${tourTier(t)}</span> <b>${esc(t[0])}</b> <span class="muted">· ${weekLabel(S.season, t[1])}</span></div>`).join("");
  return `<div class="card week-card"><div class="wk-head"><div><h3 style="margin:0">📋 Cette semaine</h3><div class="muted" style="font-size:13px">${weekLabel(S.season, S.week, true)} · ${seasonPhase()}</div></div>
      ${S.over ? "" : `<button class="primary" data-act="next">${left.length ? `🎮 Jouer les matchs (${left.length})` : "Semaine suivante ▶"}</button>`}</div>
    ${evRows ? `<div class="wk-list">${evRows}</div>` : `<p class="muted" style="margin:8px 0 0">Pas de match pour votre club cette semaine.</p>`}
    ${alerts.length ? `<div class="wk-alerts"><b>⚠️ À traiter</b>${alerts.join("")}</div>` : `<p class="ok" style="margin:10px 0 0;font-size:13px">✅ Rien d'urgent à régler.</p>`}
    ${next ? `<div class="wk-next"><b>📅 Bientôt</b>${next}</div>` : ""}</div>`;
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
  return `${weekCard()}${S.week >= EWC_FIRST - 4 && S.week <= EWC_LAST_WEEK + 2 ? ewcBanner() : ""}<div class="grid g2">
    <div class="card"><h3>🎯 Objectif du conseil</h3><p style="font-size:16px"><b>${obj[0].toUpperCase() + obj.slice(1)}</b></p>
      <div>Confiance ${bar(S.board.confidence)} ${Math.round(S.board.confidence)}% <span class="link" data-act="explain-board" title="Comment marche la confiance du conseil ?">ⓘ comment ça marche</span></div>
      <p class="muted" style="font-size:12px">À la fin de chaque saison, les 2 premiers d'un tier montent et les 2 derniers descendent. Si la confiance tombe à 0 % ou si les dettes deviennent trop lourdes, vous êtes licencié.</p></div>
    <div class="card"><h3>📅 Résultats de la semaine passée</h3>${lastHtml}</div>
  </div>
  <h3 style="margin-top:20px">Divisions</h3><div class="grid g3">${divCards}</div>
  ${formCard()}
  <h3 style="margin-top:20px">Prochains tournois</h3><div class="card">${upcomingTours(5) || "<p class='muted'>Aucun tournoi à venir pour vos jeux cette saison.</p>"}</div>
  <h3 style="margin-top:20px">Derniers messages</h3><div class="card" style="padding:0">${mails || "<p class='muted' style='padding:12px'>Rien de neuf.</p>"}</div>`;
}
// note de match sur 10 (vert : très bon, rouge : mauvais)
const noteCls = n => n >= 8 ? "n-top" : n >= 7 ? "n-good" : n >= 6 ? "n-ok" : "n-bad";
const noteChip = n => n == null ? "<span class='muted'>—</span>" : `<span class="note ${noteCls(n)}">${n.toFixed(1)}</span>`;
const notesLine = list => list && list.length ? `<div class="notes-line">${list.map(([h, n, id]) => `<span class="link-row" data-act="player-info" data-v="${id}">${esc(h)} ${noteChip(n)}</span>`).join("")}</div>` : "";
// joueurs en difficulté et en forme (notes des 3 derniers matchs) : à aller voir pour les remotiver, les recadrer ou renégocier
function formCard() {
  const ps = allUserPlayers().filter(p => recentNote(p) != null);
  if (!ps.length) return "";
  const row = p => `<tr><td>${gchip(p.game)}</td><td>${flag(p.nat)} <b>${esc(p.handle)}</b>${playerBadges(p)}</td><td>${noteChip(recentNote(p))}</td><td>${formSpark(p)}</td><td>${bar(p.morale)}</td><td><button class="small" data-act="talk" data-v="${p.id}">💬 Lui parler</button></td></tr>`;
  const sorted = ps.slice().sort((a, b) => recentNote(a) - recentNote(b));
  return `<div class="grid g2" style="margin-top:20px">
    <div class="card"><h3>📉 Joueurs en difficulté</h3><div class="table-wrap"><table>${sorted.slice(0, 5).map(row).join("")}</table></div></div>
    <div class="card"><h3>⭐ Joueurs en forme</h3><div class="table-wrap"><table>${sorted.slice(-5).reverse().map(row).join("")}</table></div></div></div>`;
}
function matchRow(r) {
  const g = r.game ? GAMES[r.game] : null, game = r.game || UI.compGame;
  const myNotes = S && S.userId ? (isMine(r.a) ? r.notesA : isMine(r.b) ? r.notesB : null) : null;
  return `<div class="match">
    <div class="r ${r.winner === r.a ? "win" : "lose"}">${displayName(r.a, game)}</div>
    <div class="score">${r.sa} - ${r.sb}</div>
    <div class="${r.winner === r.b ? "win" : "lose"}">${displayName(r.b, game)}</div>
  </div><div class="muted sub">${g ? g.icon + " " + g.short + (r.tier ? " T" + r.tier : "") + " · " : ""}${r.stage || ""} (BO${r.bestOf})${r.maps && r.maps.length ? " · " + r.maps.join(", ") : ""}${r.mvp ? " · MVP " + esc(r.mvp) : ""}${r.rk && S && S.userId && (isMine(r.a) || isMine(r.b)) ? (isMine(r.winner) ? ` · <b class="ok" title="Points de classement : victoire en ligue/tournoi + face-à-face">classement +${r.rk.win}</b>` : ` · <b class="bad" title="Points de classement perdus : plus l'adversaire était mal classé, plus la défaite coûte">classement ${r.rk.loss}</b>`) : ""}</div>${notesLine(myNotes)}`;
}
function lobbyRow(l) {
  const g = GAMES[l.game], m = l.mine;
  const places = m.places.map(p => p === 1 ? "<b class='win'>👑 1er</b>" : p <= 10 ? `<b>${p}e</b>` : `${p}e`).join(" · ");
  return `<div class="lobby"><div><b>${g.icon} ${g.short}${g.open ? "" : " T" + l.tier}</b> — ${l.stage} · lobby de ${l.lobby} ${g.unit}s${g.size > 1 ? ` (${l.lobby * g.size} joueurs)` : ""}</div>
    <div>Placements : ${places}</div>
    <div><b>${m.pts} pts</b> · ${m.kills} éliminations · <b>${l.rank}e</b> du circuit cette semaine${l.mvp ? " · meilleur joueur : " + esc(l.mvp) : ""}</div>${notesLine(l.notes && l.notes[l.club])}</div>`;
}

// évolution d'un joueur du club : note à son arrivée (ou au début du suivi), gain, rythme actuel en points par saison
function evolutionOf(p) {
  const h = p.hist || [], first = h.length ? h[0][1] : p.rating, seasonStart = (h.find(x => Math.floor(x[0] / 100) === S.season) || [0, first])[1];
  const g = growthOf(p), perSeason = g.rate * SEASON_WEEKS;
  return { first, since: p.rating - first, season: p.rating - seasonStart, perSeason, g, room: Math.max(0, p.pot - p.rating), xp: p.xp || 0 };
}
function evoCell(p) {
  const e = evolutionOf(p), pace = Math.min(e.perSeason, e.room);
  const tip = `Arrivé à ${e.first}, aujourd'hui ${p.rating}. Rythme actuel : environ +${pace.toFixed(1)} par saison${e.room ? "" : " (plafond atteint)"}.`;
  return `<span title="${tip}">${e.since > 0 ? `<b class="ok">+${e.since}</b>` : e.since < 0 ? `<b class="bad">${e.since}</b>` : "<span class='muted'>=</span>"} <small class="${!e.room ? "muted" : pace >= 3 ? "ok" : pace >= 1 ? "" : "muted"}">${!e.room ? "max" : pace >= 3 ? "▲▲" : pace >= 1 ? "▲" : pace >= 0.3 ? "↗" : "→"}</small></span>`;
}
// fiche joueur : progression détaillée et ce qui la fait varier
function evoCard(p) {
  const e = evolutionOf(p), g = e.g, pace = Math.min(e.perSeason, e.room), weeks = g.rate > 0 ? Math.ceil((1 - (e.xp % 1)) / g.rate) : 0;
  const f = (ok, txt) => `<li class="${ok > 0 ? "ok" : ok < 0 ? "bad" : ""}">${ok > 0 ? "▲" : ok < 0 ? "▼" : "•"} ${txt}</li>`;
  const factors = !e.room ? [f(0, `A atteint son potentiel (${potTxt(p)}) : il ne progresse plus, il faut maintenir sa forme.`)] : [
    f(g.ageF >= 0.8 ? 1 : g.ageF >= 0.3 ? 0 : -1, `Âge : ${p.age} ans — ${g.ageF >= 1 ? "l'âge où l'on progresse le plus vite" : g.ageF >= 0.8 ? "progresse encore vite" : g.ageF >= 0.55 ? "progresse, mais moins vite" : g.ageF >= 0.3 ? "la progression ralentit" : "presque à maturité, progresse très peu"}`),
    f(p.starter ? 1 : -1, p.starter ? "Titulaire : il joue, il progresse à plein régime" : "Remplaçant : sans temps de jeu, il progresse 2,5 fois moins vite"),
    f(g.perf > 1.05 ? 1 : g.perf < 0.95 ? -1 : 0, g.avg ? `Notes en match : ${g.avg.toFixed(1)}/10 de moyenne (${g.perf > 1.05 ? "bonus" : g.perf < 0.95 ? "malus" : "neutre"} ×${g.perf.toFixed(2)})` : "Notes en match : pas encore de match cette saison"),
    f(g.coaching >= 3 ? 1 : g.coaching <= 1 ? -1 : 0, `Infrastructure « Entraînement » niveau ${g.coaching}${g.coaching < 5 ? " (à améliorer dans Infrastructures)" : ""}`),
    ...(p.age <= 21 ? [f(g.co ? (g.coach > 0 ? 1 : g.coach < 0 ? -1 : 0) : -1, g.co ? `Entraîneur ${esc(g.co.name)} : travail avec les jeunes ${g.co.attrs.jeunes}/20` : "Pas d'entraîneur : les jeunes progressent moins (onglet Staff)")] : []),
    ...(g.aca ? [f(1, "Titulaire à l'académie : bonus de progression")] : []),
  ];
  return `<div class="card" style="margin-top:12px"><h3>📈 Progression</h3>
    <div class="offer"><div><span class="muted">À son arrivée</span><b>${R(e.first)}</b></div><div><span class="muted">Aujourd'hui</span><b>${R(p.rating)}</b></div>
      <div><span class="muted">Gagné au club</span><b class="${e.since > 0 ? "ok" : e.since < 0 ? "bad" : ""}">${e.since > 0 ? "+" : ""}${e.since}</b></div><div><span class="muted">Potentiel estimé</span><b>${potTxt(p)}</b></div></div>
    ${e.room ? `<p style="margin:8px 0 4px">Prochain point : ${bar((e.xp % 1) * 100)} ${weeks ? `dans environ <b>${weeks} semaine${weeks > 1 ? "s" : ""}</b>` : "<span class='muted'>à l'arrêt</span>"}</p>
    <p style="margin:0">Rythme actuel : environ <b class="${pace >= 3 ? "ok" : pace < 1 ? "warn" : ""}">+${pace.toFixed(1)} point${pace >= 2 ? "s" : ""} par saison</b>${e.season ? ` · <b>${e.season > 0 ? "+" : ""}${e.season}</b> cette saison` : ""}. ${pace > 0 && e.room > pace ? `À ce rythme, il lui faudrait environ ${Math.ceil(e.room / Math.max(0.1, e.perSeason))} saison(s) pour atteindre son potentiel ; mais la progression ralentit avec l'âge.` : ""}</p>` : ""}
    <ul class="explain" style="margin-top:8px">${factors.join("")}</ul>
    <p class="muted" style="font-size:12px;margin:0">Comme en vrai, un joueur progresse surtout avant 23 ans, s'il joue et s'il brille en match. Le potentiel est une estimation : un jeune très performant peut le dépasser un peu, un joueur qui ne joue pas peut ne jamais l'atteindre.</p></div>`;
}

// ---------- effectifs ----------
// choix de la ligue nationale (LFL, Prime League…) quand le tier 2 de la zone en compte plusieurs
function subPicker(game, d) {
  const zone = d.zone || "W", subs = !GAMES[game].open && d.tier >= 2 && subsOf(game, 2, zone);
  if (!subs || subs.length < 2) return "";
  const u = user(), want = (u.subPref && subs.includes(u.subPref[game]) && u.subPref[game]) || (d.tier === 2 && d.sub) || subFor(game, 2, zone, u.country);
  const hint = d.tier > 2 ? "à la montée en tier 2" : want === d.sub ? (canSwitchSub(game) ? "changement immédiat" : "changement en fin de saison") : "transfert en fin de saison";
  return `<label class="muted" style="font-size:12px">Ligue nationale visée (${hint}) :
    <select class="small-sel" data-change="sub-pick" data-game="${game}" aria-label="Ligue nationale visée">${subs.map(s => `<option value="${s}" ${s === want ? "selected" : ""}>${esc(tierName(game, 2, zone, s))}</option>`).join("")}</select></label>`;
}
function viewRoster() {
  const u = user(), divs = Object.keys(u.divisions);
  if (!UI.rosterGame || !u.divisions[UI.rosterGame]) UI.rosterGame = divs[0] || null;
  const tabs = divs.map(g => `<button class="tab ${UI.rosterGame === g ? "active" : ""}" data-act="roster-game" data-v="${g}">${GAMES[g].icon} ${GAMES[g].short} · ${tshort(g, u.divisions[g].tier)}</button>`).join("");
  const others = Object.keys(GAMES).filter(g => !u.divisions[g]);
  const open = `<div class="card" style="margin-top:20px"><h3>➕ Ouvrir une nouvelle division</h3>
    <p class="muted" style="margin-top:-6px">Le tier 3 est ouvert à tous. Acheter une place plus haut demande de la notoriété, d'autant plus que le jeu est suivi (tier 1 de LoL bien plus exigeant que celui de Trackmania). Vous êtes à <b>${u.fame.toFixed(0)}/100</b>.</p>
    <div class="grid g3">${others.map(g => `
    <div class="open-div"><div><b>${GAMES[g].icon} ${GAMES[g].name}</b><div class="muted" style="font-size:12px">${FMT_LABEL[GAMES[g].fmt]} · ${GAMES[g].size} joueur(s)${GAMES[g].fmt === "br" ? " · lobbies de " + lobbyText(g) : ""}</div>${GAMES[g].open ? "" : `<div style="font-size:12px">Notoriété requise : <span class="${u.fame >= fameReq(g, 2) ? "ok" : "muted"}">T2 ${fameReq(g, 2)}</span> · <span class="${u.fame >= fameReq(g, 1) ? "ok" : "muted"}">T1 ${fameReq(g, 1)}</span></div>`}${!mercatoRules(g).always ? `<div style="font-size:12px" class="${mercatoOpen(g) ? "ok" : "muted"}">${mercatoOpen(g) ? "🟢 Mercato ouvert : bon moment pour lancer la section" : `🔴 Mercato fermé (agents libres seulement) jusqu'au ${dayLabel(nextWindow(g)[1], nextWindow(g)[0], 0)}`}</div>` : ""}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">${(GAMES[g].open ? [3] : [3, 2, 1]).map(t => `<button class="small" data-act="open-div" data-v="${g}|${t}" ${canJoin(g, t) ? "disabled" : ""} title="${esc(canJoin(g, t) || tierName(g, GAMES[g].open ? 1 : t, zoneFrom(g, REGION_OF[u.country] || "EU", u.country)))}">${GAMES[g].open ? "Circuit ouvert" : "T" + t} · ${money(tierEntry(g, t))}</button>`).join("")}${franchiseZones(g).length ? `<button class="small" data-act="franchise" data-v="${g}" title="Ligue fermée : racheter la place d'un club">🔒 Franchise</button>` : ""}</div></div>`).join("")}</div></div>`;
  if (!UI.rosterGame) return `<h2>Effectifs</h2><p class="muted">Votre club n'a encore aucune division.</p>${open}`;
  const g = GAMES[UI.rosterGame], d = u.divisions[UI.rosterGame];
  const ps = clubPlayers(u.id, UI.rosterGame).sort((a, b) => (b.starter - a.starter) || b.rating - a.rating);
  const nSt = ps.filter(p => p.starter).length;
  const rows = ps.map(p => `<tr>
    <td>${p.starter ? "⭐" : "<span class='muted'>banc</span>"}</td>
    <td>${flag(p.nat)} <b class="link" data-act="player-info" data-v="${p.id}">${esc(p.handle)}</b> <small class="muted" title="Région de jeu">${playRegion(p)}</small>${adaptFactor(p) < 1 ? ` <small class="warn" title="Adaptation à sa nouvelle région">✈️</small>` : ""}${playerBadges(p)}</td><td>${p.role}</td><td>${ageTxt(p)}</td><td>${R(p.rating)}</td>
    <td>${potTxt(p)}</td><td>${evoCell(p)}</td>
    <td>${noteChip(avgNote(p))}</td>${UI.rosterFull ? `<td>${formSpark(p)}</td>` : ""}
    <td>${bar(p.form)}</td><td>${bar(p.morale)}</td>
    <td>${money(p.salary)}/sem</td><td class="${p.years <= 1 ? "warn" : ""}">${p.years} an(s)</td>${UI.rosterFull ? `<td>${p.clause ? money(p.clause) : "<span class='muted'>—</span>"}</td><td>${money(playerValue(p))}</td>` : ""}
    <td style="white-space:nowrap">
      <button class="small" data-act="starter" data-v="${p.id}">${p.starter ? "→ Banc" : "→ Titulaire"}</button>
      <button class="small" data-act="talk" data-v="${p.id}" title="Parler au joueur">💬</button>
      <button class="small" data-act="contract" data-v="${p.id}">Contrat</button>
      ${academyOf(p.game) ? `<button class="small" data-act="to-academy" data-v="${p.id}" title="Envoyer le joueur dans l'académie (même contrat)">↓ Académie</button>` : ""}
      ${sellBtn(p)}
      <button class="small danger" data-act="release" data-v="${p.id}">Libérer</button></td></tr>`).join("");
  if (unitGame(UI.rosterGame)) return `<h2>Effectifs</h2><div class="tabs">${tabs}</div>${unitRoster(UI.rosterGame)}${open}`;
  return `<h2>Effectifs</h2><div class="tabs">${tabs}</div>
    <div class="card"><div class="roster-head"><h3 style="margin:0">${g.icon} ${g.name}${d.label ? ` (${esc(d.label)})` : ""}</h3>
      <div class="roster-kpis"><span>Force ${R(Math.round(teamStrength(u.id, UI.rosterGame).str))}</span><span class="${nSt < g.size ? "bad" : ""}">Titulaires <b>${nSt}/${g.size}</b></span>${tchip(d.tier, UI.rosterGame)}<span class="muted">${esc(divName(u.id, UI.rosterGame))}${teamRegion(u.id, UI.rosterGame) ? " · " + REGIONS[teamRegion(u.id, UI.rosterGame)] : ""}</span></div>
      ${subPicker(UI.rosterGame, d)}</div>
      <div class="toolbar roster-actions"><button class="small" data-act="auto-lineup">⚡ Composition auto</button>
      <button class="small" data-act="team-talk" data-v="${UI.rosterGame}">💬 Réunion d'équipe</button>
      ${franchiseZones(UI.rosterGame).length && !isClosed(UI.rosterGame, d.tier, d.zone) ? `<button class="small" data-act="franchise" data-v="${UI.rosterGame}">🔒 Racheter une franchise</button>` : ""}
      ${!g.open && !RANKED_GAMES.includes(UI.rosterGame) ? `<button class="small" data-act="tier-modal" data-v="${UI.rosterGame}" title="Acheter une place plus haut ou redescendre">🔀 Changer de tier${(user().tierReq || {})[UI.rosterGame] ? " (demandé)" : ""}</button>` : ""}
      <button class="small" data-act="goto-market" data-v="${UI.rosterGame}">🔎 Recruter</button>
      <button class="small" data-act="roster-full" title="Afficher ou masquer les colonnes détaillées">${UI.rosterFull ? "➖ Moins de colonnes" : "➕ Plus de colonnes"}</button>
      <button class="small danger" data-act="close-div">Fermer la division</button></div>
    ${chemLine(u.id, UI.rosterGame)}
    <div class="table-wrap"><table><tr><th></th><th>Joueur</th><th>Rôle</th><th>Âge</th><th>Note</th><th>Potentiel</th><th title="Points gagnés depuis son arrivée et rythme de progression (▲▲ rapide, ▲ normal, ↗ lent, → à l'arrêt)">Évol.</th><th title="Note moyenne en match cette saison (sur 10)">Moy.</th>${UI.rosterFull ? `<th title="5 derniers matchs">Derniers matchs</th>` : ""}<th>Forme</th><th>Moral</th><th>Salaire</th><th>Contrat</th>${UI.rosterFull ? "<th>Clause</th><th>Valeur</th>" : ""}<th></th></tr>${rows || `<tr><td colspan="15" class="muted">Aucun joueur. Rendez-vous au mercato !</td></tr>`}</table></div></div>
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
    const rows = ps.map(p => `<tr><td>${flag(p.nat)} <b class="link" data-act="player-info" data-v="${p.id}">${esc(p.handle)}</b> <small class="muted">${playRegion(p)}</small>${adaptFactor(p) < 1 ? ` <small class="warn" title="Adaptation à sa nouvelle région">✈️</small>` : ""}</td><td>${p.role}</td><td>${ageTxt(p)}</td><td>${R(p.rating)}</td><td>${potTxt(p)}</td><td>${evoCell(p)}</td><td>${noteChip(avgNote(p))}</td><td>${bar(p.form)}</td><td>${bar(p.morale)}</td>
      <td>${money(p.salary)}/sem</td><td class="${p.years <= 1 ? "warn" : ""}">${p.years} an(s)</td>
      <td style="white-space:nowrap"><button class="small" data-act="talk" data-v="${p.id}" title="Parler au joueur">💬</button> ${opts(p) ? `<select class="small-sel" data-change="unit-move" data-pid="${p.id}" aria-label="Changer d'équipe"><option value="">Changer d'équipe…</option>${opts(p)}</select>` : ""}
        <button class="small" data-act="contract" data-v="${p.id}">Contrat</button>${sellBtn(p)}<button class="small danger" data-act="release" data-v="${p.id}">Libérer</button></td></tr>`).join("")
      + mates.map(p => `<tr class="mate"><td>${flag(p.nat)} ${esc(p.handle)}* </td><td>${p.role}</td><td>${ageTxt(p)}</td><td>${R(p.rating)}</td><td colspan="7" class="muted">Partenaire extérieur au club : il joue avec votre joueur, vous ne le payez pas.</td></tr>`).join("");
    return `<div class="card" style="margin-bottom:14px"><div class="toolbar"><div style="flex:1;min-width:0"><h3 style="margin:0">${g.icon} ${soloGame(game) ? `${k === 0 ? "N°1" : "Joueur " + (k + 1)} · ${ps[0] ? esc(ps[0].handle) : "—"}` : `${g.unit[0].toUpperCase() + g.unit.slice(1)} ${k + 1} · ${ZONE_NAMES[d.zone] || "Monde"}`} — Force ${R(Math.round(teamStrength(id, game).str))}</h3>
      <div style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">${tchip(d.tier, game)}<span class="muted">${esc(leagueName(L))}${pos ? ` · ${pos}e / ${L.teams.length}` : ""}</span></div></div></div>
      <div class="table-wrap"><table><tr><th>Joueur</th><th>Rôle</th><th>Âge</th><th>Note</th><th>Potentiel</th><th title="Points gagnés depuis son arrivée et rythme de progression (▲▲ rapide, ▲ normal, ↗ lent, → à l'arrêt)">Évol.</th><th>Moy.</th><th>Forme</th><th>Moral</th><th>Salaire</th><th>Contrat</th><th></th></tr>${rows || `<tr><td colspan="12" class="muted">Aucun joueur.</td></tr>`}</table></div></div>`;
  }).join("");
  return `<div class="card" style="margin-bottom:14px"><div class="toolbar"><div style="flex:1;min-width:0"><h3 style="margin:0">${g.icon} ${g.name} ${S.season} — ${soloGame(game) ? `${teams.length} joueur(s) engagé(s)` : `${g.unit}s (${g.size} joueurs)`}</h3>
      <p class="muted" style="margin:6px 0 0;font-size:13px">${soloGame(game) ? `Jeu en solo : pas de banc, chacun de vos joueurs est titulaire et joue de son côté sous les couleurs du club, avec sa propre place dans votre ligue (${esc(leagueName(leagueOf(u.id, game)))}) et dans les tournois. Ils ne jouent jamais ensemble et peuvent même s'affronter. Un joueur recruté en cours de saison dispute tout de suite les tournois ; ses matchs de ligue commencent à la saison suivante.` : `Pas de banc : chacun de vos joueurs joue dans un ${g.unit}. Vous pouvez aligner plusieurs ${g.unit}s, chacun dans la FNCS de sa région (un ${g.unit} américain en Amérique du Nord, un ${g.unit} européen en Europe). Un joueur seul se trouve un partenaire hors du club, que vous ne payez pas (marqué d'un astérisque). Pour changer un joueur de région, renégociez son contrat.`}</p></div>
      <button class="small" data-act="team-talk" data-v="${game}">💬 Réunion d'équipe</button><button class="small" data-act="goto-market" data-v="${game}">🔎 Recruter</button><button class="small danger" data-act="close-div">Fermer la division</button></div></div>${cards}`;
}
// entente des titulaires et entraîneur du jeu (effectifs)
function chemLine(clubId, game) {
  const st = teamStrength(clubId, game), co = coachOf(game), cf = conflicts(st.lineup);
  const txt = st.chem >= 5 ? "excellente" : st.chem >= 1.5 ? "bonne" : st.chem > -1.5 ? "correcte" : st.chem > -5 ? "tendue" : "explosive";
  return `<div class="chem-line"><span>🤝 Entente des titulaires : <b class="${st.chem >= 1.5 ? "ok" : st.chem > -1.5 ? "" : "bad"}">${txt} (${st.chem > 0 ? "+" : ""}${st.chem})</b> <small class="muted">jusqu'à ±3 % de niveau</small></span>
    ${cf.map(([a, b, sc]) => `<span class="chip ${sc > 0 ? "ok" : "bad"}" title="${esc(traitOf(a))} / ${esc(traitOf(b))}">${sc > 0 ? "💚" : "⚡"} ${esc(a.handle)} & ${esc(b.handle)}</span>`).join("")}
    <span>🧑‍🏫 ${co ? `<b class="link" data-act="view" data-v="staff">${esc(co.name)}</b> (niveau ${coachLevel(co).toFixed(1)})` : `<span class="link warn" data-act="view" data-v="staff">Pas d'entraîneur : en engager un</span>`}</span></div>`;
}
// 5 dernières notes en petites pastilles
const formSpark = p => (p.notes || []).length ? `<span class="spark">${p.notes.slice(-5).map(n => `<i class="${noteCls(n)}" style="height:${Math.round(20 + (n - 3) * 11)}%" title="${n.toFixed(1)}"></i>`).join("")}</span>` : "<span class='muted'>—</span>";
const playerBadges = p => (p.listed ? ` <span class="chip warn" title="Sur la liste des transferts">📋 à vendre</span>` : "") + (boostOf(p) > 0 ? ` <span class="chip ok" title="Remotivé après une discussion">🔥</span>` : "") + (p.wantsOut ? ` <span class="chip bad" title="Veut partir">🚪</span>` : "");
// discussion avec un joueur (façon FM)
function talkModal(pid, reply) {
  const p = S.players[pid]; if (!p) return closeModal();
  const avg = avgNote(p), rec = recentNote(p), cool = p.talkedAt && nowIndex() - p.talkedAt < 2;
  const opt = (k, label, hint) => `<button class="talk-opt" data-act="talk-do" data-v="${p.id}|${k}" ${cool && k !== "list" ? "disabled" : ""}><b>${label}</b><small class="muted">${hint}</small></button>`;
  modal(`<h2>💬 ${flag(p.nat)} ${esc(p.handle)}</h2>
    <p class="muted" style="margin-top:-6px">${GAMES[p.game].icon} ${GAMES[p.game].short} · ${p.role} · ${ageTxt(p)} ans · ${R(p.rating)} · ${personalityOf(p)} · statut « ${p.status || "Titulaire"} »${p.starter ? " · titulaire" : " · remplaçant"}</p>
    <div class="offer"><div><span class="muted">Moyenne de la saison</span><b>${avg ? avg.toFixed(2) : "—"}</b></div><div><span class="muted">3 derniers matchs</span><b>${rec ? rec.toFixed(2) : "—"}</b></div><div><span class="muted">Moral</span><b>${Math.round(p.morale)}/100</b></div></div>
    <div style="margin:6px 0">${formSpark(p)} ${(p.notes || []).slice(-10).map(noteChip).join(" ")}</div>
    ${reply ? `<div class="reply ${reply.tone || ""}">${reply.msg}</div>` : ""}
    ${cool ? "<p class='muted' style='font-size:12px'>Vous lui avez parlé récemment : attendez la semaine prochaine pour une nouvelle discussion.</p>" : ""}
    <div class="talk-grid">
      ${opt("praise", "👏 Le féliciter", "Efficace s'il joue bien, hypocrite sinon.")}
      ${opt("motivate", "💪 L'encourager", "Remonte le moral, petit bonus pendant 3 semaines.")}
      ${opt("demand", "😤 Exiger mieux", "Risqué : il peut se reprendre (gros bonus) ou se vexer.")}
      ${!p.starter && !unitGame(p.game) ? opt("playtime", "🎯 Lui promettre une place", "Il deviendra « Titulaire » promis : faites-le jouer.") : ""}
      ${opt("list", p.listed ? "📋 Le retirer de la liste des transferts" : "📋 Le mettre sur la liste des transferts", p.listed ? "Il reste au club." : "Les clubs intéressés feront des offres.")}
      <button class="talk-opt" data-act="renew" data-v="${p.id}"><b>✍️ Renégocier son contrat</b><small class="muted">Salaire, durée, statut, région…</small></button>
      <button class="talk-opt" data-act="release" data-v="${p.id}"><b>🚪 Résilier son contrat</b><small class="muted">Indemnité de rupture.</small></button>
    </div>
    <div class="actions"><button data-act="close-modal">Fermer</button></div>`);
}
function teamTalkModal(game, reply) {
  const { n, wins } = teamResults(game), u = user(), cool = u.teamTalks && u.teamTalks[game] && nowIndex() - u.teamTalks[game] < 3;
  const opt = (k, label, hint) => `<button class="talk-opt" data-act="team-talk-do" data-v="${game}|${k}" ${cool ? "disabled" : ""}><b>${label}</b><small class="muted">${hint}</small></button>`;
  const worst = gamePlayers(game).filter(p => recentNote(p) != null).sort((a, b) => recentNote(a) - recentNote(b)).slice(0, 3);
  modal(`<h2>💬 Réunion d'équipe — ${GAMES[game].icon} ${GAMES[game].name}</h2>
    <p>${n ? `Derniers résultats : <b class="${wins / n >= 0.5 ? "ok" : "bad"}">${wins} victoire(s) sur ${n}</b>.` : "Pas encore de résultats cette saison."}${worst.length ? ` Les moins en forme : ${worst.map(p => `<span class="link" data-act="talk" data-v="${p.id}">${esc(p.handle)}</span> ${noteChip(recentNote(p))}`).join(", ")}.` : ""}</p>
    ${reply ? `<div class="reply">${reply.msg}</div>` : ""}
    <div class="talk-grid">
      ${opt("praise", "👏 Féliciter le groupe", "Après de bons résultats.")}
      ${opt("reassure", "🤝 Rassurer", "Après une mauvaise passe : remonte le moral.")}
      ${opt("pressure", "😤 Mettre la pression", "Réveille certains, en vexe d'autres.")}
      ${opt("calm", "🧘 Rester concentrés", "Sans risque, effet léger.")}
    </div>
    ${cool ? "<p class='muted' style='font-size:12px'>Vous avez réuni l'équipe il y a peu : attendez quelques semaines.</p>" : ""}
    <div class="actions"><button data-act="close-modal">Fermer</button></div>`);
}
ACTIONS["talk"] = v => talkModal(v);
ACTIONS["talk-do"] = v => { const [pid, k] = v.split("|"); const r = talkToPlayer(pid, k); scheduleSave(); render(); talkModal(pid, r); };
ACTIONS["team-talk"] = v => teamTalkModal(v);
ACTIONS["team-talk-do"] = v => { const [g, k] = v.split("|"); const r = teamTalk(g, k); scheduleSave(); render(); teamTalkModal(g, r); };
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
    <td>${flag(p.nat)} <b class="link" data-act="player-info" data-v="${p.id}">${esc(p.handle)}</b> <small class="muted">${playRegion(p)}</small></td><td>${p.role}</td><td>${ageTxt(p)}</td><td>${R(p.rating)}</td><td>${potTxt(p)}</td><td>${evoCell(p)}</td>
    <td>${bar(p.form)}</td><td>${bar(p.morale)}</td><td>${money(p.salary)}/sem</td><td class="${p.years <= 1 ? "warn" : ""}">${p.years} an(s)</td>
    <td style="white-space:nowrap"><button class="small primary" data-act="to-academy" data-v="${p.id}">↑ Équipe première</button>
      <button class="small" data-act="contract" data-v="${p.id}">Contrat</button>
      <button class="small danger" data-act="release" data-v="${p.id}">Libérer</button></td></tr>`).join("");
  const L = leagueOf(aca.id, game), pos = standings(L.key).findIndex(r => r.id === aca.id) + 1;
  return `<div class="card" style="margin-top:20px"><div class="toolbar"><div style="flex:1;min-width:0"><h3 style="margin:0">🎓 ${esc(aca.name)} — Force ${R(Math.round(teamStrength(aca.id, game).str))}</h3>
      <div style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">${tchip(ad.tier)}<span class="muted">${esc(leagueName(L))}${pos ? ` · ${pos}e` : ""} · composition automatique (les meilleurs jouent)</span></div></div>
      <button class="small danger" data-act="close-academy">Fermer l'académie</button></div>
    <div class="table-wrap"><table><tr><th></th><th>Joueur</th><th>Rôle</th><th>Âge</th><th>Note</th><th>Potentiel</th><th title="Points gagnés depuis son arrivée et rythme de progression (▲▲ rapide, ▲ normal, ↗ lent, → à l'arrêt)">Évol.</th><th>Forme</th><th>Moral</th><th>Salaire</th><th>Contrat</th><th></th></tr>${rows || `<tr><td colspan="12" class="muted">Aucun joueur.</td></tr>`}</table></div></div>`;
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
// tous les transferts de la saison (clubs de l'IA et vous) : qui part, qui arrive, pour combien
function viewMoves() {
  const m = UI.market, g = m.game, u = user();
  const list = (S.moves || []).filter(x => (g === "all" ? true : x[2] === g)).slice().reverse();
  const nm = (id, game) => id ? (S.clubs[id] ? teamLink(S.clubs[id].parent && S.clubs[S.clubs[id].parent] ? S.clubs[S.clubs[id].parent] : S.clubs[id], game) : "?") : "<span class='muted'>agent libre</span>";
  const rows = list.slice(0, 300).map(x => `<tr class="${isMine(x[5]) || isMine(x[6]) ? "me" : ""}"><td style="white-space:nowrap" data-sort="${x[0] * 100 + x[1]}">${weekLabel(x[0], x[1])}</td><td>${gchip(x[2])}</td>
    <td>${S.players[x[4]] ? `<b class="link" data-act="player-info" data-v="${x[4]}">${esc(x[3])}</b>` : esc(x[3])}</td><td>${R(x[8])}</td><td>${nm(x[5], x[2])}</td><td>→ ${x[6] ? nm(x[6], x[2]) : "<span class='muted'>libéré</span>"}</td><td>${x[7] ? money(x[7]) : "<span class='muted'>libre</span>"}</td></tr>`).join("");
  const gameOpts = `<option value="all">Tous les jeux</option>` + Object.entries(GAMES).map(([k, gg]) => `<option value="${k}" ${g === k ? "selected" : ""}>${gg.icon} ${gg.name}</option>`).join("");
  return `<h2>Mercato</h2>${marketTabs()}
    <p class="muted" style="margin-top:-6px">Pendant les fenêtres de mercato, les clubs se renforcent : plus leurs résultats sont mauvais, plus ils changent de joueurs (un club qui gagne touche peu à son équipe). Les plus gros transferts de vos jeux arrivent aussi chaque semaine dans la messagerie.</p>
    <div class="toolbar"><select data-change="m-game" aria-label="Jeu">${gameOpts}</select><span class="muted">${list.length} mouvement(s)</span></div>
    <div class="card table-wrap"><table><tr><th>Date</th><th>Jeu</th><th>Joueur</th><th>Note</th><th>De</th><th>Vers</th><th>Indemnité</th></tr>${rows || `<tr><td colspan="7" class="muted">Aucun mouvement pour l'instant : ils ont lieu pendant les fenêtres de mercato.</td></tr>`}</table></div>`;
}
function marketTabs() {
  const n = allUserPlayers().filter(p => p.listed).length, offers = allUserPlayers().reduce((t, p) => t + ((p.listed && p.offers) || []).length, 0);
  return `<div class="tabs"><button class="tab ${!["list", "moves"].includes(UI.market.tab) ? "active" : ""}" data-act="m-tab" data-v="search">🔎 Recherche de joueurs</button><button class="tab ${UI.market.tab === "list" ? "active" : ""}" data-act="m-tab" data-v="list">📋 Liste des transferts${n ? ` (${n})` : ""}${offers ? ` <span class="pill">${offers}</span>` : ""}</button><button class="tab ${UI.market.tab === "moves" ? "active" : ""}" data-act="m-tab" data-v="moves">📰 Mouvements</button></div>`;
}
ACTIONS["m-tab"] = v => { UI.market.tab = v; render(); };
const sellBtn = p => p.listed ? `<button class="small" data-act="sell" data-v="${p.id}" title="Sur la liste des transferts">📋 En vente${(p.offers || []).length ? ` (${p.offers.length})` : ""}</button>` : `<button class="small" data-act="sell" data-v="${p.id}">Vendre</button>`;
// ce que le club peut payer : indemnité / prime (enveloppe du jeu) et salaire (marge sur la masse salariale du jeu)
// une ligne qui résume l'état du mercato et le budget, avant de déplier le détail
function marketSummary(game) {
  const u = user(), games = game !== "all" ? [game] : Object.keys(u.divisions);
  if (!games.length) return "🔁 État du mercato et budget";
  if (!allocManual()) return `🔁 Mercato : ${games.filter(g => u.divisions[g]).slice(0, 8).map(g => `${GAMES[g].icon} ${mercatoStatus(g).open ? "🟢" : "🔴"}`).join(" ")} · 💰 <b>${money(spendable())}</b> disponibles <span class="muted">(détails)</span>`;
  const parts = games.filter(g => u.divisions[g]).slice(0, 6).map(g => { const st = mercatoStatus(g); return `${GAMES[g].icon} ${st.open ? "🟢" : "🔴"} ${money(spendRoom(g))}`; });
  return `🔁 Mercato et budget : ${parts.join(" · ")}${games.length > 6 ? " …" : ""} <span class="muted">(détails)</span>`;
}
function mercatoMoney(game) {
  const u = user(), games = game !== "all" ? [game] : Object.keys(u.divisions);
  if (!games.length) return "";
  if (!allocManual()) return `<div class="card mm-card"><div class="mm-h"><b>💰 Ce que vous pouvez dépenser</b><button class="small" data-act="alloc">⚙️ Mode automatique</button></div>
    <p style="margin:6px 0"><b class="${spendable() > 0 ? "ok" : "bad"}" style="font-size:18px">${money(spendable())}</b> pour les indemnités, primes et commissions · salaire max d'une recrue : <b>${money(wageRoom(game))}/sem</b></p>
    <p class="muted" style="font-size:12px;margin:0">Budget ${money(u.budget)} moins une réserve de ${money(clubReserve())} (${RESERVE_WEEKS} semaines de salaires du club, ${money(clubWages())}/sem). Une recrue doit pouvoir être payée ${WAGE_WEEKS} semaines avec l'argent restant. Un seul budget pour tous vos jeux.</p></div>`;
  const rows = games.map(g => {
    if (!u.divisions[g]) return `<tr><td>${gchip(g)}</td><td colspan="3" class="muted">Pas de section dans ce jeu : ouvrez une division (onglet Effectifs) pour recruter.</td></tr>`;
    const a = allocOf(g), room = spendRoom(g), wr = wageRoom(g), lim = transferRoom(g) > u.budget;
    return `<tr><td>${gchip(g)}</td><td><b class="${room > 0 ? "ok" : "bad"}">${money(room)}</b><br><small class="muted">enveloppe ${money(Math.max(0, transferRoom(g)))} restante sur ${money(a.transfer)}${lim ? ` · limité par l'argent en caisse (${money(u.budget)})` : ""}</small></td>
      <td><b class="${wr > 0 ? "ok" : "bad"}">${money(Math.max(0, wr))}/sem</b><br><small class="muted">masse salariale ${money(gameWages(g))} sur ${money(a.wages)}/sem</small></td>
      <td><small class="muted">${room > 0 || wr > 0 ? `Une recrue doit tenir dans les deux : son indemnité (ou sa prime) dans la 1re colonne, son salaire dans la 2e.` : "Plus de marge : vendez, ou changez la répartition."}</small></td></tr>`;
  }).join("");
  return `<div class="card mm-card"><div class="mm-h"><b>💰 Ce que vous pouvez dépenser</b><button class="small" data-act="alloc">⚖️ Changer la répartition</button></div>
    <div class="table-wrap"><table class="mm-t"><tr><th>Jeu</th><th>Achat max (indemnité, prime, commission)</th><th>Salaire max à offrir</th><th></th></tr>${rows}</table></div></div>`;
}
const affordTxt = p => { if (!user().divisions[p.game]) return ""; const room = spendRoom(p.game), wr = wageRoom(p.game) + (isMine(p.club) ? p.salary : 0); return `Vous pouvez dépenser jusqu'à <b>${money(room)}</b>${allocManual() ? " en " + GAMES[p.game].short : ""} (indemnité + prime + commission) et offrir jusqu'à <b>${money(Math.max(0, wr))}/sem</b> de salaire.`; };
function viewTransferList() {
  const u = user(), m = UI.market, now = rankNow();
  const mine = allUserPlayers().filter(p => p.listed && (m.game === "all" || p.game === m.game));
  const offerRows = p => (p.offers || []).map(o => `<div class="tl-offer"><span><b>${esc(S.clubs[o.club].name)}</b> propose <b class="ok">${money(o.fee)}</b>${o.final ? " <small class='warn'>(dernière offre)</small>" : ""} <small class="warn">· réponse attendue</small></span>
      <span style="white-space:nowrap"><button class="small primary" data-act="tl-accept" data-v="${p.id}|${o.id}">Accepter</button><button class="small" data-act="tl-counter" data-v="${p.id}|${o.id}">Contre-proposition</button><button class="small danger" data-act="tl-refuse" data-v="${p.id}|${o.id}">Refuser</button></span></div>`).join("");
  const mineRows = mine.map(p => { const lvl = transferInterest(p), st = mercatoStatus(p.game); return `<tr><td>${flag(p.nat)} <b class="link" data-act="player-info" data-v="${p.id}">${esc(p.handle)}</b></td><td>${gchip(p.game)}</td><td>${ageTxt(p)}</td><td>${R(p.rating)}</td><td>${money(playerValue(p))}</td><td><b>${money(p.askPrice || playerValue(p))}</b></td>
      <td data-sort="${now - (p.listedAt ?? now)}">${now - (p.listedAt ?? now)} sem.</td><td data-sort="${lvl}"><span class="tl-int i${lvl}">${INTEREST_LABEL[lvl]}</span>${st.open ? "" : `<br><small class="bad">🔴 mercato fermé</small>`}</td>
      <td style="min-width:320px">${offerRows(p) || `<span class="muted">${st.open ? "Aucune offre pour l'instant" : "Pas d'offre tant que le mercato est fermé"}</span>`}</td>
      <td style="white-space:nowrap"><button class="small" data-act="sell" data-v="${p.id}">Modifier le prix</button><button class="small" data-act="tl-unlist" data-v="${p.id}">Retirer</button></td></tr>`; }).join("");
  const others = Object.values(S.players).filter(p => p.listed && p.club && !isMine(p.club) && !(S.clubs[p.club] && S.clubs[p.club].parent === u.id) && (m.game === "all" || p.game === m.game))
    .sort((a, b) => b.rating - a.rating).slice(0, 200);
  const otherRows = others.map(p => { const c = S.clubs[p.club], keen = interestCheck(p), shut = windowCheck(p); return `<tr><td>${flag(p.nat)} <b class="link" data-act="player-info" data-v="${p.id}">${esc(p.handle)}</b></td><td>${gchip(p.game)}</td><td>${p.role}</td><td>${ageTxt(p)}</td><td>${R(p.rating)}</td><td>${potTxt(p)}</td><td>${teamLink(c, p.game)} <small class="muted">${tshort(p.game, c.divisions[p.game].tier)}</small></td><td>${money(playerValue(p))}</td><td><b>${money(p.askPrice)}</b></td>
      <td>${!u.divisions[p.game] ? `<span class="muted">Pas de section</span>` : shut ? `<button class="small" disabled title="${esc(shut)}">🔴 Mercato fermé</button>` : keen ? `<button class="small primary" data-act="offer" data-v="${p.id}">Faire une offre</button>` : `<button class="small" disabled title="Votre club n'est pas assez connu">🔒 Hors de portée</button>`}</td></tr>`; }).join("");
  const gameOpts = `<option value="all">Tous les jeux</option>` + Object.entries(GAMES).map(([k, g]) => `<option value="${k}" ${m.game === k ? "selected" : ""}>${g.icon} ${g.name}</option>`).join("");
  return `<h2>Mercato</h2>${marketTabs()}
    <div class="toolbar"><select data-change="m-game" aria-label="Jeu">${gameOpts}</select></div>
    ${mercatoBanner(m.game)}${mercatoMoney(m.game)}
    <h3>Mes joueurs à vendre</h3>
    <p class="muted" style="margin-top:-6px;font-size:13px">Mettre un joueur en vente ne garantit pas qu'il partira : les clubs ne font une offre que si le joueur les renforce, s'ils ont le budget et si le prix demandé est raisonnable. Les offres n'arrivent que pendant le mercato du jeu. Pour mettre un joueur en vente : bouton « Vendre » dans l'onglet Effectifs.</p>
    <div class="card table-wrap"><table><tr><th>Joueur</th><th>Jeu</th><th>Âge</th><th>Note</th><th>Valeur</th><th>Prix demandé</th><th>En vente depuis</th><th>Intérêt</th><th>Offres reçues</th><th></th></tr>${mineRows || `<tr><td colspan="10" class="muted">Aucun joueur de votre club n'est sur la liste des transferts.</td></tr>`}</table></div>
    <h3 style="margin-top:20px">Mis en vente par les autres clubs</h3>
    <p class="muted" style="margin-top:-6px;font-size:13px">Ces clubs veulent se séparer de ces joueurs : ils acceptent une offre au prix affiché, souvent moins cher qu'un joueur qu'ils veulent garder.</p>
    <div class="card table-wrap"><table><tr><th>Joueur</th><th>Jeu</th><th>Rôle</th><th>Âge</th><th>Note</th><th>Potentiel</th><th>Club</th><th>Valeur</th><th>Prix</th><th></th></tr>${otherRows || `<tr><td colspan="10" class="muted">Aucun joueur en vente pour l'instant${m.game !== "all" ? " dans ce jeu" : ""}.</td></tr>`}</table></div>`;
}
function sellModal(pid) {
  const p = S.players[pid], val = playerValue(p), price = p.askPrice || val, st = mercatoStatus(p.game);
  modal(`<h2>${p.listed ? "Prix de vente" : "Mettre en vente"} : ${flag(p.nat)} ${esc(p.handle)}</h2>
    <p>${GAMES[p.game].name} · ${p.role} · ${ageTxt(p)} ans · ${R(p.rating)} · valeur estimée <b>${money(val)}</b></p>
    <div class="form-row"><label for="f-ask">Prix demandé (€)</label><input id="f-ask" type="number" step="500" min="0" value="${price}" data-input="sell-preview" data-pid="${pid}"></div>
    <div id="sell-preview" class="card" style="padding:10px 14px"></div>
    <p class="muted" style="font-size:12px">${esc(st.text)}<br>Le joueur part sur la liste des transferts : les clubs intéressés feront des offres (à accepter, refuser ou négocier), mais il est possible que personne ne se manifeste. Un joueur qui n'a pas demandé à partir peut mal le prendre.</p>
    <div class="actions"><button data-act="close-modal">Annuler</button>${p.listed ? `<button data-act="tl-unlist" data-v="${pid}">Retirer de la liste</button>` : ""}<button class="primary" data-act="do-list" data-v="${pid}">${p.listed ? "Mettre à jour le prix" : "📋 Mettre sur la liste des transferts"}</button></div>`);
  sellPreview(pid);
}
function sellPreview(pid) {
  const p = S.players[pid], el = document.getElementById("sell-preview"), inp = document.getElementById("f-ask"); if (!el || !inp) return;
  const keep = p.askPrice; p.askPrice = Math.max(0, +inp.value || 0);
  const lvl = transferInterest(p), n = potentialBuyers(p).length, ratio = p.askPrice / Math.max(1, playerValue(p));
  p.askPrice = keep;
  el.innerHTML = `<b class="tl-int i${lvl}">${INTEREST_LABEL[lvl]}</b> · ${n} club(s) pourraient être intéressés à ce prix (${Math.round(ratio * 100)} % de sa valeur)${ratio > 1.6 ? "<br><span class='bad'>Prix bien trop élevé : aucun club ne fera d'offre.</span>" : ratio > 1.2 ? "<br><span class='warn'>Prix élevé : les offres seront rares.</span>" : ""}`;
}
document.addEventListener("input", e => { if (e.target.dataset && e.target.dataset.input === "sell-preview") sellPreview(e.target.dataset.pid); });
function viewMarket() {
  const u = user(), m = UI.market;
  if (m.tab === "list") return viewTransferList();
  if (m.tab === "moves") return viewMoves();
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
  if (m.minPrice) ps = ps.filter(p => cost(p) >= m.minPrice);
  if (m.maxPrice) ps = ps.filter(p => cost(p) <= m.maxPrice);
  if (m.budgetOnly) ps = ps.filter(p => cost(p) <= spendRoom(p.game) && salaryDemand(p, u) <= wageRoom(p.game));
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
    const where = !c ? "<span class='ok'>Agent libre</span>" : c.solo ? `<span class="warn">Indépendant</span> <small class="muted">${tshort(p.game, d.tier)}</small>` : `${teamLink(c, p.game)} <small class="muted">${tshort(p.game, d.tier)}</small>`;
    const keen = interestCheck(p), shut = !c || c.solo ? null : windowCheck(p);
    const btn = !c ? `<button class="small primary" data-act="sign" data-v="${p.id}">Signer</button>`
      : shut ? `<button class="small" disabled title="${esc(shut)}">🔴 Mercato fermé</button>`
      : `<button class="small" data-act="offer" data-v="${p.id}" ${keen ? "" : "disabled title='Votre club n&#39;est pas assez connu : en ${GAMES[p.game].short}, seuls les joueurs notés jusqu&#39;à ${interestMax(p.game)} acceptent de discuter (notoriété ${Math.round(u.fame)}/100)'"}>${keen ? (c.solo ? "Recruter" : "Offre") + " (~" + money(askingPrice(p)) + ")" : "🔒 Hors de portée"}</button>`;
    return `<tr><td>${flag(p.nat)} <b class="link" data-act="player-info" data-v="${p.id}">${esc(p.handle)}</b></td><td>${gchip(p.game)}</td><td>${p.role}</td><td>${ageTxt(p)}</td><td>${R(p.rating)}</td><td>${potTxt(p)}</td>
      <td>${where}${p.listed ? ` <span class="chip warn" title="Son club veut le vendre : prix ${money(p.askPrice)}">📋 en vente</span>` : ""}</td><td>${money(playerValue(p))}</td><td class="${salaryDemand(p, u) > wageRoom(p.game) ? "bad" : ""}" title="${u.divisions[p.game] ? `Marge salariale ${GAMES[p.game].short} : ${money(Math.max(0, wageRoom(p.game)))}/sem` : "Pas de section dans ce jeu"}">${money(salaryDemand(p, u))}/sem</td><td class="${cost(p) > spendRoom(p.game) ? "bad" : ""}" title="${u.divisions[p.game] ? `Vous pouvez dépenser ${money(spendRoom(p.game))} en ${GAMES[p.game].short}` : "Pas de section dans ce jeu"}">${money(cost(p))}</td><td>${btn}</td></tr>`;
  }).join("");
  const head = [["name", "Joueur"], ["game", "Jeu"], ["role", "Rôle"], ["age", "Âge"], ["rating", "Note"], ["pot", "Potentiel"], ["club", "Statut"], ["value", "Valeur"], ["salary", "Salaire demandé"], ["price", "Coût"]]
    .map(([k, l]) => `<th class="sortable" data-act="m-sort-col" data-v="${k}" title="Trier (cliquer à nouveau pour inverser)">${l}${m.sort === k ? (m.dir === 1 ? " ▼" : " ▲") : ""}</th>`).join("") + "<th></th>";
  const opt = (cur, list) => list.map(([k, l]) => `<option value="${k}" ${String(cur) === String(k) ? "selected" : ""}>${l}</option>`).join("");
  const natOpts = Object.keys(natCount).sort((a, b) => (COUNTRIES[a] || a).localeCompare(COUNTRIES[b] || b)).map(cc => [cc, `${flag(cc)} ${COUNTRIES[cc] || cc} (${natCount[cc]})`]);
  const ages = [0, 16, 18, 20, 22, 24, 26, 28, 30, 99];
  const active = Object.keys(MARKET_DEFAULT).some(k => !["page", "per", "sort", "dir"].includes(k) && m[k] !== MARKET_DEFAULT[k]);
  return `<h2>Mercato</h2>${marketTabs()}
    <div class="toolbar">
      <select id="m-game" data-change="m-game" aria-label="Jeu">${gameOpts}</select>
      <input id="m-q" data-change="m-q" placeholder="Rechercher joueur ou club…" value="${esc(m.q)}" aria-label="Recherche">
      <select id="m-status" data-change="m-status" aria-label="Statut">${[["all", "Tous les statuts"], ["free", "Agents libres"], ["solo", "Pros indépendants"], ["club", "Sous contrat en club"]].map(([k, l]) => `<option value="${k}" ${m.status === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <select id="m-min" data-change="m-min" aria-label="Note minimale">${[0, 60, 70, 75, 80, 85, 90].map(v => `<option value="${v}" ${m.min == v ? "selected" : ""}>${v ? "Note ≥ " + v : "Toutes notes"}</option>`).join("")}</select>
      <select id="m-sort" data-change="m-sort" aria-label="Tri">${[["rating", "Tri : note"], ["pot", "Tri : potentiel"], ["age", "Tri : âge"], ["value", "Tri : valeur"], ["price", "Tri : coût"], ["salary", "Tri : salaire"], ["name", "Tri : nom"], ["nat", "Tri : nationalité"], ["role", "Tri : rôle"], ["club", "Tri : club"]].map(([k, l]) => `<option value="${k}" ${m.sort === k ? "selected" : ""}>${l}</option>`).join("")}</select>
    </div>
    <div class="quick-chips">${[["m-qfree", "🆓 Agents libres", m.status === "free"], ["m-qbudget", "💰 Dans mon budget", m.budgetOnly], ["m-qkeen", "🤝 Intéressés par mon club", m.keenOnly], ["m-qyoung", "🌱 Jeunes talents", m.ageMax == 21 && m.potMin >= 80]].map(([a, l, on]) => `<button class="chip-btn ${on ? "on" : ""}" data-act="${a}">${l}</button>`).join("")}
      ${active ? `<button class="chip-btn" data-act="m-reset">✕ Tout effacer</button>` : ""}<span class="muted" style="font-size:13px">${total} joueur(s)</span></div>
    <details class="fold" ${UI.mMore || [m.region !== "all", m.nat !== "all", m.role !== "all", +m.ageMin, m.ageMax < 99, +m.potMin, m.tier !== "all", m.minPrice, m.maxPrice].some(Boolean) ? "open" : ""} data-fold="mMore"><summary>⚙️ Plus de filtres (région, nationalité, rôle, âge, potentiel, coût…)</summary>
    <div class="toolbar" style="margin-top:8px">
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
      <span class="price-range" title="Coût de l'opération : indemnité de transfert, ou prime de signature pour un agent libre. Exemples : 50000, 50k, 1,5M">Coût <input id="m-minprice" data-change="m-minprice" inputmode="decimal" placeholder="min (ex. 20k)" value="${m.minPrice ? money(m.minPrice) : ""}" aria-label="Coût minimum"> à <input id="m-maxprice" data-change="m-maxprice" inputmode="decimal" placeholder="max (ex. 1,5M)" value="${m.maxPrice ? money(m.maxPrice) : ""}" aria-label="Coût maximum"></span>
      <label class="muted"><input type="checkbox" data-change="m-budget" ${m.budgetOnly ? "checked" : ""}> Dans mon budget</label>
      <label class="muted"><input type="checkbox" data-change="m-keen" ${m.keenOnly ? "checked" : ""}> Intéressés par mon club</label>
    </div></details>
    <details class="fold" ${UI.mInfo ? "open" : ""} data-fold="mInfo"><summary>${marketSummary(m.game)}</summary>
    ${mercatoBanner(m.game)}${mercatoMoney(m.game)}
    <p class="interest-hint">⭐ Notoriété ${Math.round(u.fame)}/100 : ${m.game !== "all" ? `en ${GAMES[m.game].short}, les joueurs notés jusqu'à <b>${interestMax(m.game)}</b> acceptent de discuter avec vous` : `les joueurs notés jusqu'à <b>${Math.min(99, Math.floor(u.fame + 70))}</b> acceptent de discuter avec vous (plus haut dans les jeux où votre équipe est en tier 1 ou 2)`}. Au-delà, ils sont « 🔒 hors de portée ». <span class="link" data-act="explain-fame">En savoir plus</span></p>
    <p class="muted" style="font-size:12px;margin-top:-4px">Agent libre : sans contrat, signature directe. Indépendant : pro sans organisation, il demande une prime. Sous contrat : il faut payer une indemnité de transfert à son club.</p></details>
    ${total ? `<div class="muted" style="font-size:13px;margin:6px 0">${first + 1}–${Math.min(total, first + per)} sur ${total} · page ${m.page + 1}/${pages}</div>` : ""}
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
  // tier découpé en ligues nationales (LFL, Prime League…) : un onglet par ligue
  const subs = subsOf(UI.compGame, UI.compTier, UI.compZone);
  if (subs && !subs.includes(UI.compSub)) UI.compSub = ud && ud.tier === UI.compTier && ud.zone === UI.compZone && ud.sub ? ud.sub : subs[0];
  const L = S.leagues[lkey(UI.compGame, UI.compTier, UI.compZone, subs ? UI.compSub : null)];
  const stabs = subs ? subs.map(x => `<button class="tab small ${UI.compSub === x ? "active" : ""}" data-act="comp-sub" data-v="${x}">${esc(SUB_NAMES[x] || x)}${S.leagues[lkey(UI.compGame, UI.compTier, UI.compZone, x)].teams.some(isMine) ? " ★" : ""}</button>`).join("") : "";
  // choix de la ligue nationale du club (LFL, Prime League…) : tout de suite en D2, sinon pour la prochaine montée
  let subBar = "";
  if (subs && ud && !g.open && ud.zone === UI.compZone) {
    const pref = u.subPref && u.subPref[UI.compGame], nm = esc(SUB_NAMES[UI.compSub] || UI.compSub);
    if (ud.tier === UI.compTier && ud.sub === UI.compSub)
      subBar = `<p class="muted">✅ Votre club joue dans cette ligue.</p>`;
    else if (ud.tier === UI.compTier && pref === UI.compSub)
      subBar = `<p class="muted">🔁 Vous rejoindrez la <b>${nm}</b> à la fin de la saison.</p>`;
    else if (ud.tier === UI.compTier)
      subBar = `<p><button class="small" data-act="sub-change" data-v="${UI.compSub}">🔁 Rejoindre la ${nm}</button> <span class="muted" style="font-size:12px">${canSwitchSub(UI.compGame) ? "Votre saison n'a pas commencé : le changement est immédiat (vous prenez la place du club le plus faible)." : "Saison entamée : le changement se fera à la fin de la saison."}</span></p>`;
    else if (pref === UI.compSub)
      subBar = `<p class="muted">🎯 Ligue visée à votre prochaine montée ou descente en ${TIER_LABEL[UI.compTier - 1]}. <span class="link" data-act="sub-unpref">Annuler</span></p>`;
    else
      subBar = `<p><button class="small" data-act="sub-change" data-v="${UI.compSub}">🎯 Viser la ${nm}</button> <span class="muted" style="font-size:12px">À votre montée (ou descente) en ${TIER_LABEL[UI.compTier - 1]}, votre club ira dans cette ligue.</span></p>`;
  }
  const mineIn = (t, z) => leaguesOf(UI.compGame).some(x => x.tier === t && x.zone === z && x.teams.some(isMine));
  const tabs = Object.keys(GAMES).map(k => `<button class="tab small ${UI.compGame === k ? "active" : ""}" data-act="comp-game" data-v="${k}">${GAMES[k].icon} ${GAMES[k].short}${u.divisions[k] ? " ★" : ""}</button>`).join("");
  const ztabs = zones.length < 2 ? "" : zones.map(z => `<button class="tab small ${UI.compZone === z ? "active" : ""}" data-act="comp-zone" data-v="${z}">${ZONE_NAMES[z]}${leaguesOf(UI.compGame).some(x => x.zone === z && x.teams.some(isMine)) ? " ★" : ""}</button>`).join("");
  const ttabs = g.open ? "" : [1, 2, 3].map(t => `<button class="tab small ${UI.compTier === t ? "active" : ""}" data-act="comp-tier" data-v="${t}">${TIER_LABEL[t - 1]} · ${esc(tierName(UI.compGame, t, UI.compZone))}${mineIn(t, UI.compZone) ? " ★" : ""}</button>`).join("");
  const st = standings(L.key), n = st.length;
  const cut = g.open ? statusCuts(n) : null;
  const zone = i => cut ? (i < 8 ? "<span class='ok' title='Grande finale'>●</span>" : i === cut[0] - 1 ? "<span class='ok' title='Dernière place Élite'>▲</span>" : i === cut[1] - 1 ? "<span class='warn' title='Dernière place Pro'>▲</span>" : "") : i < 2 && UI.compTier > 1 && !isClosed(UI.compGame, UI.compTier - 1, UI.compZone) ? "<span class='ok' title='Montée'>▲</span>" : i >= n - (subs && subs.length > 2 ? 1 : 2) && UI.compTier < 3 && !isClosed(UI.compGame, UI.compTier, UI.compZone) ? "<span class='bad' title='Relégation'>▼</span>" : (br ? i < 8 : i < 4) ? "<span class='ok'>●</span>" : "";
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
  const closed = isClosed(L.game, L.tier, L.zone);
  return `<h2>${g.icon} ${esc(leagueName(L))} <small class="muted">${g.open ? "circuit ouvert" : TIER_LABEL[L.tier - 1]}${L.zone !== "W" ? " · " + ZONE_NAMES[L.zone] : ""}</small>${closed ? ` <span class="chip warn" title="Ni montée ni relégation">🔒 Ligue fermée</span>${L.teams.some(isMine) ? "" : ` <button class="small" data-act="franchise" data-v="${L.game}|${L.zone}">Racheter une place</button>`}` : ""}</h2><div class="tabs">${tabs}</div>${ztabs ? `<div class="tabs">${ztabs}</div>` : ""}<div class="tabs">${ttabs}</div>${stabs ? `<div class="tabs">${stabs}</div>` : ""}${subBar}
    ${RANKED_GAMES.includes(UI.compGame) ? rankCard(UI.compGame) : ""}
    <div class="grid g2">
      <div class="card"><h3>Classement · ${FMT_LABEL[g.fmt]}</h3><div class="table-wrap"><table>${table}</table></div>
        <p class="muted" style="font-size:12px">${cut ? `circuit ouvert : dans cette région, le top ${cut[0]} obtient le statut Élite et le top ${cut[1]} le statut Pro pour la saison suivante (invitations, sponsors) · ` : ""}${!cut && UI.compTier > 1 && !isClosed(UI.compGame, UI.compTier - 1, UI.compZone) ? "▲ montée · " : ""}${!cut && UI.compTier < 3 && !isClosed(UI.compGame, UI.compTier, UI.compZone) ? "▼ relégation · " : ""}${isClosed(UI.compGame, UI.compTier, UI.compZone) ? "🔒 ligue fermée (franchises) · " : ""}cashprize ${money(tierPrize(UI.compGame, UI.compTier))} (40 % au champion)</p></div>
      <div>
        <div class="card"><h3>${br ? "Grande finale" : "Playoffs"}</h3>${po}</div>
        <div class="card" style="margin-top:16px">${br ? "<h3>Dernières journées</h3>" : ""}${side}</div>
      </div>
    </div>`;
}

// classement mondial façon HLTV (CS2)
function rankCard(game) {
  const reg = UI.rankReg || "W", world = rankingOf(game), list = reg === "W" ? world : regionalRanking(game, reg), prev = (S.rankPrev && S.rankPrev[game]) || {};
  const me = list.findIndex(x => isMine(x.id));
  const tabs = [["W", "🌍 Monde"]].concat(Object.entries(RANK_REGIONS).map(([k, v]) => [k, v[0]])).map(([k, l]) => `<button class="tab small ${reg === k ? "active" : ""}" data-act="rank-reg" data-v="${k}">${l}</button>`).join("");
  const mine = user().divisions[game] ? (() => { const r = rankRegionOf(S.userId, game), w = rankPos(game, S.userId), rr = regionalRanking(game, r).findIndex(x => x.id === S.userId) + 1;
    return `<p style="margin:0 0 8px">Votre équipe : <b>${w ? ord(w) : "non classée"}</b> au classement mondial · <b>${rr ? ord(rr) : "non classée"}</b> en ${RANK_REGIONS[r][0]}.</p>`; })() : "";
  const show = list.slice(0, 30).concat(me >= 30 ? [list[me]] : []);
  const rows = show.map(x => { const i = list.indexOf(x), mv = prev[x.id] ? prev[x.id] - (i + 1) : 0, d = divOf(x.id, game);
    const wr = world.indexOf(x) + 1;
    return `<tr class="${isMine(x.id) ? "me" : ""}"><td><b>${i + 1}</b>${reg !== "W" ? ` <small class="muted">(${wr}e)</small>` : ""}</td><td>${mv > 0 ? `<span class="ok">▲${mv}</span>` : mv < 0 ? `<span class="bad">▼${-mv}</span>` : "<span class='muted'>=</span>"}</td><td><span style="color:${S.clubs[x.id].color}">■</span> <b class="link" data-act="club-info" data-v="${x.id}">${displayName(x.id, game)}</b></td><td>${tchip(d.tier)}</td><td style="text-align:right"><b>${x.pts}</b></td></tr>`; }).join("");
  return `<div class="card" style="margin-bottom:16px"><h3>🌍 Classement ${GAMES[game].short} (points façon VRS / HLTV)</h3>
    <p class="muted" style="margin-top:-6px;font-size:13px">Chaque tournoi rapporte des points selon sa dotation et votre place. Chaque match compte aussi, comme un Elo : le vainqueur prend des points au perdant, beaucoup s'il bat une équipe bien mieux classée (battre Vitality rapporte gros), peu si la victoire était attendue ; perdre contre une équipe mal classée coûte cher. Les matchs des grands tournois et des phases finales pèsent plus. Les points comptent pleinement 3 mois, à 75 % jusqu'à 6 mois, à 40 % jusqu'à un an. Comme la VRS de Valve, il existe un classement mondial et un classement par région (Europe, Amériques, Asie-Pacifique). Les invitations aux grands tournois suivent ce classement, et en fin de saison les meilleurs jouent en tier 1, les suivants en tier 2. Une équipe ne joue qu'un tournoi par semaine : choisissez-les dans l'onglet Tournois.</p>
    <div class="tabs">${tabs}</div>${mine}
    <div class="table-wrap" style="max-height:420px;overflow:auto"><table><tr><th>#</th><th></th><th>Équipe</th><th>Tier</th><th style="text-align:right">Points</th></tr>${rows}</table></div></div>`;
}
// rachat d'une franchise (ligue fermée) : places à vendre et prix
function franchiseModal(game, zone) {
  const u = user(), zones = franchiseZones(game), d = u.divisions[game];
  if (!zone || !zones.includes(zone)) zone = d && zones.includes(d.zone) ? d.zone : zones.includes(zoneFrom(game, REGION_OF[u.country] || "EU", u.country)) ? zoneFrom(game, REGION_OF[u.country] || "EU", u.country) : zones[0];
  const L = S.leagues[lkey(game, 1, zone)], inIt = L.teams.some(isMine);
  const slots = franchiseSlots(game, zone);
  const rows = slots.map(x => { const c = S.clubs[x.id];
    return `<tr><td><span style="color:${c.color}">■</span> <b>${displayName(x.id, game)}</b>${c.filler ? " <small class='muted'>(club modeste)</small>" : ""}</td><td>${c.fame.toFixed(0)}/100</td><td style="text-align:right"><b class="${u.budget >= x.price ? "" : "bad"}">${money(x.price)}</b></td>
      <td><button class="small primary" data-act="franchise-buy" data-v="${game}|${zone}|${x.id}" ${inIt || u.budget < x.price || S.franchiseDeal ? "disabled" : ""}>Racheter</button></td></tr>`; }).join("");
  modal(`<h2>🔒 Franchises ${GAMES[game].icon} ${GAMES[game].name}</h2>
    <p class="muted" style="margin-top:-6px">Les ligues fermées n'ont ni montée ni relégation : pour y entrer, il faut racheter la place d'un club. Les grandes organisations ne vendent pas ; le prix dépend de la ligue et du prestige du vendeur. ${leagueSeasonOn() ? "<b>La saison de ligue est en cours : vous jouerez dans la ligue dès la saison prochaine.</b>" : "Le rachat prend effet tout de suite."} Si vous avez déjà une équipe dans ce jeu, elle monte avec ses joueurs et le vendeur prend sa place.</p>
    <div class="tabs">${zones.map(z => `<button class="tab small ${z === zone ? "active" : ""}" data-act="franchise" data-v="${game}|${z}">${esc(tierName(game, 1, z))}</button>`).join("")}</div>
    <p>Budget du club : <b>${money(u.budget)}</b> · prix de base d'une place en ${esc(tierName(game, 1, zone))} : ${money(FRANCHISES[game][1][zone])}${zoneFrom(game, REGION_OF[u.country] || "EU", u.country) !== zone ? ` · <span class="warn">ligue d'une autre région : vos titulaires devront y être inscrits</span>` : ""}</p>
    ${S.franchiseDeal ? `<p class="warn">Rachat déjà conclu : ${esc(tierName(S.franchiseDeal.game, 1, S.franchiseDeal.zone))}, effectif à la fin de la saison.</p>` : ""}
    ${inIt ? "<p class='ok'>Votre club a déjà sa place dans cette ligue.</p>" : `<div class="table-wrap"><table><tr><th>Club vendeur</th><th>Notoriété</th><th style="text-align:right">Prix</th><th></th></tr>${rows || "<tr><td colspan='4' class='muted'>Aucune place à vendre.</td></tr>"}</table></div>`}
    <div class="actions"><button data-act="close-modal">Fermer</button></div>`);
}
ACTIONS["franchise"] = v => { const [g, z] = v.split("|"); franchiseModal(g, z); };
ACTIONS["franchise-buy"] = v => { const [g, z, id] = v.split("|"); const e = buyFranchise(g, z, id); if (e) return toast(e); toast("🔒 Franchise rachetée !"); scheduleSave(); render(); franchiseModal(g, z); };
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
  const pool = tournamentPool(game, tiers, region), sp0 = qualSpec(game, name);
  // EWC : une équipe d'un tier inférieur peut y aller en passant par les qualifications
  if (sp0 && sp0.ewcQual && !pool.some(isMine) && !tournamentField(game, tiers, size, region, name, week, true).some(isMine))
    return { st: "noinv", html: (S.tourOrder || {})[game + "|" + sp0.ewcQual] ? "<span class='warn'>Non qualifié</span>" : `<span class='muted'>Passez par les qualifications</span>` };
  if (!pool.some(isMine) && !(sp0 && sp0.ewcQual)) {
    const anyRegion = tournamentPool(game, tiers, "").some(isMine);
    return { st: "no", html: anyRegion ? `<span class='muted' title='Réservé à : ${REGION_LABEL(region)}'>Autre région</span>` : "<span class='muted'>Non éligible</span>" };
  }
  const past = week < S.week || (week === S.week && weekReport().done[tourKey(game, name)]);
  if (optedOut(game, name)) return { st: "out", html: `<span class="warn">Décliné</span>${past ? "" : ` <button class="small" data-act="tour-toggle" data-v="${esc(game + "|" + name)}">S'inscrire</button>`}` };
  const cands = tourCandidates(game, week, S.userId);
  // un autre tournoi est choisi la même semaine : un seul tournoi à la fois
  if (declined(game, name, week)) {
    if (invitational(tiers) && !cands.some(x => x[0] === name)) return { st: "noinv", html: "<span class='warn'>Hors invitations</span>" };
    return { st: "other", html: `<span class="muted" title="Une équipe ne joue qu'un tournoi par semaine">Autre tournoi choisi</span>${past ? "" : ` <button class="small" data-act="tour-pick" data-v="${esc(game + "|" + week + "|" + name)}">Choisir celui-ci</button>`}` };
  }
  if (invitational(tiers) && !tournamentField(game, tiers, size, region, name, week).some(isMine)) {
    const sp = qualSpec(game, name);
    if (sp) return { st: "noinv", html: (sp.from && !(S.tourOrder || {})[game + "|" + sp.from]) || (sp.worlds && !Object.keys(S.tourOrder || {}).some(k => k.endsWith(" — Grande finale"))) ? "<span class='muted'>Qualification à venir</span>" : "<span class='warn'>Non qualifié</span>" };
    return { st: "noinv", html: "<span class='warn'>Hors invitations</span>" };
  }
  return { st: "in", html: `<span class="ok">${cands.length > 1 ? "✅ Choisi" : invitational(tiers) ? "Invité" : "Inscrit"}</span>${past ? "" : ` <button class="small" data-act="tour-toggle" data-v="${esc(game + "|" + name)}" title="Ne pas participer : pas de frais de déplacement, les joueurs se reposent">Décliner</button>`}` };
}
// ---------- calendrier façon Google Agenda : vues Mois, Semaine et Planning ----------
const MONTH_FULL = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const DAY_SHORT = ["LUN.", "MAR.", "MER.", "JEU.", "VEN.", "SAM.", "DIM."];
// heure habituelle des matchs de chaque jeu (pour la vue Semaine)
const calHour = game => ({ lol: 18, val: 19, cs2: 19, dota: 16, rl: 20, ow: 20, r6: 18, cod: 21, mlbb: 13, hok: 12, cf: 12, fn: 20, apex: 21, pubg: 14, pubgm: 13, ff: 22, wz: 22,
  fc: 19, sf6: 20, tk8: 20, fatal: 21, chess: 17, sc2: 15, tft: 18, trackmania: 20, valgc: 17 })[game] || 14 + zlibHash(game) % 8;
const zlibHash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
// semaine ISO et jour (0 = lundi) d'une date de la saison
function calWeekDay(date) {
  const m0 = weekMonday(S.season, 1), diff = Math.round((date - m0) / 864e5);
  return [Math.floor(diff / 7) + 1, ((diff % 7) + 7) % 7];
}
// événements d'une semaine : { d (jour de début), span (jours), allDay, h (heure), game, title, sub, res, kind, imp }
function calEvents(w) {
  if (w < SEASON_FIRST || w > SEASON_LAST) return [];
  const u = user(), out = [], myGames = Object.keys(u.divisions);
  for (const L of userLeagues()) {
    const e = leagueEntry(L, w); if (!e) continue;
    const po = w === PO_SEMI || w === PO_FINAL;
    out.push({ d: po ? (w === PO_FINAL ? 6 : 5) : LEAGUE_WEEKDAY[L.game] ?? 5, span: 1, h: calHour(L.game), game: L.game, title: (po ? "🔥 " : "") + leagueName(L), sub: e.what, res: e.res, kind: "league", imp: po ? "gold" : "normal" });
  }
  const games = UI.calMode === "all" ? Object.keys(GAMES) : myGames;
  for (const g of games) for (const t of allTournaments(g)) {
    if (t[1] !== w) continue;
    const r = tourStatus(g, t[0], w), state = tourState(g, t), playing = r ? !!r.mine : state.st === "in";
    if (UI.calMode === "mine" && !playing && state.st !== "out") continue;
    const tier = tourTier(t), ewc = /^EWC — (?!Qualif)/.test(t[0]), span = ewc ? 7 : tier === "S" ? 4 : tier === "A" ? 3 : 2;
    out.push({ d: 7 - span, span, allDay: true, game: g, title: t[0], sub: `${t[5] ? REGION_LABEL(t[5]) + " · " : ""}${t[2] ? "Dotation " + money(t[2]) : "Sans dotation"} · ${tier}-Tier`,
      res: r ? (r.mine ? (r.mine === 1 ? "<b class='win'>🏆 Vainqueur</b>" : `<b>${r.mine}e</b> / ${r.n}`) : `🏆 ${displayName(r.top[0], g)}`) : state.html || "", kind: ewc ? "ewc" : "tour", imp: TIER_IMP[tier], playing });
  }
  // fenêtres de mercato (ouverture et fermeture) et grandes dates de la saison
  for (const g of myGames) {
    const R = mercatoRules(g); if (R.always) continue;
    for (const [a, b] of R.w) {
      if (a === w) out.push({ d: 0, span: 1, allDay: true, game: g, title: `🔁 Ouverture du mercato ${GAMES[g].short}`, sub: `Jusqu'au ${dayLabel(S.season, b, 6)}`, kind: "info" });
      if (b === w) out.push({ d: 6, span: 1, allDay: true, game: g, title: `🔒 Fermeture du mercato ${GAMES[g].short}`, sub: "Derniers transferts", kind: "info" });
    }
  }
  if (w === SEASON_LAST) out.push({ d: 6, span: 1, allDay: true, title: "🏁 Fin de la saison", sub: "Bilan, montées et descentes", kind: "info" });
  // deux matchs le même jour ne se chevauchent pas : le second est décalé d'une heure
  const taken = {};
  for (const ev of out.filter(e => !e.allDay).sort((a, b) => a.h - b.h)) { while (taken[ev.d + ":" + ev.h]) ev.h++; ev.h = Math.min(ev.h, 23); taken[ev.d + ":" + ev.h] = 1; }
  return out;
}
const calColor = ev => ev.game && GAMES[ev.game] ? GAMES[ev.game].color : "#7c5cff";
function calChip(ev, w, i, cls = "") {
  const past = w < S.week || (w === S.week && ev.res && /class|<b>/.test(ev.res) && !/data-act/.test(ev.res));
  return `<div class="gc-ev ${ev.allDay ? "all" : "timed"} imp-${ev.imp || "normal"} ${ev.kind} ${past ? "past" : ""} ${cls}" style="--c:${calColor(ev)}" data-act="cal-ev" data-v="${w}|${i}" title="${esc(ev.title.replace(/<[^>]+>/g, ""))}">
    ${ev.allDay ? "" : `<span class="gc-dot"></span><span class="gc-time">${ev.h}h</span>`}<span class="gc-t">${ev.game && GAMES[ev.game] ? GAMES[ev.game].icon + " " : ""}${esc(ev.title.replace(/<[^>]+>/g, ""))}</span></div>`;
}
function viewCalendar() {
  if (!UI.calMode) UI.calMode = "mine";
  if (!UI.calView) UI.calView = "month";
  const now = weekMonday(S.season, S.week);
  if (UI.calMonth == null || UI.calSeason !== S.season) { UI.calMonth = now.getUTCMonth(); UI.calWeek = S.week; UI.calSeason = S.season; }
  const views = [["month", "Mois"], ["week", "Semaine"], ["agenda", "Planning"]].map(([k, l]) => `<button class="gc-vbtn ${UI.calView === k ? "on" : ""}" data-act="cal-view" data-v="${k}">${l}</button>`).join("");
  const filt = `<select data-change="cal-filter" class="gc-sel" aria-label="Événements affichés">${[["mine", "Mes matchs et mes tournois"], ["eligible", "+ tournois de mes jeux"], ["all", "Tous les tournois"]].map(([k, l]) => `<option value="${k}" ${UI.calMode === k ? "selected" : ""}>${l}</option>`).join("")}</select>`;
  let title, body;
  if (UI.calView === "month") {
    const first = new Date(Date.UTC(S.season, UI.calMonth, 1)), start = new Date(first.getTime() - ((first.getUTCDay() + 6) % 7) * 864e5);
    title = `${MONTH_FULL[UI.calMonth]} ${S.season}`;
    const rows = [];
    for (let r = 0; r < 6; r++) {
      const d0 = new Date(start.getTime() + r * 7 * 864e5);
      if (r >= 4 && d0.getUTCMonth() !== UI.calMonth) break;
      const [w] = calWeekDay(d0), evs = calEvents(w);
      const cells = Array.from({ length: 7 }, (_, d) => {
        const dt = new Date(d0.getTime() + d * 864e5), out = dt.getUTCMonth() !== UI.calMonth, today = w === S.week && d === 0;
        return `<div class="gc-cell ${out ? "out" : ""} ${w === S.week ? "cur" : ""}" style="grid-column:${d + 1};grid-row:1 / span 6"></div>
          <div class="gc-num ${today ? "today" : ""}" style="grid-column:${d + 1};grid-row:1">${dt.getUTCDate() === 1 ? dt.getUTCDate() + " " + MONTHS[dt.getUTCMonth()] : dt.getUTCDate()}</div>`;
      }).join("");
      // bandeaux (tournois) puis matchs, 4 lignes au plus ; le reste dans « +N »
      const lanes = [], placed = [], hidden = Array(7).fill(0);
      const order = evs.map((ev, i) => [ev, i]).sort((a, b) => (b[0].allDay - a[0].allDay) || (b[0].span - a[0].span) || (a[0].h || 0) - (b[0].h || 0));
      for (const [ev, i] of order) {
        let lane = 0; while (lanes[lane] && lanes[lane].some(([a, b]) => ev.d < b && a < ev.d + ev.span)) lane++;
        if (lane >= 4) { for (let d = ev.d; d < ev.d + ev.span; d++) hidden[d]++; continue; }
        (lanes[lane] = lanes[lane] || []).push([ev.d, ev.d + ev.span]);
        placed.push(`<div style="grid-column:${ev.d + 1} / span ${ev.span};grid-row:${lane + 2}">${calChip(ev, w, i)}</div>`);
      }
      const more = hidden.map((n, d) => n ? `<div class="gc-more" style="grid-column:${d + 1};grid-row:6" data-act="cal-day" data-v="${w}|${d}" title="${n} autre(s) événement(s)">+${n}</div>` : "").join("");
      rows.push(`<div class="gc-row ${w === S.week ? "cur" : ""}">${cells}${placed.join("")}${more}</div>`);
    }
    body = `<div class="gc-month"><div class="gc-dow">${DAY_SHORT.map(d => `<div>${d}</div>`).join("")}</div>${rows.join("")}</div>`;
  } else if (UI.calView === "week") {
    const w = UI.calWeek, evs = calEvents(w), m = weekMonday(S.season, w);
    title = weekLabel(S.season, w, true);
    const all = evs.map((ev, i) => [ev, i]).filter(([ev]) => ev.allDay), timed = evs.map((ev, i) => [ev, i]).filter(([ev]) => !ev.allDay);
    const H0 = 10, H1 = 24;
    const head = Array.from({ length: 7 }, (_, d) => { const dt = new Date(m.getTime() + d * 864e5); return `<div class="gc-wh ${w === S.week && d === 0 ? "today" : ""}"><span>${DAY_SHORT[d]}</span><b>${dt.getUTCDate()}</b></div>`; }).join("");
    const lanes = []; const allHtml = all.map(([ev, i]) => { let l = 0; while (lanes[l] && lanes[l].some(([a, b]) => ev.d < b && a < ev.d + ev.span)) l++; (lanes[l] = lanes[l] || []).push([ev.d, ev.d + ev.span]);
      return `<div style="grid-column:${ev.d + 2} / span ${ev.span};grid-row:${l + 1}">${calChip(ev, w, i)}</div>`; }).join("");
    const hours = Array.from({ length: H1 - H0 }, (_, k) => `<div class="gc-hour" style="grid-row:${k + 1}">${H0 + k}:00</div>`).join("");
    const lines = Array.from({ length: (H1 - H0) * 7 }, (_, k) => `<div class="gc-slot" style="grid-column:${(k % 7) + 2};grid-row:${Math.floor(k / 7) + 1}"></div>`).join("");
    const tEv = timed.map(([ev, i]) => `<div class="gc-block" style="grid-column:${ev.d + 2};grid-row:${Math.max(1, ev.h - H0 + 1)};--c:${calColor(ev)}" data-act="cal-ev" data-v="${w}|${i}">
      <b>${ev.game ? GAMES[ev.game].icon + " " : ""}${esc(ev.title.replace(/<[^>]+>/g, ""))}</b><small>${ev.h}:00 · ${ev.sub.replace(/<[^>]+>/g, "")}</small></div>`).join("");
    body = `<div class="gc-week"><div class="gc-wrow"><div></div>${head}</div>
      <div class="gc-allday"><div class="gc-hour">Journée</div>${allHtml || ""}</div>
      <div class="gc-grid">${hours}${lines}${tEv}</div></div>`;
  } else {
    title = `Planning ${S.season}`;
    const days = [];
    for (let w = Math.max(SEASON_FIRST, UI.calMode === "all" ? S.week : S.week - 2); w <= SEASON_LAST; w++) {
      const evs = calEvents(w);
      for (let d = 0; d < 7; d++) {
        const list = evs.map((ev, i) => [ev, i]).filter(([ev]) => ev.d === d);
        if (!list.length) continue;
        const dt = new Date(weekMonday(S.season, w).getTime() + d * 864e5);
        days.push(`<div class="gc-ag-day ${w === S.week ? "cur" : ""} ${w < S.week ? "past" : ""}"><div class="gc-ag-date"><b>${dt.getUTCDate()}</b><span>${MONTHS[dt.getUTCMonth()]} · ${DAY_SHORT[d].toLowerCase()}</span></div>
          <div class="gc-ag-list">${list.map(([ev, i]) => `<div class="gc-ag-ev" data-act="cal-ev" data-v="${w}|${i}"><span class="gc-dot" style="--c:${calColor(ev)}"></span><span class="gc-ag-time">${ev.allDay ? (ev.span > 1 ? `${ev.span} jours` : "Journée") : ev.h + ":00"}</span><span class="gc-ag-t"><b>${esc(ev.title.replace(/<[^>]+>/g, ""))}</b> <small class="muted">${ev.sub}</small></span><span class="gc-ag-res">${ev.res || ""}</span></div>`).join("")}</div></div>`);
      }
    }
    body = `<div class="gc-agenda">${days.join("") || "<p class='muted'>Rien de prévu.</p>"}</div>`;
  }
  return `<div class="gc-bar"><h2 style="margin:0">🗓️ Calendrier</h2><button class="gc-today" data-act="cal-today">Aujourd'hui</button>
      ${UI.calView === "agenda" ? "" : `<button class="gc-nav" data-act="cal-step" data-v="-1" aria-label="Précédent">‹</button><button class="gc-nav" data-act="cal-step" data-v="1" aria-label="Suivant">›</button>`}
      <span class="gc-title">${title}</span><span style="flex:1"></span>${filt}<div class="gc-views">${views}</div></div>
    ${body}
    <p class="muted" style="font-size:12px;margin-top:8px">Cliquez sur un événement pour le détail (et pour décliner un tournoi). Les tournois s'étalent sur leurs jours de compétition, les matchs de ligue sont à leur jour et heure habituels.</p>`;
}
function calEventModal(w, i) {
  const ev = calEvents(w)[i]; if (!ev) return;
  modal(`<div class="gc-pop" style="--c:${calColor(ev)}"><div class="gc-pop-h"><span class="gc-sq"></span><div><h2 style="margin:0">${ev.game && GAMES[ev.game] ? GAMES[ev.game].icon + " " : ""}${esc(ev.title.replace(/<[^>]+>/g, ""))}</h2>
    <div class="muted">${ev.allDay ? (ev.span > 1 ? `${dayLabel(S.season, w, ev.d)} – ${dayLabel(S.season, w, ev.d + ev.span - 1)}` : dayLabel(S.season, w, ev.d)) : `${dayLabel(S.season, w, ev.d)} · ${ev.h}:00`}</div></div></div>
    <p>${ev.sub}</p>${ev.res ? `<p>${ev.res}</p>` : ""}${ev.imp === "gold" ? `<p><span class="imp-chip imp-gold">Match capital</span></p>` : ""}
    <div class="actions">${ev.kind === "tour" || ev.kind === "ewc" ? `<button data-act="view" data-v="${ev.kind === "ewc" ? "ewc" : "tours"}">Voir ${ev.kind === "ewc" ? "l'EWC" : "les tournois"}</button>` : ""}<button class="primary" data-act="close-modal">Fermer</button></div></div>`);
}
ACTIONS["tour-toggle"] = v => {
  const k = v; S.tourChoice = S.tourChoice || {};
  if (S.tourChoice[k] === "out") { delete S.tourChoice[k]; const [g, n] = k.split("|"); setTourPick(g, tourWeek(g, n), n); } else S.tourChoice[k] = "out";
  // un tournoi de la semaine en cours : son plateau est retiré
  const rep = weekReport(); delete rep.fields["T:" + k];
  toast(S.tourChoice[k] === "out" ? "Tournoi décliné : pas de déplacement, vos joueurs se reposeront." : "Inscription confirmée.");
  scheduleSave(); render();
};

ACTIONS["tour-pick"] = v => {
  const [g, w, ...n] = v.split("|"), name = n.join("|");
  setTourPick(g, +w, name); toast(`${GAMES[g].short} : vous jouerez « ${name} » cette semaine-là.`); scheduleSave(); render();
};
// choix des tournois : les semaines à venir où le club est retenu dans plusieurs tournois d'un même jeu
function tourPickCard(games) {
  const u = user(), blocks = [];
  for (const g of games) {
    if (!u.divisions[g]) continue;
    const ranked = RANKED_GAMES.includes(g);
    for (let w = S.week; w <= SEASON_LAST && blocks.length < 8; w++) {
      if (w === S.week && allTournaments(g).some(t => t[1] === w && weekReport().done[tourKey(g, t[0])])) continue;
      const c = tourCandidates(g, w, u.id); if (c.length < 2) continue;
      const pick = pickedTour(g, w, u.id);
      const rows = c.sort((a, b) => tourValue(b) - tourValue(a)).map(t => {
        const f = tournamentField(g, t[3], t[4], t[5], t[0], w, true), str = f.map(id => teamStrength(id, g).str).sort((a, b) => b - a);
        const top = str.slice(0, 8), avg = top.length ? Math.round(top.reduce((a, b) => a + b, 0) / top.length) : 0;
        const pts = rankPointsFor(t[2]);
        return `<tr class="${t[0] === pick ? "me" : ""}"><td><b>${esc(t[0])}</b>${t[5] ? ` <small class="muted">${REGION_LABEL(t[5])}</small>` : ""}</td><td>${t[2] ? money(t[2]) : "—"}</td><td>${accessLabel(t[3])}</td>
          <td>${f.length} ${GAMES[g].fmt === "br" ? GAMES[g].unit + "s" : "équipes"} · niveau ${R(avg)}</td>
          ${ranked ? `<td title="Vainqueur / finaliste / demi-finaliste / quart">${pts.win} / ${pts.final} / ${pts.top4} / ${pts.top8}</td>` : ""}
          <td>${t[0] === pick ? "<b class='ok'>✅ Choisi</b>" : `<button class="small" data-act="tour-pick" data-v="${esc(g + "|" + w + "|" + t[0])}">Choisir</button>`}</td></tr>`;
      }).join("");
      blocks.push(`<h4 style="margin:12px 0 6px">${GAMES[g].icon} ${GAMES[g].short} · ${weekLabel(S.season, w)}${w === S.week ? " <span class='chip now'>Cette semaine</span>" : ""}</h4>
        <div class="table-wrap"><table><tr><th>Tournoi</th><th>Dotation</th><th>Accès</th><th>Plateau (top 8)</th>${ranked ? "<th>Points de classement (1er / 2e / top 4 / top 8)</th>" : ""}<th></th></tr>${rows}</table></div>`);
    }
  }
  if (!blocks.length) return "";
  const rk = games.filter(g => RANKED_GAMES.includes(g) && u.divisions[g]).map(g => { const reg = rankRegionOf(u.id, g), w = rankPos(g, u.id), r = regionalRanking(g, reg).findIndex(x => x.id === u.id) + 1;
    return `${GAMES[g].icon} ${GAMES[g].short} : <b>${w ? ord(w) : "non classé"}</b> mondial · <b>${r ? ord(r) : "non classé"}</b> ${RANK_REGIONS[reg][0]}`; }).join(" — ");
  return `<div class="card" style="margin-bottom:16px"><h3>🎯 Choix des tournois</h3>
    <p class="muted" style="margin-top:-6px;font-size:13px">Une équipe ne peut jouer qu'un tournoi par semaine. Ces semaines-là, votre équipe est retenue dans plusieurs tournois : choisissez celui que vous jouez (par défaut, le plus important). Un grand tournoi rapporte plus d'argent et de points de classement, mais le plateau est plus relevé ; un plus petit tournoi offre de meilleures chances d'aller loin.${rk ? `<br>Vos classements : ${rk}.` : ""}</p>${blocks.join("")}</div>`;
}

// ---------- tournois ----------
const accessLabel = t => ({ "1": "Invitation (les meilleurs)", "12": "Tiers 1 et 2", "2": "Tier 2", "23": "Open (tiers 2-3)", "3": "Open (tier 3)", "123": "Meilleurs de la région", "1230": "Open régional (tous tiers)" }[t] || t);
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
function ewcCard(full) {
  const u = user(), done = S.ewcResult && S.ewcResult.season === S.season;
  const list = done ? S.ewcResult.ranking : ewcStandings();
  const total = EWC_CLUB_PRIZES.reduce((a, b) => a + b, 0);
  const rows = list.slice(0, full ? 30 : 12).map((x, i) => `<tr class="${x.id === u.id ? "me" : ""}"><td>${i + 1}</td><td>${displayName(x.id)}</td><td><b>${x.pts.toLocaleString("fr-FR")}</b></td><td>${x.wins ? "🥇 " + x.wins : "—"}</td><td>${x.second ? "🥈 " + x.second : "—"}</td><td>${x.third ? "🥉 " + x.third : "—"}</td><td>${x.top8}</td><td>${done ? money(x.prize || 0) : x.ok ? `<span class='ok'>Éligible</span>` : "<span class='muted'>1 seul top 8</span>"}</td>${done ? "" : `<td>${x.ok && EWC_CLUB_PRIZES[i] ? `<b class="ok">${money(EWC_CLUB_PRIZES[i])}</b>` : "—"}</td>`}</tr>`).join("");
  const me = list.findIndex(x => x.id === u.id);
  const head = `<tr><th>#</th><th>Club</th><th>Pts</th><th>Titres</th><th>2e</th><th>3e</th><th>Top 8</th><th>${done ? "Dotation" : "Statut"}</th>${done ? "" : "<th>Cashprize visé</th>"}</tr>`;
  const past = (S.ewcHistory || []).filter(h => h.season !== S.season || !done).slice().reverse();
  const pastHtml = past.map(h => `<details class="fold"><summary>🏟️ EWC ${h.season} — champion : <b>${esc(h.top[0] ? h.top[0][1] : "?")}</b></summary><div class="table-wrap"><table><tr><th>#</th><th>Club</th><th>Pts</th><th>Titres</th><th>2e</th><th>3e</th><th>Dotation</th></tr>
    ${h.top.map((x, i) => `<tr class="${x[0] === u.id ? "me" : ""}"><td>${i + 1}</td><td>${esc(x[1])}</td><td>${x[2].toLocaleString("fr-FR")}</td><td>${x[3]}</td><td>${x[4]}</td><td>${x[5]}</td><td>${money(x[6])}</td></tr>`).join("")}</table></div></details>`).join("");
  const R = typeof EWC_REAL !== "undefined" ? EWC_REAL : null;
  const realHtml = R ? `<details class="fold"><summary>📜 Référence : l'EWC ${R.season} réel (Paris) — classement des structures et podiums</summary>
    <div class="table-wrap"><table><tr><th>#</th><th>Club</th><th>Pts</th><th>Titres</th><th>2e</th><th>3e</th><th>Dotation</th></tr>${R.clubs.map((x, i) => `<tr><td>${i + 1}</td><td><b>${esc(x[0])}</b></td><td>${x[1].toLocaleString("fr-FR")}</td><td>${x[2]}</td><td>${x[3]}</td><td>${x[4]}</td><td>${money(x[5])}</td></tr>`).join("")}</table></div>
    <div class="table-wrap"><table><tr><th>Jeu</th><th>Dotation</th><th>🥇</th><th>🥈</th><th>🥉</th></tr>${Object.entries(R.games).sort((a, b) => b[1][0] - a[1][0]).map(([g, [pool, n, pod]]) => `<tr><td>${gchip(g)} <small class="muted">${n} ${GAMES[g].fmt === "duel" ? "joueurs" : "clubs"}</small></td><td>${money(pool)}</td>${pod.map(([t, p]) => `<td>${esc(t)} <small class="muted">${money(p)}</small></td>`).join("")}</tr>`).join("")}</table></div></details>` : "";
  return `<div class="card" style="margin-bottom:16px"><h3>🌍 EWC Club Championship ${S.season} ${done ? "— terminé" : `— du ${weekLabel(S.season, EWC_FIRST)} au ${weekLabel(S.season, EWC_LAST_WEEK)}`}</h3>
    <p class="muted" style="margin-top:-6px;font-size:13px">L'Esports World Cup regroupe un tournoi par jeu, avec les dotations de l'édition réelle (2 M€ en LoL, 3 M€ en MLBB, HoK et PUBG Mobile…). Chaque top 8 rapporte des points au club : 1 000 pour un titre, 750 pour une finale, 500 pour un podium. Pour être classé, il faut un top 8 dans au moins 2 jeux ; ${EWC_CLUB_PRIZES.length} clubs se partagent ${money(total)} (7 M€ pour le champion, 5 M€ pour le 2e, 4 M€ pour le 3e).</p>
    ${rows ? `<div class="table-wrap"><table>${head}${rows}</table></div>${me >= (full ? 30 : 12) ? `<p>Vous : ${me + 1}e (${list[me].pts} pts)</p>` : ""}` : "<p class='muted'>Aucun point attribué pour l'instant.</p>"}
    ${pastHtml}${realHtml}</div>`;
}
// bandeau EWC (tournois, tableau de bord) : renvoie vers l'onglet EWC
function ewcBanner() {
  const u = user(), st = ewcStandings(), me = st.findIndex(x => x.id === u.id), done = S.ewcResult && S.ewcResult.season === S.season;
  const live = S.week >= EWC_FIRST - 4 && S.week <= EWC_LAST_WEEK + 1;
  return `<div class="card ewc-banner" data-act="view" data-v="ewc"><div><b>🌍 Esports World Cup ${S.season}</b> · du ${weekLabel(S.season, EWC_FIRST)} au ${weekLabel(S.season, EWC_LAST_WEEK, true)}
    <div class="muted" style="font-size:13px">${done ? `Terminé · champion des clubs : <b>${esc(S.clubs[S.ewcResult.ranking[0].id].name)}</b>${S.ewcResult.ranking.findIndex(x => x.id === u.id) >= 0 ? ` · vous : ${S.ewcResult.ranking.findIndex(x => x.id === u.id) + 1}e` : ""}` : me >= 0 ? `Club Championship : vous êtes <b>${me + 1}e</b> (${st[me].pts} pts)` : live ? "C'est le moment : un tournoi par jeu, 30 M$ pour les clubs" : "Classement des clubs, cashprize de chaque jeu, palmarès"}</div></div>
    <button class="small primary">Classement & cashprize →</button></div>`;
}
function viewEwc() {
  const u = user(), games = Object.keys(GAMES).filter(g => allTournaments(g).some(t => /^EWC — (?!Qualif)/.test(t[0])));
  const rows = games.map(g => [g, allTournaments(g).find(t => /^EWC — (?!Qualif)/.test(t[0]))]).sort((a, b) => a[1][1] - b[1][1] || b[1][2] - a[1][2]).map(([g, t]) => {
    const sh = ewcShare(g, t[4]), r = tourStatus(g, t[0], t[1]), st = tourState(g, t), mine = !!u.divisions[g];
    return `<tr class="${r && r.mine === 1 ? "me" : ""} ${mine ? "" : "muted"}"><td style="white-space:nowrap">${weekLabel(S.season, t[1])}</td><td>${gchip(g)}</td><td><b>${money(t[2])}</b></td>
      <td>🥇 ${money(t[2] * sh[0])}</td><td>🥈 ${money(t[2] * sh[1])}</td><td>🥉 ${money(t[2] * sh[2])}</td>
      <td>${r ? `🏆 ${displayName(r.top[0], g)}` : mine ? st.html || "—" : "<small>pas de section</small>"}</td><td>${r && r.mine ? `<b>${r.mine}e</b>${r.won ? ` · <span class="ok">${money(r.won)}</span>` : ""}${r.mine <= 8 ? ` · <b>+${EWC_POINTS[r.mine - 1]} pts</b>` : ""}` : "—"}</td></tr>`;
  }).join("");
  const pools = games.reduce((a, g) => a + allTournaments(g).find(t => /^EWC — (?!Qualif)/.test(t[0]))[2], 0), club = EWC_CLUB_PRIZES.reduce((a, b) => a + b, 0);
  return `<h2>🌍 Esports World Cup ${S.season}</h2>
    <div class="tr-stats">
      <div class="tr-stat gold"><b>${money(pools + club)}</b><span>dotation totale</span></div>
      <div class="tr-stat"><b>${games.length}</b><span>tournois (un par jeu)</span></div>
      <div class="tr-stat"><b>${money(club)}</b><span>Club Championship</span></div>
      <div class="tr-stat gold"><b>${money(EWC_CLUB_PRIZES[0])}</b><span>pour le champion des clubs</span></div></div>
    ${ewcCard(true)}
    <div class="card"><h3>🎮 Les tournois et leurs cashprize</h3>
      <p class="muted" style="margin-top:-6px;font-size:13px">Dotations et répartition de l'édition réelle. Points du Club Championship : ${EWC_POINTS.map((p, i) => `${i + 1}e ${p}`).join(" · ")}. Vos gains sont partagés avec les joueurs selon leurs contrats.</p>
      <div class="table-wrap"><table><tr><th>Dates</th><th>Jeu</th><th>Dotation</th><th>1er</th><th>2e</th><th>3e</th><th>Vainqueur / accès</th><th>Vous</th></tr>${rows}</table></div></div>`;
}
// qualifié ou éliminé pour l'étape suivante (qualifs FNCS, course aux Worlds, qualifs EWC)
function qualBadge(q, short) {
  if (!q) return "";
  if (q.invited) return `<b class="ok">🎟️ Déjà invité${short ? "" : " : " + esc(q.next)}</b>`;
  if (q.worlds) return q.ok ? `<b class="ok">✅ ${short ? "Worlds" : `Qualifié provisoirement pour le ${esc(q.next)}`} (${q.rank}e/${q.top} places)</b>` : `<b class="bad">❌ ${short ? "Hors Worlds" : `Hors des places pour le ${esc(q.next)}`} (${q.rank ? q.rank + "e, " : ""}top ${q.top} requis)</b>`;
  return q.ok ? `<b class="ok">✅ Qualifié${short ? "" : " pour " + esc(q.next)}</b>` : `<b class="bad">❌ Éliminé${short ? "" : ` (il fallait le top ${q.top}${q.ewc ? " hors invités" : ""})`}</b>`;
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
  const rows = games.flatMap(g => allTournaments(g).map(t => [g, t])).filter(([g, t]) => UI.tourSize === "all" || (["S", "A", "B", "C"].includes(UI.tourSize) ? tourTier(t) === UI.tourSize : (UI.tourSize === "big") === !(S.smallTours || []).some(x => x[5] === g && x[0] === t[0] && x[1] === t[1])))
    .sort((a, b) => a[1][1] - b[1][1] || b[1][2] - a[1][2]).map(([g, t]) => {
    const [name, week, prize, tiers, size, region] = t;
    const r = tourStatus(g, name, week);
    const status = r ? `🏆 ${displayName(r.top[0], g)}${r.mine ? ` · <b>vous : ${r.mine}e</b>` : ""}${r.qual ? " · " + qualBadge(r.qual, true) : ""}` : week < S.week ? "<span class='muted'>Annulé</span>" : week === S.week ? "<b class='warn'>Cette semaine</b>" : "À venir";
    const st = tourState(g, t);
    return `<tr class="${r && r.mine === 1 ? "me" : ""}"><td style="white-space:nowrap" data-sort="${week}">${weekLabel(S.season, week)}</td><td>${gchip(g)}</td><td data-sort="${"SABC".indexOf(tourTier(t))}"><span class="imp-chip imp-${TIER_IMP[tourTier(t)]}">${tourTier(t)}</span></td><td><b>${esc(name)}</b>${region ? ` <small class="muted">${REGION_LABEL(region)}</small>` : ""}</td><td>${prize ? money(prize) : "<span class='muted' title='Pas de cashprize : qualification et prestige'>—</span>"}</td><td>${accessLabel(tiers)}</td><td>${r ? r.n : tournamentField(g, tiers, size, region || "", name).length}${GAMES[g].fmt === "br" ? " " + GAMES[g].unit + "s" : ""}</td><td style="white-space:nowrap">${st.html || "<span class='muted'>—</span>"}</td><td>${status}</td></tr>`;
  }).join("");
  if (!UI.tourSize) UI.tourSize = "all";
  const stabs = [["all", "Tous les tournois"], ["S", "S-Tier"], ["A", "A-Tier"], ["B", "B-Tier"], ["C", "C-Tier"], ["big", "Grands tournois"], ["small", "Petits tournois & cash cups"]].map(([k, l]) => `<button class="tab small ${UI.tourSize === k ? "active" : ""}" data-act="tour-size" data-v="${k}">${l}</button>`).join("");
  return `<h2>📅 Tournois de la saison ${S.season}</h2>${tourPickCard(games)}${ewcBanner()}
    <p class="muted" style="margin-top:-6px">En plus des ligues, les tournois à cashprize, à leurs vraies dates. Les tournois sur invitation prennent les meilleures équipes ; les opens accueillent tous les clubs des tiers admis. Vous pouvez décliner un tournoi (pas de déplacement à payer, vos joueurs se reposent). Les gains sont partagés avec les joueurs selon leurs contrats.</p>
    <div class="tabs">${tabs}</div><div class="tabs">${stabs}</div>
    <div class="card table-wrap"><table><tr><th>Dates</th><th>Jeu</th><th title="Niveau du tournoi façon Liquipedia : S (les plus grands), A, B, C (cash cups)">Niveau</th><th>Tournoi</th><th>Dotation</th><th>Accès</th><th>Places</th><th>Vous</th><th>Résultat</th></tr>${rows}</table></div>`;
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
      ${allocManual() ? `<td style="text-align:right">${money(a.transfer)}</td><td style="text-align:right" class="${room < 0 ? "bad" : ""}">${money(room)}</td><td style="text-align:right" class="${wages > a.wages ? "bad" : ""}">${money(wages)} / ${money(a.wages)}</td>` : `<td style="text-align:right">${money(wages)}/sem</td>`}</tr>`;
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
  const ledRows = led.filter(e => UI.finGame === "all" || e[4] === UI.finGame).slice(-60).reverse().map(([sn, w, cat, amt, g, label]) => `<tr><td style="white-space:nowrap" data-sort="${sn * 100 + w}">${weekLabel(sn, w)}</td><td>${g ? gchip(g) : "<span class='muted'>Club</span>"}</td><td>${BOOK_LABELS[cat] || cat}</td><td>${esc(label)}</td><td style="text-align:right" class="${amt >= 0 ? "ok" : "bad"}">${amt >= 0 ? "+" : ""}${money(amt)}</td></tr>`).join("");
  return `<h2>Finances — saison ${season}</h2><div class="grid g3">
    <div class="card"><h3>Budget</h3><div class="kpi ${u.budget < 0 ? "bad" : ""}">${money(u.budget)}</div><div class="muted">Résultat de la saison : <b class="${tot(inc) + tot(exp) >= 0 ? "ok" : "bad"}">${money(tot(inc) + tot(exp))}</b></div></div>
    <div class="card"><h3>Masse salariale</h3><div class="kpi">${money(ps.reduce((s, p) => s + p.salary, 0))}<span class="muted" style="font-size:14px">/sem</span></div><div class="muted">${money(ps.reduce((s, p) => s + p.salary, 0) * SEASON_WEEKS)} sur la saison · valeur de l'effectif ${money(ps.reduce((s, p) => s + playerValue(p), 0))}</div></div>
    <div class="card"><h3>Image & fans</h3><div class="kpi">${imageTxt(u.image ?? 60)} <span class="muted" style="font-size:14px">${Math.round(u.image ?? 60)}/100</span></div>${bar(u.image ?? 60)}<div class="muted">${u.fans.toLocaleString("fr-FR")} fans${fans0 ? ` · <b class="${u.fans >= fans0 ? "ok" : "bad"}">${u.fans >= fans0 ? "+" : ""}${(u.fans - fans0).toLocaleString("fr-FR")}</b> cette saison` : ""}</div></div>
  </div>
  <div class="card" style="margin-top:16px"><h3>Évolution du budget</h3>${chart}</div>
  ${forecastCard()}
  ${financeCharts(season, inc, exp)}
  <div class="card" style="margin-top:16px"><div class="toolbar"><h3 style="margin:0;flex:1">${allocManual() ? "Budget par section" : "Résultat par section"}</h3><button class="small ${allocManual() ? "primary" : ""}" data-act="alloc">${allocManual() ? "⚖️ Répartir le budget mercato" : "⚙️ Argent du mercato : automatique"}</button></div>
    <p class="muted" style="margin-top:-4px;font-size:13px">${allocManual() ? "Mode manuel : chaque section dispose d'une enveloppe mercato (indemnités, primes à la signature, commissions d'agents ; les ventes la renflouent) et d'un plafond de masse salariale. Les signatures qui les dépassent sont refusées." : `Mode automatique : un seul budget pour tout le club. Disponible pour le mercato : <b>${money(spendable())}</b> (budget moins ${RESERVE_WEEKS} semaines de salaires en réserve). Ce que chaque jeu rapporte et coûte cette saison :`}</p>
    <div class="table-wrap"><table><tr><th>Jeu</th><th style="text-align:right">Recettes</th><th style="text-align:right">Dépenses</th><th style="text-align:right">Résultat</th>${allocManual() ? `<th style="text-align:right">Enveloppe mercato</th><th style="text-align:right">Reste</th><th style="text-align:right">Salaires / plafond (sem.)</th>` : `<th style="text-align:right">Salaires</th>`}</tr>${gameRows || "<tr><td colspan='7' class='muted'>Aucune section.</td></tr>"}</table></div></div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>Recettes de la saison <span class="ok">${money(tot(inc))}</span></h3><table>${catRows(inc)}</table></div>
    <div class="card"><h3>Dépenses de la saison <span class="bad">${money(tot(exp))}</span></h3><table>${catRows(exp)}</table></div>
  </div>
  <div class="card" style="margin-top:16px"><div class="toolbar"><h3 style="margin:0;flex:1">Contrats de sponsoring</h3><button class="small primary" data-act="view" data-v="sponsors">🤝 Gérer les sponsors</button></div>
    ${deals ? `<div class="table-wrap"><table>${deals}</table></div>` : "<p class='muted'>Aucun contrat. Voyez les marques intéressées et démarchez-en dans l'onglet Sponsors.</p>"}</div>
  <div class="card" style="margin-top:16px"><div class="toolbar"><h3 style="margin:0;flex:1">Grand livre</h3>${gameSel}</div>
    <div class="table-wrap"><table><tr><th>Semaine</th><th>Section</th><th>Catégorie</th><th>Détail</th><th style="text-align:right">Montant</th></tr>${ledRows || "<tr><td colspan='5' class='muted'>Aucune opération.</td></tr>"}</table></div>
    ${led.length > 60 ? `<p class="muted" style="font-size:12px">Les 60 dernières opérations sont affichées.</p>` : ""}</div>`;
}
// prévisionnel : où en sera le budget à la mi-décembre si rien ne change (revenus et charges récurrents, contrats de sponsors qui se terminent)
function forecast() {
  const u = user(), rem = Math.max(0, SEASON_LAST - S.week + 1), fac = u.facilities;
  const base = 300 + 3.6 * u.fame * u.fame + Object.values(u.divisions).reduce((s, d) => s + TIER_SPONSOR[d.tier - 1], 0) * (0.5 + u.fame / 100);
  const deals = u.sponsorDeals.reduce((s, d) => s + d.weekly * Math.min(d.weeks, rem), 0);
  const merch = u.fans * (0.012 + fac.content * 0.003);
  const games = Object.keys(u.divisions);
  const sal = games.reduce((s, g) => s + gameWages(g), 0), ops = games.reduce((s, g) => s + TIER_OP[u.divisions[g].tier - 1] * GAMES[g].size * GAMES[g].mult + (academyOf(g) ? TIER_OP[academyOf(g).divisions[g].tier - 1] * GAMES[g].size * GAMES[g].mult * 0.7 : 0), 0);
  const coaches = games.reduce((s, g) => s + (coachOf(g) ? coachOf(g).wage : 0), 0), upkeep = Object.values(fac).reduce((s, l) => s + l * 800, 0);
  const bonusPot = u.sponsorDeals.reduce((s, d) => s + (d.clauses || []).filter(c => c.status === "pending").reduce((a, c) => a + c.bonus, 0), 0);
  const lines = [["Partenaires historiques et droits", base * rem], ["Contrats de sponsoring en cours", deals], ["Merch & streaming", merch * rem],
    ["Salaires", -sal * rem], ["Frais de fonctionnement et académies", -ops * rem], ["Entraîneurs", -coaches * rem], ["Entretien des infrastructures", -upkeep * rem]];
  const net = lines.reduce((s, [, v]) => s + v, 0);
  return { rem, lines, net, end: u.budget + net, bonusPot, weekly: net / Math.max(1, rem) };
}
function forecastCard() {
  const f = forecast(), u = user();
  return `<div class="card" style="margin-top:16px"><h3>📊 Prévisionnel jusqu'à la fin de la saison (${f.rem} semaines)</h3>
    <div class="grid g3" style="margin-bottom:10px">
      <div><span class="muted">Budget prévu mi-décembre</span><div class="kpi ${f.end < 0 ? "bad" : ""}">${money(f.end)}</div></div>
      <div><span class="muted">Solde récurrent par semaine</span><div class="kpi ${f.weekly < 0 ? "bad" : "ok"}">${f.weekly >= 0 ? "+" : ""}${money(f.weekly)}</div></div>
      <div><span class="muted">Primes de sponsors en jeu</span><div class="kpi">${money(f.bonusPot)}</div><small class="muted">si les objectifs sont atteints</small></div>
    </div>
    ${hbars(f.lines.map(([l, v]) => [l, v]))}
    <p class="muted" style="font-size:12px;margin-bottom:0">Hors cashprizes, transferts et événements, impossibles à prévoir.${f.end < 0 ? ` <b class="bad">Attention : sous ${money(-Math.max(100000, u.fame * 8000))}, un administrateur judiciaire prend le contrôle (ventes forcées, puis faillite).</b>` : ""}</p></div>`;
}
// barres horizontales (montants positifs en vert, négatifs en rouge)
function hbars(rows) {
  const max = Math.max(1, ...rows.map(([, v]) => Math.abs(v)));
  return `<div class="hbars">${rows.map(([l, v]) => `<div class="hb"><span class="hb-l">${l}</span><span class="hb-t"><i class="${v >= 0 ? "pos" : "neg"}" style="width:${Math.max(1, Math.abs(v) / max * 100).toFixed(1)}%"></i></span><span class="hb-v ${v >= 0 ? "ok" : "bad"}">${v >= 0 ? "+" : ""}${money(v)}</span></div>`).join("")}</div>`;
}
// graphiques de la saison : recettes et dépenses semaine par semaine, répartition par catégorie, résultat par jeu
function financeCharts(season, inc, exp) {
  const F = S.finance.filter(f => f.season === season);
  let weeks = "<p class='muted'>Jouez quelques semaines pour voir le graphique.</p>";
  if (F.length >= 2) {
    const W = 600, H = 160, max = Math.max(1, ...F.flatMap(f => [f.inc, f.exp])), bw = (W - 20) / F.length;
    const bars = F.map((f, i) => `<rect x="${(10 + i * bw).toFixed(1)}" y="${(H - 14 - f.inc / max * (H - 24)).toFixed(1)}" width="${(bw * 0.42).toFixed(1)}" height="${(f.inc / max * (H - 24)).toFixed(1)}" fill="var(--ok)"><title>${f.label} : +${money(f.inc)}</title></rect>
      <rect x="${(10 + i * bw + bw * 0.45).toFixed(1)}" y="${(H - 14 - f.exp / max * (H - 24)).toFixed(1)}" width="${(bw * 0.42).toFixed(1)}" height="${(f.exp / max * (H - 24)).toFixed(1)}" fill="var(--bad)"><title>${f.label} : -${money(f.exp)}</title></rect>`).join("");
    weeks = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Recettes et dépenses par semaine">${bars}</svg>
      <div class="muted" style="display:flex;justify-content:space-between;font-size:12px"><span>${F[0].label}</span><span><span class="ok">■</span> recettes · <span class="bad">■</span> dépenses · max ${money(max)}</span><span>${F[F.length - 1].label}</span></div>`;
  }
  const led = (S.ledger || []).filter(e => e[0] === season), byGame = {};
  for (const [, , , amt, g] of led) if (g) byGame[g] = (byGame[g] || 0) + amt;
  return `<div class="card" style="margin-top:16px"><h3>Recettes et dépenses par semaine</h3>${weeks}</div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><h3>D'où vient l'argent</h3>${inc.length ? hbars(inc.map(([k, v]) => [BOOK_LABELS[k] || k, v])) : "<p class='muted'>—</p>"}</div>
      <div class="card"><h3>Où part l'argent</h3>${exp.length ? hbars(exp.map(([k, v]) => [BOOK_LABELS[k] || k, v])) : "<p class='muted'>—</p>"}</div>
    </div>
    ${Object.keys(byGame).length ? `<div class="card" style="margin-top:16px"><h3>Résultat de chaque section</h3>${hbars(Object.entries(byGame).sort((a, b) => b[1] - a[1]).map(([g, v]) => [`${GAMES[g].icon} ${GAMES[g].short}`, v]))}</div>` : ""}`;
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
ACTIONS["alloc"] = () => allocManual() ? allocModal() : modeModal();
// mode de gestion de l'argent du mercato : automatique (un budget pour tout le club) ou manuel (enveloppes par jeu)
function modeModal() {
  const m = allocManual();
  modal(`<h2>💰 Gestion de l'argent du mercato</h2>
    <div class="help-steps">
      <div class="help-step"><div class="help-i">⚙️</div><div><b>Automatique ${!m ? "<span class='ok'>(actuel)</span>" : "(recommandé)"}</b><p>Un seul budget pour tout le club. Vous pouvez dépenser votre budget moins une réserve de ${RESERVE_WEEKS} semaines de salaires ; une recrue doit pouvoir être payée ${WAGE_WEEKS} semaines avec l'argent restant. Aujourd'hui : <b>${money(spendable())}</b> disponibles.</p></div></div>
      <div class="help-step"><div class="help-i">⚖️</div><div><b>Manuel ${m ? "<span class='ok'>(actuel)</span>" : ""}</b><p>Vous fixez vous-même, pour chaque jeu, une enveloppe mercato et un plafond de salaires, à la manière de Football Manager. Plus de contrôle, mais il faut répartir l'argent à chaque saison.</p></div></div>
    </div>
    <div class="actions"><button data-act="close-modal">Fermer</button>${m ? `<button class="primary" data-act="mode-auto">Passer en automatique</button><button data-act="mode-alloc">⚖️ Modifier la répartition</button>` : `<button data-act="mode-manual">Passer en manuel</button>`}</div>`);
}
ACTIONS["mode-auto"] = () => { S.allocManual = false; closeModal(); toast("Mode automatique : un seul budget pour tout le club."); scheduleSave(); render(); };
ACTIONS["mode-manual"] = () => { S.allocManual = true; if (S.alloc) S.alloc.set = false; allocModal("Mode manuel : répartissez l'argent du mercato entre vos jeux."); scheduleSave(); render(); };
ACTIONS["mode-alloc"] = () => allocModal();
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

// ---------- salle des trophées ----------
// le trophée : titres mondiaux en or, puis S-tier, ligues, autres tournois ; les finales perdues des grands tournois en médailles
function trophyKind(t) {
  if (t.game === "ewc") return { k: 0, ic: "🌍", cls: "world", lbl: "EWC Club Champion" };
  const tour = !t.tier && GAMES[t.game] && allTournaments(t.game).find(x => x[0] === t.name);
  const world = t.world ?? (tour ? isWorldTitle(t.game, tour) : /Worlds|World (Championship|Finals|Cup)|Global (Championship|Finals?)|The International|Champions$|Tactician's Crown|Major/.test(t.name));
  if (world) return { k: 0, ic: "🏆", cls: "world", lbl: "Champion du monde" };
  if (t.tier) return { k: 2, ic: "🥇", cls: "league", lbl: t.tier === 1 ? "Champion de ligue" : `Ligue · ${GAMES[t.game] ? tierLabel(t.game, t.tier) : "tier " + t.tier}` };
  const tt = t.tt || (tour ? tourTier(tour) : "B");
  return tt === "S" ? { k: 1, ic: "🏆", cls: "s", lbl: "Tournoi S-Tier" } : tt === "A" ? { k: 3, ic: "🏅", cls: "a", lbl: "Tournoi A-Tier" } : { k: 4, ic: "🎖️", cls: "b", lbl: `Tournoi ${tt}-Tier` };
}
function viewTrophies() {
  checkAch();
  const tabs0 = `<div class="tabs tr-tabs"><button class="tab ${UI.trophyTab !== "ach" ? "active" : ""}" data-act="trophy-tab" data-v="cups">🏆 Palmarès</button><button class="tab ${UI.trophyTab === "ach" ? "active" : ""}" data-act="trophy-tab" data-v="ach">🎖️ Succès <small>${Object.keys(S.ach.done).length}/${ACHIEVEMENTS.length}</small></button></div>`;
  if (UI.trophyTab === "ach") return `<h2>🏆 Salle des trophées de ${esc(user().name)}</h2>${tabs0}${achievementsView()}`;
  const u = user(), f = UI.trophyGame || "all";
  const mineT = S.titles.filter(t => t.clubId && isMine(t.clubId) && (f === "all" || t.game === f));
  const won = mineT.filter(t => !t.real), legacy = mineT.filter(t => t.real);
  const medals = (S.tourResults || []).filter(r => (r.mine === 2 || r.mine === 3) && (f === "all" || r.game === f) && ["S", "A"].includes(r.tt || (allTournaments(r.game).find(x => x[0] === r.name) ? tourTier(allTournaments(r.game).find(x => x[0] === r.name)) : "C")));
  const all = won.map(t => ({ t, kd: trophyKind(t) }));
  const worlds = all.filter(x => x.kd.k === 0);
  const games = [...new Set(S.titles.filter(t => t.clubId && isMine(t.clubId)).map(t => t.game).concat((S.tourResults || []).filter(r => r.mine && r.mine <= 3).map(r => r.game)))];
  const tabs = [["all", "Tous"]].concat(games.map(g => [g, GAMES[g] ? GAMES[g].icon + " " + GAMES[g].short : "🌍 EWC"]))
    .map(([k, l]) => `<button class="tab small ${f === k ? "active" : ""}" data-act="trophy-game" data-v="${k}">${l}</button>`).join("");
  const earned = (S.tourResults || []).filter(r => f === "all" || r.game === f).reduce((a, r) => a + (r.won || 0), 0);
  const team = t => t.club && t.club !== u.name ? `<div class="tr-team">${esc(t.club)}</div>` : "";
  const gameChip = g => GAMES[g] ? gchip(g) : "<span class='chip'>🌍 EWC</span>";
  const card = ({ t, kd }) => `<div class="trophy ${kd.cls}"><div class="tr-ic">${kd.ic}</div><div class="tr-name">${esc(t.name)}</div><div class="tr-meta">${gameChip(t.game)} <b>${t.season}</b></div>${team(t)}<div class="tr-lbl">${kd.lbl}${t.prize ? ` · ${money(t.prize)}` : ""}</div></div>`;
  const shelf = (title, list) => list.length ? `<div class="card"><h3>${title} <small class="muted">(${list.length})</small></h3><div class="shelf">${list.map(card).join("")}</div></div>` : "";
  const sorted = all.filter(x => x.kd.k > 0).sort((a, b) => a.kd.k - b.kd.k || b.t.season - a.t.season);
  const stat = (n, l, cls = "") => `<div class="tr-stat ${cls}"><b>${n}</b><span>${l}</span></div>`;
  return `<h2>🏆 Salle des trophées de ${esc(u.name)}</h2>${tabs0}
    <div class="tr-stats">${stat(won.length, "trophées remportés", "gold")}${stat(worlds.length, "titres mondiaux", "gold")}${stat(all.filter(x => x.kd.k === 2).length, "titres de ligue")}${stat(all.filter(x => x.kd.k === 1 || x.kd.k >= 3).length, "tournois gagnés")}${stat(medals.length, "podiums (S/A)")}${stat(money(earned), "gains en tournoi")}</div>
    ${games.length > 1 ? `<div class="tabs">${tabs}</div>` : ""}
    ${worlds.length ? `<div class="card world-shelf"><h3>🌍 Champions du monde</h3><div class="shelf">${worlds.sort((a, b) => b.t.season - a.t.season).map(card).join("")}</div></div>` : ""}
    ${shelf("🏆 Vitrine", sorted)}
    ${!won.length ? `<div class="card empty-shelf"><div style="font-size:54px">🗄️</div><p><b>La vitrine est encore vide.</b></p><p class="muted">Chaque ligue, tournoi ou titre mondial remporté sous votre direction viendra s'exposer ici. Les finales perdues des grands tournois sont rangées dans les médailles.</p></div>` : ""}
    ${medals.length ? `<div class="card"><h3>🥈 Médailles <small class="muted">(podiums en S-Tier et A-Tier)</small></h3><div class="medals">${medals.slice().reverse().map(r => `<div class="medal">${r.mine === 2 ? "🥈" : "🥉"} <b>${esc(r.name)}</b> ${gameChip(r.game)} <small class="muted">${r.season}${r.won ? " · " + money(r.won) : ""}</small></div>`).join("")}</div></div>` : ""}
    ${legacy.length ? `<div class="card"><h3>📜 Héritage du club <small class="muted">(titres remportés avant votre arrivée)</small></h3><div class="medals">${legacy.slice().sort((a, b) => b.season - a.season).map(t => `<div class="medal">${trophyKind(t).ic} <b>${esc(t.name)}</b> ${gameChip(t.game)} <small class="muted">${t.season}${t.club && t.club !== u.name ? " · " + esc(t.club) : ""}</small></div>`).join("")}</div></div>` : ""}`;
}
ACTIONS["trophy-game"] = v => { UI.trophyGame = v; render(); };
ACTIONS["trophy-tab"] = v => { UI.trophyTab = v; render(); };
ACTIONS["ach-filter"] = v => { UI.achFilter = v; render(); };
// onglet Succès : les 50 succès par catégorie, débloqués en couleur, les autres grisés avec leur progression
function achievementsView() {
  const done = S.ach.done, n = Object.keys(done).length, f = UI.achFilter || "all";
  const fmtN = (x, t, a) => a.cat === "fin" && t >= 1000 ? money(x) : t >= 1e5 ? Math.round(x).toLocaleString("fr-FR") : Math.round(x).toLocaleString("fr-FR");
  const card = a => {
    const d = done[a.id]; let c = 0, t = 1; try { [c, t] = a.prog(); } catch (e) { }
    const pct = Math.max(0, Math.min(100, Math.round(c / t * 100)));
    return `<div class="ach ${d ? "on" : "off"} ${a.cat === "fun" ? "fun" : ""}"><div class="ach-ic">${a.icon}</div><div class="ach-body"><b>${esc(a.name)}</b><div class="ach-desc">${esc(a.desc)}</div>
      ${d ? `<div class="ach-date">✅ ${d[2] ? "Acquis à la reprise du club" : `Débloqué · ${weekLabel(d[0], d[1], true)}`}</div>` : t > 1 ? `<div class="ach-bar"><i style="width:${pct}%"></i></div><div class="ach-date">${fmtN(Math.max(0, c), t, a)} / ${fmtN(t, t, a)}</div>` : `<div class="ach-date">🔒 À débloquer</div>`}</div></div>`;
  };
  const list = ACHIEVEMENTS.filter(a => f === "all" || (f === "done" ? done[a.id] : !done[a.id]));
  const filt = [["all", "Tous"], ["done", "Débloqués"], ["todo", "À débloquer"]].map(([k, l]) => `<button class="tab small ${f === k ? "active" : ""}" data-act="ach-filter" data-v="${k}">${l}</button>`).join("");
  return `<div class="card ach-head"><div class="ach-score"><b>${n}</b><span>/ ${ACHIEVEMENTS.length} succès</span></div><div style="flex:1;min-width:200px"><div class="ach-bar big"><i style="width:${Math.round(n / ACHIEVEMENTS.length * 100)}%"></i></div>
      <p class="muted" style="margin:6px 0 0;font-size:13px">Des défis à relever au fil de vos saisons : finances, compétition, séries, mercato, club… et quelques moments moins glorieux 😅. Ils se débloquent tout seuls, avec une notification.</p></div></div>
    <div class="tabs">${filt}</div>
    ${ACH_CATS.map(([k, l]) => { const xs = list.filter(a => a.cat === k); return xs.length ? `<h3 style="margin-top:16px">${l} <small class="muted">${xs.filter(a => done[a.id]).length}/${ACHIEVEMENTS.filter(a => a.cat === k).length}</small></h3><div class="ach-grid">${xs.map(card).join("")}</div>` : ""; }).join("")}`;
}
// notification des succès débloqués (en bas à droite, quelques secondes)
function achPopup() {
  if (!S || !S.ach || !S.ach.pending || !S.ach.pending.length) return;
  const ids = S.ach.pending.splice(0), list = ids.map(id => ACHIEVEMENTS.find(a => a.id === id)).filter(Boolean);
  let box = document.getElementById("ach-pop"); if (!box) { box = document.createElement("div"); box.id = "ach-pop"; document.body.appendChild(box); }
  // au plus 3 notifications à la fois ; au-delà, une seule qui les regroupe (elles ne doivent jamais cacher l'écran)
  box.querySelectorAll(".ach-toast").forEach(e => e.remove());
  const show = list.length > 3 ? [{ icon: "🎖️", name: `${list.length} succès débloqués`, desc: list.map(a => a.name).join(", ") }] : list;
  for (const a of show) {
    const el = document.createElement("div"); el.className = "ach-toast"; el.dataset.act = "ach-open";
    el.innerHTML = `<div class="ach-ic">${a.icon}</div><div><small>🎖️ Succès débloqué</small><b>${esc(a.name)}</b><span>${esc(a.desc)}</span></div>`;
    box.appendChild(el); setTimeout(() => el.classList.add("out"), 5000); setTimeout(() => el.remove(), 5600);
  }
  scheduleSave();
}
ACTIONS["ach-open"] = () => { document.querySelectorAll(".ach-toast").forEach(e => e.remove()); UI.view = "trophies"; UI.trophyTab = "ach"; closeModal(); render(); };

// ---------- monde ----------
function viewWorld() {
  const clubs = Object.values(S.clubs).filter(c => ((!c.filler && !c.solo) || c.titles.length || c.id === S.userId) && !c.sister).sort((a, b) => b.fame - a.fame).slice(0, 100);
  const divs = c => Object.entries(c.divisions).map(([g, d]) => `<span class="chip" style="border-color:${GAMES[g].color}">${GAMES[g].icon} ${GAMES[g].short} <small class="muted">${tshort(g, d.tier)}</small></span>`).join(" ");
  const rows = clubs.map((c, i) => `<tr class="${c.id === S.userId ? "me" : ""}"><td>${i + 1}</td><td><span style="color:${c.color}">■</span> <b data-act="club-info" data-v="${c.id}" style="cursor:pointer">${esc(c.name)}</b></td><td>${flag(c.country)}</td>
    <td>${Math.round(c.fame)}<small class="muted">/100</small></td><td>${c.fans.toLocaleString("fr-FR")}</td><td>${divs(c)}</td><td>${c.titles.length ? "🏆 × " + c.titles.length : ""}</td></tr>`).join("");
  const hist = S.titles.slice().reverse().slice(0, 80).map(t => `<tr><td>${t.season}</td><td>${GAMES[t.game] ? gchip(t.game) : "<span class='chip'>🌍 EWC</span>"}</td><td>${t.tier ? (GAMES[t.game] && GAMES[t.game].open ? "<span class='chip'>Circuit</span>" : tchip(t.tier)) + (t.name ? " " + esc(t.name) : " Ligue") : `<span class="chip">🏆 ${esc(t.name)}</span>`}</td><td class="${t.clubId === S.userId ? "ok" : ""}"><b>${esc(t.club)}</b></td></tr>`).join("");
  return `<h2>Clubs & palmarès</h2><div class="grid g2">
    <div class="card table-wrap"><h3>Classement mondial des clubs (notoriété)</h3><table><tr><th>#</th><th>Club</th><th></th><th>Notoriété</th><th>Fans</th><th>Divisions</th><th>Titres</th></tr>${rows}</table></div>
    <div class="card table-wrap"><h3>Palmarès</h3>${hist ? `<table><tr><th>Saison</th><th>Jeu</th><th>Compétition</th><th>Champion</th></tr>${hist}</table>` : "<p class='muted'>Aucun titre décerné pour l'instant.</p>"}</div></div>`;
}
// lien vers l'effectif d'un club dans un jeu (mercato, fiche joueur…)
const teamLink = (c, game, txt) => `<span class="link" data-act="team-info" data-v="${c.id}|${game}" title="Voir l'effectif">${txt || esc(c.name)}</span>`;
// effectif d'un club dans un jeu, avec de quoi faire une offre à chaque joueur
function teamInfo(id, game) {
  const c = S.clubs[id], d = c && c.divisions[game]; if (!d) return;
  const u = user(), mine = isMine(id), owner = c.parent && S.clubs[c.parent] ? S.clubs[c.parent] : c;
  const ps = clubPlayers(id, game).concat(unitMates(id, game)).sort((a, b) => b.starter - a.starter || b.rating - a.rating);
  const btn = p => {
    if (mine || isMine(p.club)) return "";
    if (!p.club) return `<button class="small primary" data-act="sign" data-v="${p.id}">Signer</button>`;
    const shut = S.clubs[p.club].solo ? null : windowCheck(p);
    if (shut) return `<button class="small" disabled title="${esc(shut)}">🔴 Mercato fermé</button>`;
    return interestCheck(p) ? `<button class="small" data-act="offer" data-v="${p.id}">Offre (~${money(askingPrice(p))})</button>` : `<button class="small" disabled title="Votre club n'est pas assez connu pour ce joueur">🔒 Hors de portée</button>`;
  };
  const coach = mine ? coachOf(game) : aiCoachOf(id, game);
  const st = teamStrength(id, game);
  modal(`<div style="display:flex;gap:12px;align-items:center">${badge(owner)}<div><h2 style="margin:0">${esc(d.label || c.name)} ${flag(c.country)}</h2>
    <div class="muted" style="font-size:13px">${GAMES[game].icon} ${GAMES[game].name} · ${esc(divName(id, game))} · ${tierLabel(game, d.tier)} · force ${R(Math.round(st.str))}${coach ? ` · 🧑‍🏫 ${esc(coach.name)}` : ""}</div></div></div>
    ${!mine && GAMES[game] && u.divisions[game] ? `<p class="afford" style="margin-top:12px">💰 Vous pouvez dépenser jusqu'à <b>${money(spendRoom(game))}</b> en ${GAMES[game].short}. ${mercatoStatus(game).text}</p>` : ""}
    <div class="table-wrap" style="margin-top:10px"><table><tr><th></th><th>Joueur</th><th>Rôle</th><th>Âge</th><th>Note</th><th>Potentiel</th><th>Valeur</th><th>Contrat</th><th></th></tr>
    ${ps.map(p => `<tr><td>${p.starter ? "⭐" : ""}</td><td>${flag(p.nat)} <b class="link" data-act="player-info" data-v="${p.id}">${esc(p.handle)}</b>${p.listed ? ` <span class="chip warn" title="Prix demandé : ${money(p.askPrice)}">📋 en vente</span>` : ""}${p.club !== id ? ` <small class="muted">(partenaire extérieur)</small>` : ""}</td>
      <td class="muted">${p.role}</td><td>${ageTxt(p)}</td><td>${R(p.rating)}</td><td>${potTxt(p)}</td><td>${money(playerValue(p))}</td><td>${p.club ? p.years + " an(s)" : "—"}</td><td>${btn(p)}</td></tr>`).join("") || `<tr><td colspan="9" class="muted">Aucun joueur.</td></tr>`}</table></div>
    <div class="actions"><button data-act="close-modal">Fermer</button><button data-act="club-info" data-v="${owner.id}">🏢 Tout le club</button></div>`);
}
ACTIONS["team-info"] = v => { const [id, g] = v.split("|"); teamInfo(id, g); };
function clubInfo(id) {
  const c = S.clubs[id];
  const divs = Object.entries(c.divisions).map(([g, d]) => `<h3 style="margin-top:12px">${teamLink(c, g, GAMES[g].icon + " " + GAMES[g].name)}${d.label ? ` — ${esc(d.label)}` : ""} · ${esc(divName(id, g))} · ${GAMES[g].open ? "statut " : ""}${tierLabel(g, d.tier)} ${d.generated ? "<span class='warn' title='Le club a bien une équipe dans ce jeu, mais son effectif réel est introuvable'>* joueurs inventés</span>" : d.verified ? "<span class='ok' title='Effectif recoupé dans des sources 2026'>✓ 2026</span>" : c.filler ? "" : "<span class='muted' title='Effectif établi de mémoire, peut être dépassé'>≈ non vérifié</span>"}</h3><div class="table-wrap"><table>${clubPlayers(id, g).sort((a, b) => b.starter - a.starter || b.rating - a.rating).map(p => `<tr><td>${p.starter ? "⭐" : ""}</td><td>${flag(p.nat)} ${esc(p.handle)}</td><td class="muted">${p.role}</td><td>${ageTxt(p)} ans</td><td>${R(p.rating)}</td><td>${potTxt(p)}</td></tr>`).join("")}</table></div>`).join("");
  const coachLine = Object.keys(c.divisions).map(g => [g, id === S.userId ? coachOf(g) : aiCoachOf(id, g)]).filter(([, co]) => co).map(([g, co]) => `${GAMES[g].icon} ${esc(co.name)} (${coachLevel(co).toFixed(1)})`).join(" · ");
  modal(`<div style="display:flex;gap:12px;align-items:center">${badge(c)}<div><h2 style="margin:0">${esc(c.name)} ${flag(c.country)}</h2>${coachLine ? `<div class="muted" style="font-size:12px">🧑‍🏫 Entraîneurs : ${coachLine}</div>` : ""}<span class="muted">${c.solo ? "Pro indépendant · " : ""}Notoriété ${Math.round(c.fame)}/100 · ${c.fans.toLocaleString("fr-FR")} fans${c.titles.length ? " · 🏆 " + c.titles.map(esc).join(", ") : ""}</span></div></div>${divs}<div class="actions"><button data-act="close-modal">Fermer</button></div>`);
}

// =====================================================================
//  Actions
// =====================================================================
Object.assign(ACTIONS, {
  "screen": v => { UI.screen = v; renderHome(); },
  "pick-club": v => { UI.pickClub = v; const ceo = document.getElementById("f-ceo").value; renderHome(); document.getElementById("f-ceo").value = ceo; },
  "start-create": () => {
    if (confirmReplace("start-create")) return;
    const val = id => document.getElementById(id).value.trim();
    const name = val("f-name"), tag = val("f-tag").toUpperCase();
    if (!name || tag.length < 2) return toast("Indiquez un nom de club et un tag de 2 à 4 lettres.");
    newWorld({ ceo: val("f-ceo") || "Le CEO", mode: "create", name, tag, country: val("f-country"), color: val("f-color"), firstGame: val("f-game") });
    UI.view = "dash"; UI.market.status = "free"; UI.market.game = val("f-game"); render(); if (!firstHelp()) maybeAlloc();
  },
  "start-takeover": () => {
    if (confirmReplace("start-takeover")) return;
    newWorld({ ceo: document.getElementById("f-ceo").value.trim() || "Le CEO", mode: "takeover", clubId: UI.pickClub });
    UI.view = "dash"; render(); if (!firstHelp()) maybeAlloc();
  },
  "continue": () => {
    if (load()) { UI.view = "dash"; render(); if (S.loadWarning) { toast("⚠️ " + S.loadWarning); delete S.loadWarning; } return; }
    modal(`<h2>⚠️ La sauvegarde n'a pas pu être chargée</h2><p>Erreur : <code>${esc(LOAD_ERROR || "inconnue")}</code></p>
      <p>Rien n'est effacé. Vous pouvez restaurer une copie de secours (liste sur l'écran d'accueil) ou exporter la sauvegarde dans un fichier pour la faire réparer.</p>
      <div class="actions"><button data-act="close-modal">Fermer</button><button class="primary" data-act="save-export">💾 Exporter le fichier</button></div>`);
  },
  // exporter / importer la partie dans un fichier (pour la garder, la transférer ou la faire réparer)
  "save-export": () => {
    const raw = S ? packSave(JSON.stringify(S)) : localStorage.getItem(SAVE_KEY);
    if (!raw) return toast("Aucune partie à exporter.");
    let name = "partie";
    try { const x = S || JSON.parse(readSave()); name = `${x.clubs[x.userId].name} ${x.season}-S${x.week}`; } catch (e) { }
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([raw], { type: "text/plain" })); a.download = `EsportsManager - ${name.replace(/[^\w -]/g, "")}.emsave`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  },
  "save-import": () => {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".emsave,.txt,.json";
    inp.onchange = () => { const f = inp.files[0]; if (!f) return; f.text().then(raw => restoreRaw(raw.trim())); };
    inp.click();
  },
  "backup-restore": v => idbAll().then(list => { const x = list.find(([k]) => k === v); if (x) restoreRaw(x[1].z); else toast("Copie introuvable."); }),
  "backup-more": () => { UI.backupAll = !UI.backupAll; listBackups(); },
  "wipe": () => modal(`<h2>Effacer la sauvegarde ?</h2><p>La partie en cours sera définitivement perdue.</p><div class="actions"><button data-act="close-modal">Annuler</button><button class="danger" data-act="do-wipe">Effacer</button></div>`),
  "do-wipe": () => { wipeSave(); closeModal(); renderHome(); },
  "replace-ok": v => { UI.replaceOk = true; closeModal(); ACTIONS[v](); UI.replaceOk = false; },
  "quit": () => { saveNow(); S = null; UI.screen = "home"; UI.compGame = UI.compTier = UI.rosterGame = null; renderHome(); },
  "view": v => { UI.view = v; render(); window.scrollTo(0, 0); },
  "roster-game": v => { UI.rosterGame = v; render(); },
  "comp-game": v => { UI.compGame = v; const d = user().divisions[v]; UI.compTier = d ? d.tier : 1; UI.compZone = d ? d.zone : null; UI.compSub = d ? d.sub : null; render(); },
  "comp-tier": v => { UI.compTier = +v; render(); },
  "comp-zone": v => { UI.compZone = v; render(); },
  "comp-sub": v => { UI.compSub = v; render(); },
  "sub-change": v => {
    const r = changeSub(UI.compGame, v), nm = SUB_NAMES[v] || v;
    toast(r.err || (r.now ? `✅ Votre club joue désormais en ${nm}.` : r.later ? `🔁 Vous rejoindrez la ${nm} à la fin de la saison.` : `🎯 À votre montée, votre club ira en ${nm}.`));
    save(); render();
  },
  "sub-unpref": () => { const u = user(); if (u.subPref) delete u.subPref[UI.compGame]; toast("Choix annulé : ligue de votre pays par défaut."); save(); render(); },
  "tour-game": v => { UI.tourGame = v; render(); },
  "tour-size": v => { UI.tourSize = v; render(); },
  "cal-mode": v => { UI.calMode = v; render(); },
  "cal-view": v => { UI.calView = v; if (v === "week") UI.calWeek = Math.max(SEASON_FIRST, Math.min(SEASON_LAST, UI.calWeek || S.week)); render(); },
  "cal-today": () => { UI.calMonth = weekMonday(S.season, S.week).getUTCMonth(); UI.calWeek = S.week; render(); },
  "cal-step": v => { if (UI.calView === "week") UI.calWeek = Math.max(SEASON_FIRST, Math.min(SEASON_LAST, UI.calWeek + +v)); else UI.calMonth = Math.max(0, Math.min(11, UI.calMonth + +v)); render(); },
  "cal-ev": v => { const [w, i] = v.split("|").map(Number); calEventModal(w, i); },
  "cal-day": v => { const [w, d] = v.split("|").map(Number); UI.calView = "week"; UI.calWeek = w; render(); },
  "goto-market": v => { closeModal(); UI.market.game = v; UI.market.page = 0; UI.market.tab = "search"; UI.view = "market"; render(); },
  "open-div": v => {
    const [game, t] = v.split("|"), tier = +t, g = GAMES[game];
    const z = zoneFrom(game, REGION_OF[user().country] || "EU", user().country);
    const subs = !g.open && subsOf(game, tier, z), pref = user().subPref && user().subPref[game], pick = subs && subs.length > 1
      ? `<p>Ligue nationale : <select id="open-sub" aria-label="Ligue nationale">${subs.map(s => `<option value="${s}" ${s === (subs.includes(pref) ? pref : subFor(game, tier, z, user().country)) ? "selected" : ""}>${esc(tierName(game, tier, z, s))}</option>`).join("")}</select></p>` : "";
    modal(`<h2>${g.icon} ${g.name} · ${tierLabel(game, tier)}</h2><p>Entrée dans le <b>${esc(tierName(game, g.open ? 1 : tier, z))}</b> (${ZONE_NAMES[z]}) : <b>${money(tierEntry(game, tier))}</b>.<br>
      Il vous faudra ${g.size} joueur(s) titulaire(s). Frais de fonctionnement : ${money(TIER_OP[tier - 1] * g.size * g.mult)}/sem. Cashprize du circuit : ${money(tierPrize(game, tier))}.</p>${pick}
      <div class="actions"><button data-act="close-modal">Annuler</button><button class="primary" data-act="confirm-open" data-v="${v}">Confirmer</button></div>`);
  },
  "confirm-open": v => { const [game, t] = v.split("|"); const sel = document.getElementById("open-sub"), e = openDivision(game, +t, sel && sel.value); closeModal(); if (e) toast(e); else { UI.rosterGame = game; toast("Division ouverte !"); } render(); },
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
  // depuis la liste des fins de contrat, on y revient après la négociation ; ailleurs, la fenêtre se ferme simplement
  "renew": v => { UI.ctFlow = !!document.querySelector('#modal:not(.hidden) [data-act="ct-continue"]'); openNego(startNegotiation(v, "renew")); },
  "contract": v => contractModal(v),
  "sell": v => sellModal(v),
  "do-list": v => {
    const p = S.players[v], price = +document.getElementById("f-ask").value || 0, was = p.listed;
    if (!was && !p.wantsOut && p.morale >= 35) p.morale = clamp(p.morale - 8, 0, 100);
    listPlayer(v, price); closeModal();
    if (!was) mail(`📋 ${p.handle} sur la liste des transferts`, `${p.handle} est mis en vente pour ${money(p.askPrice)} (valeur estimée ${money(playerValue(p))}). ${INTEREST_LABEL[transferInterest(p)]} pour l'instant.`, "transfer", p.game);
    toast(was ? `Prix de ${p.handle} : ${money(p.askPrice)}` : `${p.handle} est sur la liste des transferts.`); save(); render();
  },
  "tl-unlist": v => { const p = S.players[v]; unlistPlayer(v); p.morale = clamp(p.morale + 3, 0, 100); closeModal(); toast(`${p.handle} est retiré de la liste des transferts.`); save(); render(); },
  "tl-accept": v => { const [pid, oid] = v.split("|"); const r = acceptTransferOffer(pid, oid); toast(r); save(); render(); if (UI.offerFlow) offersModal(); },
  "tl-refuse": v => { const [pid, oid] = v.split("|"), o = findOffer(pid, oid); if (o) mail(`Offre refusée`, `Vous refusez l'offre de ${S.clubs[o.club].name} (${money(o.fee)}) pour ${S.players[pid].handle}.`, "transfer", S.players[pid].game); refuseTransferOffer(pid, oid); save(); render(); if (UI.offerFlow) offersModal(); },
  "tl-counter": v => {
    const [pid, oid] = v.split("|"), p = S.players[pid], o = findOffer(pid, oid); if (!o) return toast("Offre expirée.");
    modal(`<h2>Contre-proposition à ${esc(S.clubs[o.club].name)}</h2><p>Offre actuelle pour ${esc(p.handle)} : <b>${money(o.fee)}</b> · prix demandé ${money(p.askPrice)} · valeur ${money(playerValue(p))}</p>
      <div class="form-row"><label for="f-counter">Votre prix (€)</label><input id="f-counter" type="number" step="500" value="${Math.max(o.fee + 500, p.askPrice || 0)}"></div>
      <p class="muted" style="font-size:12px">Le club peut accepter, monter une dernière fois, ou se retirer si vous demandez trop.</p>
      <div class="actions"><button data-act="${UI.offerFlow ? "offers-back" : "close-modal"}">Annuler</button><button class="primary" data-act="tl-do-counter" data-v="${v}">Envoyer</button></div>`);
  },
  "tl-do-counter": v => {
    const [pid, oid] = v.split("|"), r = counterTransferOffer(pid, oid, +document.getElementById("f-counter").value || 0);
    closeModal(); mail(`Contre-proposition : ${S.players[pid].handle}`, r.msg, "transfer", S.players[pid].game);
    if (r.status === "accept") { const t = acceptTransferOffer(pid, oid); toast(r.msg + " " + t); } else toast(r.msg);
    save(); render();
    if (UI.offerFlow) offersModal();
  },
  "release": v => { const p = S.players[v]; modal(`<h2>Libérer ${esc(p.handle)} ?</h2><p>Indemnité de rupture : <b>${money(Math.round(p.salary * 52 * p.years * 0.25))}</b>.</p><div class="actions"><button data-act="close-modal">Annuler</button><button class="danger" data-act="do-release" data-v="${v}">Libérer</button></div>`); },
  "do-release": v => { releasePlayer(v); closeModal(); render(); },
  "sign": v => {
    const u = user(), p = S.players[v];
    if (!u.divisions[p.game]) return toast(`Ouvrez d'abord une division ${GAMES[p.game].name} (onglet Effectifs).`);
    openNego(startNegotiation(v, "sign"));
  },
  "offer": (v, reply, fee, tone) => feeModal(v, reply, fee, tone),
  "do-offer": v => {
    const p = S.players[v], fee = Math.max(0, +document.getElementById("f-fee").value || 0);
    // vérifications (mercato, budget, intérêt) avant de parler au club
    const e = feeChecks(v, fee);
    if (e && fee > transferRoom(p.game) && fee <= user().budget) return feeModal(v, e, fee, "bad");
    if (e) return feeModal(v, e, fee, "bad");
    const r = clubTalk(v, fee);
    if (r.status === "accept") return openNego(startNegotiation(v, "transfer", r.fee), `${r.msg} Place à la négociation avec le joueur.`);
    if (r.status === "walk" || r.status === "closed") { closeModal(); render(); return toast(r.msg.replace(/<[^>]+>/g, "")); }
    feeModal(v, r.msg, Math.round(r.counter * 0.95 / 500) * 500, r.last ? "bad" : "");
  },
  "fee-take": v => { const t = feeTalk(v), e = feeChecks(v, t.counter); if (e) return feeModal(v, e, t.counter, "bad"); const r = clubTalk(v, t.counter); if (r.status === "accept") openNego(startNegotiation(v, "transfer", r.fee), `${r.msg} Place à la négociation avec le joueur.`); },
  "pay-clause": v => openNego(payClause(v), `Vous payez la clause libératoire (${money(S.players[v].clause)}). Il reste à convaincre le joueur.`),
  "upgrade": v => { const e = upgradeFacility(v); if (e) toast(e); render(); },
  "open-mail": v => { const m = S.inbox.find(x => x.id === v); if (m) { m.read = true; UI.mailOpen = v; } if (UI.view !== "inbox") { UI.view = "inbox"; UI.inbox = { cat: "all", game: "all", q: "" }; } render(); },
  "read-all": () => { S.inbox.forEach(m => m.read = true); render(); },
  "club-info": v => clubInfo(v),
  "close-modal": () => closeModal(),
});

// encadré pour ajuster tout de suite l'enveloppe et le plafond salarial d'une section quand une offre les dépasse
// back : écran à réafficher après l'ajustement ("nego" ou "offer:<id du joueur>")
function allocFix(game, upfront, weekly, back) {
  if (!allocManual()) return "";
  const a = allocOf(game), lack = Math.max(0, upfront - transferRoom(game)), wlack = Math.max(0, weekly - wageRoom(game));
  if (!lack && !wlack) return "";
  const u = user(), games = Object.keys(u.divisions), left = g => Math.max(0, allocOf(g).transfer - Math.max(0, allocOf(g).spent));
  const free = Math.max(0, Math.max(0, u.budget) - games.reduce((s, g) => s + left(g), 0)), elsewhere = games.filter(g => g !== game).reduce((s, g) => s + left(g), 0);
  return `<div class="counter-box"><b>⚖️ Ajuster le budget ${GAMES[game].short} sans quitter</b>
    <div class="muted" style="font-size:12px;margin:4px 0">Non réparti : ${money(free)} · encore libre dans les autres sections : ${money(elsewhere)} (repris si besoin, les plus garnies d'abord).</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end">
      <div class="form-row" style="margin:0"><label for="fx-t">Enveloppe mercato (€)</label><input id="fx-t" type="number" min="0" step="1000" value="${a.transfer + lack}" style="width:130px"><small class="muted">actuelle : ${money(a.transfer)}${lack ? ` (+${money(lack)} nécessaires)` : ""}</small></div>
      <div class="form-row" style="margin:0"><label for="fx-w">Plafond salarial (€/sem)</label><input id="fx-w" type="number" min="0" step="50" value="${round50(a.wages + wlack)}" style="width:110px"><small class="muted">actuel : ${money(a.wages)}${wlack ? ` (+${money(wlack)} nécessaires)` : ""}</small></div>
      <button class="small primary" data-act="fix-alloc" data-v="${game}|${back}">✅ Appliquer</button></div></div>`;
}
// vérifications avant une offre au club (mercato, intérêt du joueur, budget) ; le prix se négocie ensuite
function feeChecks(pid, fee) {
  const p = S.players[pid], u = user();
  if (!p.club || isMine(p.club)) return "Offre impossible.";
  if (!u.divisions[p.game]) return `Ouvrez d'abord une division ${GAMES[p.game].name}.`;
  const we = windowCheck(p); if (we) return we;
  if (!interestCheck(p)) return `${p.handle} n'est pas intéressé par le projet : votre club manque de notoriété (${u.fame.toFixed(0)}) ou évolue trop bas.`;
  return budgetCheck(p.game, fee);
}
// négociation de l'indemnité avec le club vendeur
function feeModal(v, reply, fee, tone) {
  const p = S.players[v], u = user(), c = S.clubs[p.club], t = feeTalk(v), closed = t.walked && nowIndex() - t.walked < 4;
  const mood = t.patience >= 4 ? "😊 Ouvert" : t.patience === 3 ? "😐 Attentif" : t.patience === 2 ? "😠 Agacé" : "🤬 Dernière chance";
  const log = t.log.map(x => x.you !== undefined ? `<li>Vous : <b>${money(x.you)}</b></li>` : x.walk ? `<li class="bad">Le club rompt les discussions</li>` : `<li>${esc(c.solo ? p.handle : c.name)} : <b>${money(x.them)}</b>${x.ok ? " ✅" : x.last ? " (dernière offre)" : ""}</li>`).join("");
  modal(`<h2>${c.solo ? "Recruter" : "Transfert"} : ${flag(p.nat)} ${esc(p.handle)}</h2>
    <p class="muted" style="margin-top:-6px">${c.solo ? "Pro indépendant" : teamLink(c, p.game)} · ${GAMES[p.game].icon} ${GAMES[p.game].short} · ${p.role} · ${ageTxt(p)} ans · ${R(p.rating)} · potentiel ${potTxt(p)} · contrat ${p.years} an(s)</p>
    <div class="nego-head"><div><span class="muted">${c.solo ? "Prime demandée" : "Le club demande"}</span><b>${money(t.counter)}</b><small class="muted">valeur estimée ${money(playerValue(p))}</small></div>
      <div><span class="muted">Patience du ${c.solo ? "joueur" : "club"}</span><b>${closed ? "🚫 Discussions rompues" : mood}</b>${bar(Math.min(100, t.patience * 22))}</div></div>
    ${t.why.length ? `<p style="font-size:13px">💡 Ce qui peut faire baisser ou monter le prix : ${t.why.join(", ")}.</p>` : `<p class="muted" style="font-size:13px">💡 Un club vend moins cher un remplaçant, un joueur en fin de contrat ou mis en vente, ou quand il manque d'argent.</p>`}
    ${p.clause ? `<p style="font-size:13px">🔓 Clause libératoire : <b>${money(p.clause)}</b> — si vous la payez, le club ne peut pas refuser.</p>` : ""}
    ${reply ? `<div class="reply ${tone || ""}">${reply}</div>${tone === "bad" ? allocFix(p.game, fee || t.counter, 0, "offer:" + v) : ""}` : ""}
    ${closed ? "" : `<div class="form-row"><label for="f-fee">Votre offre (${c.solo ? "prime" : "indemnité"}, €)</label><input id="f-fee" type="number" step="500" value="${fee || Math.round(t.counter * 0.85 / 500) * 500}"></div>`}
    <p class="afford">💰 ${affordTxt(p)}<br><small class="muted">Il demandera environ ${money(salaryDemand(p, u))}/sem. L'indemnité, la prime de signature et la commission de l'agent sont prises sur la même enveloppe.</small></p>
    ${log ? `<ul class="muted" style="font-size:12px;margin:4px 0">${log}</ul>` : ""}
    <p class="muted" style="font-size:12px">Négociez : le club répond par des contre-propositions. Une offre trop basse l'agace ; à bout de patience, il rompt les discussions pour 4 semaines. Si l'accord est trouvé, vous négocierez ensuite le contrat avec le joueur.</p>
    <div class="actions"><button data-act="close-modal">Fermer</button>${p.clause ? `<button data-act="pay-clause" data-v="${v}">Payer la clause</button>` : ""}${closed ? "" : `${t.log.length ? `<button data-act="fee-take" data-v="${v}">✅ Accepter leur prix (${money(t.counter)})</button>` : ""}<button class="primary" data-act="do-offer" data-v="${v}">Faire l'offre</button>`}</div>`);
}
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
    <p class="afford">💰 ${affordTxt(p)}${N.ctx === "transfer" ? ` <small class="muted">(l'indemnité de ${money(N.fee)} sera prise sur cette somme)</small>` : ""}</p>
    ${reply ? `<div class="reply ${tone || ""}">${reply}</div>` : ""}${tone === "bad" ? allocFix(p.game, o.bonus + o.agentFee + (N.ctx === "transfer" ? N.fee : 0), o.salary - (N.ctx === "renew" ? p.salary : 0), "nego") : ""}
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
    const h = S.players[NEGO.pid].handle; NEGO = null; negoClosed(); toast(`${h} signe ! ✍️ ${r.msg}`); save(); return render();
  }
  if (r.status === "walk") { mail(`Négociations rompues : ${S.players[NEGO.pid].handle}`, r.msg, "transfer"); NEGO = null; negoClosed(); toast("Le joueur a quitté la table des négociations."); save(); return render(); }
  // l'agent répond par sa propre offre : le contrat affiché devient sa contre-proposition
  if (r.counter) { NEGO.draft = r.counter; NEGO.counter = r.counter; }
  const c = r.counter, sum = c ? `<div class="counter-box"><b>Contre-proposition de l'agent :</b> ${money(c.salary)}/sem · ${c.years} an(s) · statut « ${c.status} » · prime ${money(c.bonus)} · commission ${money(c.agentFee)} · ${c.prizeShare} % des gains${c.clause ? " · clause " + money(c.clause) : ""}
    <div style="margin-top:6px"><button class="small primary" data-act="nego-take">✅ Accepter sa contre-proposition</button> <span class="muted" style="font-size:12px">ou modifiez les champs et refaites une offre</span></div></div>` : "";
  negoModal(r.msg + sum, r.tone);
};
ACTIONS["nego-take"] = () => {
  const offer = NEGO.counter; if (!offer) return;
  const r = proposeContract(NEGO, offer);
  if (r.status === "accept") {
    const e = acceptContract(NEGO, offer);
    if (e) return negoModal(e, "bad");
    const h = S.players[NEGO.pid].handle; NEGO = null; negoClosed(); toast(`${h} signe ! ✍️ ${r.msg}`); save(); return render();
  }
  NEGO.draft = r.counter || offer; NEGO.counter = r.counter || null; negoModal(r.msg, r.tone);
};
ACTIONS["nego-quit"] = () => { NEGO = null; negoClosed(); };
ACTIONS["fix-alloc"] = v => {
  const [game, back] = v.split("|"), r = adjustAlloc(game, +document.getElementById("fx-t").value || 0, +document.getElementById("fx-w").value || 0);
  if (r.err) return toast(r.err);
  const fee = document.getElementById("f-fee"), keep = fee && +fee.value;
  if (back === "nego" && NEGO) NEGO.draft = readOffer();
  toast(`Budget ${GAMES[game].short} : enveloppe ${money(allocOf(game).transfer)}, plafond ${money(allocOf(game).wages)}/sem${r.moved.length ? " (repris : " + r.moved.map(([g, x]) => GAMES[g].short + " " + money(x)).join(", ") + ")" : ""}.`);
  scheduleSave();
  if (back === "nego" && NEGO) return negoModal(`✅ Budget ajusté. ${affordTxt(S.players[NEGO.pid])} Vous pouvez refaire l'offre.`, "ok");
  if (back.startsWith("offer:")) { const pid = back.slice(6); ACTIONS.offer(pid); const f = document.getElementById("f-fee"); if (f && keep) f.value = keep; }
};

// ---------- négociation de sponsors ----------
let SP = null;
// logo d'une marque : ses initiales sur une couleur qui lui est propre
const brandLogo = (name, big) => { const h = [...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 360; const ini = name.replace(/[^A-Za-zÀ-ÿ0-9 ]/g, "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  return `<span class="brand-logo ${big ? "big" : ""}" style="background:hsl(${h} 55% 42%)">${esc(ini)}</span>`; };
const clauseIcon = c => c.status === "met" ? "✅" : c.status === "failed" ? "❌" : "⏳";
function sponsorModal(o, intro) {
  SP = o;
  o.clauses = sponsorClauses(o);
  const e = ETHIC[o.ethic || "neutre"], C = o.clauses, last = o.history[o.history.length - 1];
  const hist = o.history.map((h, i) => `<li>Tour ${i + 1} : vous demandez ${money(h.ask)}/sem sur ${h.weeks} sem.</li>`).join("");
  const lv = C.levels.map((l, i) => `<label class="clause-opt ${i === (o.level ?? 1) ? "sel" : ""}"><input type="radio" name="sp-level" value="${i}" ${i === (o.level ?? 1) ? "checked" : ""} data-change="sp-level"> <b>${l.label}</b> : finir ${l.target === 1 ? "1er" : "dans le top " + l.target} · prime <b data-bonus="${[0.12, 0.25, 0.5][i]}">${money(l.bonus)}</b></label>`).join("");
  modal(`<div class="brand-head">${brandLogo(o.brand, true)}<div><h2 style="margin:0">${esc(o.brand)}</h2><div class="muted">${esc(o.sector || "")} · marque ${(BRAND_SIZE[o.size] || "").toLowerCase()}e · <span class="${e[2]}">${e[0]} ${e[1]}</span></div></div></div>
    <p>${intro}</p>
    <p class="${e[2]}" style="font-size:13px">${o.ethic === "controverse" ? "Très bien payé, mais l'image du club va se dégrader : vos victoires rapporteront moins de fans, vos défaites en feront partir plus, et des fans partiront chaque semaine." : o.ethic === "ethique" ? "Un peu moins payé, mais l'image du club s'améliore : vos victoires attireront plus de fans." : "Sans effet sur l'image du club."}</p>
    <div class="offer"><div><span class="muted">Offre de la marque</span><b>${money(o.weekly)}/sem</b></div><div><span class="muted">Durée proposée</span><b>${o.weeks} semaines</b></div><div><span class="muted">Total de son offre</span><b>${money(o.weekly * o.weeks)}</b></div>${last ? `<div><span class="muted">Votre dernière demande</span><b>${money(last.ask)}/sem</b></div>` : ""}</div>
    ${lv ? `<h3 style="margin:14px 0 6px">Clause d'objectif (${GAMES[C.game].icon} ${esc(divName(S.userId, C.game))})</h3><div class="clause-list">${lv}</div><p class="muted" style="font-size:12px;margin-top:4px">Les primes dépendent du montant et de la durée du contrat (elles suivent votre proposition ci-dessous). Plus l'objectif est ambitieux, plus la prime est grosse et plus la marque accepte de payer cher. Objectif atteint : prime versée et proposition de renouvellement. Objectif manqué : pas de prime, pas de renouvellement.</p>` : ""}
    ${C.extra.length ? `<div class="clause-list">${C.extra.map(x => `<div class="clause-opt">➕ ${esc(x.label)} · prime <b data-xbonus="${x.kind === "title" ? 6 : 4}">${money(x.bonus)}</b></div>`).join("")}</div>` : ""}
    ${hist ? `<ul class="muted" style="font-size:13px">${hist}</ul>` : ""}
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:10px">
      <div class="form-row" style="flex:1;min-width:140px"><label for="sp-ask">Montant par semaine (€)</label><input id="sp-ask" type="number" step="50" min="0" value="${o.weekly}" data-input="sp-preview"></div>
      <div class="form-row"><label for="sp-weeks">Durée</label><select id="sp-weeks" data-change="sp-preview">${[...new Set([13, 20, 26, 39, 52, o.weeks])].sort((a, b) => a - b).map(w => `<option value="${w}" ${w === o.weeks ? "selected" : ""}>${w} semaines</option>`).join("")}</select></div>
    </div>
    <p id="sp-sum" style="margin:4px 0"></p>
    <p class="muted" style="font-size:12px">Gardez le montant et la durée de la marque pour accepter son offre, ou changez-les pour faire une contre-proposition. Demander trop peut la faire fuir ; un contrat plus long rapporte plus au total, mais la marque paiera un peu moins par semaine.</p>
    <div class="actions"><button data-act="sp-refuse">Refuser</button><button class="primary" id="sp-main" data-act="sp-main">Accepter ${money(o.weekly)}/sem</button></div>`);
  spPreview();
}
// tout reste raccord avec ce qui est tapé : bouton, total et primes
function spPreview() {
  if (!SP) return;
  const ask = Math.max(0, +document.getElementById("sp-ask").value || 0), weeks = +document.getElementById("sp-weeks").value, same = ask === SP.weekly && weeks === SP.weeks;
  const btn = document.getElementById("sp-main"); if (!btn) return;
  btn.textContent = same ? `Accepter ${money(ask)}/sem` : `Proposer ${money(ask)}/sem sur ${weeks} sem.`;
  document.getElementById("sp-sum").innerHTML = `${same ? "Offre de la marque" : "Votre proposition"} : <b>${money(ask)}/sem × ${weeks} semaines = ${money(ask * weeks)}</b>`;
  document.querySelectorAll("[data-bonus]").forEach(el => el.textContent = money(round50(ask * weeks * +el.dataset.bonus)));
  document.querySelectorAll("[data-xbonus]").forEach(el => el.textContent = money(round50(ask * +el.dataset.xbonus)));
}
ACTIONS["sp-main"] = () => {
  const ask = Math.max(0, +document.getElementById("sp-ask").value || 0), weeks = +document.getElementById("sp-weeks").value;
  if (ask === SP.weekly && weeks === SP.weeks) return ACTIONS["sp-accept"]();
  ACTIONS["sp-counter"]();
};
document.addEventListener("input", e => { if (e.target.dataset && e.target.dataset.input === "sp-preview") spPreview(); });
const spLevel = () => { const el = document.querySelector('input[name="sp-level"]:checked'); return el ? +el.value : (SP.level ?? 1); };
ACTIONS["sp-accept"] = () => { SP.level = spLevel(); signSponsor(SP, SP.weekly, SP.weeks); toast(`Contrat ${SP.brand} signé !`); SP = null; save(); render(); ACTIONS["next-event"](); };
ACTIONS["sp-refuse"] = () => { mail(`Offre déclinée : ${SP.brand}`, `Vous avez refusé l'offre de ${SP.brand} (${money(SP.weekly)}/sem).`, "sponsor"); SP = null; save(); render(); ACTIONS["next-event"](); };
ACTIONS["sp-counter"] = () => {
  const ask = +document.getElementById("sp-ask").value, weeks = +document.getElementById("sp-weeks").value;
  const r = negotiateSponsor(SP, ask, weeks, spLevel());
  if (r.status === "accept") { signSponsor(SP, r.weekly, r.weeks); toast(`${SP.brand} accepte : ${money(r.weekly)}/sem !`); SP = null; save(); render(); return ACTIONS["next-event"](); }
  if (r.status === "walk") { mail(`Négociation rompue : ${SP.brand}`, `${SP.brand} a mis fin aux discussions.`, "sponsor"); toast(`${SP.brand} quitte la table des négociations.`); SP = null; save(); render(); return ACTIONS["next-event"](); }
  sponsorModal(SP, `<b>${esc(SP.brand)}</b> fait une contre-proposition.${r.last ? " <b class='warn'>La marque prévient que c'est sa dernière offre.</b>" : ""}`);
};
// fiche détaillée d'une marque
const bigNum = n => n >= 1e9 ? (n / 1e9).toFixed(1).replace(".", ",") + " Md€" : money(n);
const fmtFollowers = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace(".", ",") + " M" : n >= 1e3 ? Math.round(n / 1e3) + " k" : String(n);
function brandModal(name) {
  const b = brandStats(name), u = user(), e = ETHIC[b.ethic], deal = u.sponsorDeals.find(d => d.name === name);
  const interested = S.sponsorMarket && S.sponsorMarket.list.find(x => x.brand === name);
  const cd = S.brandCooldown && S.brandCooldown[name] > nowIndex(), ch = Math.round(contactChance(name) * 100);
  const req = (ok, txt) => `<div class="${ok ? "ok" : "bad"}">${ok ? "✅" : "❌"} ${txt}</div>`;
  const kpi = (label, val, sub) => `<div class="card brand-kpi"><span class="muted">${label}</span><b>${val}</b>${sub ? `<small class="muted">${sub}</small>` : ""}</div>`;
  modal(`<div class="brand-head">${brandLogo(b.brand, true)}<div><h2 style="margin:0">${esc(b.brand)}</h2><div class="muted">${esc(b.sector)} · marque ${BRAND_SIZE[b.size].toLowerCase()}e · <span class="${e[2]}">${e[0]} ${e[1]}</span></div></div></div>
    <div class="brand-kpis">
      ${kpi("Chiffre d'affaires", bigNum(b.revenue), `croissance ${b.growth >= 0 ? "+" : ""}${b.growth} %/an`)}
      ${kpi("Bénéfice net", bigNum(b.profit), `marge ${Math.round(b.margin * 100)} %`)}
      ${kpi("Abonnés (réseaux sociaux)", fmtFollowers(b.followers), "toutes plateformes")}
      ${kpi("Budget esport annuel", bigNum(b.esport), "tous clubs confondus")}
    </div>
    <div class="grid g2" style="margin-top:12px">
      <div><h3>Profil</h3><p style="margin:0">Cible : ${esc(b.audience)}.<br>Jeux qui l'intéressent : ${b.games.map(g => GAMES[g] ? gchip(g) : "").join(" ")}<br>
        Déjà partenaire de : ${b.partners.length ? b.partners.map(c => `<span class="link" data-act="club-info" data-v="${c.id}">${esc(c.name)}</span>`).join(", ") : "aucun club pour l'instant"}.</p>
        <p class="${e[2]}" style="font-size:13px">${b.ethic === "controverse" ? "Paie très bien, mais associer le club à cette marque dégrade son image : moins de fans gagnés après les victoires, plus de fans perdus après les défaites." : b.ethic === "ethique" ? "Paie un peu moins, mais améliore l'image du club : vos victoires attirent plus de fans." : "Sans effet sur l'image du club."}</p></div>
      <div><h3>Pour votre club</h3>
        ${req(u.fame >= b.minFame, `Notoriété ${b.minFame ? "≥ " + b.minFame : "sans minimum"} (vous : ${u.fame.toFixed(0)}/100)`)}
        ${b.minImage ? req((u.image ?? 60) >= b.minImage, `Image du club ≥ ${b.minImage} (vous : ${Math.round(u.image ?? 60)})`) : ""}
        ${req(b.games.some(g => u.divisions[g]), `Présent dans un des jeux visés`)}
        ${b.size >= 2 ? req(!sectorRival(b.brand), sectorRival(b.brand) ? `Exclusivité : pas de concurrent du secteur (vous avez ${esc(sectorRival(b.brand))})` : `Exclusivité : pas de concurrent du secteur ${esc(b.sector)}`) : ""}
        <p style="margin:8px 0 0">Offre estimée : <b>${money(b.offer[0])} à ${money(b.offer[1])}/sem</b><br>Chances qu'elle accepte un rendez-vous : <b class="${ch >= 50 ? "ok" : ch >= 20 ? "warn" : "bad"}">${ch} %</b></p></div>
    </div>
    ${deal ? `<p class="ok">🤝 Partenaire du club : ${money(deal.weekly)}/sem, encore ${deal.weeks} semaine(s).</p>` : ""}
    <p class="muted" style="font-size:11px">Chiffres indicatifs estimés par le jeu, pas des données officielles de la marque.</p>
    <div class="actions"><button data-act="close-modal">Fermer</button>
      ${deal ? "" : interested ? `<button class="danger" data-act="sp-decline" data-v="${esc(name)}">✕ Refuser</button><button class="primary" data-act="sp-talk" data-v="${esc(name)}">🤝 Négocier (elle est intéressée)</button>` : cd ? `<button disabled>A refusé récemment</button>` : `<button class="primary" data-act="sp-contact" data-v="${esc(name)}">📞 Contacter (${ch} %)</button>`}</div>`);
}
ACTIONS["brand-info"] = v => brandModal(v);
// refuser une marque intéressée : elle sort de la liste et ne revient pas avant 8 semaines
ACTIONS["sp-decline"] = v => { S.sponsorMarket.list = S.sponsorMarket.list.filter(x => x.brand !== v); S.brandCooldown = S.brandCooldown || {}; S.brandCooldown[v] = nowIndex() + 8; mail(`Offre déclinée : ${v}`, `Vous avez décliné l'intérêt de ${v}.`, "sponsor"); toast(`${v} : offre déclinée.`); closeModal(); scheduleSave(); render(); };
// ---------- explications simples : notoriété et budget ----------
const fameLevel = f => f >= 80 ? "Club de référence mondiale" : f >= 55 ? "Club reconnu à l'international" : f >= 25 ? "Club connu dans son pays" : "Club local, encore peu connu";
function fameModal() {
  const u = user(), f = u.fame, games = Object.keys(u.divisions);
  modal(`<h2>⭐ Notoriété : ${Math.round(f)}/100</h2><p class="muted" style="margin-top:-6px">${fameLevel(f)}. La notoriété va de 0 (club inconnu) à 100 (les plus grands clubs du monde, comme T1 ou Vitality).</p>
    ${bar(f)}
    <h3 style="margin-top:14px">À quoi elle sert</h3>
    <ul class="explain">
      <li><b>Mercato</b> : un joueur trop fort pour votre club refuse de discuter. Dans chaque jeu, les joueurs notés jusqu'à : ${games.length ? games.map(g => `${GAMES[g].icon} ${GAMES[g].short} <b>${interestMax(g)}</b>`).join(" · ") : `<b>${Math.min(99, Math.floor(f + 70))}</b>`}. Jouer en tier 1 (+20) ou en tier 2 (+8) dans un jeu y ouvre des joueurs plus forts.</li>
      <li><b>Sponsors</b> : ${f >= 55 ? "les marques internationales (Red Bull, Logitech…) s'intéressent à vous" : f >= 25 ? "les marques nationales s'intéressent à vous ; les internationales à partir de 55/100" : "seuls les commerces locaux s'intéressent à vous ; les marques nationales à partir de 25/100"}. Une notoriété élevée fait aussi monter les montants proposés.</li>
      <li><b>Divisions</b> : acheter une place en tier 1 ou 2 demande de la notoriété, plus dans les jeux très suivis. ${(games.length ? games : ["lol", "rl", "trackmania"]).filter(g => !GAMES[g].open).slice(0, 6).map(g => `${GAMES[g].icon} ${GAMES[g].short} : T2 <b>${fameReq(g, 2)}</b>, T1 <b>${fameReq(g, 1)}</b>`).join(" · ")}.</li>
      <li><b>Salaires</b> : une star demande plus cher à un club peu connu.</li>
    </ul>
    <h3>Comment la faire monter</h3>
    <ul class="explain"><li>Gagner des matchs (un peu à chaque victoire), des tournois et surtout des titres.</li><li>Recruter des stars (notées 80 et plus).</li><li>En fin de saison, elle se rapproche du niveau de votre meilleure division (tier 1 ≈ 75, tier 2 ≈ 40, tier 3 ≈ 15).</li><li>Les défaites et les polémiques la font baisser.</li></ul>
    <div class="actions"><button class="primary" data-act="close-modal">Compris</button></div>`);
}
function budgetModal() {
  const u = user(), fc = forecast(), games = Object.keys(u.divisions), limit = -Math.max(100000, u.fame * 8000);
  const wages = allUserPlayers().reduce((s, p) => s + p.salary, 0);
  modal(`<h2>💰 Comprendre le budget</h2>
    <div class="offer"><div><span class="muted">Argent disponible</span><b class="${u.budget < 0 ? "bad" : ""}">${money(u.budget)}</b></div><div><span class="muted">Solde par semaine (hors matchs)</span><b class="${fc.weekly < 0 ? "bad" : "ok"}">${fc.weekly >= 0 ? "+" : ""}${money(fc.weekly)}</b></div><div><span class="muted">Prévu à la mi-décembre</span><b class="${fc.end < 0 ? "bad" : ""}">${money(fc.end)}</b></div></div>
    <ul class="explain">
      <li><b>Le budget</b>, c'est l'argent du club aujourd'hui. Chaque semaine, il monte avec les sponsors, le merch et les cashprizes, et il baisse avec les salaires (${money(wages)}/sem), les frais des équipes, les entraîneurs et l'entretien des infrastructures.</li>
      <li><b>Solde par semaine</b> : ${fc.weekly >= 0 ? `sans compter les matchs, le club gagne environ ${money(fc.weekly)} par semaine.` : `sans compter les cashprizes, le club perd environ ${money(-fc.weekly)} par semaine : il faut gagner des tournois, trouver des sponsors ou réduire les salaires.`}</li>
      ${allocManual() ? `<li><b>Enveloppes mercato (mode manuel)</b> : en début de saison, vous réservez une partie du budget aux transferts de chaque jeu. Il reste : ${games.map(g => `${GAMES[g].icon} ${GAMES[g].short} <b>${money(Math.max(0, transferRoom(g)))}</b>`).join(" · ") || "—"}. Une signature qui dépasse l'enveloppe du jeu est refusée.</li>`
        : `<li><b>Argent du mercato (mode automatique)</b> : vous pouvez dépenser <b>${money(spendable())}</b>, c'est-à-dire le budget moins une réserve de ${money(clubReserve())} (${RESERVE_WEEKS} semaines de salaires). Une recrue doit pouvoir être payée ${WAGE_WEEKS} semaines avec l'argent restant. Un seul budget pour tous vos jeux.</li>`}
      <li><b>Dans le rouge</b> : un budget négatif coûte des intérêts chaque semaine. Sous ${money(limit)}, un administrateur judiciaire vend vos meilleurs joueurs, et au bout de 16 semaines le club fait faillite.</li>
    </ul>
    <div class="actions"><button data-act="close-modal">Fermer</button><button data-act="alloc">${allocManual() ? "⚖️ Répartir le budget mercato" : "⚙️ Mode de gestion du mercato"}</button><button class="primary" data-act="explain-go-fin">Voir les finances</button></div>`);
}
// confiance du conseil : ce qui la fait bouger et comment la remonter
function boardModal() {
  const c = S.board.confidence, o = S.board.objective, u = user();
  const lvl = c >= 75 ? "Le conseil vous fait pleinement confiance." : c >= 55 ? "Le conseil est serein." : c >= 30 ? "Le conseil commence à douter." : "Le conseil est à bout : votre poste est menacé.";
  modal(`<h2>🏛️ Confiance du conseil : ${Math.round(c)}%</h2><p class="muted" style="margin-top:-6px">${lvl} Le conseil d'administration juge votre travail de CEO. <b>À 0 %, vous êtes licencié</b> et la partie s'arrête.</p>
    ${bar(c)}
    <h3 style="margin-top:14px">L'objectif de la saison</h3>
    <p style="margin:0">${o ? `<b>${objectiveText(o)}</b>` : "Aucun objectif fixé pour l'instant."}<br><span class="muted" style="font-size:13px">Fixé par le conseil au début de chaque saison d'après votre meilleure division et votre notoriété.</span></p>
    <h3 style="margin-top:14px">Ce qui la fait bouger</h3>
    <ul class="explain">
      <li><b>Fin de saison</b> : objectif atteint <b class="ok">+20</b> ; manqué mais qualifié pour des playoffs <b class="bad">−8</b> ; manqué sans playoffs <b class="bad">−20</b>.</li>
      <li><b>Titres</b> : <b class="ok">+8</b> par championnat remporté dans la saison.</li>
      <li><b>Budget dans le rouge</b> : <b class="bad">−2 chaque semaine</b> tant que le budget est négatif${u.budget < 0 ? ` <b class="bad">(c'est le cas en ce moment : ${money(u.budget)})</b>` : ""}.</li>
      <li><b>Conférences de presse</b> : certaines réponses plaisent au conseil (fermeté, objectifs réalistes), d'autres l'inquiètent (promettre le titre, défendre un joueur fautif).</li>
      <li><b>Investisseurs</b> : faire entrer un investisseur au capital coûte <b class="bad">−10</b> ; refuser l'offre rapporte <b class="ok">+3</b>.</li>
    </ul>
    <h3>Comment l'augmenter</h3>
    <ul class="explain">
      <li>Viser d'abord l'<b>objectif de la saison</b> : c'est ce qui pèse le plus.</li>
      <li>Gagner des <b>titres</b> : chaque championnat remporté s'ajoute à l'objectif.</li>
      <li>Garder un <b>budget positif</b> : répartissez le budget mercato (onglet Finances) et évitez les salaires que vous ne pouvez pas payer.</li>
      <li>Soigner les <b>conférences de presse</b> : rester mesuré et sanctionner les écarts.</li>
      <li>Refuser les investisseurs quand vous n'avez pas besoin d'argent.</li>
    </ul>
    <div class="actions"><button data-act="close-modal">Fermer</button><button class="primary" data-act="explain-go-fin">Voir les finances</button></div>`);
}
ACTIONS["explain-board"] = () => boardModal();
ACTIONS["explain-fame"] = () => fameModal();
ACTIONS["explain-budget"] = () => budgetModal();
ACTIONS["explain-go-fin"] = () => { closeModal(); UI.view = "finance"; render(); };
// ---------- staff : un entraîneur par jeu ----------
const attrBar = v => `<span class="attr" title="${v}/20"><i style="width:${v * 5}%;background:${v >= 15 ? "var(--ok)" : v >= 10 ? "var(--accent2)" : v >= 6 ? "var(--warn)" : "var(--bad)"}"></i></span> <b>${v}</b>`;
function viewStaff() {
  const u = user(), games = Object.keys(u.divisions);
  if (!games.length) return `<h2>🧑‍🏫 Staff</h2><p class="muted">Ouvrez une division pour engager un entraîneur.</p>`;
  if (!UI.staffGame || !games.includes(UI.staffGame)) UI.staffGame = games[0];
  const g = UI.staffGame, cur = coachOf(g);
  const tabs = games.map(k => `<button class="tab ${k === g ? "active" : ""}" data-act="staff-game" data-v="${k}">${GAMES[k].icon} ${GAMES[k].short}${coachOf(k) ? " ✓" : ""}</button>`).join("");
  const card = cur ? `<div class="card"><div class="toolbar"><div style="flex:1"><h3 style="margin:0">Entraîneur ${GAMES[g].name} : ${flag(cur.nat)} ${esc(cur.name)}${cur.ex ? ` <span class="chip">ancien joueur pro</span>` : ""}</h3>
      <div class="muted">${cur.age} ans · niveau ${coachLevel(cur).toFixed(1)}/20 · ${money(cur.wage)}/sem${cur.won.length ? " · palmarès de joueur : " + cur.won.map(esc).join(", ") : ""}</div></div>
      <button class="small danger" data-act="coach-fire" data-v="${g}">Le licencier (${money(cur.wage * 8)})</button></div>
      <div class="coach-attrs">${Object.entries(COACH_ATTRS).map(([k, l]) => `<div><span class="muted">${l}</span>${attrBar(cur.attrs[k])}</div>`).join("")}</div>
      <p class="muted" style="font-size:13px;margin-bottom:0">Effets : tactique → niveau de l'équipe en match (+${(cur.attrs.tactique * 0.15).toFixed(1)}) · motivation → moral chaque semaine · formation des jeunes → progression des moins de 22 ans · gestion des egos → atténue les tensions entre joueurs.</p></div>`
    : `<div class="card"><h3>Pas d'entraîneur en ${GAMES[g].name}</h3><p class="muted">Sans entraîneur, l'équipe ne profite que des infrastructures. Engagez-en un ci-dessous : il améliore le niveau en match, le moral, la progression des jeunes et l'entente du groupe.</p></div>`;
  const list = Object.values(S.coaches || {}).filter(c => c.game === g && !c.club).sort((a, b) => coachLevel(b) - coachLevel(a));
  const rows = list.map(c => `<tr><td>${flag(c.nat)} <b>${esc(c.name)}</b>${c.ex ? ` <span class="chip" title="${c.won.length ? esc(c.won.join(", ")) : "Ancien joueur pro"}">ex-joueur</span>` : ""}</td><td>${c.age}</td>
    ${Object.keys(COACH_ATTRS).map(k => `<td>${attrBar(c.attrs[k])}</td>`).join("")}<td><b>${coachLevel(c).toFixed(1)}</b></td><td>${money(c.wage)}/sem</td><td>${money(c.wage * 6)}</td>
    <td><button class="small primary" data-act="coach-hire" data-v="${c.id}" ${u.budget < c.wage * 6 ? "disabled" : ""}>Engager</button></td></tr>`).join("");
  return `<h2>🧑‍🏫 Staff</h2><div class="tabs">${tabs}</div>${card}
    <div class="card" style="margin-top:16px"><h3>Entraîneurs disponibles (${GAMES[g].short})</h3><p class="muted" style="margin-top:-6px;font-size:13px">Notes sur 20, comme dans FM. Les meilleurs joueurs qui prennent leur retraite deviennent parfois entraîneurs : leur tactique vient de leur niveau, leur motivation et leur gestion des egos de leur caractère.</p>
    <div class="table-wrap"><table><tr><th>Entraîneur</th><th>Âge</th>${Object.values(COACH_ATTRS).map(l => `<th>${l}</th>`).join("")}<th>Niveau</th><th>Salaire</th><th>Prime d'arrivée</th><th></th></tr>${rows || "<tr><td colspan='10' class='muted'>Aucun entraîneur libre.</td></tr>"}</table></div></div>
    ${employedCoaches(g)}`;
}
// entraîneurs en poste dans les autres clubs : on peut tenter de les recruter (indemnité au club, puis il accepte ou non)
function employedCoaches(g) {
  const list = Object.values(S.coaches || {}).filter(c => c.game === g && c.club && c.club !== S.userId && S.clubs[c.club]).sort((a, b) => coachLevel(b) - coachLevel(a));
  const rows = list.map(c => { const cl = S.clubs[c.club], d = cl.divisions[g];
    return `<tr><td>${flag(c.nat)} <b>${esc(c.name)}</b>${c.ex ? ` <span class="chip">ex-joueur</span>` : ""}</td><td><span style="color:${cl.color}">■</span> <span class="link" data-act="club-info" data-v="${cl.id}">${esc(cl.name)}</span> ${d ? tchip(d.tier) : ""}</td>
      ${Object.keys(COACH_ATTRS).map(k => `<td>${attrBar(c.attrs[k])}</td>`).join("")}<td><b>${coachLevel(c).toFixed(1)}</b></td><td>${money(c.wage)}/sem</td><td>${c.years || 1} an(s)</td><td>${money(coachRelease(c))}</td>
      <td><button class="small" data-act="coach-poach" data-v="${c.id}">Faire une offre</button></td></tr>`; }).join("");
  return `<div class="card" style="margin-top:16px"><h3>Entraîneurs en poste dans d'autres clubs (${GAMES[g].short})</h3>
    <p class="muted" style="margin-top:-6px;font-size:13px">Vous payez une indemnité à son club, puis l'entraîneur décide : il regarde le prestige de votre club face au sien, le tier où vous jouez, le salaire et la durée proposés, et son attachement à son club actuel.</p>
    <div class="table-wrap" style="max-height:480px;overflow:auto"><table><tr><th>Entraîneur</th><th>Club</th>${Object.values(COACH_ATTRS).map(l => `<th>${l}</th>`).join("")}<th>Niveau</th><th>Salaire</th><th>Contrat</th><th>Indemnité</th><th></th></tr>${rows || "<tr><td colspan='11' class='muted'>Aucun.</td></tr>"}</table></div></div>`;
}
function poachModal(id, reply) {
  const c = S.coaches[id]; if (!c) return;
  const cl = S.clubs[c.club], fee = c.club ? coachRelease(c) : 0;
  modal(`<h2>🧑‍🏫 Offre à ${flag(c.nat)} ${esc(c.name)}</h2>
    <p class="muted" style="margin-top:-6px">Entraîneur ${GAMES[c.game].name} de ${cl ? esc(cl.name) : "—"} · ${c.age} ans · niveau ${coachLevel(c).toFixed(1)}/20 · ${money(c.wage)}/sem · encore ${c.years || 1} an(s) de contrat</p>
    <div class="coach-attrs">${Object.entries(COACH_ATTRS).map(([k, l]) => `<div><span class="muted">${l}</span>${attrBar(c.attrs[k])}</div>`).join("")}</div>
    ${reply ? `<div class="reply ${reply.ok ? "" : "bad"}">${esc(reply.msg)}</div>` : ""}
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <div class="form-row" style="flex:1;min-width:160px"><label for="co-wage">Salaire proposé (€/semaine)</label><input id="co-wage" type="number" step="50" min="0" value="${round50(c.wage * 1.3)}"></div>
      <div class="form-row"><label for="co-years">Durée</label><select id="co-years">${[1, 2, 3, 4].map(y => `<option value="${y}" ${y === 2 ? "selected" : ""}>${y} an${y > 1 ? "s" : ""}</option>`).join("")}</select></div>
    </div>
    <p>Indemnité à verser à ${cl ? esc(cl.name) : "son club"} : <b>${money(fee)}</b> · prime d'arrivée : 6 semaines du salaire proposé.</p>
    <div class="actions"><button data-act="close-modal">Annuler</button><button class="primary" data-act="coach-poach-send" data-v="${c.id}">Envoyer l'offre</button></div>`);
}
ACTIONS["coach-poach"] = v => poachModal(v);
ACTIONS["coach-poach-send"] = v => {
  const r = poachCoach(v, Math.max(0, +document.getElementById("co-wage").value || 0), +document.getElementById("co-years").value);
  if (r.error) return toast(r.error);
  if (r.ok) { closeModal(); toast("🧑‍🏫 " + r.msg); scheduleSave(); return render(); }
  scheduleSave(); render(); poachModal(v, r);
};
ACTIONS["staff-game"] = v => { UI.staffGame = v; render(); };
ACTIONS["coach-hire"] = v => { const e = hireCoach(v); toast(e || "🧑‍🏫 Entraîneur engagé !"); scheduleSave(); render(); };
ACTIONS["coach-fire"] = v => { fireCoach(v); toast("Entraîneur licencié."); scheduleSave(); render(); };
// ---------- sponsors (onglet) ----------
// audience et profil de sponsors des jeux du club : ce qui fixe le montant des offres et le type de marques
function ecoCard() {
  const u = user(), gs = Object.keys(u.divisions); if (!gs.length) return "";
  const mg = mainGame(), lvl = v => v >= 60 ? "très forte" : v >= 30 ? "forte" : v >= 12 ? "moyenne" : "faible";
  const rows = gs.sort((a, b) => ecoOf(b).view - ecoOf(a).view).map(g => { const e = ecoOf(g), d = u.divisions[g];
    return `<tr class="${g === mg ? "me" : ""}"><td>${gchip(g)}${g === mg ? " <small class='muted'>jeu phare</small>" : ""}</td><td>${lvl(e.view)} ${bar(Math.min(100, e.view))}</td><td>${tchip(d.tier, g)}</td>
      <td><span class="ok">🌱 ${Math.round(e.eth * 100)} %</span> · 🤝 ${Math.round((1 - e.eth - e.bet) * 100)} % · <span class="bad">🎰 ${Math.round(e.bet * 100)} %</span></td><td>×${e.spon.toFixed(2)}</td></tr>`; }).join("");
  return `<details class="fold" ${UI.ecoOpen ? "open" : ""} data-fold="ecoOpen"><summary>📺 Audience et sponsors de vos jeux <span class="muted">(jeu phare : ${GAMES[mg] ? GAMES[mg].name : "—"})</span></summary>
    <p class="muted" style="font-size:13px">Le montant des offres dépend de vos sections : leur tier, l'audience du jeu et son attrait pour les marques. Le type de marques qui vous contactent suit le profil de votre jeu phare : beaucoup de paris et de crypto en CS2 ou Dota, des marques grand public et éthiques en LoL, Rocket League ou Fortnite. Une marque paie aussi plus si vous jouez aux jeux qu'elle vise. La valeur et le salaire des joueurs suivent l'audience du jeu et le tier de leur club.</p>
    <div class="table-wrap"><table><tr><th>Jeu</th><th>Audience</th><th>Tier</th><th>Sponsors (éthiques · classiques · paris/crypto)</th><th>Attrait marques</th></tr>${rows}</table></div></details>`;
}
function viewSponsors() {
  const u = user();
  if (!S.sponsorMarket) refreshSponsorMarket();
  if (!UI.spFilter) UI.spFilter = { ethic: "all", size: "reach" };
  const F = UI.spFilter, reach = brandReach();
  const deals = u.sponsorDeals.map(d => {
    const e = ETHIC[d.ethic || "neutre"], done = d.total ? 1 - d.weeks / d.total : 0;
    const cl = (d.clauses || []).map(c => { const prog = c.kind === "rank" ? (leagueRank(c.game) ? ` · actuellement ${leagueRank(c.game)}e` : "") : c.kind === "fans" && c.pos !== undefined ? ` · ${c.pos >= 0 ? "+" : ""}${c.pos} % pour l'instant` : "";
      return `<div class="clause ${c.status}">${clauseIcon(c)} ${esc(c.label)} · prime ${money(c.bonus)}<span class="muted">${c.status === "pending" ? prog : ""}</span>${clauseRisk(d, c) ? ` <b class="bad" title="${esc(clauseRisk(d, c))}">⚠️ non respectée</b>` : c.status === "pending" ? ` <span class="ok">✓ en bonne voie</span>` : ""}</div>`; }).join("");
    return `<div class="card sp-card"><div class="brand-head link-row" data-act="brand-info" data-v="${esc(d.name)}">${brandLogo(d.name)}<div style="min-width:0"><b class="link">${esc(d.name)}</b><div class="muted" style="font-size:12px">${esc(d.sector || "")} · <span class="${e[2]}">${e[0]} ${e[1]}</span>${d.renewals ? ` · renouvelé ${d.renewals}×` : ""}</div></div><div class="sp-amt">${money(d.weekly)}<small>/sem</small></div></div>
      <div style="margin:8px 0 4px;font-size:12px" class="${d.weeks <= 4 ? "warn" : "muted"}">${d.weeks} semaine(s) restante(s) sur ${d.total || d.weeks} · ${money(d.weekly * d.weeks)} à venir${d.renew === "yes" ? " · prolongation acceptée" : d.renew === "no" ? " · ne sera pas renouvelé" : d.renew === "refused" ? " · la marque ne prolonge pas" : d.weeks <= 4 ? " · décision de renouvellement 2 semaines avant la fin" : ""}</div>${bar(Math.round(done * 100), "var(--accent2)")}
      ${cl ? `<div style="margin-top:8px">${cl}</div>` : "<p class='muted' style='font-size:12px'>Aucune clause d'objectif.</p>"}</div>`;
  }).join("");
  const market = S.sponsorMarket.list.filter(x => !u.sponsorDeals.some(d => d.name === x.brand)).map(x => {
    const b = brandOf(x.brand), e = ETHIC[b.ethic];
    return `<div class="card sp-card"><div class="brand-head link-row" data-act="brand-info" data-v="${esc(b.brand)}">${brandLogo(b.brand)}<div style="min-width:0"><b class="link">${esc(b.brand)}</b><div class="muted" style="font-size:12px">${esc(b.sector)} · ${BRAND_SIZE[b.size]} · <span class="${e[2]}">${e[0]} ${e[1]}</span></div></div></div>
      <div style="margin:8px 0;font-size:13px">Intérêt ${bar(x.interest, "var(--ok)")} ${x.interest} %</div>
      <button class="small primary" data-act="sp-talk" data-v="${esc(b.brand)}">🤝 Négocier</button> <button class="small" data-act="brand-info" data-v="${esc(b.brand)}">🔍 Détails</button> <button class="small danger" data-act="sp-decline" data-v="${esc(b.brand)}">✕ Refuser</button></div>`;
  }).join("");
  const list = BRANDS.filter(b => !u.sponsorDeals.some(d => d.name === b[0]) && (F.ethic === "all" || b[2] === F.ethic) && (F.size === "all" || (F.size === "reach" ? b[3] <= reach + 1 : b[3] === +F.size)))
    .sort((a, b) => b[3] - a[3] || a[0].localeCompare(b[0]))
    .map(b => { const ch = Math.round(contactChance(b[0]) * 100), e = ETHIC[b[2]], cd = S.brandCooldown && S.brandCooldown[b[0]] > nowIndex();
      return `<tr><td class="link-row" data-act="brand-info" data-v="${esc(b[0])}" data-sort="${esc(b[0].toLowerCase())}">${brandLogo(b[0])} <b class="link">${esc(b[0])}</b></td><td class="muted">${esc(b[1])}</td><td>${BRAND_SIZE[b[3]]}</td><td class="${e[2]}">${e[0]} ${e[1]}</td><td><span class="${ch >= 50 ? "ok" : ch >= 20 ? "warn" : "bad"}">${ch} %</span></td>
        <td>${sectorRival(b[0]) ? `<span class="muted" title="Exclusivité de secteur">🚫 concurrent de ${esc(sectorRival(b[0]))}</span>` : cd ? "<span class='muted'>a refusé récemment</span>" : `<button class="small" data-act="sp-contact" data-v="${esc(b[0])}">📞 Contacter</button>`}</td></tr>`; }).join("");
  const opt = (k, cur, list) => list.map(([v, l]) => `<option value="${v}" ${cur === v ? "selected" : ""}>${l}</option>`).join("");
  return `<h2>🤝 Sponsors</h2>${ecoCard()}
    <div class="grid g3">
      <div class="card"><h3>Revenus sponsors</h3><div class="kpi">${money(u.sponsorDeals.reduce((s, d) => s + d.weekly, 0))}<span class="muted" style="font-size:14px">/sem</span></div><div class="muted">${u.sponsorDeals.length} partenaire(s) · hors partenaires historiques et droits</div></div>
      <div class="card"><h3>Image du club</h3><div class="kpi">${imageTxt(u.image ?? 60)} <span class="muted" style="font-size:14px">${Math.round(u.image ?? 60)}/100</span></div>${bar(u.image ?? 60)}</div>
      <div class="card"><h3>Attractivité</h3><div class="kpi">${BRAND_SIZE[reach]}</div><div class="muted">Notoriété ${u.fame.toFixed(0)}/100 : les marques ${BRAND_SIZE[reach].toLowerCase()}es s'intéressent à vous${reach < 3 ? ` (marques ${BRAND_SIZE[reach + 1].toLowerCase()}es à partir de ${reach === 1 ? 25 : 55} de notoriété)` : ""}.</div></div>
    </div>
    <h3 style="margin-top:20px">Vos partenaires</h3><div class="sp-grid">${deals || "<p class='muted'>Aucun partenaire pour l'instant.</p>"}</div>
    <h3 style="margin-top:20px">Marques intéressées par le club</h3><p class="muted" style="margin-top:-6px;font-size:13px">Elles vous ont contacté : la discussion est assurée. La liste change toutes les 4 semaines.</p><div class="sp-grid">${market || "<p class='muted'>Aucune marque pour le moment.</p>"}</div>
    <div class="card" style="margin-top:20px"><div class="toolbar"><h3 style="margin:0;flex:1">Démarcher une marque</h3>
      <select data-change="sp-f-ethic" aria-label="Type de marque">${opt("e", F.ethic, [["all", "Toutes les marques"], ["ethique", "🌱 Éthiques"], ["neutre", "🤝 Classiques"], ["controverse", "🎰 Controversées"]])}</select>
      <select data-change="sp-f-size" aria-label="Taille">${opt("s", F.size, [["reach", "À ma portée"], ["all", "Toutes tailles"], ["1", "Locales"], ["2", "Nationales"], ["3", "Internationales"]])}</select></div>
      <p class="muted" style="margin-top:-4px;font-size:13px">Votre équipe commerciale peut contacter 2 marques par semaine. Une marque trop grande pour votre notoriété refuse presque toujours ; les marques éthiques regardent l'image du club. Une marque qui refuse ne peut pas être recontactée avant 8 semaines.</p>
      <div class="table-wrap"><table><tr><th>Marque</th><th>Secteur</th><th>Taille</th><th>Éthique</th><th>Chances</th><th></th></tr>${list}</table></div></div>`;
}
ACTIONS["sp-talk"] = v => { S.sponsorMarket.list = S.sponsorMarket.list.filter(x => x.brand !== v); const rv = sectorRival(v); if (rv) { toast(`${v} exige l'exclusivité dans son secteur : vous êtes déjà partenaire de ${rv}.`); return render(); } sponsorModal(sponsorOffer(v), `<b>${esc(v)}</b> s'intéresse à votre club et vous propose un partenariat.`); };
ACTIONS["sp-contact"] = v => { const r = contactBrand(v); if (r.error) { toast(r.error); return render(); } sponsorModal(r.offer, `<b>${esc(v)}</b> accepte de vous rencontrer et fait une première offre.`); };
ACTIONS["prospect"] = () => { UI.view = "sponsors"; render(); };

// ---------- boucle hebdomadaire ----------
let pendingEvents = [];
window.addEventListener("error", e => { try { toast("⚠️ Erreur : " + (e.message || e)); } catch (x) { } });
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
// résultats d'une semaine, une ligne par match, dans l'ordre des dates : date · jeu · victoire/défaite · score · adversaire
function resultsHtml(r) {
  const season = r.season || S.season, items = [];
  for (const m of r.matches) {
    const meA = isMine(m.a), me = meA ? m.a : m.b, opp = meA ? m.b : m.a, won = m.winner === me, my = meA ? m.sa : m.sb, their = meA ? m.sb : m.sa;
    const [comp, stage] = (m.stage || "").split(" — ");
    items.push({ k: (m.week || r.week || 0) * 10 + (m.dd ?? 5), html: `<div class="res-row ${won ? "w" : "l"}"><div class="res-date">${m.week ? dayLabel(season, m.week, m.dd ?? 5) : ""}</div>
      <div class="res-main"><div class="res-title"><span class="res-badge">${won ? "V" : "D"}</span> <b>${my}-${their}</b> contre <b>${displayName(opp, m.game)}</b>${me !== S.userId ? ` <small class="muted">(${displayName(me, m.game)})</small>` : ""}</div>
      <div class="muted res-sub">${GAMES[m.game].icon} ${esc(comp || "")}${stage ? " · " + esc(stage) : ""} · BO${m.bestOf}${m.maps && m.maps.length ? " · " + m.maps.join(", ") : ""}${m.mvp ? " · MVP " + esc(m.mvp) : ""}${m.rk ? (won ? ` · <b class="ok">classement +${m.rk.win} pts</b>` : ` · <b class="bad">classement ${m.rk.loss} pts</b>`) : ""}</div>
      ${(meA ? m.notesA : m.notesB) ? `<details class="res-notes"><summary>Notes des joueurs</summary>${notesLine(meA ? m.notesA : m.notesB)}</details>` : ""}</div></div>` });
  }
  for (const l of r.lobbies) {
    const good = l.rank <= 3;
    items.push({ k: (l.week || r.week || 0) * 10 + (l.dd ?? 6), html: `<div class="res-row ${good ? "w" : l.rank <= Math.ceil(l.lobby / 2) ? "n" : "l"}"><div class="res-date">${l.week ? dayLabel(season, l.week, l.dd ?? 6) : ""}</div>
      <div class="res-main"><div class="res-title"><span class="res-badge">${l.rank}e</span> <b>${l.mine.pts} pts</b> · ${l.mine.kills} élim. · places ${l.mine.places.map(p => p === 1 ? "👑" : p).join(", ")}${l.club !== S.userId ? ` <small class="muted">(${displayName(l.club, l.game)})</small>` : ""}</div>
      <div class="muted res-sub">${GAMES[l.game].icon} ${esc(l.stage)} · lobby de ${l.lobby} ${GAMES[l.game].unit}s</div>
      ${l.notes && l.notes[l.club] ? `<details class="res-notes"><summary>Notes des joueurs</summary>${notesLine(l.notes[l.club])}</details>` : ""}</div></div>` });
  }
  for (const t of r.tournaments) items.push({ k: (t.week || r.week || 0) * 10 + 7, html: `<div class="res-row ${t.place === 1 ? "w trophy" : "n"}"><div class="res-date">${t.week ? dayLabel(season, t.week, 6) : ""}</div>
      <div class="res-main"><div class="res-title">${t.place === 1 ? "🏆 <b>VAINQUEUR</b>" : `<span class="res-badge">${t.place}e</span> sur ${t.n}`} · <b>${esc(t.name)}</b>${t.prize ? ` · <b class="ok">+${money(t.prize)}</b>` : ""}</div>
      ${t.quals && t.quals.length > 1 ? t.quals.map(q => `<div class="res-qual">${displayName(q.id, t.game)} (${q.place}e) : ${qualBadge(q)}</div>`).join("") : t.qual ? `<div class="res-qual">${qualBadge(t.qual)}</div>` : ""}${!(t.quals && t.quals.length > 1) && t.others && t.others.length ? `<div class="res-qual muted">Vos autres engagés : ${t.others.map(([id, pl]) => `${displayName(id, t.game)} <b>${pl}e</b>`).join(" · ")}</div>` : ""}<div class="muted res-sub">${GAMES[t.game].icon} Bilan du tournoi${t.place > 1 ? ` · vainqueur : ${displayName(t.winner, t.game)}` : ""}</div></div></div>` });
  return items.sort((a, b) => a.k - b.k).map(x => x.html).join("");
}
// victoire en tournoi ou titre : confettis et gains, comme un pari gagnant
function celebrate(reps) {
  const wins = reps.flatMap(r => r.tournaments.filter(t => t.place === 1)), titles = reps.flatMap(r => r.fans.filter(([l]) => l.startsWith("🏆 Titre")));
  if (!wins.length && !titles.length) return;
  // tous les trophées de la semaine (tournois et titres de ligue), affichés ensemble
  const list = wins.map(t => ({ ic: t.world ? "🌍" : "🏆", g: t.game, name: t.name, prize: t.prize })).concat(titles.map(([l]) => ({ ic: "🥇", name: l.replace("🏆 Titre : ", "") })));
  const world = wins.find(t => t.world);
  if (world) return worldCelebrate(world, list);
  const gain = wins.reduce((s, t) => s + t.prize, 0), name = list.length > 1 ? `${list.length} TITRES CETTE SEMAINE !` : list[0].name;
  const box = document.createElement("div"); box.className = "celebrate";
  const colors = ["#ffd166", "#06d6a0", "#ef476f", "#118ab2", "#7c5cff", "#00d4ff", "#ff9f1c"];
  box.innerHTML = Array.from({ length: 140 }, () => `<i style="left:${Math.random() * 100}%;background:${pick(colors)};animation-delay:${(Math.random() * 0.8).toFixed(2)}s;animation-duration:${(2.2 + Math.random() * 1.6).toFixed(2)}s;transform:rotate(${randi(0, 360)}deg)"></i>`).join("")
    + `<div class="celebrate-card"><div class="cel-cup">🏆</div><div class="cel-title">${esc(name)}</div>${gain ? `<div class="cel-amount" data-to="${Math.round(gain)}">+0 €</div>` : `<div class="cel-amount">CHAMPIONS !</div>`}${list.length > 1 ? trophyList(list) : ""}<div class="muted">Cliquez pour continuer</div></div>`;
  document.body.appendChild(box);
  const amt = box.querySelector(".cel-amount[data-to]");
  if (amt) { const to = +amt.dataset.to, t0 = performance.now(); const step = t => { const k = Math.min(1, (t - t0) / 1400); amt.textContent = "+" + money(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }
  box.addEventListener("click", () => box.remove());
  setTimeout(() => box.remove(), list.length > 1 ? 7000 : 4500);
}
// titre mondial : grande animation plein écran (rayons dorés, feux d'artifice, pluie de confettis, l'équipe championne)
const trophyList = list => `<div class="cel-list">${list.map(x => `<div class="cel-item">${x.ic} ${x.g && GAMES[x.g] ? GAMES[x.g].icon + " " : ""}<b>${esc(x.name)}</b>${x.prize ? ` <span class="ok">+${money(x.prize)}</span>` : ""}</div>`).join("")}</div>`;
function worldCelebrate(t, list) {
  const others = (list || []).filter(x => x.name !== t.name), count = (list || []).length;
  const g = GAMES[t.game], u = user();
  const roster = clubPlayers(t.winner, t.game).filter(p => p.starter || unitGame(t.game)).concat(unitGame(t.game) ? unitMates(t.winner, t.game) : []).slice(0, 8);
  const gold = ["#ffd166", "#ffe8a3", "#f4b400", "#fff3c4", "#ffb703"], colors = gold.concat(["#06d6a0", "#ef476f", "#7c5cff", "#00d4ff"]);
  const box = document.createElement("div"); box.className = "celebrate world-cel";
  const fw = Array.from({ length: 9 }, (_, i) => { const x = randi(8, 92), y = randi(8, 50), c = pick(colors);
    return `<div class="fw" style="left:${x}%;top:${y}%;animation-delay:${(0.4 + i * 0.55).toFixed(2)}s">${Array.from({ length: 18 }, (_, k) => `<b style="--a:${k * 20}deg;background:${c}"></b>`).join("")}</div>`; }).join("");
  box.innerHTML = `<div class="wc-rays"></div>${fw}`
    + Array.from({ length: 260 }, () => `<i style="left:${Math.random() * 100}%;background:${pick(colors)};animation-delay:${(Math.random() * 4).toFixed(2)}s;animation-duration:${(2.6 + Math.random() * 2.4).toFixed(2)}s;transform:rotate(${randi(0, 360)}deg)"></i>`).join("")
    + `<div class="wc-card"><div class="wc-kicker">${g.icon} ${esc(g.name)} · ${S.season}</div>
      <div class="wc-cup">🏆</div><div class="wc-big">CHAMPIONS DU MONDE</div>
      <div class="wc-name">${esc(t.name)}</div><div class="wc-team">${displayName(t.winner, t.game)}</div>
      ${roster.length ? `<div class="wc-roster">${roster.map(p => `<span>${flag(p.nat)} ${esc(p.handle)}</span>`).join("")}</div>` : ""}
      ${t.prize ? `<div class="cel-amount" data-to="${Math.round(t.prize)}">+0 €</div>` : ""}
      ${others.length ? `<div class="muted" style="margin-bottom:4px">Et aussi cette semaine :</div>${trophyList(others)}` : ""}<div class="muted">${count > 1 ? `${count} trophées cette semaine · ` : ""}${esc(u.name)} entre dans l'histoire · cliquez pour continuer</div></div>`;
  document.body.appendChild(box);
  const amt = box.querySelector(".cel-amount[data-to]");
  if (amt) { const to = +amt.dataset.to, t0 = performance.now() + 1200; const step = n => { const k = Math.max(0, Math.min(1, (n - t0) / 2200)); amt.textContent = "+" + money(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }
  setTimeout(() => box.addEventListener("click", () => box.remove()), 1500);
  setTimeout(() => box.remove(), 14000);
}
// ---------- mercato : état des fenêtres et animation « Mercato time ! » ----------
function mercatoBanner(game) {
  const u = user(), games = game !== "all" ? [game] : Object.keys(u.divisions);
  if (!games.length) return "";
  const rows = games.map(g => { const st = mercatoStatus(g); return `<div class="mw-row ${st.open ? (st.last ? "last" : "open") : "shut"}">${GAMES[g].icon} <b>${GAMES[g].short}</b> · ${esc(st.text)}${st.last ? " <b class='warn'>· dernière semaine !</b>" : ""}</div>`; }).join("");
  return `<div class="card mw-banner">${rows}<span class="link" data-act="mercato-dates" style="font-size:12px">📅 Toutes les dates de mercato</span></div>`;
}
function mercatoDatesModal() {
  const u = user(), list = Object.keys(GAMES).sort((a, b) => !!u.divisions[b] - !!u.divisions[a]);
  modal(`<h2>📅 Périodes de mercato ${S.season}</h2>
    <p class="muted" style="margin-top:-6px">Chaque scène a ses propres fenêtres, calées sur son vrai calendrier (intersaison après les championnats du monde, pauses entre deux splits…). Hors fenêtre, un club ne peut pas vous céder un joueur sous contrat : seuls les agents libres et les indépendants peuvent signer. Les jeux marqués « libre » n'ont pas de fenêtre réglementée (CS2, battle royale, jeux en solo) : les dates indiquent les moments où le marché s'emballe. Dates approximatives : les éditeurs les fixent chaque année.</p>
    <div class="table-wrap"><table><tr><th>Jeu</th><th>Règle</th><th>Périodes</th><th>Maintenant</th></tr>${list.map(g => { const r = mercatoRules(g), st = mercatoStatus(g); return `<tr class="${u.divisions[g] ? "" : "muted"}"><td>${GAMES[g].icon} ${GAMES[g].short}${u.divisions[g] ? "" : " <small>(pas de section)</small>"}</td><td>${r.always ? "libre" : "fenêtres"}</td>
      <td style="font-size:12px">${r.w.map(x => `${dayLabel(S.season, x[0], 0)} → ${dayLabel(S.season, x[1], 6)} <span class="muted">(${esc(x[2])})</span>`).join("<br>")}</td><td>${st.open ? (r.always && !st.hot ? "🟡 libre" : "🟢 ouvert") : "🔴 fermé"}</td></tr>`; }).join("")}</table></div>
    <div class="actions"><button class="primary" data-act="close-modal">Fermer</button></div>`);
}
ACTIONS["mercato-dates"] = () => mercatoDatesModal();
ACTIONS["rank-reg"] = v => { UI.rankReg = v; render(); };
function mercatoChip() {
  const u = user(), open = Object.keys(u.divisions).filter(g => !mercatoRules(g).always && windowAt(g)).map(g => [g, windowEnd(g).weeks]).sort((a, b) => a[1] - b[1]);
  if (!open.length) return "";
  const [g, n] = open[0];
  return `<div class="stat link-row mw-chip ${n === 1 ? "last" : ""}" data-act="goto-market" data-v="${open.length === 1 ? g : "all"}" title="${open.map(([x, k]) => `${GAMES[x].short} : encore ${k} sem.`).join(" · ")}"><b>🔁 ${n === 1 ? "Dernière semaine" : n + " sem."}</b><span>Mercato ${open.map(([x]) => GAMES[x].short).join(" · ")}</span></div>`;
}
// avant de passer la dernière semaine d'un mercato, on prévient une fois
function mercatoCloseWarning() {
  const u = user(), closing = Object.keys(u.divisions).filter(g => !mercatoRules(g).always && windowAt(g) && windowEnd(g).weeks === 1);
  const key = S.season + "-" + S.week; if (!closing.length || UI.mwWarned === key) return false;
  UI.mwWarned = key;
  modal(`<h2>⏳ Le mercato se ferme</h2><p>C'est la <b>dernière semaine</b> du mercato en ${closing.map(g => `${GAMES[g].icon} ${GAMES[g].name}`).join(", ")}. Après, vous ne pourrez plus acheter de joueurs sous contrat (seulement des agents libres) jusqu'à la prochaine fenêtre : ${closing.map(g => { const [w, sn] = nextWindow(g); return `${GAMES[g].short} le ${dayLabel(sn, w, 0)}`; }).join(", ")}.</p>
    <div class="actions"><button data-act="close-modal">Rester sur cette semaine</button><button data-act="goto-market" data-v="${closing.length === 1 ? closing[0] : "all"}">💱 Aller au mercato</button><button class="primary" data-act="mw-continue">Continuer quand même ▶</button></div>`);
  return true;
}
ACTIONS["mw-continue"] = () => { closeModal(); playWeek(); };
function mercatoTime(info) {
  if (!info || !info.opened.length) return;
  // l'animation ne s'affiche que si le mercato s'ouvre dans un jeu où le club a une section
  const u = user(), mine = info.opened.filter(o => o[2]), others = [];
  if (!mine.length) return;
  const line = ([g, cur, , , end]) => `<div class="mt-g">${GAMES[g].icon} <b>${GAMES[g].name}</b> <span class="muted">${untilTxt(end)} · ${esc(cur[2])}</span></div>`;
  const box = document.createElement("div"); box.className = "mercato-time";
  box.innerHTML = `<div class="mt-card"><div class="mt-title"><span>MERCATO</span> <span>TIME !</span></div>
    ${mine.length ? `<div class="mt-h">Vos sections</div>${mine.map(line).join("")}` : ""}
    ${others.length ? `<div class="mt-h">C'est aussi le moment d'ouvrir une nouvelle section</div>${others.slice(0, 6).map(line).join("")}${others.length > 6 ? `<div class="muted">+ ${others.length - 6} autre(s) jeu(x)</div>` : ""}` : ""}
    <div class="actions" style="justify-content:center"><button data-mt="close">Plus tard</button>${others.length ? `<button data-mt="roster">➕ Ouvrir une section</button>` : ""}<button class="primary" data-mt="market">💱 Aller au mercato</button></div></div>`;
  document.body.appendChild(box);
  box.addEventListener("click", e => {
    const b = e.target.closest("[data-mt]"); if (!b && e.target !== box) return;
    box.remove();
    const k = b && b.dataset.mt;
    if (k === "market") { closeModal(); UI.market.game = mine.length === 1 ? mine[0][0] : "all"; UI.market.page = 0; UI.view = "market"; render(); window.scrollTo(0, 0); }
    if (k === "roster") { closeModal(); UI.view = "roster"; render(); }
  });
}
// jour de match : les rencontres du club cette semaine, à lancer une par une
function matchDayModal(last) {
  const evs = weekEvents(), left = evs.filter(e => !e.done);
  const rows = evs.slice().sort((a, b) => (a.when || "").localeCompare(b.when || "")).map(e => `<div class="md-ev imp-${e.imp || "normal"} ${e.done ? "done" : ""}"><div class="md-when">${esc(e.when || "")}</div><div style="min-width:0;flex:1">${gchip(e.game)} ${e.impLabel ? `<span class="imp-chip imp-${e.imp}">${esc(e.impLabel)}</span> ` : ""}<b>${esc(e.title)}</b><div class="muted" style="font-size:13px">${esc(e.what)}</div></div>
    ${e.done ? "<span class='ok'>✓ Joué</span>" : `<button class="primary small" data-act="md-play" data-v="${esc(e.id)}">▶ Lancer</button>`}</div>`).join("");
  modal(`<h2>🎮 Jour de match — ${weekLabel(S.season, S.week, true)}</h2>
    ${last || ""}
    <div class="md-list">${rows}</div>
    <p class="muted" style="font-size:12px">Lancez vos matchs un par un pour suivre chaque résultat, ou simulez tout le reste de la semaine d'un coup (pratique avec beaucoup de jeux). Vous pouvez fermer cette fenêtre pour changer une composition avant de jouer.</p>
    <div class="actions"><button data-act="close-modal">Fermer</button><button class="primary" data-act="md-finish">${left.length ? `⏩ Simuler le reste de la semaine (${left.length})` : "Terminer la semaine ▶"}</button></div>`);
}
// ---------- match en direct (animation) ----------
// le résultat est déjà calculé ; on le dévoile manche par manche pour garder du suspense
const LIVE = { timer: null, speed: 1, steps: [], i: 0, onDone: null };
function flavor(game, side, m, players) {
  const g = GAMES[game], p = players.length ? pick(players) : "un joueur", team = side;
  const lines = g.rounds ? [`Pistol round pour ${team}`, `Clutch 1v3 de ${p} !`, `ACE de ${p} !`, `${team} enchaîne 5 rounds`, `Retake parfait de ${team}`, `${p} ouvre le round à l'AWP`, `Éco gagné par ${team} !`]
    : game === "rl" ? [`But de ${p} !`, `Arrêt décisif de ${p}`, `Double tap de ${p} !`, `${team} met la pression`, `But en prolongation pour ${team} !`]
    : g.fmt === "duel" ? [`Combo dévastateur de ${p}`, `${p} lit parfaitement son adversaire`, `Perfect pour ${p} !`, `${p} revient de nulle part`]
    : [`First blood pour ${team}`, `${team} prend le Baron`, `Teamfight remporté par ${team}`, `${p} fait un quadra kill !`, `${team} détruit un inhibiteur`, `Steal de ${p} !`];
  return pick(lines);
}
function liveSteps(r) {
  const steps = [];
  for (const m of r.matches) {
    const A = clubLabel(m.a, m.game), B = clubLabel(m.b, m.game), pa = (m.notesA || []).map(x => x[0]), pb = (m.notesB || []).map(x => x[0]);
    steps.push({ t: 900, m, a: 0, b: 0, log: `${GAMES[m.game].icon} ${m.stage || ""} — ${A} contre ${B}, BO${m.bestOf}` });
    let a = 0, b = 0;
    (m.seq || []).forEach((w, i) => {
      steps.push({ t: 700, m, a, b, live: true, log: flavor(m.game, w === "a" ? A : B, m, w === "a" ? pa : pb) });
      w === "a" ? a++ : b++;
      steps.push({ t: 1300, m, a, b, flash: w, log: `<b>${w === "a" ? A : B}</b> remporte la manche ${i + 1}${m.maps && m.maps[i] ? " (" + m.maps[i] + ")" : ""} · ${a}-${b}` });
    });
    steps.push({ t: 1100, m, a: m.sa, b: m.sb, end: true, log: `🏁 <b>${clubLabel(m.winner, m.game)}</b> gagne ${Math.max(m.sa, m.sb)}-${Math.min(m.sa, m.sb)}${m.mvp ? " · MVP " + esc(m.mvp) : ""}` });
  }
  // lobbies (battle royale, TFT…) : toutes les équipes du club dans un même lobby jouent en même temps, partie par partie
  const groups = [];
  for (const l of r.lobbies) {
    let g = groups.find(x => x.game === l.game && x.stage === l.stage);
    if (!g) groups.push(g = { game: l.game, stage: l.stage, lobby: l.lobby, tour: r.tournaments.some(t => t.game === l.game && t.name === l.stage), teams: [] });
    // les joueurs de l'équipe (un partenaire extérieur au club est marqué d'un *) et leurs éliminations, partie par partie
    const names = ((l.notes && l.notes[l.club]) || []).map(x => x[0]), mates = new Set(unitMates(l.club, l.game).map(p => p.handle));
    const label = h => esc(h) + (mates.has(h) ? "*" : "");
    const games = l.mine.places.length, cum = [], kills = Object.fromEntries(names.map(h => [h, 0])), got = [];
    for (let k = 0; k < games; k++) {
      const n = (l.mine.kpg && l.mine.kpg[k]) ?? Math.round(l.mine.kills / games), gk = {};
      for (let i = 0; i < n && names.length; i++) { const h = pick(names); gk[h] = (gk[h] || 0) + 1; kills[h]++; }
      got.push({ n, gk }); cum.push({ ...kills });
    }
    g.teams.push({ l, label, names, cum, got, start: Object.fromEntries(names.map(h => [h, 0])),
      name: names.length ? names.map(label).join(" & ") : clubLabel(l.club, l.game).split(" (")[0] });
  }
  for (const grp of groups) {
    const G = GAMES[grp.game], games = Math.max(...grp.teams.map(t => t.l.mine.places.length));
    const club = clubLabel(grp.teams[0].l.club, grp.game).split(" (")[0];
    steps.push({ t: 1000, grp, k: -1, log: `${G.icon} ${esc(grp.stage)} — lobby de ${grp.lobby} ${G.unit}s · ${grp.teams.length > 1 ? `vos ${grp.teams.length} équipes` : `<b>${esc(club)}</b>`}` });
    for (let k = 0; k < games; k++) {
      // un fait de jeu d'une de vos équipes pendant la partie, puis les places de toutes vos équipes
      const hot = grp.teams.map(t => [t, Object.entries((t.got[k] || {}).gk || {}).sort((a, b) => b[1] - a[1])[0]]).filter(x => x[1]).sort((a, b) => b[1][1] - a[1][1])[0];
      steps.push({ t: 700, grp, k: k - 1, live: true, log: hot ? `${hot[0].label(hot[1][0])} ${hot[1][1] >= 3 ? `enchaîne ${hot[1][1]} éliminations !` : "prend un combat et élimine un adversaire"}` : "Les équipes jouent la zone…" });
      const line = grp.teams.filter(t => t.l.mine.places[k]).map(t => { const pl = t.l.mine.places[k]; return `${grp.teams.length > 1 ? t.name + " " : ""}<b>${pl === 1 ? "👑 TOP 1" : pl + "e"}</b> (${t.got[k].n} élim.)`; }).join(" · ");
      steps.push({ t: 1300, grp, k, log: `Partie ${k + 1} : ${line}` });
    }
    const fin = grp.teams.slice().sort((a, b) => a.l.rank - b.l.rank).map(t => `${grp.teams.length > 1 ? t.name + " : " : ""}<b>${t.l.rank === 1 ? "🏆 1er" : t.l.rank + "e"}</b> (${t.l.mine.pts} pts)`).join(" · ");
    const mvp = grp.teams[0].l.mvp;
    steps.push({ t: 1100, grp, k: games, end: true, log: `🏁 ${fin} ${grp.tour ? "du tournoi" : "de la journée"}${mvp ? ` · meilleur joueur du lobby : ${esc(mvp)}` : ""}` });
  }
  for (const t of r.tournaments) steps.push({ t: 1200, tour: t, log: `🏆 ${esc(t.name)} : ${t.place === 1 ? "<b class='win'>VAINQUEUR !</b>" : `<b>${t.place}e</b> sur ${t.n}`}${t.quals && t.quals.length > 1 ? " · " + t.quals.map(q => `${displayName(q.id, t.game)} ${qualBadge(q, true)}`).join(" · ") : t.qual ? " · " + qualBadge(t.qual) : ""}` });
  return steps;
}
function liveRender() {
  const st = LIVE.steps[LIVE.i], same = x => (st.grp ? x.grp === st.grp : st.m ? x.m === st.m : true);
  const log = LIVE.steps.slice(0, LIVE.i + 1).filter(same).map(x => x.log).reverse().slice(0, 8);
  let board = "";
  if (st.m) {
    const m = st.m, A = clubLabel(m.a, m.game), B = clubLabel(m.b, m.game);
    const lineup = list => list && list.length ? `<small class="live-lineup">${list.map(x => esc(x[0])).join(" · ")}</small>` : "";
    board = `<div class="live-board"><div class="live-team ${st.end && m.winner === m.a ? "win" : ""}">${esc(A)}${lineup(m.notesA)}</div>
      <div class="live-score"><span class="${st.flash === "a" ? "flash" : ""}">${st.a}</span> - <span class="${st.flash === "b" ? "flash" : ""}">${st.b}</span></div>
      <div class="live-team ${st.end && m.winner === m.b ? "win" : ""}">${esc(B)}${lineup(m.notesB)}</div></div>
      <div class="live-bar ${st.live ? "playing" : ""}"><i></i></div>`;
  } else if (st.grp) {
    const grp = st.grp, games = Math.max(...grp.teams.map(t => t.l.mine.places.length));
    const rows = grp.teams.map(t => {
      const places = Array.from({ length: games }, (_, k) => { const p = t.l.mine.places[k]; return k <= st.k && p ? `<span class="${p === 1 ? "top1" : p <= 10 ? "good" : ""}${k === st.k && !st.live ? " new" : ""}">${p === 1 ? "👑" : p}</span>` : `<span class="hidden-pl">${k === st.k + 1 && st.live ? "⏳" : "?"}</span>`; }).join("");
      const kills = st.k >= 0 ? t.cum[Math.min(st.k, t.cum.length - 1)] : t.start;
      const tot = Object.values(kills || {}).reduce((a, b) => a + b, 0);
      return `<tr><td><b>${t.name}</b>${kills && t.names.length > 1 ? `<div class="muted" style="font-size:12px">${t.names.map(h => `${t.label(h)} ${kills[h] || 0}`).join(" · ")}</div>` : ""}</td>
        <td><div class="live-places">${places}</div></td><td style="text-align:right">${tot} élim.</td><td style="text-align:right">${st.end ? `<b>${t.l.rank}e</b> · ${t.l.mine.pts} pts` : ""}</td></tr>`;
    }).join("");
    board = `<div class="live-teamname">${GAMES[grp.game].icon} ${esc(grp.stage)} · lobby de ${grp.lobby} ${GAMES[grp.game].unit}s</div>
      <div class="table-wrap"><table class="live-lobby"><tr><th>Équipe</th><th>Parties</th><th style="text-align:right">Élim.</th><th style="text-align:right">Classement</th></tr>${rows}</table></div>
      <div class="live-bar ${st.live ? "playing" : ""}"><i></i></div>`;
  } else board = `<div class="live-board"><div class="live-team win">${st.log}</div></div>`;
  modal(`<h2><span class="live-dot"></span> EN DIRECT</h2>${board}<div class="live-log">${log.map((x, i) => `<div class="${i ? "muted" : ""}">${x}</div>`).join("")}</div>
    <div class="actions"><button data-act="live-fast">${LIVE.speed > 1 ? "⏩ Vitesse ×4" : "⏩ Accélérer"}</button><button class="primary" data-act="live-skip">⏭ Voir le résultat</button></div>`);
}
function liveNext() {
  clearTimeout(LIVE.timer);
  if (LIVE.i >= LIVE.steps.length - 1) { const f = LIVE.onDone; LIVE.onDone = null; return f && f(); }
  LIVE.i++; liveRender();
  LIVE.timer = setTimeout(liveNext, LIVE.steps[LIVE.i].t / LIVE.speed);
}
function playLive(r, onDone) {
  LIVE.steps = liveSteps(r); LIVE.i = 0; LIVE.onDone = onDone; LIVE.speed = 1;
  if (!LIVE.steps.length) return onDone();
  liveRender(); LIVE.timer = setTimeout(liveNext, LIVE.steps[0].t);
}
ACTIONS["live-fast"] = () => { LIVE.speed = LIVE.speed > 1 ? 1 : 4; liveRender(); };
ACTIONS["live-skip"] = () => { clearTimeout(LIVE.timer); const f = LIVE.onDone; LIVE.onDone = null; f && f(); };
ACTIONS["md-play"] = v => {
  const r = playEvent(v);
  playLive(r, () => showEventResult(r));
};
// points de classement gagnés ou perdus (CS2) : détail par match et par tournoi, total, places mondiale et régionale
const ord = n => n === 1 ? "1er" : n + "e";
function rankRecap(list) {
  if (!list || !list.length) return "";
  const byGame = {};
  for (const [g, pts, why, id] of list) (byGame[g] = byGame[g] || []).push([pts, why, id]);
  return Object.entries(byGame).map(([g, l]) => {
    const tot = l.reduce((a, x) => a + x[0], 0), id = l[0][2], w = rankPos(g, id), reg = rankRegionOf(id, g), rr = regionalRanking(g, reg).findIndex(x => x.id === id) + 1;
    return `<div class="recap" style="margin-top:12px"><div class="recap-h"><span>🌍 Classement ${GAMES[g].short}</span><b class="${tot >= 0 ? "ok" : "bad"}">${tot >= 0 ? "+" : ""}${tot} pts</b></div>
      ${l.map(([pts, why]) => `<div class="recap-r"><span>${esc(why)}</span><b class="${pts >= 0 ? "ok" : "bad"}">${pts >= 0 ? "+" : ""}${pts}</b></div>`).join("")}
      <div class="recap-r"><span class="muted">Place actuelle</span><b>${w ? ord(w) + " mondial" : "non classé"} · ${rr ? ord(rr) + " " + RANK_REGIONS[reg][0] : ""}</b></div></div>`;
  }).join("");
}
function showEventResult(r) {
  const res = resultsHtml(r) || "<p class='muted'>Votre équipe n'a pas joué.</p>";
  render();
  matchDayModal(`<div class="card md-result">${res}${rankRecap(r.rank)}${fanRecap(r.fans, "📈 Fans après ce match")}${r.money ? `<p>Gains : <b class="${r.money >= 0 ? "ok" : "bad"}">${r.money >= 0 ? "+" : ""}${money(r.money)}</b></p>` : ""}</div>`);
  celebrate([r]);
};
// offres reçues pour vos joueurs en vente : comme dans Football Manager, il faut y répondre avant de continuer
const pendingOffers = () => allUserPlayers().filter(p => p.listed).flatMap(p => (p.offers || []).map(o => [p, o]));
function offersModal() {
  const list = pendingOffers();
  if (!list.length) { UI.offerFlow = false; closeModal(); render(); return false; }
  UI.offerFlow = true;
  modal(`<h2>📨 Offres de transfert à traiter (${list.length})</h2>
    <p class="muted" style="margin-top:-6px">Des clubs veulent acheter vos joueurs mis en vente. Répondez à chaque offre avant de passer à la semaine suivante.</p>
    ${list.map(([p, o]) => `<div class="card tl-card"><div><b>${flag(p.nat)} ${esc(p.handle)}</b> ${gchip(p.game)} ${R(p.rating)} <small class="muted">· valeur ${money(playerValue(p))} · prix demandé ${money(p.askPrice || playerValue(p))}</small></div>
      <div class="tl-offer"><span><b>${esc(S.clubs[o.club].name)}</b> propose <b class="ok">${money(o.fee)}</b>${o.final ? " <small class='warn'>(dernière offre)</small>" : ""}</span>
      <span style="white-space:nowrap"><button class="small primary" data-act="tl-accept" data-v="${p.id}|${o.id}">Accepter</button><button class="small" data-act="tl-counter" data-v="${p.id}|${o.id}">Contre-proposition</button><button class="small danger" data-act="tl-refuse" data-v="${p.id}|${o.id}">Refuser</button></span></div></div>`).join("")}
    <div class="actions"><button data-act="offers-later">Voir la liste des transferts</button></div>`);
  return true;
}
ACTIONS["offers-back"] = () => offersModal();
ACTIONS["offers-later"] = () => { UI.offerFlow = false; closeModal(); UI.view = "market"; UI.market.tab = "list"; render(); };
// sections dont l'effectif est incomplet (elles jouent en sous-nombre)
const incompleteGames = () => Object.keys(user().divisions).filter(g => unitGame(g) ? gamePlayers(g).length === 0 : gamePlayers(g).length < GAMES[g].size);
// avant de jouer une semaine : effectif incomplet, puis joueurs en fin de contrat avant la fin de saison, puis fermeture du mercato
function preWeekChecks(act) {
  UI.afterCheck = act;
  const key = S.season + "-" + S.week, inc = incompleteGames();
  if (inc.length && UI.incWarned !== key) {
    UI.incWarned = key;
    modal(`<h2>⚠️ Effectif incomplet</h2><p>Il manque des joueurs en ${inc.map(g => `${GAMES[g].icon} <b>${GAMES[g].name}</b> (${gamePlayers(g).length}/${GAMES[g].size})`).join(", ")}.
      Si vous continuez, ces équipes jouent leurs matchs en sous-nombre : défaites quasi assurées, fans et confiance du conseil en baisse.</p>
      <div class="actions"><button data-act="close-modal">Rester sur cette semaine</button><button data-act="goto-market" data-v="${inc.length === 1 ? inc[0] : "all"}">🔎 Recruter</button><button class="primary" data-act="check-continue">Jouer quand même ▶</button></div>`);
    return true;
  }
  const exp = expiringPlayers();
  if (S.week === SEASON_LAST && exp.length && UI.ctWarned !== key) { UI.ctWarned = key; contractsModal(); return true; }
  return mercatoCloseWarning();
}
// fin de saison : les joueurs dont le contrat se termine partiront s'ils ne sont pas prolongés
// fin d'une négociation : si elle a été lancée depuis la liste des fins de contrat, on y revient (liste à jour)
function negoClosed() { if (UI.ctFlow) contractsModal(); else closeModal(); }
function contractsModal() {
  const exp = expiringPlayers().sort((a, b) => b.rating - a.rating);
  UI.ctFlow = true;
  if (!exp.length) {
    return modal(`<h2>✅ Tous les contrats sont réglés</h2><p>Plus aucun joueur ne quittera le club à la fin de la saison.</p>
      <div class="actions"><button data-act="ct-stay">Rester sur cette semaine</button><button class="primary" data-act="ct-continue">Continuer ▶</button></div>`);
  }
  modal(`<h2>⏳ Fin de saison : ${exp.length} contrat(s) se terminent</h2>
    <p class="muted" style="margin-top:-6px">Ces joueurs quitteront le club à la fin de la saison s'ils ne sont pas prolongés. Vérifiez qu'il vous restera assez de joueurs dans chaque jeu.</p>
    <div class="table-wrap"><table><tr><th>Joueur</th><th>Jeu</th><th>Âge</th><th>Note</th><th>Salaire</th><th>Statut</th><th></th></tr>
    ${exp.map(p => `<tr><td>${flag(p.nat)} <b class="link" data-act="player-info" data-v="${p.id}">${esc(p.handle)}</b></td><td>${gchip(p.game)}</td><td>${ageTxt(p)}</td><td>${R(p.rating)}</td><td>${money(p.salary)}/sem</td><td>${p.starter ? "⭐ Titulaire" : "Remplaçant"}</td>
      <td><button class="small primary" data-act="renew" data-v="${p.id}">✍️ Prolonger</button></td></tr>`).join("")}</table></div>
    <div class="actions"><button data-act="ct-stay">Rester sur cette semaine</button><button class="primary" data-act="ct-continue">Les laisser partir et continuer ▶</button></div>`);
}
ACTIONS["contracts"] = () => contractsModal();
ACTIONS["ct-stay"] = () => { UI.ctFlow = false; closeModal(); render(); };
ACTIONS["ct-continue"] = () => { UI.ctFlow = false; ACTIONS["check-continue"](); };
ACTIONS["roster-full"] = () => { UI.rosterFull = !UI.rosterFull; try { localStorage.setItem("em-rosterFull", UI.rosterFull ? "1" : ""); } catch (e) { } render(); };
const setM = f => { f(UI.market); UI.market.page = 0; render(); };
ACTIONS["m-qfree"] = () => setM(m => m.status = m.status === "free" ? "all" : "free");
ACTIONS["m-qbudget"] = () => setM(m => m.budgetOnly = !m.budgetOnly);
ACTIONS["m-qkeen"] = () => setM(m => m.keenOnly = !m.keenOnly);
ACTIONS["m-qyoung"] = () => setM(m => { const on = m.ageMax == 21 && m.potMin >= 80; m.ageMax = on ? 99 : 21; m.potMin = on ? 0 : 80; m.sort = on ? m.sort : "pot"; });
// guide pour débuter : les étapes d'une saison, en quelques lignes
const HELP_STEPS = [
  ["🎮", "Jouer une semaine", "Le gros bouton <b>▶ Continuer</b> (en haut à droite, ou en bas sur téléphone) fait avancer le jeu : il lance la journée de match quand vos équipes jouent, sinon il passe à la semaine suivante. <b>⏭ Aller au prochain match</b> saute les semaines vides."],
  ["📋", "Savoir quoi faire", "Le <b>Tableau de bord</b> résume la semaine : vos matchs (les finales et les grands tournois en or), ce qui demande une action (effectif incomplet, contrats, sponsors) et les grands rendez-vous à venir."],
  ["👥", "Gérer ses équipes", "Dans <b>Effectifs</b>, choisissez vos titulaires (⭐), suivez la progression (colonne Évol.) et prolongez les contrats. <b>⚡ Composition auto</b> aligne les meilleurs."],
  ["💱", "Recruter", "Au <b>Mercato</b>, les boutons rapides (agents libres, dans mon budget, jeunes talents) trouvent vite un joueur. Cliquez sur un club pour voir tout son effectif. Hors période de mercato, seuls les agents libres signent."],
  ["💰", "Tenir le budget", "Par défaut, un seul budget pour tout le club : vous dépensez votre argent en gardant une réserve pour les salaires (le mode manuel, avec une enveloppe par jeu, se règle dans <b>Finances</b>). Les <b>Sponsors</b> paient chaque semaine et versent des primes si leurs objectifs sont atteints."],
  ["🏆", "Gagner", "Finissez dans les 2 premiers d'un tier pour monter, visez l'objectif du <b>conseil</b> (ⓘ en haut) et jouez les tournois (onglet <b>Tournois</b> : un seul par semaine et par jeu)."],
];
function helpModal() {
  modal(`<h2>❓ Comment jouer</h2><p class="muted" style="margin-top:-6px">Vous êtes le CEO d'un club esport. Chaque semaine : vos équipes jouent, vous recrutez, vous gérez l'argent. Voici l'essentiel.</p>
    <div class="help-steps">${HELP_STEPS.map(([i, t, d]) => `<div class="help-step"><div class="help-i">${i}</div><div><b>${t}</b><p>${d}</p></div></div>`).join("")}</div>
    <p class="muted" style="font-size:12px">Les petits ⓘ et les infobulles expliquent chaque chiffre. Ce guide reste accessible depuis le menu (❓ Comment jouer).</p>
    <div class="actions"><button class="primary" data-act="close-modal">C'est parti !</button></div>`);
}
ACTIONS["help"] = () => helpModal();
// changer de tier : acheter une place plus haut (notoriété et droit d'entrée) ou redescendre volontairement
function tierModal(game) {
  const u = user(), d = u.divisions[game], g = GAMES[game], zone = d.zone || "W", req = (u.tierReq || {})[game], started = seasonStarted(game);
  const rows = [1, 2, 3].map(t => {
    const e = t === d.tier ? null : tierChangeCheck(game, t), up = t < d.tier;
    return `<tr class="${t === d.tier ? "me" : ""}"><td>${tchip(t, game)}</td><td>${esc(tierName(game, t, zone, subPrefFor(u.id, game, t, zone)))}</td>
      <td>${t === d.tier ? "<b>Tier actuel</b>" : up ? `Droit d'entrée <b>${money(tierEntry(game, t))}</b> · notoriété ${fameReq(game, t)} requise` : "Gratuit · notoriété −2, confiance du conseil −5"}</td>
      <td>${t === d.tier ? "" : req === t ? "<b class='ok'>Demandé pour la fin de saison</b>" : e ? `<span class="muted" style="font-size:12px">${esc(e)}</span>` : `<button class="small ${up ? "primary" : ""}" data-act="tier-req" data-v="${game}|${t}">${up ? "⬆️ Acheter la place" : "⬇️ Descendre"}</button>`}</td></tr>`;
  }).join("");
  modal(`<h2>🔀 ${g.icon} ${g.name} : changer de tier</h2>
    <p class="muted" style="margin-top:-6px">Comme en vrai, une organisation peut racheter une place dans une division plus haute, ou redescendre pour reconstruire. ${started ? "<b>La saison de votre équipe a commencé : le changement se fera à la fin de la saison</b> (le droit d'entrée sera payé à ce moment-là)." : "La saison de votre équipe n'a pas commencé : le changement est immédiat."} Votre équipe prend la place du club le plus faible du tier visé si elle monte, du plus fort si elle descend.</p>
    <div class="table-wrap"><table>${rows}</table></div>
    <div class="actions">${req ? `<button data-act="tier-cancel" data-v="${game}">Annuler la demande</button>` : ""}<button class="primary" data-act="close-modal">Fermer</button></div>`);
}
ACTIONS["tier-modal"] = v => tierModal(v);
ACTIONS["tier-req"] = v => { const [g, t] = v.split("|"), r = requestTier(g, +t); if (r.err) return toast(r.err); toast(r.now ? `Votre équipe joue désormais en ${TIER_LABEL[+t - 1]}.` : `Demande enregistrée : passage en ${TIER_LABEL[+t - 1]} à la fin de la saison.`); scheduleSave(); render(); tierModal(g); };
ACTIONS["tier-cancel"] = v => { const u = user(); if (u.tierReq) delete u.tierReq[v]; toast("Demande annulée."); scheduleSave(); render(); tierModal(v); };
ACTIONS["check-continue"] = () => { closeModal(); const a = UI.afterCheck || "next"; UI.afterCheck = null; ACTIONS[a](); };
ACTIONS["md-finish"] = () => { if (pendingOffers().length) return offersModal(); if (!preWeekChecks("md-finish")) playWeek(); };
// bouton principal : jour de match s'il reste des rencontres à lancer, sinon semaine suivante
ACTIONS["next0"] = () => { if (pendingOffers().length) return offersModal(); if (incompleteGames().length && UI.incWarned !== S.season + "-" + S.week) return preWeekChecks("next"); if (weekEvents().some(e => !e.done)) matchDayModal(); else if (!preWeekChecks("next")) playWeek(); };
// « Continuer » : si rien ne se passe (ni fenêtre, ni semaine suivante) ou en cas d'erreur, une fenêtre explique ce qui bloque
ACTIONS["next"] = () => {
  const w = S.week, sea = S.season;
  try { ACTIONS.next0(); } catch (e) { console.error(e); return blockersModal(e); }
  setTimeout(() => {
    if (!S || S.over || S.week !== w || S.season !== sea) return;
    if (!document.getElementById("modal").classList.contains("hidden") || document.querySelector(".celebrate, .mercato-time")) return;
    blockersModal();
  }, 350);
};
// tout ce qui peut empêcher d'avancer, avec le bouton pour le régler
function blockersModal(err) {
  const u = user(), items = [];
  const offers = pendingOffers().length;
  if (offers) items.push(["📨", `${offers} offre(s) de transfert à traiter`, "Acceptez, refusez ou faites une contre-proposition.", "offers-back", "Traiter les offres"]);
  if (pendingEvents.length) items.push(["📌", `${pendingEvents.length} décision(s) en attente`, "Sponsors à renouveler, événements du club…", "next-event", "Décider"]);
  const exp = expiringPlayers();
  if (exp.length && S.week >= SEASON_LAST - 3) items.push(["⏳", `${exp.length} joueur(s) en fin de contrat`, "Prolongez-les ou laissez-les partir (les libérer).", "contracts", "Prolonger ou libérer"]);
  const inc = incompleteGames();
  if (inc.length) items.push(["⚠️", `Effectif incomplet : ${inc.map(g => GAMES[g].short).join(", ")}`, "Recrutez au mercato ou fermez la division. Sinon vos équipes jouent en sous-nombre.", "goto-market", "Recruter", inc.length === 1 ? inc[0] : "all"]);
  const spon = u.sponsorDeals.filter(d => d.weeks <= 2 && !d.renew);
  if (spon.length) items.push(["🤝", `${spon.length} contrat(s) de sponsor se terminent`, "Décidez de les renouveler ou non (onglet Sponsors).", "view", "Voir les sponsors", "sponsors"]);
  const left = weekEvents().filter(e => !e.done).length;
  if (left) items.push(["🎮", `${left} match(s) à jouer cette semaine`, "Lancez-les un par un ou tous d'un coup.", "md-open", "Jouer les matchs"]);
  modal(`<h2>🚧 Qu'est-ce qui bloque ?</h2>
    ${err ? `<p class="bad">Une erreur s'est produite : <code>${esc(String(err && err.message || err))}</code>. Vous pouvez forcer le passage à la semaine suivante.</p>` : `<p class="muted" style="margin-top:-6px">La semaine n'a pas avancé. Voici ce qui demande votre attention :</p>`}
    ${items.length ? `<div class="blk-list">${items.map(([ic, t, d, act, lbl, v]) => `<div class="blk"><span class="blk-ic">${ic}</span><div><b>${t}</b><div class="muted" style="font-size:12px">${d}</div></div><button class="small primary" data-act="${act}" ${v ? `data-v="${v}"` : ""}>${lbl}</button></div>`).join("")}</div>` : "<p>Rien de particulier n'est en attente.</p>"}
    <div class="actions"><button data-act="close-modal">Fermer</button><button class="primary" data-act="force-week">⏭ Forcer la semaine suivante</button></div>`);
}
ACTIONS["md-open"] = () => matchDayModal();
ACTIONS["force-week"] = () => { closeModal(); pendingEvents = []; UI.ctFlow = false; try { playWeek(); } catch (e) { console.error(e); toast("⚠️ Erreur : " + e.message); } };
// avance jusqu'à la prochaine semaine où le club joue (les semaines vides passent d'un coup)
ACTIONS["skip"] = () => {
  if (pendingOffers().length) return offersModal();
  if (preWeekChecks("skip")) return;
  // « Prochain match » ne saute jamais une ouverture ni la dernière semaine d'un mercato de vos sections
  const mwState = () => Object.keys(user().divisions).map(g => mercatoOpen(g) + ":" + (windowAt(g) && windowEnd(g).weeks === 1)).join();
  const reps = [];
  for (let i = 0; i < 20; i++) {
    const before = mwState(), rep = advanceWeek(); reps.push(rep);
    if (rep.events.length || rep.seasonEnd || S.over || weekEvents().length || pendingOffers().length || mwState() !== before) break;
    // la dernière semaine de la saison : on s'arrête pour pouvoir prolonger les joueurs en fin de contrat
    if (S.week === SEASON_LAST && expiringPlayers().length) break;
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
  setTimeout(() => celebrate(reps), 50);
  const opened = reps.map(r => r.mercato).filter(Boolean);
  if (opened.length) setTimeout(() => mercatoTime({ opened: opened.flatMap(o => o.opened).filter((o, i, a) => a.findIndex(x => x[0] === o[0]) === i) }), 80);
  const se = last.seasonEnd;
  const title = se ? "🏁 Fin de la saison " + last.season : reps.length > 1 ? `${weekLabel(reps[0].season, reps[0].week)} → ${weekLabel(last.season, last.week, true)}` : `Semaine du ${weekLabel(last.season, last.week, true)}`;
  modal(`<h2>${title}</h2>${reps.length > 1 ? `<p class="muted" style="margin-top:-6px">${reps.length} semaines jouées.</p>` : ""}${res}
    ${rankRecap(reps.flatMap(r => r.rank || []))}
    <div class="grid g2" style="margin-top:12px">${fanRecap(reps.flatMap(r => r.fans))}${moneyRecap(merge("income"), merge("expenses"))}</div>
    ${(() => { const pr = reps.flatMap(r => r.progress || []); return pr.length ? `<div class="recap" style="margin-top:12px"><div class="recap-h"><span>📈 Progression des joueurs</span></div>${pr.map(([id, h, g, r]) => `<div class="recap-r"><span>${GAMES[g].icon} ${esc(h)}</span><b class="ok">${r} (+1)</b></div>`).join("")}</div>` : ""; })()}
    ${missing.length ? `<p class="bad">⚠️ Effectif incomplet en ${missing.map(g => GAMES[g].short).join(", ")} : vos équipes jouent en sous-nombre !</p>` : ""}
    ${se ? `<p>${se.moves.length ? se.moves.join("<br>") : "Pas de changement de division."}</p><p>Objectif du conseil ${se.ok ? "<b class='ok'>atteint ✅</b>" : "<b class='bad'>manqué ❌</b>"}. Le bilan complet est dans la messagerie.</p>` : ""}
    ${S.over ? `<p class="bad"><b>Vous avez été licencié. Fin de partie.</b></p>` : ""}
    <div class="actions"><button class="primary" data-act="next-event">Continuer</button></div>`);
  render();
}
// nouvelle saison : le CEO répartit d'abord son budget mercato entre ses sections
function maybeAlloc() {
  if (!allocManual()) return false;
  if (S.over || !Object.keys(user().divisions).length) return false;
  allocOf(Object.keys(user().divisions)[0]);
  if (S.alloc.set || S.alloc.asked) return false;
  S.alloc.asked = true;
  allocModal(`Début de la saison ${S.season} : comme en Football Manager, répartissez votre budget de transferts entre vos sections et fixez leur masse salariale. Vous pourrez le modifier à tout moment dans l'onglet Finances.`);
  return true;
}
ACTIONS["next-event"] = () => {
  const ev = pendingEvents.shift();
  if (!ev) { if (!maybeAlloc() && !offersModal()) closeModal(); return; }
  if (ev.sponsor) return sponsorModal(ev.sponsor, ev.intro || `<b>${esc(ev.sponsor.brand)}</b> vous contacte pour un partenariat.`);
  window._ev = ev;
  modal(`<h2>${ev.title}</h2><p>${ev.body}</p><div class="actions">${ev.choices.map((c, i) => `<button class="${i ? "" : "primary"}" data-act="ev-choice" data-v="${i}">${c.label}</button>`).join("")}</div>`);
};
ACTIONS["ev-choice"] = v => {
  const ev = window._ev, res = ev.choices[+v].fx();
  // un choix peut ouvrir une suite (questions d'une conférence de presse)
  const txt = res && typeof res === "object" ? res.text : res;
  mail(ev.title, ev.body + "<br><i>Décision : " + ev.choices[+v].label + " — " + txt + "</i>", "event");
  if (res && res.next) pendingEvents.unshift(res.next);
  save(); toast(txt); render();
  ACTIONS["next-event"]();
};

// ---------- recherche (menu) ----------
function searchResults(q) {
  q = q.trim().toLowerCase(); if (q.length < 2) return "";
  const norm = x => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(), nq = norm(q);
  const clubs = Object.values(S.clubs).filter(c => !c.filler && !c.sister && !c.unitOf && Object.keys(c.divisions).length && (norm(c.name).includes(nq) || Object.values(c.divisions).some(d => d.label && norm(d.label).includes(nq))))
    .sort((a, b) => (norm(b.name).startsWith(nq) - norm(a.name).startsWith(nq)) || b.fame - a.fame).slice(0, 8);
  const players = Object.values(S.players).filter(p => norm(p.handle).includes(nq)).sort((a, b) => (norm(b.handle).startsWith(nq) - norm(a.handle).startsWith(nq)) || b.rating - a.rating).slice(0, 8);
  const cl = clubs.map(c => `<div class="sr" data-act="club-info" data-v="${c.id}"><span style="color:${c.color}">■</span> <b>${esc(c.name)}</b> ${flag(c.country)} <small class="muted">${Object.keys(c.divisions).map(g => GAMES[g].icon).join("")}</small></div>`).join("");
  const pl = players.map(p => { const c = S.clubs[p.club]; return `<div class="sr" data-act="player-info" data-v="${p.id}">${flag(p.nat)} <b>${esc(p.handle)}</b> <small class="muted">${GAMES[p.game].short} · ${p.rating} · ${c ? esc(c.solo ? "indépendant" : c.name) : "agent libre"}</small></div>`; }).join("");
  return (cl ? `<div class="sr-h">Équipes</div>${cl}` : "") + (pl ? `<div class="sr-h">Joueurs</div>${pl}` : "") || "<div class='sr muted'>Aucun résultat.</div>";
}
document.addEventListener("input", e => {
  if (e.target.id !== "g-search") return;
  const box = document.getElementById("g-results"), html = searchResults(e.target.value);
  box.innerHTML = html; box.classList.toggle("hidden", !html);
});
// fiche d'un joueur (recherche) : voir, recruter ou lui parler
// petit graphique en ligne (SVG) : series = [{ pts: [valeurs], color, label }]
function lineChart(series, labels, h = 150) {
  const all = series.flatMap(x => x.pts).filter(v => v != null);
  if (all.length < 2) return "<p class='muted'>Pas encore assez de données.</p>";
  const W = 600, n = Math.max(...series.map(x => x.pts.length)), lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo) * 0.1 || 1;
  const x = i => 10 + i * (W - 20) / Math.max(1, n - 1), y = v => h - 12 - (v - lo + pad) / (hi - lo + 2 * pad) * (h - 24);
  const paths = series.map(sr => `<path d="${sr.pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")}" fill="none" stroke="${sr.color}" stroke-width="2.5" vector-effect="non-scaling-stroke"/>`).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" role="img" aria-label="Graphique">${paths}</svg>
    <div class="muted" style="display:flex;justify-content:space-between;font-size:12px"><span>${labels[0] || ""}</span><span>${series.map(sr => `<span style="color:${sr.color}">■</span> ${sr.label}`).join(" · ")} · de ${Math.round(lo)} à ${Math.round(hi)}</span><span>${labels[1] || ""}</span></div>`;
}
// fiche d'un joueur : infos publiques pour tous ; caractère, entente et évolution détaillée seulement pour les joueurs du club
function playerInfo(pid) {
  const p = S.players[pid]; if (!p) return;
  const c = S.clubs[p.club], mine = c && isMine(c.id), avg = avgNote(p);
  const act = mine ? `<button data-act="talk" data-v="${p.id}">💬 Lui parler</button><button data-act="contract" data-v="${p.id}">📄 Contrat</button>`
    : !c ? `<button class="primary" data-act="sign" data-v="${p.id}">Signer</button>` : `<button class="primary" data-act="offer" data-v="${p.id}">Faire une offre (~${money(askingPrice(p))})</button>`;
  const won = (p.won || []).slice().reverse();
  const car = (p.car || []).slice().reverse().map(([sn, club, r, n]) => `<tr><td>${sn}</td><td>${esc(club)}</td><td>${R(r)}</td><td>${n ? noteChip(n) : "—"}</td></tr>`).join("");
  let priv = `<div class="card" style="margin-top:12px"><p class="muted" style="margin:0">🔒 Personnalité, caractère, entente avec les coéquipiers et évolution détaillée : visibles une fois le joueur dans votre club.</p></div>`;
  if (mine) {
    const h = p.hist || [], mates = clubPlayers(p.club, p.game).filter(x => x.id !== p.id);
    const pairs = mates.map(x => [x, pairScore(p, x)]).filter(([, sc]) => sc >= 1 || sc <= -1.5).sort((a, b) => b[1] - a[1]);
    priv = `<div class="grid g2" style="margin-top:12px">
      <div class="card"><h3>Caractère</h3><p style="margin:0"><b>${personalityOf(p)}</b> — ${PERSONALITIES[personalityOf(p)].desc}<br><b>${traitOf(p)}</b> — ${TRAITS[traitOf(p)]}</p>
        <p style="margin:8px 0 0">Forme ${bar(p.form)} · Moral ${bar(p.morale)}</p>
        ${pairs.length ? `<p style="margin:8px 0 0;font-size:13px">${pairs.map(([x, sc]) => `${sc > 0 ? "💚" : "⚡"} ${esc(x.handle)} <span class="${sc > 0 ? "ok" : "bad"}">${sc > 0 ? "bonne entente" : "tensions"}</span>`).join("<br>")}</p>` : ""}</div>
      <div class="card"><h3>Notes des 10 derniers matchs</h3>${(p.notes || []).length ? `<div>${p.notes.map(noteChip).join(" ")}</div>${lineChart([{ pts: p.notes, color: "var(--accent2)", label: "note" }], ["", ""], 90)}` : "<p class='muted'>Aucun match joué pour le club.</p>"}</div>
    </div>
    ${evoCard(p)}
    <div class="card" style="margin-top:12px"><h3>Évolution au club${p.joinedAt ? ` (depuis ${weekLabel(Math.floor(p.joinedAt / 100), p.joinedAt % 100, true)})` : ""}</h3>
      ${lineChart([{ pts: h.map(x => x[1]), color: "#ffd166", label: "note" }, { pts: h.map(x => 60 + (x[2] - 50) / 5), color: "var(--ok)", label: "forme (échelle réduite)" }], h.length ? [weekLabel(Math.floor(h[0][0] / 100), h[0][0] % 100), weekLabel(Math.floor(h[h.length - 1][0] / 100), h[h.length - 1][0] % 100)] : [])}</div>`;
  }
  modal(`<h2>${flag(p.nat)} ${esc(p.handle)}${p.late ? ` <span class="chip">révélation tardive</span>` : ""}</h2><p class="muted" style="margin-top:-6px">${GAMES[p.game].icon} ${GAMES[p.game].name} · ${p.role} · ${ageTxt(p)} ans · ${COUNTRIES[p.nat] || p.nat || "nationalité inconnue"} · ${c ? (c.solo ? "pro indépendant" : teamLink(c, p.game)) : "agent libre"}</p>
    <div class="offer"><div><span class="muted">Note</span><b>${R(p.rating)}</b></div><div><span class="muted">Potentiel estimé</span><b>${potTxt(p)}</b></div><div><span class="muted">Moyenne en match (saison)</span><b>${avg ? avg.toFixed(2) : "—"}</b></div><div><span class="muted">Valeur</span><b>${money(playerValue(p))}</b></div></div>
    <p>Région de jeu : ${REGIONS[playRegion(p)]}${c ? ` · contrat ${p.years} an(s)` : ""}${mine ? ` · ${money(p.salary)}/sem${p.clause ? ` · clause ${money(p.clause)}` : ""}` : ""}</p>
    <div class="grid g2"><div><h3>Palmarès</h3>${won.length ? `<p style="margin:0">${won.map(t => `🏆 ${esc(t)}`).join("<br>")}</p>` : "<p class='muted'>Aucun titre pour l'instant.</p>"}</div>
      <div><h3>Carrière</h3>${car ? `<table><tr><th>Saison</th><th>Club</th><th>Note</th><th>Moy.</th></tr>${car}</table>` : "<p class='muted'>Première saison suivie.</p>"}</div></div>
    ${priv}
    <div class="actions"><button data-act="close-modal">Fermer</button>${act}</div>`);
}
ACTIONS["player-info"] = v => playerInfo(v);

// ---------- délégation d'événements ----------
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (el && !el.disabled) { ACTIONS[el.dataset.act] && ACTIONS[el.dataset.act](el.dataset.v); return; }
  if (e.target.id === "modal" && !pendingEvents.length && !document.querySelector('#modal [data-act="ev-choice"], #modal [data-act="next-event"], #modal [data-act="sp-counter"], #modal [data-act="nego-propose"], #modal [data-act="live-skip"], #modal [data-act="md-finish"]')) closeModal();
});
document.addEventListener("change", e => {
  const k = e.target.dataset.change; if (!k) return;
  if (k === "sub-pick") {
    const r = changeSub(e.target.dataset.game, e.target.value), nm = SUB_NAMES[e.target.value] || e.target.value;
    toast(r.err || (r.now ? `✅ Votre club joue désormais en ${nm}.` : r.later ? `🔁 Vous rejoindrez la ${nm} à la fin de la saison.` : `🎯 À votre montée, votre club ira en ${nm}.`));
    save(); return render();
  }
  if (k === "unit-move") { if (e.target.value) { const err = assignUnit(e.target.dataset.pid, e.target.value); if (err) toast(err); scheduleSave(); } return render(); }
  if (k.startsWith("al-")) return allocSum();
  if (k === "cal-filter") { UI.calMode = e.target.value; return render(); }
  if (k === "fin-game") { UI.finGame = e.target.value; return render(); }
  if (k === "sp-f-ethic") { UI.spFilter.ethic = e.target.value; return render(); }
  if (k === "sp-f-size") { UI.spFilter.size = e.target.value; return render(); }
  if (k === "sp-level") { document.querySelectorAll(".clause-opt").forEach(x => x.classList.toggle("sel", x.contains(e.target))); return; }
  if (k === "sp-preview") return spPreview();
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
  if (k === "m-maxprice") m.maxPrice = parseMoney(e.target.value);
  if (k === "m-minprice") m.minPrice = parseMoney(e.target.value);
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
