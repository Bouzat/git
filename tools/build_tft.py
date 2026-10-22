# Ajoute Teamfight Tactics à js/data_live.js à partir des fichiers de l'utilisateur (Google Sheet d'après Liquipedia) :
#   tools/sources/tft/players.csv  : portail des joueurs par pays (ID, nom réel, équipe)
#   tools/sources/tft/teams.csv    : organisations par région (Americas, EMEA, APAC, China) et leurs joueurs
#   tools/sources/tft/tournois.csv : tournois S/A/B/C/D-Tier depuis 2020 (vainqueur et finaliste)
# TFT se joue seul : chaque joueur d'une organisation est une entrée de SOLOS (les suivants jouent dans une équipe « sœur »).
# Les notes viennent des résultats (Tactician's Crown, EWC, finales régionales…) et du club ; les autres jeux ne sont pas touchés.
# Usage : python3 tools/build_tft.py
import csv, datetime, json, os, re, subprocess, sys, unicodedata, zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, "tools/sources/tft")
LIVE = os.path.join(ROOT, "js/data_live.js")
SEASON_FIRST, SEASON_LAST = 2, 50

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

ISO = {"Argentina": "AR", "Bolivia": "BO", "Brazil": "BR", "Canada": "CA", "Chile": "CL", "Colombia": "CO", "Costa Rica": "CR", "Ecuador": "EC",
    "Mexico": "MX", "Paraguay": "PY", "Peru": "PE", "United States": "US", "Uruguay": "UY", "Venezuela": "VE", "Austria": "AT", "Belarus": "BY",
    "Belgium": "BE", "Bulgaria": "BG", "Croatia": "HR", "Czechia": "CZ", "Denmark": "DK", "Egypt": "EG", "Estonia": "EE", "Finland": "FI", "France": "FR",
    "Georgia": "GE", "Germany": "DE", "Greece": "GR", "Hungary": "HU", "Italy": "IT", "Kyrgyzstan": "KG", "Lithuania": "LT", "Luxembourg": "LU",
    "Morocco": "MA", "Netherlands": "NL", "Poland": "PL", "Portugal": "PT", "Romania": "RO", "Russia": "RU", "Serbia": "RS", "Slovakia": "SK",
    "South Africa": "ZA", "Spain": "ES", "Sweden": "SE", "Switzerland": "CH", "Tunisia": "TN", "Turkey": "TR", "Ukraine": "UA", "United Kingdom": "GB",
    "Australia": "AU", "Hong Kong": "HK", "Indonesia": "ID", "Japan": "JP", "Malaysia": "MY", "New Zealand": "NZ", "Philippines": "PH", "Singapore": "SG",
    "South Korea": "KR", "Taiwan": "TW", "Thailand": "TH", "Vietnam": "VN", "China": "CN"}

# ---------- portail : pays et équipe de chaque joueur ----------
portal, cc, sec = [], None, None
rows = list(csv.reader(open(os.path.join(DIR, "players.csv"), encoding="utf-8")))
for i, r in enumerate(rows):
    r = (r + [""] * 4)[:4]
    a = r[0].strip()
    if i + 1 < len(rows) and rows[i + 1][:1] == ["Players"]: cc = ISO.get(a); continue
    if a == "Players": sec = "p"; continue
    if a.startswith("Staff"): sec = "s"; continue
    if a in ("ID", "") or sec != "p" or not cc: continue
    portal.append((a, cc, r[2].strip()))
cc_of, team_of = {}, {}
for h, c, t in portal:
    cc_of.setdefault(norm(h), c)
    if t: team_of.setdefault(norm(h), t)

