# Ajoute Trackmania à js/data_live.js à partir des fichiers de l'utilisateur (Google Sheet d'après Liquipedia) :
#   tools/sources/trackmania/players.csv  : portail des pilotes par pays (ID, nom réel, équipe)
#   tools/sources/trackmania/teams.csv    : équipes par région (Europe, North America, Asia-Pacific) ; certaines sont des communautés
#   tools/sources/trackmania/tournois.csv : tournois 2026 avec leur tier Liquipedia (Tier 1 à 4, Monthly, Showmatch…)
# Trackmania se joue seul : chaque pilote d'une organisation est une entrée de SOLOS (les suivants courent dans une équipe « sœur »).
# Les notes viennent des résultats 2026, du club et de quelques références connues de la scène ; les autres jeux ne sont pas touchés.
# Usage : python3 tools/build_tm.py
import csv, datetime, json, os, re, subprocess, sys, unicodedata, zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, "tools/sources/trackmania")
LIVE = os.path.join(ROOT, "js/data_live.js")
SEASON_FIRST, SEASON_LAST = 2, 50
GAME = "trackmania"

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

ISO = {"Albania": "AL", "Austria": "AT", "Belgium": "BE", "Croatia": "HR", "Czechia": "CZ", "Denmark": "DK", "Estonia": "EE", "Finland": "FI",
    "France": "FR", "Germany": "DE", "Hungary": "HU", "Iceland": "IS", "Ireland": "IE", "Italy": "IT", "Latvia": "LV", "Lithuania": "LT", "Malta": "MT",
    "Netherlands": "NL", "Norway": "NO", "Poland": "PL", "Portugal": "PT", "Romania": "RO", "Russia": "RU", "Serbia": "RS", "Slovakia": "SK",
    "Slovenia": "SI", "Spain": "ES", "Sweden": "SE", "Switzerland": "CH", "Ukraine": "UA", "United Kingdom": "GB", "Argentina": "AR", "Brazil": "BR",
    "Canada": "CA", "Chile": "CL", "Colombia": "CO", "Jamaica": "JM", "Mexico": "MX", "United States": "US", "Uruguay": "UY", "Australia": "AU",
    "New Zealand": "NZ", "Azerbaijan": "AZ", "China": "CN", "Hong Kong": "HK", "India": "IN", "Indonesia": "ID", "Israel": "IL", "Japan": "JP",
    "Malaysia": "MY", "Singapore": "SG", "South Korea": "KR", "Syria": "SY", "Taiwan": "TW", "Turkey": "TR", "Morocco": "MA", "South Africa": "ZA"}

# ---------- portail : pays et équipe de chaque pilote ----------
portal, cc, sec = [], None, None
rows = list(csv.reader(open(os.path.join(DIR, "players.csv"), encoding="utf-8")))
for i, r in enumerate(rows):
    r = (r + [""] * 4)[:4]
    a = r[0].strip()
    if i + 1 < len(rows) and rows[i + 1][:1] == ["Players"] and a != "Players": cc = ISO.get(a); continue
    if a == "Players": sec = "p"; continue
    if a.startswith("Staff"): sec = "s"; continue
    if a in ("ID", "") or sec != "p" or not cc: continue
    portal.append((a, cc, r[2].strip()))
cc_of, team_of = {}, {}
for h, c, t in portal:
    cc_of.setdefault(norm(h), c)
    if t: team_of.setdefault(norm(h), t)

# ---------- équipes : les petites équipes du fichier (les communautés de dizaines de membres sont ignorées) ----------
REGION_HDR = {"Europe": "EU", "North America": "NA", "Asia-Pacific": "AP"}
REG_CC = {"EU": "FR", "NA": "US", "AP": "AU"}
rows = [(r + ["", "", ""])[:3] for r in csv.reader(open(os.path.join(DIR, "teams.csv"), encoding="utf-8"))]
teams, region, team = {}, "EU", None
for i, (a, b, role) in enumerate(rows):
    a = a.strip()
    nxt = rows[i + 1][0].strip() if i + 1 < len(rows) else ""
    if a in REGION_HDR and nxt != "ID": region = REGION_HDR[a]; team = None; continue
    if not a or a == "ID": continue
    if nxt == "ID": team = teams.setdefault(a, {"reg": region, "ps": []}); continue
    if team is not None and not re.search(r"coach|manager|analyst", role, re.I) and a not in team["ps"]: team["ps"].append(a)
