# Ajoute à js/data_live.js les scènes suivies par Liquipedia qui manquaient au jeu (hors Esports World Cup) :
# Brawl Stars, Marvel Rivals, Wild Rift, World of Tanks, Heroes of the Storm, Hearthstone, Clash Royale, GeoGuessr,
# Age of Empires II, Warcraft III, StarCraft: Brood War, Super Smash Bros. Ultimate.
# Sources (API de Liquipedia, réponses gardées dans tools/sources/liquipedia) :
#   - les listes « S-Tier » et « A-Tier Tournaments » (pages rendues) : calendrier 2026, dotations, vainqueurs ;
#   - les pages des tournois terminés de 2025-2026 : participants (fiches d'équipe ou joueurs) et classements.
# Les notes viennent des résultats (place, prestige du tournoi, nombre de grands tournois joués) ; les autres jeux ne sont pas touchés.
# Usage : python3 tools/build_liquipedia.py [jeu…]
import datetime, json, os, re, subprocess, sys, unicodedata, zlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lp, lp_lists

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIVE = os.path.join(ROOT, "js/data_live.js")
SEASON_FIRST, SEASON_LAST = 2, 50

# jeu : (wiki, pages S-Tier et A-Tier, filtre sur la colonne des tournois, format)
GAMES = {
    "bs":    ("brawlstars", ["S-Tier Tournaments", "A-Tier Tournaments"], "team"),
    "mr":    ("marvelrivals", ["S-Tier Tournaments", "A-Tier Tournaments"], "team"),
    "wr":    ("wildrift", ["S-Tier Tournaments", "A-Tier Tournaments"], "team"),
    "wot":   ("worldoftanks", ["World of Tanks/S-Tier Tournaments", "World of Tanks/A-Tier Tournaments"], "team"),
    "hots":  ("heroes", ["S-Tier Tournaments", "A-Tier Tournaments"], "team"),
    "hs":    ("hearthstone", ["S-Tier Tournaments", "A-Tier Tournaments"], "solo"),
    "cr":    ("clashroyale", ["S-Tier Tournaments", "A-Tier Tournaments"], "solo"),
    "geo":   ("geoguessr", ["S-Tier Tournaments", "A-Tier Tournaments"], "solo"),
    "aoe":   ("ageofempires", ["Age of Empires II/S-Tier Tournaments", "Age of Empires II/A-Tier Tournaments"], "solo"),
    "wc3":   ("warcraft", ["Tier 1 Tournaments"], "solo"),
    "bw":    ("starcraft", ["S-Tier Tournaments", "A-Tier Tournaments"], "solo"),
    "smash": ("smash", ["S-Tier Tournaments", "A-Tier Tournaments"], "solo"),
}
MAX_EVENTS = {"team": 6, "solo": 6}

cur = json.loads(subprocess.run(["node", "-e", f"""
const fs=require('fs');eval(fs.readFileSync({json.dumps(os.path.join(ROOT, 'js/data.js'))},'utf8')+fs.readFileSync({json.dumps(LIVE)},'utf8')+';global.X={{ORGS}}');
console.log(JSON.stringify(X))"""], capture_output=True, text=True, check=True).stdout)
ORGS = cur["ORGS"]

def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", s.lower())
FILLER = {"esports", "esport", "team", "gaming", "club", "the", "gg"}
def make_tag(name):
    words = [w for w in re.findall(r"[A-Za-z0-9]+", name) if w.lower() not in FILLER] or re.findall(r"[A-Za-z0-9]+", name) or ["TEAM"]
    return ("".join(w[0] for w in words) if len(words) >= 2 else words[0][:4]).upper()[:4]
def hcolor(s): return "hsl(%d 60%% 52%%)" % (zlib.crc32(s.encode()) % 360)
jit = lambda h, k: zlib.crc32(h.encode()) % k

ALIASES = {"teamvitality": "vitality", "teamfalcons": "falcons", "teamliquid": "liquid", "gengesports": "geng", "natusvincere": "navi",
           "weibogaming": "wbg", "auroragaming": "aurora", "rexregumqeon": "rrq", "virtuspro": "vp", "teamspirit": "spirit", "crazyraccoon": "cr",
           "zetadivision": "zeta", "fazeclan": "faze", "100thieves": "100t", "teamheretics": "heretics", "sentinels": "sentinels", "g2esports": "g2",
           "karminecorp": "kc", "teamsecret": "secret", "gentlemates": "m8", "teambds": "bds", "skgaming": "sk", "mousesports": "mouz"}
