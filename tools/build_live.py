# Construit js/data_live.js à partir des données récupérées (VLR, Wikidata…).
# Usage : python3 tools/build_live.py <dossier des données> js/data_live.js
import csv, json, os, re, subprocess, sys, unicodedata, zlib
SRC, OUT = sys.argv[1], sys.argv[2]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# données actuelles du jeu (orgs, notes connues des joueurs)
cur = json.loads(subprocess.run(["node", "-e", f"""
const fs=require('fs');eval(fs.readFileSync({json.dumps(os.path.join(ROOT, 'js/data.js'))},'utf8')+';global.X={{ORGS,ROSTERS,SOLOS}}');
console.log(JSON.stringify(X))"""], capture_output=True, text=True, check=True).stdout)
ORGS = cur["ORGS"]

def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", s.lower())
known_rating = {}
for g, lst in cur["ROSTERS"].items():
    for org, ps, *_ in lst:
        for p in ps: known_rating[(g, norm(p[0]))] = p[2]

# âges : Wikidata (pseudo + jeu)
GAMEKEYS = {"val": ["valorant"], "lol": ["league of legends"], "cs2": ["counter-strike"], "dota": ["dota"], "rl": ["rocket league"], "ow": ["overwatch"],
            "r6": ["rainbow six"], "cod": ["call of duty"], "mlbb": ["mobile legends"], "fn": ["fortnite"], "apex": ["apex"], "pubg": ["pubg", "playerunknown"],
            "fc": ["fifa", "ea sports fc"], "sf6": ["street fighter"], "sc2": ["starcraft"], "tk8": ["tekken"], "hok": ["honor of kings"], "chess": ["chess"]}
ages = {}
wd = os.path.join(SRC, "wd_players.csv")
if os.path.exists(wd):
    for r in csv.DictReader(open(wd, encoding="utf-8")):
        for n in (r["label"], r["alias"], r["nick"]):
            if not n: continue
            for g, keys in GAMEKEYS.items():
                if any(k in (r["gameLabel"] or "").lower() for k in keys):
                    ages.setdefault((g, norm(n)), set()).add(r["birth"][:10])
def age_of(g, h):
    b = ages.get((g, norm(h)))
    if not b or len(b) != 1: return 0
    y, m, d = map(int, next(iter(b)).split("-"))
    return 2026 - y - (1 if (m, d) > (10, 20) else 0)   # âge au 20 octobre 2026

# correspondance nom d'équipe -> org existante
ALIASES = {"fnatic": "fnatic", "kiwoomdrx": "drx", "leviatan": "lev", "fluxow7m": "w7m", "nongshimredforce": "ns", "gentlemates": "m8",
           "kruesports": "kru", "allgamers": "al", "dplusesports": "dk", "teamheretics": "heretics", "g2esports": "g2", "geng": "geng"}
by_name = {norm(v[0]): k for k, v in ORGS.items()}
by_name.update({norm(v[1]): k for k, v in ORGS.items() if len(v[1]) > 2})
def org_for(name):
    n = norm(name)
    return ALIASES.get(n) or by_name.get(n)

live_orgs, rosters = {}, {}
FILLER_WORDS = {"esports", "esport", "team", "gaming", "club", "e-sports", "the", "gg"}
def make_tag(name):
    words = [w for w in re.findall(r"[A-Za-z0-9]+", name) if w.lower() not in FILLER_WORDS]
    if not words: words = re.findall(r"[A-Za-z0-9]+", name) or ["TEAM"]
    return ("".join(w[0] for w in words) if len(words) >= 2 else words[0][:4]).upper()[:4]
def hcolor(s): return "hsl(%d 60%% 52%%)" % (zlib.crc32(s.encode()) % 360)