for t, x in teams.items():
    if len(x["ps"]) <= 10:
        for h in x["ps"]: team_of.setdefault(norm(h), t)

# ---------- tournois 2026 ----------
MON = {m: k + 1 for k, m in enumerate("jan feb mar apr may jun jul aug sep oct nov dec".split())}
def tdate(txt):
    y = re.search(r"(20\d\d)", txt)
    parts = re.findall(r"([A-Za-z]{3})[a-z.]*\s+(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?", txt)
    if not y: return None, None
    year = int(y.group(1))
    if not parts:                                            # « nov., 2026 » : le mois seulement
        m = re.match(r"\s*([A-Za-z]{3})", txt)
        if not m or m.group(1).lower() not in MON: return None, None
        return year, datetime.date(year, MON[m.group(1).lower()], 15).timetuple().tm_yday
    if parts[0][0].lower() not in MON: return None, None
    m1, d1, d1b = parts[0]
    start = datetime.date(year, MON[m1.lower()], int(d1))
    end = datetime.date(year, MON[parts[1][0].lower()], int(parts[1][1])) if len(parts) > 1 and parts[1][0].lower() in MON else datetime.date(year, MON[m1.lower()], int(d1b or d1))
    if end < start or (end - start).days > 60: end = start
    return year, (start + (end - start) / 2).timetuple().tm_yday
tours, seen = [], set()
for r in csv.reader(open(os.path.join(DIR, "tournois.csv"), encoding="utf-8")):
    r = (r + [""] * 9)[:9]
    kind, name = r[0].strip(), r[2].strip()
    if not name or name in seen: continue
    m = re.search(r"Tier (\d)", kind)
    if kind.startswith(("Camp", "Qual")) or not (m or kind in ("Monthly", "Showmatch")): continue   # campagnes et qualifications : pas des tournois
    tier = int(m.group(1)) if m else (3 if kind == "Monthly" else 1)
    if kind.startswith("Showm") and tier > 1: continue                                     # Bonk Cups et petits showmatchs
    year, doy = tdate(r[3])
    if year != 2026: continue
    seen.add(name)
    tours.append({"tier": tier, "show": kind.startswith("Show"), "name": name, "doy": doy, "usd": float(re.sub(r"[^\d.]", "", r[4]) or 0), "loc": r[5].strip(),
                  "n": int(re.sub(r"\D", "", r[6]) or 0), "win": [x.strip() for x in r[7].split("\n") if x.strip()], "ru": [x.strip() for x in r[8].split("\n") if x.strip()]})
score = {}
for t in tours:
    k = {1: 4.0, 2: 2.0, 3: 0.8, 4: 0.3}[t["tier"]]
    for h in t["win"]: score[norm(h)] = score.get(norm(h), 0) + k
    for h in t["ru"]: score[norm(h)] = score.get(norm(h), 0) + k * 0.6

# ---------- pilotes ----------
# références de la scène (champions et habitués des grandes finales) : leur note sert de plancher
KNOWN = {"granady": 92, "pac": 90, "carljr": 90, "affi": 89, "massa": 89, "bren": 88, "mudda": 88, "yannex": 88, "scrapie": 87, "wosile": 87,
         "otaaaq": 86, "nayko": 86, "walegen": 86, "epos": 86, "aurel": 85, "eria": 85, "binkss": 85, "whizzy": 85, "gwen": 84, "kimi": 84,
         "flimsy": 84, "hobbit": 84, "stufts": 84, "l1ngo": 84, "taak": 84, "jswag": 83, "mime": 83, "tona": 83, "lars": 83, "speedself": 83,
         "baiwack": 82, "nitech": 82, "dummy": 82, "glidurr": 82, "krude": 82, "lordquacked": 82, "neal": 81, "spark": 80, "cemko": 80, "huso": 80}