by_name = {norm(v[0]): k for k, v in ORGS.items()}
by_name.update({norm(v[1]): k for k, v in ORGS.items() if len(v[1]) > 2})
def org_for(name):
    n = norm(name); o = ALIASES.get(n) or by_name.get(n)
    return o if o in ORGS else None

# drapeaux Liquipedia (codes à 2 lettres, parfois des noms ou des régions)
FLAG_ALIAS = {"uk": "GB", "en": "GB", "england": "GB", "scotland": "GB", "wales": "GB", "usa": "US", "kr": "KR", "korea": "KR", "southkorea": "KR",
              "emea": "", "eu": "", "europe": "", "world": "", "sea": "", "latam": "", "na": "US", "sa": "BR", "cis": "RU"}
def cc(flag):
    f = (flag or "").strip().lower()
    if f in FLAG_ALIAS: return FLAG_ALIAS[f]
    return f.upper() if re.fullmatch(r"[a-z]{2}", f) else ""

MONTHS = {m: i + 1 for i, m in enumerate(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])}
def start_week(date, year):
    m = re.match(r"([A-Z][a-z]{2})\s+(\d{1,2})", date or "")
    if not m: return None
    d = datetime.date(year, MONTHS[m.group(1)], int(m.group(2)))
    return max(SEASON_FIRST, min(SEASON_LAST, d.isocalendar()[1]))
def clean(name): return re.sub(r"\s+", " ", re.sub(r"\b20\d\d\b:?", "", name)).strip(" :-–")
def place_of(s):
    m = re.match(r"(\d+)", str(s or "").strip())
    return int(m.group(1)) if m else None

# ---------- participants d'une page de tournoi ----------
def templates(text, name):
    """Blocs {{name …}} (avec les modèles imbriqués)."""
    out, i = [], 0
    pat = re.compile(r"\{\{\s*" + name + r"\b", re.I)
    while True:
        m = pat.search(text, i)
        if not m: return out
        depth, j = 0, m.start()
        while j < len(text):
            if text.startswith("{{", j): depth += 1; j += 2; continue
            if text.startswith("}}", j):
                depth -= 1; j += 2
                if depth == 0: break
                continue
            j += 1
        out.append(text[m.start():j]); i = j
def args(block):
    """Paramètres |clé=valeur de premier niveau d'un modèle."""
    body, depth, cur_, parts = block[2:-2], 0, "", []
    k = 0
    while k < len(body):
        c2 = body[k:k + 2]
        if c2 in ("{{", "[["): depth += 1; cur_ += c2; k += 2; continue
        if c2 in ("}}", "]]"): depth -= 1; cur_ += c2; k += 2; continue
        if body[k] == "|" and depth == 0: parts.append(cur_); cur_ = ""; k += 1; continue
        cur_ += body[k]; k += 1
    parts.append(cur_)
    d, pos = {}, []
    for p in parts[1:]:
        if "=" in p and not p.lstrip().startswith("{{"):
            a, b = p.split("=", 1); d[a.strip().lower()] = b.strip()
        else: pos.append(p.strip())
    return d, pos
def strip_links(s): return re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s or "").strip()

def team_participants(text):
    teams = []
    for b in templates(text, "TeamCard"):
        if re.match(r"\{\{\s*TeamCard\s*(columns|Toggle|end)", b, re.I): continue
        d, _ = args(b)
        team = strip_links(d.get("team", ""))
        if not team: continue
        ps = []
        for k in range(1, 11):
            h = strip_links(d.get("p%d" % k, ""))
            if not h: continue
            ps.append([h, cc(d.get("p%dflag" % k) or d.get("flag", ""))])
        if ps: teams.append({"team": team, "flag": cc(d.get("flag", "")), "players": ps, "place": place_of(d.get("placement"))})
    # format plus récent : {{TeamParticipants … {{Opponent|team=…|players={{Persons|{{Person|nom|flag=…}}…}}}}}}
    for b in templates(text, "Opponent"):
        d, pos = args(b)
        team = strip_links(d.get("team") or (pos[0] if pos and d.get("type") == "team" else ""))
        if not team or "players" not in d: continue
        ps = []
        for pb in templates(d["players"], "Person"):
            pd_, ppos = args(pb)
            h = strip_links(pd_.get("name") or (ppos[0] if ppos else ""))
            if h and not pd_.get("role"): ps.append([h, cc(pd_.get("flag", ""))])
        if ps and not any(t["team"] == team for t in teams): teams.append({"team": team, "flag": "", "players": ps, "place": None})
    return teams

