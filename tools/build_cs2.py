# Ajoute Counter-Strike 2 à js/data_live.js à partir des fichiers de l'utilisateur (Google Sheet d'après Liquipedia) :
#   tools/sources/cs2/teams.csv    : équipes par région et par tranche de gains 2026 (équipe / ID, Real Name / joueurs)
#   tools/sources/cs2/players.csv  : portail des joueurs par pays (« pseudo - Nom réel (rôle) »)
#   tools/sources/cs2/tournois.csv : tournois S/A/B/C-Tier 2026
# Les autres jeux de data_live.js ne sont pas touchés (leurs sources ne sont pas dans le dépôt).
# Usage : python3 tools/build_cs2.py
import csv, datetime, json, os, re, subprocess, sys, unicodedata, zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, "tools/sources/cs2")
LIVE = os.path.join(ROOT, "js/data_live.js")
SEASON_FIRST, SEASON_LAST = 2, 50

cur = json.loads(subprocess.run(["node", "-e", f"""
const fs=require('fs');eval(fs.readFileSync({json.dumps(os.path.join(ROOT, 'js/data.js'))},'utf8')+';global.X={{ORGS,ROSTERS,REGION_OF,COUNTRIES}}');
console.log(JSON.stringify(X))"""], capture_output=True, text=True, check=True).stdout)

def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", s.lower())
FILLER = {"esports", "esport", "team", "gaming", "club", "the", "gg"}
def make_tag(name):
    words = [w for w in re.findall(r"[A-Za-z0-9]+", name) if w.lower() not in FILLER] or re.findall(r"[A-Za-z0-9]+", name) or ["TEAM"]
    return ("".join(w[0] for w in words) if len(words) >= 2 else words[0][:4]).upper()[:4]
def hcolor(s): return "hsl(%d 60%% 52%%)" % (zlib.crc32(s.encode()) % 360)
jit = lambda h, k: zlib.crc32(h.encode()) % k

ISO = {"Albania": "AL", "Algeria": "DZ", "Argentina": "AR", "Australia": "AU", "Austria": "AT", "Azerbaijan": "AZ", "Belarus": "BY", "Belgium": "BE",
    "Bosnia and Herzegovina": "BA", "Brazil": "BR", "Bulgaria": "BG", "Canada": "CA", "Chile": "CL", "China": "CN", "Colombia": "CO", "Croatia": "HR",
    "Czechia": "CZ", "Denmark": "DK", "Ecuador": "EC", "Estonia": "EE", "Finland": "FI", "France": "FR", "Georgia": "GE", "Germany": "DE", "Greece": "GR",
    "Guatemala": "GT", "Hong Kong": "HK", "Hungary": "HU", "Iceland": "IS", "India": "IN", "Indonesia": "ID", "Iran": "IR", "Iraq": "IQ", "Ireland": "IE",
    "Israel": "IL", "Jordan": "JO", "Kazakhstan": "KZ", "Kosovo": "XK", "Kyrgyzstan": "KG", "Latvia": "LV", "Lebanon": "LB", "Lithuania": "LT",
    "Luxembourg": "LU", "Malaysia": "MY", "Malta": "MT", "Mexico": "MX", "Moldova": "MD", "Mongolia": "MN", "Montenegro": "ME", "Netherlands": "NL",
    "New Zealand": "NZ", "North Macedonia": "MK", "Norway": "NO", "Pakistan": "PK", "Palestine": "PS", "Peru": "PE", "Philippines": "PH", "Poland": "PL",
    "Portugal": "PT", "Romania": "RO", "Russia": "RU", "Saudi Arabia": "SA", "Serbia": "RS", "Singapore": "SG", "Slovakia": "SK", "Slovenia": "SI",
    "South Africa": "ZA", "South Korea": "KR", "Spain": "ES", "Sweden": "SE", "Switzerland": "CH", "Syria": "SY", "Taiwan": "TW", "Thailand": "TH",
    "Tunisia": "TN", "Turkey": "TR", "Ukraine": "UA", "United Arab Emirates": "AE", "United Kingdom": "GB", "United States": "US", "Uruguay": "UY"}
STAFF = re.compile(r"coach|analyst|manager", re.I)