# ---------- organisations (fichier des équipes) ----------
REGION_HDR = {"Americas": "AM", "EMEA": "EU", "APAC": "AP", "China": "CN"}
REG_CC = {"AM": "US", "EU": "FR", "AP": "KR", "CN": "CN"}
rows = [(r + ["", "", ""])[:3] for r in csv.reader(open(os.path.join(DIR, "teams.csv"), encoding="utf-8"))]
teams, region, team = {}, "AM", None
for i, (a, b, role) in enumerate(rows):
    a = a.strip()
    nxt = rows[i + 1][0].strip() if i + 1 < len(rows) else ""
    if a in REGION_HDR and nxt != "ID": region = REGION_HDR[a]; team = None; continue
    if not a or a == "ID": continue
    if nxt == "ID":
        team = teams.setdefault(a, {"reg": region, "ps": []}); continue
    if team is not None and not re.search(r"coach|analyst|manager", role, re.I): team["ps"].append(a)
# l'équipe d'un joueur : celle du portail (la plus récente), sinon la première du fichier des équipes
for t, x in teams.items():
    for h in x["ps"]: team_of.setdefault(norm(h), t)

# ---------- résultats : vainqueurs et finalistes des grands tournois ----------
MON = {m: k + 1 for k, m in enumerate("jan feb mar apr may jun jul aug sep oct nov dec".split())}
def tdate(txt):
    y = re.search(r"(20\d\d)", txt)
    parts = re.findall(r"([A-Za-z]{3})[a-z.]*\s+(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?", txt)
    if not y or not parts or parts[0][0].lower() not in MON: return None, None
    year = int(y.group(1)); m1, d1, d1b = parts[0]
    start = datetime.date(year, MON[m1.lower()], int(d1))
    end = datetime.date(year, MON[parts[1][0].lower()], int(parts[1][1])) if len(parts) > 1 and parts[1][0].lower() in MON else datetime.date(year, MON[m1.lower()], int(d1b or d1))
    if end < start or (end - start).days > 60: end = start
    return year, (start + (end - start) / 2).timetuple().tm_yday
tours, tier = [], None
for r in csv.reader(open(os.path.join(DIR, "tournois.csv"), encoding="utf-8")):
    r = (r + [""] * 9)[:9]
    m = re.match(r"([SABCD])-[Tt]ier", r[0].strip())
    if m: tier = m.group(1); continue
    name = r[2].strip()
    if not name or not tier: continue
    year, doy = tdate(r[3])
    if year is None: continue
    tours.append({"tier": tier, "name": name, "year": year, "doy": doy, "usd": float(re.sub(r"[^\d.]", "", r[4]) or 0), "loc": r[5].strip(),
                  "n": int(re.sub(r"\D", "", r[6]) or 0), "win": [x.strip() for x in r[7].split("\n") if x.strip()], "ru": [x.strip() for x in r[8].split("\n") if x.strip()]})
JCC = re.compile(r"\bJCC\b|JOC|Women|Men\b|4v4|4vs4|Double Up|Duos|College|Qualifier|PBE|Gauntlet|Fan Voting|Ticket Battle|TFTras|Akademicki|LAN ETS|Huya Cup", re.I)
score = {}
for t in tours:
    if JCC.search(t["name"]) or t["tier"] not in "SAB": continue
    age = 2026 - t["year"]
    k = {"S": 4.0, "A": 2.0, "B": 0.8}[t["tier"]] * (1 if age <= 1 else 0.6 if age <= 2 else 0.3)
    for h in t["win"]: score[norm(h)] = score.get(norm(h), 0) + k
    for h in t["ru"]: score[norm(h)] = score.get(norm(h), 0) + k * 0.6

# ---------- joueurs : organisations, indépendants classés, agents libres ----------
TOP_ORGS = {norm(x) for x in ["T1", "JD Gaming", "Weibo Gaming", "Team Vision", "Aurora Gaming", "Team Vitality", "Gentle Mates", "MOUZ", "Movistar KOI",
            "Ninjas in Pyjamas", "Virtus.pro", "Team Falcons", "Fnatic", "Final Lobby Gaming", "Academy", "Team Liquid", "Nongshim RedForce", "All Gamers",
            "Alpha Gaming", "Flash Wolves", "Rex Regum Qeon", "ZETA DIVISION", "Disguised", "Geekay Esports", "Mihos eSport", "KiraCorp"]}