def solo_participants(text):
    """Joueurs d'un tournoi en 1 contre 1 : tableaux de participants, dotation (places) et arbres."""
    seen = {}
    for b in templates(text, "Opponent") + templates(text, "Player") + templates(text, "1Opponent"):
        d, pos = args(b)
        if d.get("type") in ("team", "literal"): continue
        h = strip_links(d.get("1") or d.get("name") or d.get("link") or (pos[0] if pos else ""))
        if not h or h.upper() in ("TBD", "BYE", "") or len(h) > 30: continue
        f = cc(d.get("flag", ""))
        if h not in seen or (f and not seen[h]): seen[h] = f
    # places : modèles de dotation {{Slot|place=…|{{Opponent|…}}}}
    places = {}
    for b in templates(text, "Slot"):
        d, _ = args(b)
        p = place_of(d.get("place"))
        if not p: continue
        for ob in templates(b[2:], "Opponent"):
            od, opos = args(ob)
            h = strip_links(od.get("1") or od.get("name") or (opos[0] if opos else ""))
            if h: places[h] = min(places.get(h, 999), p)
    return [{"player": h, "flag": f, "place": places.get(h)} for h, f in seen.items()]

# ---------- notes : place obtenue, pondérée par le prestige du tournoi ----------
def place_rating(place, n, tier, usd):
    # simple participation : un plateau S-Tier réunit l'élite mondiale
    if not place: base = 85 if tier == "S" else 81
    elif place == 1: base = 92
    elif place == 2: base = 90
    elif place <= 4: base = 88
    elif place <= 8: base = 85
    elif place <= 16: base = 82
    elif place <= 32: base = 79
    else: base = 76
    if tier != "S": base -= 2
    if usd and usd < 50000: base -= 1
    return base

def build(game):
    wiki, lists, kind = GAMES[game]
    events = []
    for k, t in enumerate(lists):
        tier = "S" if k == 0 else "A"
        try: events += [dict(e, tier=tier) for e in lp_lists.tournaments(lp.html(wiki, t), tier)]
        except Exception as ex: print(game, t, "liste indisponible :", ex, file=sys.stderr)
    events = [e for e in events if e["year"] in (2025, 2026)]
    # ---- calendrier 2026 : les tournois de 2026 ; ceux de 2025 dont la série n'a pas (encore) d'édition 2026 sont repris à la même date
    series = lambda e: norm(re.sub(r"\b(20\d\d|[IVX]+|\d+)\b", "", e["name"]))
    s26 = {series(e) for e in events if e["year"] == 2026}
    cal, seen = [], set()
    for e in sorted(events, key=lambda e: (-e["year"], -e["usd"])):
        if e["year"] == 2025 and series(e) in s26: continue
        w = start_week(e["date"], e["year"])
        if not w: continue
        name = clean(e["name"]); key = (name, w)
        if key in seen: continue
        seen.add(key)
        eur = round(e["usd"] * 0.92 / 100) * 100 or (30000 if e["tier"] == "S" else 8000)
        size = max(8, min(32, e["n"] or 16))
        cal.append([name, w, eur, "1" if e["tier"] == "S" else "12", size])
    cal.sort(key=lambda x: (x[1], -x[2]))
    # ---- palmarès : tournois terminés
    hist = [[e["year"], e["name"], e["winner"], e["runner"], e["usd"], e["tier"]] for e in events if e["winner"] and e["winner"] != "TBD"]
    # ---- participants des tournois terminés les plus récents (les plus grands d'abord)
    done = sorted([e for e in events if e["winner"] and e["winner"] != "TBD"], key=lambda e: (e["tier"] != "S", -e["year"], -e["usd"]))[:MAX_EVENTS[kind]]
    best, cnt, info = {}, {}, {}
    for e in done:
        try: text = lp.page(wiki, e["page"])
        except Exception as ex: print(game, e["page"], "page indisponible :", ex, file=sys.stderr); continue
        if kind == "team":
            for t in team_participants(text):
                k = norm(t["team"])
                r = place_rating(1 if norm(e["winner"]) == k else 2 if norm(e["runner"]) == k else None, e["n"], e["tier"], e["usd"])
                best[k] = max(best.get(k, 0), r); cnt[k] = cnt.get(k, 0) + 1
                if k not in info or len(t["players"]) >= len(info[k]["players"]): info[k] = t
        else:
            for p in solo_participants(text):
                k = norm(p["player"])
                if not k: continue
                r = place_rating(p["place"] or (1 if norm(e["winner"]) == k else 2 if norm(e["runner"]) == k else None), e["n"], e["tier"], e["usd"])
                best[k] = max(best.get(k, 0), r); cnt[k] = cnt.get(k, 0) + 1
                if k not in info or (p["flag"] and not info[k]["flag"]): info[k] = p
    return events, cal, hist, best, cnt, info