# ---------- portail : pays de chaque joueur ----------
cc_of, portal = {}, []
cc = None
for r in csv.reader(open(os.path.join(DIR, "players.csv"), encoding="utf-8")):
    a = (r[0] if r else "").strip()
    if not a: continue
    if " - " not in a:
        cc = ISO.get(a); continue
    h, rest = a.split(" - ", 1)
    role = re.search(r"\(([^)]*)\)\s*$", rest)
    if not cc or (role and STAFF.search(role.group(1))): continue
    h = h.strip()
    cc_of.setdefault(norm(h), cc); portal.append((h, cc))

# ---------- équipes : région, tranche de gains, effectif ----------
REGION_HDR = {"Europe": "EU", "CIS Team": "CIS", "North American Team": "NA", "Oceania Team Portal": "OCE", "Asian Team Portal": "ASIA", "African Teams": "AF"}
# note de base des joueurs d'après les gains 2026 de l'équipe
BRACKET = [(500000, 84), (250000, 79), (100000, 76), (50000, 72), (25000, 69), (10000, 66), (0, 62)]
# circuit féminin : pas de scène CS2 féminine dans le jeu (comme le Game Changers à part pour Valorant)
FEMALE = {norm(x) for x in ["MIBR Female", "FlyQuest RED", "Shimmer", "Let Her Cook"]}
rows = [(r + ["", ""])[:2] for r in csv.reader(open(os.path.join(DIR, "teams.csv"), encoding="utf-8"))]
teams, order, region, base, team = {}, [], "EU", 62, None
for i, (a, b) in enumerate(rows):
    a = a.strip()
    nxt, nb = ((rows[i + 1][0].strip(), rows[i + 1][1].strip()) if i + 1 < len(rows) else ("", ""))
    if a in REGION_HDR: region = REGION_HDR[a]; team = None; continue
    m = re.match(r"([≥≤])([\d,]+) Earnings", a)
    if m:
        v = int(m.group(2).replace(",", ""))
        base = 62 if m.group(1) == "≤" else next(r for lim, r in BRACKET if v >= lim)
        # les clubs d'Amérique du Sud suivent le bloc nord-américain, sans en-tête de région
        if region == "NA" and i > 0 and not rows[i - 1][0].strip() and v >= 500000: region = "SA"
        team = None; continue
    if a == "Active Teams": base = 66; continue
    if not a or a == "ID": continue
    # en-tête d'équipe : suivi de « ID », ou nom seul suivi d'une autre ligne sans nom réel (équipes sans effectif : 9z, FURIA, Legacy)
    if nxt == "ID" or (not b.strip() and not nb and nxt not in REGION_HDR and nxt):
        if norm(a) in teams: team = None; continue                   # bloc en double (CIS)
        team = teams[norm(a)] = {"name": a, "reg": region, "base": 60 if region == "AF" else 65 if region == "OCE" else base, "ps": []}
        order.append(norm(a)); continue
    if not team: continue
    tag = re.search(r"\(([^)]*)\)\s*$", a)
    if tag and re.search(r"coach|inactive", tag.group(1), re.I): continue
    h = re.sub(r"\s*\([^)]*\)\s*$", "", a).strip()
    if h and h not in team["ps"]: team["ps"].append(h)

ORGS = cur["ORGS"]
ALIASES = {"natusvincere": "navi", "teamvitality": "vitality", "teamfalcons": "falcons", "teamspirit": "spirit", "themongolz": "mongolz", "fazeclan": "faze",
           "g2esports": "g2", "100thieves": "100t", "paingaming": "pain", "gamerlegion": "gl", "betboomteam": "betboom", "teamliquid": "liquid",
           "ninjasinpyjamas": "nip", "aurora": "aurora", "auroragaming": "aurora", "furia": "furia", "mibr": "mibr", "parivision": "parivision"}
by_name = {norm(v[0]): k for k, v in ORGS.items()}
by_name.update({norm(v[1]): k for k, v in ORGS.items() if len(v[1]) > 2})
def org_for(name):
    n = norm(name)
    o = ALIASES.get(n) or by_name.get(n)
    return o if o in ORGS else None