# ---------- Valorant (vlr.gg) ----------
# qualifiés pour VALORANT Champions 2026 et équipes partenaires de la VCT 2026 (sources : esports.gg, Dot Esports, Wikipedia)
VAL_CHAMPIONS = {norm(x) for x in ["TYLOO", "JD Gaming", "EDward Gaming", "Xi Lai Gaming", "Global Esports", "Nongshim RedForce", "Paper Rex", "T1",
    "Karmine Corp", "Team Liquid", "FUT Esports", "Team Vitality", "100 Thieves", "LOUD", "NRG", "G2 Esports"]}
VAL_PARTNERS = {norm(x) for x in ["Cloud9", "Sentinels", "ENVY", "LEVIATÁN", "MIBR", "FURIA", "KRÜ Esports", "Evil Geniuses", "FNATIC", "Team Heretics",
    "BBL Esports", "GIANTX", "Gentle Mates", "Natus Vincere", "Gen.G", "DetonatioN FocusMe", "VARREL", "KIWOOM DRX", "Rex Regum Qeon", "ZETA DIVISION",
    "Team Secret", "FULL SENSE", "All Gamers", "Bilibili Gaming", "FunPlus Phoenix", "Nova Esports", "Titan Esports Club", "Dragon Ranger Gaming", "Wolves Esports", "Trace Esports"]}
vlr = os.path.join(SRC, "vlr_teams.json")
if os.path.exists(vlr):
    TOP = {"europe": 88, "north-america": 87, "brazil": 86, "asia-pacific": 86, "korea": 85, "china": 85, "japan": 82, "la-s": 78, "la-n": 77, "mena": 76, "oceania": 74}
    CC = {"europe": "FR", "north-america": "US", "brazil": "BR", "asia-pacific": "SG", "korea": "KR", "china": "CN", "japan": "JP", "la-s": "AR", "la-n": "MX", "mena": "SA", "oceania": "AU"}
    teams = []
    for t in json.load(open(vlr, encoding="utf-8")):
        if re.search(r"academy|junior|spark|orchid", t["name"], re.I): continue
        active = [p for p in t["roster"] if p["role"] not in ("inactive",)]
        if len([p for p in active if p["role"] != "sub"]) < 3: continue
        rating = max(62, TOP[t["region"]] - (t["rank"] - 1) * 0.9)
        n = norm(t["name"])
        rating += 6 if n in VAL_CHAMPIONS else 3 if n in VAL_PARTNERS else -3
        org = org_for(t["name"])
        if not org:
            org = "v_" + t["slug"].replace("-", "")[:20]
            fame = int(max(15, min(70, (rating - 60) * 2.2)))
            live_orgs[org] = [t["name"], make_tag(t["name"]), CC[t["region"]], hcolor(t["name"]), fame]
        ps = []
        for p in sorted(active, key=lambda p: p["role"] == "sub")[:6]:
            r = known_rating.get(("val", norm(p["h"])))
            if r is None: r = int(round(rating + (zlib.crc32(p["h"].encode()) % 6) - 3))
            ps.append([p["h"], p["cc"] if len(p["cc"]) == 2 else "", min(97, r), age_of("val", p["h"])])
        teams.append((rating + sum(x[2] for x in ps[:5]) / 50, org, ps, n in VAL_CHAMPIONS or n in VAL_PARTNERS))
    teams.sort(key=lambda x: -x[0])
    # toutes les équipes de la VCT, puis les meilleures équipes Challengers jusqu'à 48 équipes
    keep = [t for t in teams if t[3]] + [t for t in teams if not t[3]]
    keep = sorted(keep[:max(48, sum(1 for t in teams if t[3]))], key=lambda x: -x[0])
    rosters["val"] = [[org, ps, 1] for _, org, ps, _ in keep]