STREAMERS = {"sardoche": 70, "zerator": 68, "wirtual": 79}
TOP_ORGS = {norm(x) for x in ["BIG", "Team Vitality", "Team Falcons", "Team Liquid", "Gen.G Esports", "ROC Esports", "Twisted Minds", "FUT Esports",
            "All Gamers Global", "S8UL Esports", "Weibo Gaming", "Natus Vincere", "Aurora Gaming", "Titan Esports Club", "Fnatic", "Sentinels",
            "GodLike Esports", "Rex Regum Qeon", "Solary", "Team BPP", "eSport Line", "Nyxar Main", "Halcyon", "Holy Dynasty", "Jetlag Racing"]}
NOT_TEAMS = {"retired", "inactive"}
# communautés (plus de 10 membres dans le fichier des équipes ou dans le portail) : pas des équipes pro
from collections import Counter
pcount = Counter(norm(t) for h, c, t in portal if t)
COMMUNITY = {norm(t) for t, x in teams.items() if len(x["ps"]) > 10} | {t for t, k in pcount.items() if k > 10}
ALIASES = {"teamvitality": "vitality", "teamfalcons": "falcons", "teamliquid": "liquid", "gengesports": "geng", "natusvincere": "navi",
           "weibogaming": "wbg", "fnatic": "fnatic", "solary": "solary", "auroragaming": "aurora", "rexregumqeon": "rrq"}
by_name = {norm(v[0]): k for k, v in ORGS.items()}
by_name.update({norm(v[1]): k for k, v in ORGS.items() if len(v[1]) > 2})
def org_for(name):
    n = norm(name); o = ALIASES.get(n) or by_name.get(n)
    return o if o in ORGS else None
live_orgs, org_id = {}, {}
def org_of(t):
    if t in org_id: return org_id[t]
    o = org_for(t)
    if not o:
        o = "tm_" + norm(t)[:22]
        reg = teams.get(t, {}).get("reg")
        ccs = [c for h, c, tt in portal if tt == t]
        occ = max(set(ccs), key=ccs.count) if ccs else REG_CC.get(reg, "FR")
        live_orgs[o] = [t, make_tag(t), occ, hcolor(t), 38 if norm(t) in TOP_ORGS else 14]
    org_id[t] = o; return o
names = {}
for h, c, t in portal: names.setdefault(norm(h), h)
solos, fa = [], []
for n, h in names.items():
    t = team_of.get(n)
    if t and (norm(t) in NOT_TEAMS or (norm(t) in COMMUNITY and norm(t) not in TOP_ORGS)): t = None
    sc = score.get(n, 0)
    if n in STREAMERS: r = STREAMERS[n]
    else:
        base = (78 if norm(t) in TOP_ORGS else 70) if t else 70 if sc else 0
        r = max(KNOWN.get(n, 0), min(94, int(base + min(14, sc * 1.8) + jit(h, 5) - 2))) if base or n in KNOWN else 0
    if not r: fa.append([h, cc_of.get(n, ""), 55 + jit(h, 10), 0]); continue
    p = [h, cc_of.get(n, ""), r, 0]
    solos.append([org_of(t), [p]] if t else p)
rating = lambda e: (e[1][0] if isinstance(e[1], list) else e)[2]
solos.sort(key=lambda e: -rating(e))
fa = sorted(fa, key=lambda p: zlib.crc32(p[0].encode()))[:800]
print("TM : %d pilotes (%d dans une organisation, %d nouvelles organisations), %d agents libres ; meilleurs : %s" % (
    len(solos), sum(1 for e in solos if isinstance(e[1], list)), len(live_orgs), len(fa),
    ", ".join("%s %d" % ((e[1][0] if isinstance(e[1], list) else e)[0], rating(e)) for e in solos[:12])), file=sys.stderr)