existing = {x[0]: x for x in cur["ROSTERS"]["cs2"]}
known_rating = {norm(p[0]): p[2] for x in cur["ROSTERS"]["cs2"] for p in x[1]}
known_age = {norm(p[0]): p[3] for x in cur["ROSTERS"]["cs2"] for p in x[1] if p[3]}
known_nat = {norm(p[0]): p[1] for x in cur["ROSTERS"]["cs2"] for p in x[1] if p[1]}
REG_CC = {"EU": "DE", "CIS": "RU", "NA": "US", "SA": "BR", "OCE": "AU", "ASIA": "CN", "AF": "ZA"}
live_orgs, out, used, taken = {}, [], set(), set()
for nt in order:
    t = teams[nt]
    if nt in FEMALE: continue
    org = org_for(t["name"])
    if org in taken: org = None
    hs = [h for h in t["ps"] if norm(h) not in used]
    if len(hs) < 3:
        # effectif inconnu dans le fichier (FURIA…) : celui de data.js est gardé
        if org in existing: out.append(existing[org]); taken.add(org); used.update(norm(p[0]) for p in existing[org][1])
        continue
    ps = []
    for h in hs[:6]:
        used.add(norm(h))
        r = known_rating.get(norm(h)) or t["base"] + jit(h, 7) - 3
        ps.append([h, cc_of.get(norm(h)) or known_nat.get(norm(h), ""), r, known_age.get(norm(h), 0)])
    if not org:
        org = "cs2_" + nt[:22]
        ccs = [p[1] for p in ps if p[1]]
        occ = max(set(ccs), key=ccs.count) if ccs else REG_CC[t["reg"]]
        live_orgs[org] = [t["name"], make_tag(t["name"]), occ, hcolor(t["name"]), int(max(6, min(70, (t["base"] - 58) * 2.6)))]
    for p in ps:
        if not p[1]: p[1] = (live_orgs.get(org) or ORGS[org])[2]
    taken.add(org); out.append([org, ps, 1])
# équipes de data.js absentes du fichier
out += [x for k, x in existing.items() if k not in taken and not any(norm(p[0]) in used for p in x[1])]
size = 5
out.sort(key=lambda x: -sum(sorted((p[2] for p in x[1]), reverse=True)[:size]) / max(1, min(size, len(x[1]))))
# vrais joueurs sans équipe : agents libres (900 au plus, tirés sans ordre alphabétique)
fa = [[h, c, 58 + jit(h, 11), 0] for h, c in portal if norm(h) not in used]
seen, fa_u = set(), []
for p in sorted(fa, key=lambda p: zlib.crc32(p[0].encode())):
    if norm(p[0]) not in seen: seen.add(norm(p[0])); fa_u.append(p)
fa_u = fa_u[:900]
print("CS2 : %d équipes (%d nouvelles), %d joueurs, %d agents libres" % (len(out), len(live_orgs), sum(len(x[1]) for x in out), len(fa_u)), file=sys.stderr)

# ---------- tournois ----------
MON = {m: k + 1 for k, m in enumerate("jan feb mar apr may jun jul aug sep oct nov dec".split())}
def tdate(txt):
    y = re.search(r"(20\d\d)", txt)
    parts = re.findall(r"([A-Za-z]{3})[a-z.]*\s+(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?", txt)
    if not y or not parts or parts[0][0].lower() not in MON: return None, None
    year = int(y.group(1)); m1, d1, d1b = parts[0]
    start = datetime.date(year, MON[m1.lower()], int(d1))
    end = datetime.date(year, MON[parts[1][0].lower()], int(parts[1][1])) if len(parts) > 1 and parts[1][0].lower() in MON else datetime.date(year, MON[m1.lower()], int(d1b or d1))
    if end < start: end = start
    return year, (start + (end - start) / 2).timetuple().tm_yday
def iso_week(year, doy):
    return max(SEASON_FIRST, min(SEASON_LAST, (datetime.date(year, 1, 1) + datetime.timedelta(days=doy - 1)).isocalendar()[1]))