# ---------- Fortnite (esportsearnings : nationalité, âge, duos du Major 1 2026) ----------
solos = {}
eef = os.path.join(SRC, "ee_fortnite.json")
if os.path.exists(eef):
    ee = json.load(open(eef, encoding="utf-8"))
    EE_ALIAS = {"vic0try0na": "vic0", "shark": "shxrk", "t3enyy": "t3eny", "skyboy": "sky", "merstachhh": "merstach", "rezonay": "rezon"}
    info = {}
    for p in ee["players"].values():
        k = EE_ALIAS.get(norm(p["h"]), norm(p["h"]))
        info[k] = (p["cc"], p.get("age", 0), p["h"])
    for r in ee["results"]:
        for m in r["members"]:
            k = EE_ALIAS.get(norm(m["h"]), norm(m["h"]))
            info.setdefault(k, (m["cc"], 0, m["h"]))
    # organisations des duos (Liquipedia via presse, Wikipedia : Pollo chez Falcons, Gen.G signe Ritual…)
    # tags du classement du Global Championship 2026 (TechWiser, esports.gg), listes du Pro-Am 2026 (Liquipedia), Wikipedia, presse.
    # Un club n'a qu'une équipe par jeu : quand une org a deux duos, le second joue sous l'org partenaire (HavoK by Vitality).
    FN_ORGS = {("peterbot", "pollo"): "falcons", ("tjino", "pablowingu"): "havok", ("swizzy", "pixie"): "vitality",
               ("ritual", "cold"): "geng", ("shxrk", "t3eny"): "aurora", ("vic0", "malibuca"): "big", ("acorn", "boltz"): "tm",
               ("916gon", "night"): "furia", ("rax", "jannisz"): "m8", ("sky", "scroll"): "ag", ("darm", "demus"): "t1",
               ("yuma", "koyota"): "zeta", ("higgs", "curve"): "xset", ("victerv", "queasy"): "dignitas", ("charyy", "kami"): "roc",
               # FNCS 2026 Major 2 (Liquipedia, via la presse) et pages d'organisations (Fandom)
               ("cr1nge", "twi"): "xp42", ("idrop", "ghonzo"): "solary", ("minori", "darkos"): "solary", ("ajerss", "veno"): "xset",
               ("muz", "rise"): "xset", ("clix", "rapid"): "xset", ("kingaling", "kraez"): "geng", ("josh", "eomzo"): "elite",
               ("golden", "ozone"): "force", ("vadeal", "juu"): "wave", ("akiira", "kurama"): "m8"}
    # précisions données par l'utilisateur (joueurs français)
    CC_FIX = {"izzi": "FR", "nociff": "FR", "momsy": "FR", "seyyto": "FR", "kurama": "FR"}
    live_orgs.setdefault("havok", ["HavoK", "HVK", "SE", "#e63946", 58])
    live_orgs.setdefault("ag", ["All Gamers Global", "AG", "DK", "#c9a227", 55])
    for k, v in {"xp42": ["XP42 Esports", "XP42", "", "#3d5a80", 46], "solary": ["Solary", "SLY", "FR", "#00a2ff", 58],
                 "elite": ["Elite Esports", "ELT", "GB", "#d4af37", 48], "force": ["Force Esports", "FRC", "US", "#ff5d5d", 44],
                 "wave": ["Wave Esports", "WAVE", "DE", "#3fa7d6", 44]}.items():
        live_orgs.setdefault(k, v)
    live_orgs.setdefault("xset", ["XSET", "XSET", "US", "#7b2cbf", 56])
    live_orgs.setdefault("dignitas", ["Dignitas", "DIG", "US", "#f2c94c", 56])
    live_orgs.setdefault("roc", ["ROC Esports", "ROC", "PL", "#b5179e", 50])
    duos, seen = [], set()
    for x in cur["SOLOS"]["fn"]:
        duo = x[1] if isinstance(x[0], str) else x
        ps = []
        for h, cc, r, a in duo:
            c2, a2, _ = info.get(norm(h), ("", 0, h))
            ps.append([h, c2 or cc, r, a2 or a])
            seen.add(norm(h))
        key = tuple(sorted(norm(p[0]) for p in ps))
        org = next((o for k, o in FN_ORGS.items() if tuple(sorted(k)) == key), None)
        duos.append([org, ps] if org else ps)
    # duos d'organisations trouvés sur les pages d'équipes (Fandom) et absents des grands classements
    for org, a1, c1, a2, c2, r in [("solary", "Minori", "CH", "Darkos", "FR", 81), ("wave", "Vadeal", "", "Juu", "", 79),
                                   ("m8", "Merstach", "LV", "Vanyak3kk", "UA", 85)]:
        if norm(a1) in seen or norm(a2) in seen: continue
        duos.insert(30, [[a1, c1, r, info.get(norm(a1), ("", 0, ""))[1]], [a2, c2, r - 1, info.get(norm(a2), ("", 0, ""))[1]]])
        if org: FN_ORGS[(norm(a1), norm(a2))] = org
        seen.update((norm(a1), norm(a2)))
    # duos qualifiés au Global Championship 2026 par le Last Chance Qualifier (Hotspawn)
    LCQ = [("Momsy", "Seyyto"), ("Huty", "F1shyx"), ("Izzi", "Nociff"), ("Hcube", "Encrypted"), ("slepzi", "Wagers"), ("Ark", "Khanada"),
           ("Randu", "Grx"), ("Rura", "Pinq"), ("Mshary", "SaLva"), ("Phazma", "Crusades"), ("Howly", "1Lusha"), ("5aald", "Smiky")]
    for i, (a1, a2) in enumerate(LCQ):
        if norm(a1) in seen or norm(a2) in seen: continue
        r = 84 - i // 3
        ps = [[h, info.get(norm(h), ("", 0, h))[0], r - j, info.get(norm(h), ("", 0, h))[1]] for j, h in enumerate((a1, a2))]
        seen.update((norm(a1), norm(a2)))
        duos.insert(40, ps)
    # duos du Major 1 2026 absents de la base
    for r in ee["results"]:
        if "Major 1" not in r["t"] or len(r["members"]) != 2: continue
        ms = [EE_ALIAS.get(norm(m["h"]), norm(m["h"])) for m in r["members"]]
        if any(m in seen for m in ms): continue
        oce = "Oceania" in r["t"]
        place = sum(1 for q in ee["results"] if q["t"] == r["t"] and ee["results"].index(q) < ee["results"].index(r)) + 1
        rating = int(round((80 if oce else 85) - place * (0.2 if oce else 0.15)))
        ps = [[m["h"], m["cc"], rating - i, info.get(k, ("", 0, ""))[1]] for i, (m, k) in enumerate(zip(r["members"], ms))]
        seen.update(ms)
        duos.append(ps)
    # Liquipedia (Portal:Players/Europe, copié par l'utilisateur) : pays et équipe des joueurs européens.
    # Les sources 2026 (FN_ORGS) restent prioritaires : la page Liquipedia date de novembre 2025.
    LQ = {}
    lq_file = os.path.join(ROOT, "tools/sources/liquipedia_fortnite_europe.tsv")
    if os.path.exists(lq_file):
        for line in open(lq_file, encoding="utf-8"):
            if line.startswith("#") or not line.strip(): continue
            h, cc, team = (line.rstrip("\n").split("\t") + ["", ""])[:3]
            LQ[norm(h)] = (cc, team.strip())
    LQ_ALIAS = {"scaryy": "scary", "velo": "velofps"}
    lq = lambda h: LQ.get(LQ_ALIAS.get(norm(h), norm(h)))
    by_org_name = {norm(v[0]): k for k, v in {**ORGS, **live_orgs}.items()}
    TEAM_ALIAS = {"havokbyvitality": "havok", "teamvitality": "vitality", "allgamersglobal": "ag"}
    def org_of_team(team, cc, rating):
        n = norm(team)
        if n in TEAM_ALIAS: return TEAM_ALIAS[n]
        if n in by_org_name: return by_org_name[n]
        key = "fn_" + n[:20]
        live_orgs[key] = [team, make_tag(team), cc, hcolor(team), int(max(25, min(55, (rating - 70) * 2.5)))]
        by_org_name[n] = key
        return key
    def with_org(x):
        ps = x[1] if isinstance(x[0], str) else x
        for p in ps:
            if lq(p[0]) and lq(p[0])[0]: p[1] = lq(p[0])[0]
        key = tuple(sorted(norm(p[0]) for p in ps))
        org = next((o for k, o in FN_ORGS.items() if tuple(sorted(k)) == key), None)
        if not org:
            teams = [lq(p[0])[1] for p in ps if lq(p[0]) and lq(p[0])[1]]
            if teams: org = org_of_team(teams[0], ps[0][1], ps[0][2])
        return [org, ps] if org else ps
    duos = [with_org(x) for x in duos]
    for x in duos:
        for p in (x[1] if isinstance(x[0], str) else x):
            if norm(p[0]) in CC_FIX: p[1] = CC_FIX[norm(p[0])]
    # on garde tous les duos d'organisation et ceux du Global Championship, puis les meilleurs autres duos jusqu'à 120
    KEEP = {norm(h) for pair in LCQ for h in pair} | {"merstach", "akiira", "kurama"}
    must = [x for x in duos if isinstance(x[0], str) or any(norm(p[0]) in KEEP for p in x)]
    rest = [x for x in duos if not (isinstance(x[0], str) or any(norm(p[0]) in KEEP for p in x))]
    keep = must + rest[:max(0, 120 - len(must))]
    order = {id(x): i for i, x in enumerate(duos)}
    solos["fn"] = sorted(keep, key=lambda x: order[id(x)])   # 20 en tier 1, 60 en tier 2, 30 en tier 3 (le reste de la scène est amateur)