# ---------- calendrier ----------
def iso_week(doy): return max(SEASON_FIRST, min(SEASON_LAST, (datetime.date(2026, 1, 1) + datetime.timedelta(days=doy - 1)).isocalendar()[1]))
def region(loc):
    if re.search(r"Asia|India|Singapore|Japan|Korea|China", loc): return "ASIA"
    if re.search(r"Newark|North America|United States|Canada|Americas", loc): return "NA|SA"
    if re.search(r"Belgium|Italy|United Kingdom|Ireland|Paris|Marzy|Finland|France|Germany|Europe|Hamburg|Cologne", loc): return "EU"
    return ""
cal = []
for t in tours:
    if t["tier"] == 4: continue
    tiers = {1: "1", 2: "12", 3: "23"}[t["tier"]] if not t["show"] else "12"
    eur = round(t["usd"] * 0.92 / 100) * 100 or {1: 8000, 2: 1500, 3: 300}[t["tier"]]
    clean = re.sub(r"\s*\b20\d\d\b:?\s*", " ", t["name"]).replace("  ", " ").strip()
    e = [clean, iso_week(t["doy"]), eur, tiers, max(8, min(32, (t["n"] or 16) // 8 * 8 or 16))]
    rg = region(t["loc"])
    if rg and t["tier"] > 1: e.append(rg)
    cal.append(e)
# l'EWC (et ses qualifications, ajoutées par le jeu) reste au calendrier
cal.append(["EWC — Trackmania", 33, 460000, "1", 16])
# Le fichier couvre la fin de saison (septembre-novembre). Le début de saison suit le même modèle que le circuit réel :
# les deux premiers splits d'OverDrive (Major et wildcards) et une BIG YEK Monthly Cup chaque mois.
major = next((e for e in cal if e[0].startswith("OverDrive Split 3: Major")), None)
wild = next((e for e in cal if e[0].startswith("OverDrive Split 3: Wildcards")), None)
monthly = next((e for e in cal if e[0].startswith("BIG YEK Monthly Cup")), None)
for k, w in ((1, 12), (2, 25)):
    if major: cal.append([f"OverDrive Split {k}: Major", w, major[2], major[3], major[4]])
    if wild: cal.append([f"OverDrive Split {k}: Wildcards", w - 1, wild[2], wild[3], wild[4]])
if monthly:
    for mi, mname in enumerate(["January", "February", "March", "April", "May", "June", "July", "August"]):
        cal.append([f"BIG YEK Monthly Cup {mname}", iso_week(datetime.date(2026, mi + 1, 26).timetuple().tm_yday), monthly[2], monthly[3], monthly[4]])
cal.sort(key=lambda e: (e[1], -e[2]))
print("TM : %d tournois au calendrier 2026" % len(cal), file=sys.stderr)

# ---------- écriture : seules les entrées trackmania changent ----------
lines = open(LIVE, encoding="utf-8").read().split("\n")
def patch(const, fn):
    for i, l in enumerate(lines):
        if l.startswith("const %s = " % const):
            v = json.loads(l[len("const %s = " % const):].rstrip(";"))
            fn(v); lines[i] = "const %s = %s;" % (const, json.dumps(v, ensure_ascii=False)); return
    raise SystemExit("constante introuvable : " + const)
def set_orgs(v):
    for k in [k for k in v if k.startswith("tm_")]: del v[k]
    v.update(live_orgs)
patch("LIVE_ORGS", set_orgs)
patch("LIVE_SOLOS", lambda v: v.__setitem__(GAME, solos))
patch("LIVE_FREE_AGENTS", lambda v: v.__setitem__(GAME, fa))
patch("LIVE_TOURNAMENTS", lambda v: v.__setitem__(GAME, cal))
open(LIVE, "w", encoding="utf-8").write("\n".join(lines))