REG = [(r"South America|Brazil|São Paulo|Sorocaba|Curitiba|Cuiabá|Rio de Janeiro|Buenos Aires", "SA"), (r"North America|Las Vegas|Lisle|Austin|Syracuse|Fort Worth|Atlanta", "NA"),
       (r"Oceania|Brisbane", "OCE"), (r"Asia|China|Shanghai|Beijing|Hangzhou|Luoyang|Ulaanbaatar|Japan|Vietnam|India|Karachi|Mongolia", "ASIA"),
       (r"Johannesburg|Africa", "MENA"), (r"Europe|CIS|Russia|Moscow|Kazakhstan|Uzbekistan|Bukhara|Stockholm|Bucharest|Belgrade|Barcelona|Prague|Brno|Vila Nova de Gaia|"
        r"Lisbon|Warsaw|Wrocław|Łódź|Skövde|Karlskrona|Sheffield|Kettering|Riga|Tampere|Finland|Ukraine|Moldova|Spain|Hamburg|Odense|Aveiro|Bern|Nitra|Sofia|Pristina|"
        r"Bergen|Sweden|Recquignies|Braga", "EU")]
SKIP = re.compile(r"Cancelled|Female|Rainhas|WIBR|Qualifier|University|College|Collegiate|Student|Texas Collegiate|HLTV Awards|Nations Cup", re.I)
cal, sec = [], "S"
for r in csv.reader(open(os.path.join(DIR, "tournois.csv"), encoding="utf-8")):
    r = (r + [""] * 9)[:9]
    a = r[0].strip()
    if re.match(r"A-Tier", a): sec = "A"; continue
    if re.match(r"B tier", a, re.I): sec = "B"; continue
    if re.match(r"C tier", a, re.I): sec = "C"; continue
    name = r[2].strip()
    if not name or name == "Tournament" or SKIP.search(name) or r[7].strip() == "Cancelled": continue
    year, doy = tdate(r[3])
    if year != 2026: continue
    usd = float(re.sub(r"[^\d.]", "", r[4]) or 0)
    if sec == "C" and usd < 5000: continue                          # petits tournois locaux : le jeu génère déjà des coupes amateurs
    eur = round(usd * 0.92 / 1000) * 1000 or {"S": 500000, "A": 80000, "B": 10000, "C": 4000}[sec]
    n = int(re.sub(r"\D", "", r[6]) or 16)
    loc = r[5].strip()
    reg = "" if sec == "S" else next((k for pat, k in REG if re.search(pat, name + " " + loc)), "")
    tiers = {"S": "1", "A": "12", "B": "23", "C": "3"}[sec]
    clean = re.sub(r"\s*\b20\d\d\b:?\s*", " ", name).replace("  ", " ").strip()
    if clean.startswith("Esports World Cup"): clean = "EWC — Counter-Strike 2"
    t = [clean, iso_week(year, doy), eur, tiers, max(4, min(32 if sec == "S" else 16, n))]
    if reg: t.append(reg)
    cal.append(t)
cal.sort(key=lambda t: (t[1], -t[2]))
print("CS2 : %d tournois au calendrier (S %d, A %d, B %d, C %d)" % (len(cal), *[sum(1 for t in cal if t[3] == k) for k in ("1", "12", "23", "3")]), file=sys.stderr)

# ---------- écriture : seules les entrées cs2 changent ----------
lines = open(LIVE, encoding="utf-8").read().split("\n")
def patch(const, fn):
    for i, l in enumerate(lines):
        if l.startswith("const %s = " % const):
            v = json.loads(l[len("const %s = " % const):].rstrip(";"))
            fn(v); lines[i] = "const %s = %s;" % (const, json.dumps(v, ensure_ascii=False)); return
    raise SystemExit("constante introuvable : " + const)
def set_orgs(v):
    for k in [k for k in v if k.startswith("cs2_")]: del v[k]
    v.update(live_orgs)
patch("LIVE_ORGS", set_orgs)
patch("LIVE_ROSTERS", lambda v: v.__setitem__("cs2", out))
patch("LIVE_FREE_AGENTS", lambda v: v.__setitem__("cs2", fa_u))
patch("LIVE_TOURNAMENTS", lambda v: v.__setitem__("cs2", cal))
open(LIVE, "w", encoding="utf-8").write("\n".join(lines))