# âges réels (Wikidata) pour tous les joueurs déjà présents dans data.js
age_fix = {}
for g, lst in cur["ROSTERS"].items():
    for org, ps, *_ in lst:
        for p in ps:
            a = age_of(g, p[0]) if g in GAMEKEYS else 0
            if a and a != p[3]: age_fix[g + "|" + p[0]] = a
for g, lst in cur["SOLOS"].items():
    for x in lst:
        r = x[1] if isinstance(x[0], str) and isinstance(x[1], list) else x if isinstance(x[0], list) else [x]
        for p in r:
            a = age_of(g, p[0]) if g in GAMEKEYS else 0
            if a and a != p[3]: age_fix[g + "|" + p[0]] = a
print("ages corrigés :", len(age_fix), file=sys.stderr)

with open(OUT, "w", encoding="utf-8") as f:
    f.write("// Généré par tools/build_live.py — effectifs récupérés sur les sites de données (VLR…).\n")
    f.write("// Ces données remplacent celles de data.js pour les jeux concernés.\n")
    f.write("const LIVE_ORGS = " + json.dumps(live_orgs, ensure_ascii=False) + ";\n")
    f.write("const LIVE_ROSTERS = " + json.dumps(rosters, ensure_ascii=False) + ";\n")
    f.write("const LIVE_SOLOS = " + json.dumps(solos, ensure_ascii=False) + ";\n")
    f.write("// âges réels (Wikidata, au 20 octobre 2026) : jeu|pseudo -> âge\n")
    f.write("const LIVE_AGES = " + json.dumps(age_fix, ensure_ascii=False) + ";\n")
    f.write("""Object.assign(ORGS, LIVE_ORGS);
for (const [g, l] of Object.entries(LIVE_ROSTERS)) ROSTERS[g] = l;
for (const [g, l] of Object.entries(LIVE_SOLOS)) SOLOS[g] = l;
// applique les âges réels à tous les effectifs
const fixAge = (g, p) => { const a = LIVE_AGES[g + "|" + p[0]]; if (a) p[3] = a; };
for (const [g, l] of Object.entries(ROSTERS)) for (const [, ps] of l) ps.forEach(p => fixAge(g, p));
for (const [g, l] of Object.entries(SOLOS)) for (const x of l) {
  const r = typeof x[0] === "string" && Array.isArray(x[1]) ? x[1] : Array.isArray(x[0]) ? x : [x];
  r.forEach(p => fixAge(g, p));
}
""")
print({g: len(l) for g, l in rosters.items()}, "new orgs:", len(live_orgs), file=sys.stderr)