STREAMERS = {norm(x) for x in ["Disguised Toast", "Imaqtpie", "Scarra", "Kiyoon", "Gotaga", "Forsen", "Reckful", "Kibler", "Amaz", "Hafu"]}
ALIASES = {"teamvitality": "vitality", "gentlemates": "m8", "movistarkoi": "koi", "teamfalcons": "falcons", "teamliquid": "liquid", "onicesports": "onic",
           "nongshimredforce": "ns", "paperrex": "prx", "rexregumqeon": "rrq", "zetadivision": "zeta", "virtuspro": "vp", "weibogaming": "wbg", "jdgaming": "jdg"}
by_name = {norm(v[0]): k for k, v in ORGS.items()}
by_name.update({norm(v[1]): k for k, v in ORGS.items() if len(v[1]) > 2})
def org_for(name):
    n = norm(name)
    o = ALIASES.get(n) or by_name.get(n)
    return o if o in ORGS else None
live_orgs, org_id = {}, {}
def org_of(t):
    if t in org_id: return org_id[t]
    o = org_for(t)
    if not o:
        o = "tft_" + norm(t)[:22]
        reg = teams.get(t, {}).get("reg")
        ccs = [cc_of[norm(h)] for h in teams.get(t, {}).get("ps", []) if norm(h) in cc_of] + [c for h, c, tt in portal if tt == t]
        occ = max(set(ccs), key=ccs.count) if ccs else REG_CC.get(reg, "US")
        live_orgs[o] = [t, make_tag(t), occ, hcolor(t), 40 if norm(t) in TOP_ORGS else 18]
    org_id[t] = o; return o
names = {}
for h, c, t in portal: names.setdefault(norm(h), h)
for t, x in teams.items():
    for h in x["ps"]: names.setdefault(norm(h), h)
NOT_TEAMS = {"retired", "inactive", "coachingtft"}
solos, fa = [], []
for n, h in names.items():
    t = team_of.get(n)
    if t and norm(t) in NOT_TEAMS: t = None
    sc = score.get(n, 0)
    if n in STREAMERS: r = 64 + jit(h, 5)
    else:
        base = (78 if norm(t) in TOP_ORGS else 72) if t else 70 if sc else 0
        if not base: fa.append([h, cc_of.get(n, ""), 56 + jit(h, 10), 0]); continue
        r = min(95, int(base + min(14, sc * 1.6) + jit(h, 5) - 2))
    c = cc_of.get(n) or (REG_CC.get(teams[t]["reg"]) if t in teams else "") or ""
    p = [h, c, r, 0]
    solos.append([org_of(t), [p]] if t else p)
rating = lambda e: (e[1][0] if isinstance(e[1], list) else e)[2]
solos.sort(key=lambda e: -rating(e))
fa = sorted(fa, key=lambda p: zlib.crc32(p[0].encode()))[:600]
print("TFT : %d joueurs (%d dans une organisation, %d nouvelles organisations), %d agents libres ; meilleurs : %s" % (
    len(solos), sum(1 for e in solos if isinstance(e[1], list)), len(live_orgs), len(fa),
    ", ".join("%s %d" % ((e[1][0] if isinstance(e[1], list) else e)[0], rating(e)) for e in solos[:12])), file=sys.stderr)

# ---------- calendrier 2026 ----------
def iso_week(year, doy):
    return max(SEASON_FIRST, min(SEASON_LAST, (datetime.date(year, 1, 1) + datetime.timedelta(days=doy - 1)).isocalendar()[1]))
def region(t):
    # le nom d'abord (« APAC Bilgewater Cup » se joue en Asie-Pacifique même si le lieu cite la Chine), puis le lieu
    for s in (t["name"], t["loc"]):
        r = region_of(s)
        if r: return r
    return ""