GAME_SIZE = {"bs": 3, "mr": 6, "wr": 5, "wot": 7, "hots": 5}
def assemble(game, best, cnt, info):
    kind = GAMES[game][2]
    rate = lambda k: min(94, best[k] + min(2, cnt[k] - 1))
    orgs, out = {}, []
    if kind == "team":
        for k in sorted(best, key=lambda k: -rate(k)):
            t = info[k]
            ps = t["players"][:GAME_SIZE[game]]
            occ = t["flag"] or max([p[1] for p in ps if p[1]] or ["US"], key=[p[1] for p in ps].count)
            o = org_for(t["team"])
            if not o:
                o = game + "_" + norm(t["team"])[:22]
                orgs[o] = [t["team"], make_tag(t["team"]), occ, hcolor(t["team"]), 40 if rate(k) >= 88 else 25 if rate(k) >= 84 else 15]
            r = rate(k)
            out.append([o, [[h, c or occ, max(65, r - 2 + jit(h, 5) - 1), 0] for h, c in ps], 1])
    else:
        for k in sorted(best, key=lambda k: -rate(k)):
            p = info[k]
            out.append([p["player"], p["flag"], max(65, rate(k) + jit(p["player"], 3) - 1), 0])
    return orgs, out

def main(only):
    lines = open(LIVE, encoding="utf-8").read().split("\n")
    def patch(const, fn):
        for i, l in enumerate(lines):
            if l.startswith("const %s = " % const):
                v = json.loads(l[len("const %s = " % const):].rstrip(";"))
                fn(v); lines[i] = "const %s = %s;" % (const, json.dumps(v, ensure_ascii=False)); return
        raise SystemExit("constante introuvable : " + const)
    for game in only:
        events, cal, hist, best, cnt, info = build(game)
        orgs, out = assemble(game, best, cnt, info)
        kind = GAMES[game][2]
        top = ", ".join(("%s %d" % (ORGS.get(e[0], orgs.get(e[0], [e[0]]))[0], e[1][0][2])) if kind == "team" else "%s %d" % (e[0], e[2]) for e in out[:8])
        print("%s : %d %s, %d tournois au calendrier, %d titres ; meilleurs : %s" % (game, len(out), "équipes" if kind == "team" else "joueurs", len(cal), len(hist), top), file=sys.stderr)
        if not out: continue
        def set_orgs(v):
            for k in [k for k in v if k.startswith(game + "_")]: del v[k]
            v.update(orgs)
        patch("LIVE_ORGS", set_orgs)
        if kind == "team": patch("LIVE_ROSTERS", lambda v: v.__setitem__(game, out))
        else: patch("LIVE_SOLOS", lambda v: v.__setitem__(game, out))
        if cal: patch("LIVE_TOURNAMENTS", lambda v: v.__setitem__(game, cal))
        patch("LIVE_HISTORY", lambda v: v.__setitem__(game, [h for h in hist if h[0] < 2026]))
    open(LIVE, "w", encoding="utf-8").write("\n".join(lines))

if __name__ == "__main__":
    main(sys.argv[1:] or list(GAMES))