def region_of(s):
    if re.search(r"\bAPAC\b", s): return "PAC|KR|OCE"
    if re.search(r"\bEMEA\b", s): return "EU|MENA"
    if re.search(r"AMER|Americas|LATAM|Latin America|North America|Brazil|Montréal", s): return "NA|SA"
    if re.search(r"\bCN\b|China|TFT Open Championship|Hangzhou|Guangzhou|Chengdu", s): return "CN"
    if re.search(r"APAC|Asia-Pacific|Vietnam|Thailand|Korea|Taiwan|Hong Kong|Ho Chi Minh|SEA\b", s): return "PAC|KR|OCE"
    if re.search(r"EMEA|Europe|France|Paris|Spain|Poland|DACH|Vienna|Cologne|Eaubonne|Kraków|Nordic", s): return "EU|MENA"
    return ""
cal = []
for t in tours:
    if t["year"] != 2026 or JCC.search(t["name"]) or t["win"][:1] == ["Cancelled"]: continue
    pro = "Pro Circuit" in t["name"]
    if t["tier"] == "D" and not pro: continue
    if t["tier"] == "C" and t["usd"] < 2000: continue
    if t["tier"] == "B" and t["usd"] < 2000 and not re.search(r"Superbrawl|Tactician", t["name"]): continue
    reg = "" if t["tier"] == "S" or "Invitational" in t["name"] else region(t)
    tiers = "1" if t["tier"] == "S" or "Invitational" in t["name"] else "12" if t["tier"] == "A" or pro else "23" if t["tier"] == "B" else "3"
    eur = round(t["usd"] * 0.92 / 100) * 100 or {"S": 430000, "A": 46000, "B": 6000, "C": 2000, "D": 20000}[t["tier"]]
    clean = re.sub(r"\s*\b20\d\d\b:?\s*", " ", t["name"]).replace("  ", " ").strip()
    clean = re.sub(r"^(Lore & Legends|Space Gods|Enchanted Wilds): (TFT Pro Circuit - )?", r"\1 · ", clean)
    if clean.startswith("Esports World Cup"): clean = "EWC — Teamfight Tactics"
    n = t["n"] or 32
    e = [clean, iso_week(t["year"], t["doy"]), eur, tiers, max(8, min(32, n // 8 * 8 or 8))]
    if reg: e.append(reg)
    cal.append(e)
cal.sort(key=lambda e: (e[1], -e[2]))
hist = [[t["year"], t["name"], t["win"][0], (t["ru"] or [""])[0], round(t["usd"] * 0.92), t["tier"]] for t in tours
        if t["tier"] in "SA" and t["year"] <= 2025 and not JCC.search(t["name"]) and t["win"] and t["win"][0] not in ("TBD", "Cancelled")]
print("TFT : %d tournois au calendrier 2026, %d résultats historiques (S/A-Tier)" % (len(cal), len(hist)), file=sys.stderr)

# ---------- écriture : seules les entrées tft changent ----------
lines = open(LIVE, encoding="utf-8").read().split("\n")
def patch(const, fn):
    for i, l in enumerate(lines):
        if l.startswith("const %s = " % const):
            v = json.loads(l[len("const %s = " % const):].rstrip(";"))
            fn(v); lines[i] = "const %s = %s;" % (const, json.dumps(v, ensure_ascii=False)); return
    raise SystemExit("constante introuvable : " + const)
def set_orgs(v):
    for k in [k for k in v if k.startswith("tft_")]: del v[k]
    v.update(live_orgs)
patch("LIVE_ORGS", set_orgs)
patch("LIVE_SOLOS", lambda v: v.__setitem__("tft", solos))
patch("LIVE_FREE_AGENTS", lambda v: v.__setitem__("tft", fa))
patch("LIVE_TOURNAMENTS", lambda v: v.__setitem__("tft", cal))
patch("LIVE_HISTORY", lambda v: v.__setitem__("tft", hist))
open(LIVE, "w", encoding="utf-8").write("\n".join(lines))
