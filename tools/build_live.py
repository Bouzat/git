# Construit js/data_live.js à partir des données récupérées (VLR, Wikidata…).
# Usage : python3 tools/build_live.py <dossier des données> js/data_live.js
import csv, json, os, re, subprocess, sys, unicodedata, zlib

# calendrier du jeu : semaines réelles (ISO) de la saison, de début janvier (semaine 2) à mi-décembre (semaine 50)
SEASON_FIRST, SEASON_LAST = 2, 50
def iso_week(year, doy):
    import datetime as _dt
    return max(SEASON_FIRST, min(SEASON_LAST, (_dt.date(year, 1, 1) + _dt.timedelta(days=doy - 1)).isocalendar()[1]))
SRC, OUT = sys.argv[1], sys.argv[2]
LIVE_FORMAT = 4   # à incrémenter avec LIVE_EXPECTED (js/data.js) quand le contenu change de façon importante
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# données actuelles du jeu (orgs, notes connues des joueurs)
cur = json.loads(subprocess.run(["node", "-e", f"""
const fs=require('fs');eval(fs.readFileSync({json.dumps(os.path.join(ROOT, 'js/data.js'))},'utf8')+';global.X={{ORGS,ROSTERS,SOLOS,REGION_OF}}');
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
           "kruesports": "kru", "allgamers": "al", "dplusesports": "dk", "dplus": "dk", "teamheretics": "heretics", "g2esports": "g2", "geng": "geng",
           "gengesports": "geng", "g2": "g2", "sk": "sk", "falcons": "falcons"}
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

# ---------- Valorant : Google Sheet de l'utilisateur (portails joueurs et effectifs Liquipedia) ----------
# Pays des joueurs, nouvelles équipes (Challengers, académies, universités) et vrais joueurs sans équipe (agents libres).
# Les 48 équipes VLR (octobre 2026) gardent leur effectif. Le circuit féminin (Game Changers) n'existe pas dans le jeu : ignoré.
free_agents = {}
VDIR = os.path.join(ROOT, "tools/sources/valorant")
if os.path.isdir(VDIR) and "val" in rosters:
    ISO = {"Argentina": "AR", "Canada": "CA", "Chile": "CL", "Colombia": "CO", "Costa Rica": "CR", "Cuba": "CU", "Dominican Republic": "DO",
           "Ecuador": "EC", "El Salvador": "SV", "Guatemala": "GT", "Honduras": "HN", "Mexico": "MX", "Panama": "PA", "Paraguay": "PY", "Peru": "PE",
           "Puerto Rico": "PR", "United States": "US", "Uruguay": "UY", "Venezuela": "VE", "Belarus": "BY", "Kazakhstan": "KZ", "Kyrgyzstan": "KG",
           "Russia": "RU", "Ukraine": "UA", "Uzbekistan": "UZ", "Autriche": "AT", "Belgique": "BE", "Bulgarie": "BG", "Tchéquie": "CZ", "Danemark": "DK",
           "Estonia": "EE", "Finlande": "FI", "France": "FR", "Allemagne": "DE", "Islande": "IS", "Irlande": "IE", "Italie": "IT", "Lettonie": "LV",
           "Lituanie": "LT", "Moldova": "MD", "Pays-Bas": "NL", "Norvège": "NO", "Pologne": "PL", "Portugal": "PT", "Roumanie": "RO", "Écosse": "GB",
           "Serbie": "RS", "Slovaquie": "SK", "Slovenia": "SI", "Espagne": "ES", "Suède": "SE", "Suisse": "CH", "Turquie": "TR",
           "Bangladesh": "BD", "Brunei": "BN", "Cambodia": "KH", "China": "CN", "Hong Kong": "HK", "India": "IN", "Indonesia": "ID", "Japan": "JP",
           "Laos": "LA", "Macau": "MO", "Malaysia": "MY", "Mongolia": "MN", "Nepal": "NP", "Pakistan": "PK", "Philippines": "PH", "Singapore": "SG",
           "South Korea": "KR", "Sri Lanka": "LK", "Taiwan": "TW", "Thailand": "TH", "Vietnam": "VN", "Australia": "AU", "New Zealand": "NZ"}
    GC_TEAMS = {norm(t) for t in """KRÜ Blaze|Shopify Rebellion Gold|SEN Otters|FlyQuest RED|G2 Gozen|Twisted Orchid|No Sweat Blossom|Six Karma Femenil|
        NOVO Nightingale|FOKUS Sakura|Bitfix Zero|Bitfix Puppies|SK Nebula|DVM Miss|Melilla Titans Aura|RIZON Sugar|TOG Inari|PCS Aphrodite|
        WLG Female Stars|ALTERNATE aTTaX Ruby|Akave Esports Black|Velocity Gaming X|Falcons Vega|Stallions Lyra|BIGG Siren|LILAX|LILITH|
        Nerve Esports Quartz|Team Liquid Brazil|FULL SENSE SISU|Ninetails|CNE Changers|DXE Game Changers""".split("|")}
    is_gc = lambda t: norm(t) in GC_TEAMS or bool(re.search(r"\b(GC|gc|Female|Women|Game Changers)$", t.strip()))
    COLLEGE = re.compile(r"universit|college|rutgers|northwood|cumberland|maryville|winthrop|osu varsity|virginia tech|tu dublin|ucam", re.I)
    # entrées : (pseudo, pays, équipe, source)
    entries = []
    # portail Amériques : bloc par pays
    files = sorted(os.listdir(VDIR))
    first_line = lambda f: open(os.path.join(VDIR, f), encoding="utf-8").readline()
    for f in files:
        if not first_line(f).startswith("Player Portal"): continue
        cc = None
        for r in csv.reader(open(os.path.join(VDIR, f), encoding="utf-8")):
            r = (r + [""] * 4)[:4]
            if r[0] in ISO and not r[1]: cc = ISO[r[0]]; continue
            if r[0] in ("Players", "ID", "Staff & Talents") or r[0].startswith("Player Portal") or not r[0] or not cc: continue
            entries.append((r[0].strip(), cc, r[2].strip(), "portal"))
    # portails CIS et Europe : « Nom réel Équipe » dans la même colonne -> équipe reconnue par suffixe
    known_teams = set()
    roster_files = [f for f in files if f.startswith("rosters_")]
    for fn_ in roster_files:
        for r in csv.DictReader(open(os.path.join(VDIR, fn_), encoding="utf-8")):
            t = (r.get("Équipe") or "").strip()
            if t: known_teams.add(t)
    known_teams |= {e[2] for e in entries if e[2]} | {v[0] for v in {**ORGS, **live_orgs}.values()}
    known_teams |= set("""AlQadsiah Esports|Colors Esport|S8UL Esports|FORWARD|All Gamers|team hz|VOLT|Weibo Gaming|Stallions Esports|Young Talents|
        Gamax Esports|BAO eSPORTS|Oxuji|MANIA Esports|RAFHA eSPORTS|KeepBest Gaming|Skulls Esports|B8 Esports|Playing Ducks|BAAM Esports|Elite Klan|
        eSuba|WATEr|AaB Esport Denmark|HAVU|SAVU|HL Tauri Esports|Esprit Shōnen|ToDoBew|Metro Esports|Valkyriant|Exalty|Caldya Esport|Ghools Esports|
        WIP Esports|Vestige|Erah Esport|EvozA Esport|Luminary Esport|PULSAR OLDSTARS|DNSTY|Nuxeria Esport|Pingou Esport|Poyo Esports|Al Ahli Esports|
        ALTERNATE aTTaX|Aspire Esports|Big Blue Charizard|eSports Cologne|MOLO|5HEAD|Glacial Guardians|TRUMPS|GamerZ Esports|AKA HERO|TeamOrangeGaming|
        Veni eSports|Ovation eSports|AIGHT|GnG Amazigh|Parma Esports|Ingenious Esports|Elevate|NEON BLADE|Kahoot|FRG|BLX UTD|Royal Legion|Brødreskift|
        Incognito GC|Fordon Boars|Chosen Clique Gaming|Dead Rabbits|ACE eSports|Diamant Esports|Fractious Esports|ZETA Gaming|DimoniX Esports|
        PAWN GAMING|VexOficial|Thunder Gaming|Otakar Esports|Newstar|PURE Esports|Royal Legion Academy|VosFacto Esports|Trigon Titans|
        Team Demiral Esports|İstanbul Wildcats|TOA Esports|Beşiktaş Esports|Galatasaray Esports|Misa Esports|JFT Esports|Fire Flux Esports|
        Nova Esports|Paper Rex|Rex Regum Qeon|XLG Esports|Dragon Ranger Gaming|Formulation Gaming|Lost Puppies GC|ZennIT Orange GC""".replace("\n", "").split("|"))
    known_teams = sorted({t.strip() for t in known_teams if t.strip()}, key=len, reverse=True)
    for fn_ in ("players_cis.csv", "players_europe.csv"):
        for r in csv.DictReader(open(os.path.join(VDIR, fn_), encoding="utf-8")):
            txt = r["Nom Réel & Équipe"].strip()
            team = next((t for t in known_teams if txt == t or txt.endswith(" " + t)), "")
            entries.append((r["ID"].strip(), ISO.get(r["Pays"], ""), team, "gc" if r["Game Changers"].startswith("Oui") else "portal"))
    # effectifs par équipe : Europe (catégorie VCT / Challengers / GC, puis blocs turcs) et Amérique du Nord
    # les blocs « Équipe / ID,Real name,Role » n'existent qu'après la ligne vide (équipes turques)
    roster_rows, block, blocks = [], None, False
    for r in csv.reader(open(os.path.join(VDIR, "rosters_europe.csv"), encoding="utf-8")):
        r = (r + [""] * 5)[:5]
        if r[0] == "Équipe": continue
        if not any(x.strip() for x in r): blocks = True; continue
        if not blocks:
            if r[0] and r[1]: roster_rows.append((r[1].strip(), r[0].strip(), r[4], r[3]))
            continue
        if r[0] == "ID": continue
        if r[0] and not r[1] and not r[2]: block = r[0].strip(); continue
        if block and r[0]: roster_rows.append((r[0].strip(), block, "Challengers", r[2]))
    for fn_ in roster_files:
        if fn_ == "rosters_europe.csv": continue
        for r in csv.DictReader(open(os.path.join(VDIR, fn_), encoding="utf-8")):
            if (r.get("ID") or "").strip() and (r.get("Équipe") or "").strip():
                roster_rows.append((r["ID"].strip(), r["Équipe"].strip(), r.get("Catégorie") or ("NA" if "america" in fn_ else "Challengers"), r.get("Rôle") or ""))
    # pays connus par pseudo (+ équipe pour départager les homonymes)
    cc_of = {}
    for h, c, t, _ in entries:
        if c: cc_of.setdefault(norm(h), []).append((c, norm(t)))
    def country(h, team=""):
        l = cc_of.get(norm(h), [])
        if not l: return ""
        m = [c for c, t in l if t and t == norm(team)]
        return m[0] if m else (l[0][0] if len(l) == 1 else "")
    # 1) pays des joueurs des équipes VLR quand il manque
    used, fixed = set(), 0
    for org, ps, *_ in rosters["val"]:
        oname = ({**ORGS, **live_orgs}.get(org) or [org])[0]
        for p in ps:
            used.add(norm(p[0]))
            if not p[1]:
                c = country(p[0], oname)
                if c: p[1] = c; fixed += 1
    vlr_org_names = {norm(({**ORGS, **live_orgs}.get(org) or [org])[0]) for org, *_ in rosters["val"]}
    # 2) nouvelles équipes : effectifs détaillés d'abord, puis équipes citées dans les portails ; les universités en dernier
    teams_ = {}
    for h, t, cat, role in roster_rows:
        if t and not is_gc(t) and "Game Changers" not in cat: teams_.setdefault(t, {"src": cat, "ps": []})["ps"].append(h)
    for h, c, t, src in entries:
        if t and not is_gc(t) and src != "gc": teams_.setdefault(t, {"src": "portal", "ps": []})["ps"].append(h)
    order = sorted(teams_, key=lambda t: (bool(COLLEGE.search(t)), teams_[t]["src"] == "portal"))
    new_teams, skipped = [], 0
    for t in order:
        if norm(t) in vlr_org_names or org_for(t) in {o for o, *_ in rosters["val"]}: continue   # équipe déjà connue (VLR)
        hs = []
        for h in teams_[t]["ps"]:
            if norm(h) not in used and norm(h) not in {norm(x) for x in hs}: hs.append(h)
        if len(hs) < 2: continue
        nt = norm(t)
        base = 80 if nt in VAL_CHAMPIONS or nt in VAL_PARTNERS or nt in {"natusvincere", "kruesports"} else \
               63 if COLLEGE.search(t) else 68 if re.search(r"academy|junior|spark", t, re.I) else 71 if teams_[t]["src"] != "portal" else 67
        ps = []
        for h in hs[:7]:
            used.add(norm(h))
            r = known_rating.get(("val", norm(h))) or base + (zlib.crc32(h.encode()) % 7) - 3
            ps.append([h, country(h, t), r, age_of("val", h)])
        org = org_for(t)
        if not org:
            org = "v_" + norm(t)[:20]
            ccs = [p[1] for p in ps if p[1]]
            occ = max(set(ccs), key=ccs.count) if ccs else ("US" if teams_[t]["src"] == "NA" else "FR")
            live_orgs.setdefault(org, [t, make_tag(t), occ, hcolor(t), int(max(8, min(40, (base - 58) * 2.5)))])
        new_teams.append([org, ps, 1])
    rosters["val"] += new_teams
    # le jeu répartit les équipes en tiers dans l'ordre de la liste : on trie par niveau du cinq de départ
    rosters["val"].sort(key=lambda t: -sum(sorted((p[2] for p in t[1]), reverse=True)[:5]) / max(1, min(5, len(t[1]))))
    # 3) vrais joueurs sans équipe (ou d'une équipe trop peu renseignée) : agents libres
    fa, seen_fa = [], set()
    for h, c, t, src in entries:
        n = norm(h)
        if n in used or n in seen_fa or (t and is_gc(t)) or src == "gc": continue
        seen_fa.add(n)
        fa.append([h, c, 58 + zlib.crc32(h.encode()) % 11, age_of("val", h)])
    free_agents["val"] = fa
    # ---------- Valorant Game Changers : un circuit à part ----------
    # chaque équipe GC est rattachée à son organisation (Karmine Corp GC -> Karmine Corp, G2 Gozen -> G2…) et garde son nom
    GC_TOP = {norm(t) for t in """Team Liquid Brazil|Shopify Rebellion Gold|G2 Gozen|Karmine Corp GC|MIBR GC|FURIA Female|KRÜ Blaze|Cloud9 GC|
        Gen.G GC|Nova Esports GC|SEN Otters|FULL SENSE SISU|GIANTX GC|Evil Geniuses GC""".split("|")}
    GC_SUFFIX = re.compile(r"\s+(GC|Female|Femenil|Women|Gozen|Vega|Ruby|SISU|Brazil|Gold|RED|Otters|Lyra|Siren|Sakura|Nightingale|Nebula|Sugar|Inari|"
                           r"Aphrodite|Blossom|Puppies|Zero|Orchid|Black|Quartz|Changers|Game Changers|Female Stars|Miss|Aura|Academy)$")
    def gc_base(t):
        b = t.strip()
        while True:
            nb = GC_SUFFIX.sub("", b)
            if nb == b: return b
            b = nb
    gc_teams = {}
    for h, t, cat, role in roster_rows:
        if t and (is_gc(t) or "Game Changers" in cat): gc_teams.setdefault(t, {"src": "roster", "ps": []})["ps"].append(h)
    for h, c, t, src in entries:
        if t and (is_gc(t) or src == "gc"): gc_teams.setdefault(t, {"src": "portal", "ps": []})["ps"].append(h)
    gc_used, gc_rosters, gc_orgs_used = set(), [], set()
    for t in sorted(gc_teams, key=lambda t: (norm(t) not in GC_TOP, gc_teams[t]["src"] == "portal")):
        hs = []
        for h in gc_teams[t]["ps"]:
            n = norm(h)
            # même joueuse saisie deux fois (« Tookii » / « TookiiTookii »)
            if any(n == norm(x) * 2 or norm(x) == n * 2 for x in gc_teams[t]["ps"]): continue
            if n not in gc_used and n not in {norm(x) for x in hs}: hs.append(h)
        if len(hs) < 2: continue
        # vainqueurs et finalistes du Game Changers Championship : les meilleures équipes du circuit
        GC_ELITE = {"teamliquidbrazil", "shopifyrebelliongold", "g2gozen", "mibrgc"}
        base_r = 85 if norm(t) in GC_ELITE else 80 if norm(t) in GC_TOP else 74 if gc_teams[t]["src"] == "roster" else 70
        ps = []
        for h in hs[:7]:
            gc_used.add(norm(h))
            ps.append([h, country(h, t), base_r + (zlib.crc32(h.encode()) % 7) - 3, age_of("val", h)])
        base = gc_base(t)
        org = org_for(base) or org_for(t) or next((k for k, v in live_orgs.items() if norm(v[0]) == norm(base)), None)
        if not org or org in gc_orgs_used:   # pas d'organisation connue (ou déjà une équipe GC) : l'équipe est sa propre organisation
            org = "gc_" + norm(t)[:20]
            ccs = [p[1] for p in ps if p[1]]
            live_orgs.setdefault(org, [t, make_tag(t), max(set(ccs), key=ccs.count) if ccs else "US", hcolor(t), int(max(8, min(35, (base_r - 60) * 1.6)))])
        gc_orgs_used.add(org)
        gc_rosters.append([org, ps, 1, t])
    gc_rosters.sort(key=lambda t: -sum(sorted((p[2] for p in t[1]), reverse=True)[:5]) / max(1, min(5, len(t[1]))))
    rosters["valgc"] = gc_rosters
    free_agents["valgc"] = [[h, c, 60 + zlib.crc32(h.encode()) % 9, age_of("val", h)] for h, c, t, src in entries
                            if (src == "gc" or (t and is_gc(t))) and norm(h) not in gc_used]
    print("Valorant Game Changers : %d équipes (%d joueuses), %d agents libres" % (len(gc_rosters), sum(len(t[1]) for t in gc_rosters), len(free_agents["valgc"])), file=sys.stderr)
    print("Valorant (sheet) : %d pays complétés, %d nouvelles équipes (%d joueurs), %d agents libres réels"
          % (fixed, len(new_teams), sum(len(t[1]) for t in new_teams), len(fa)), file=sys.stderr)

# ---------- Google Sheet de l'utilisateur, format Liquipedia générique (Rocket League…) ----------
# Fichiers « portail » (pays -> ID, nom réel, équipe) et fichiers « équipes » (équipe -> ID, nom réel, rôle).
COUNTRY_ISO = {"Albania": "AL", "Argentina": "AR", "Australia": "AU", "Austria": "AT", "Belarus": "BY", "Belgium": "BE", "Bosnia and Herzegovina": "BA",
    "Brazil": "BR", "Bulgaria": "BG", "Canada": "CA", "Chile": "CL", "Colombia": "CO", "Croatia": "HR", "Cuba": "CU", "Czechia": "CZ", "Denmark": "DK",
    "Dominican Republic": "DO", "Ecuador": "EC", "Egypt": "EG", "England": "GB", "Fiji": "FJ", "Finland": "FI", "France": "FR", "Germany": "DE",
    "Greece": "GR", "Guernsey": "GG", "Hungary": "HU", "Iceland": "IS", "India": "IN", "Iraq": "IQ", "Ireland": "IE", "Italy": "IT", "Jersey": "JE",
    "Kazakhstan": "KZ", "Latvia": "LV", "Lithuania": "LT", "Luxembourg": "LU", "Malta": "MT", "Mexico": "MX", "Morocco": "MA", "Netherlands": "NL",
    "New Zealand": "NZ", "Northern Ireland": "GB", "Norway": "NO", "Pakistan": "PK", "Paraguay": "PY", "Peru": "PE", "Poland": "PL", "Portugal": "PT",
    "Puerto Rico": "PR", "Romania": "RO", "Russia": "RU", "Saudi Arabia": "SA", "Scotland": "GB", "Serbia": "RS", "Slovakia": "SK", "Slovenia": "SI",
    "South Africa": "ZA", "Spain": "ES", "Sudan": "SD", "Sweden": "SE", "Switzerland": "CH", "Turkey": "TR", "Ukraine": "UA", "United Kingdom": "GB",
    "United States": "US", "Uruguay": "UY", "Venezuela": "VE", "Wales": "GB"}
STAFF_ROLES = re.compile(r"coach|manager|analyst|staff", re.I)
# propriétaires et créateurs de contenu listés avec leur organisation dans les portails, mais qui ne jouent pas en compétition
NOT_PLAYERS = {"gotaga", "brawks", "squeezie", "kameto", "ibai", "psyonixcory", "psyonixian", "psyonixschuyler", "gumerprod"}
COLLEGE_RE = re.compile(r"universit|college|\bstate\b|institute|\bUCF\b|\bTUD\b|\bDCU\b|\bSETU\b|\bUEA\b|\bUoB\b|\bVUB\b|\bPXL\b|Roehampton|"
                        r"Loughborough|Keele|Exeter|Salford|Warwick|Portsmouth|Bournemouth|Erasmus|Lackawanna|Penn State|Academics", re.I)
FILE_REGION = {"Europe": "EU", "North America": "NA", "South America": "SA", "Oceania": "OCE", "Asia-Pacific": "ASIA", "Middle East and North Africa": "MENA"}
REGION_DEFAULT_CC = {"EU": "FR", "NA": "US", "SA": "BR", "OCE": "AU", "ASIA": "SG", "MENA": "SA"}
region_of_cc = lambda cc: cur["REGION_OF"].get(cc, "EU")
def sheet_game(game, folder, size, top_names, keep_existing):
    """Équipes (nouvelles ou complétées), pays et agents libres réels d'un jeu à partir des fichiers de l'utilisateur."""
    entries, team_rows = [], []
    for f in sorted(os.listdir(folder)):
        lines = list(csv.reader(open(os.path.join(folder, f), encoding="utf-8")))
        if any(r[:3] == ["ID", "Real Name", "Team"] for r in lines):        # portail par pays
            cc = None
            for r in lines:
                r = (r + [""] * 4)[:4]
                if r[0] in COUNTRY_ISO and not any(r[1:]): cc = COUNTRY_ISO[r[0]]; continue
                if r[0] in ("Players", "ID", "Staff & Talents") or r[0].startswith("Player Portal") or not r[0].strip() or not cc: continue
                entries.append((r[0].strip(), cc, r[2].strip()))
        else:                                                               # blocs par équipe (1re ligne : la région)
            team, freg = None, FILE_REGION.get(lines[0][0].strip(), "") if lines else ""
            for i, r in enumerate(lines):
                r = (r + [""] * 3)[:3]
                if r[0] == "ID": continue
                if i + 1 < len(lines) and lines[i + 1][:1] == ["ID"]: team = r[0].strip(); continue
                if team and r[0].strip() and not STAFF_ROLES.search(r[2]): team_rows.append((r[0].strip(), team, r[2].strip(), freg))
    cc_of = {}
    for h, c, t in entries: cc_of.setdefault(norm(h), []).append((c, norm(t)))
    def country(h, team=""):
        l = cc_of.get(norm(h), [])
        m = [c for c, t in l if t and t == norm(team)]
        return m[0] if m else (l[0][0] if l else "")
    existing = [(list(x) + [0])[:3] for x in cur["ROSTERS"].get(game, [])]   # [org, effectif, vérifié]
    by_org = {x[0]: x for x in existing}
    used = {norm(p[0]) for x in existing if x[2] for p in x[1]}            # effectifs vérifiés : intouchables
    teams = {}
    for h, t, role, reg in team_rows: teams.setdefault(t, {"src": "teams", "ps": [], "reg": reg})["ps"].append(h)
    for h, c, t in entries:
        if t and t.lower() not in ("retired", "1"): teams.setdefault(t, {"src": "portal", "ps": []})["ps"].append(h)
    order = sorted(teams, key=lambda t: (bool(COLLEGE_RE.search(t)), teams[t]["src"] == "portal"))
    new, replaced = [], 0
    for t in order:
        hs = []
        for h in teams[t]["ps"]:
            if norm(h) not in used and norm(h) not in NOT_PLAYERS and norm(h) not in {norm(x) for x in hs}: hs.append(h)
        if len(hs) < 2: continue
        org = org_for(t)
        reg = teams[t].get("reg", "")
        # même nom, autre organisation (Nova Esports en Chine et au Moyen-Orient) : on n'associe pas une équipe à une org d'une autre région
        if org and org not in by_org and reg and region_of_cc(({**ORGS, **live_orgs}.get(org) or [0, 0, ""])[2]) != reg: org = None
        if org in by_org and (by_org[org][2] or len(hs) < size): continue  # effectif vérifié, ou info trop maigre pour remplacer
        nt = norm(t)
        base = 82 if nt in top_names or org in top_names else 62 if COLLEGE_RE.search(t) else 72 if teams[t]["src"] == "teams" else 67
        ps = []
        for h in hs[:size + 1]:
            used.add(norm(h))
            r = known_rating.get((game, norm(h))) or base + (zlib.crc32(h.encode()) % 7) - 3
            ps.append([h, country(h, t), r, age_of(game, h)])
        if org in by_org:                                                    # effectif non vérifié remplacé par la feuille
            by_org[org][1], by_org[org][2] = ps, 1; replaced += 1; continue
        if not org:
            org = "%s_%s" % (game, nt[:20])
            ccs = [p[1] for p in ps if p[1]]
            occ = REGION_DEFAULT_CC[reg] if reg and (not ccs or region_of_cc(max(set(ccs), key=ccs.count)) != reg) else (max(set(ccs), key=ccs.count) if ccs else "US")
            live_orgs.setdefault(org, [t, make_tag(t), occ, hcolor(t), int(max(8, min(45, (base - 58) * 2.2)))])
        new.append([org, ps, 1])
    out = existing + new
    out.sort(key=lambda x: -sum(sorted((p[2] for p in x[1]), reverse=True)[:size]) / max(1, min(size, len(x[1]))))
    fa, seen = [], set()
    for h, c, t in entries:
        n = norm(h)
        if n in used or n in seen or n in NOT_PLAYERS: continue
        seen.add(n)
        fa.append([h, c, 58 + zlib.crc32(h.encode()) % 11, age_of(game, h)])
    print("%s (sheet) : %d équipes au total, %d nouvelles, %d complétées, %d agents libres réels" % (game, len(out), len(new), replaced, len(fa)), file=sys.stderr)
    return out, fa

RL_DIR = os.path.join(ROOT, "tools/sources/rocketleague")
if os.path.isdir(RL_DIR):
    RL_TOP = {norm(x) for x in ["Karmine Corp", "Team Vitality", "Team Falcons", "NRG", "Gentle Mates", "Dignitas", "Spacestation Gaming", "M80",
              "Shopify Rebellion", "SK Gaming", "Geekay Esports", "FUT Esports", "Twisted Minds", "FURIA", "MIBR", "GameWard", "Man City Esports",
              "Team Liquid", "G2 Esports", "Team BDS", "Moist Esports", "Wildcard", "PWR", "Elevate"]} | {"m8", "kc", "vitality", "falcons", "nrg", "tm", "furia", "liquid", "g2", "bds"}
    rosters["rl"], free_agents["rl"] = sheet_game("rl", RL_DIR, 3, RL_TOP, True)

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
    # Liquipedia (Portal:Players de chaque région et Portal:Teams, copiés par l'utilisateur) : pays et équipe actuelle.
    # Les colonnes « équipe » des portails sont tenues à jour automatiquement : elles priment sur les autres sources.
    LQ = {}
    for lq_name in ("liquipedia_fortnite_europe.tsv", "liquipedia_fortnite_world.tsv"):
        lq_file = os.path.join(ROOT, "tools/sources", lq_name)
        if not os.path.exists(lq_file): continue
        for line in open(lq_file, encoding="utf-8"):
            if line.startswith("#") or not line.strip(): continue
            h, cc, team = (line.rstrip("\n").split("\t") + ["", ""])[:3]
            LQ.setdefault(norm(h), []).append((h, cc, team.strip()))
    LQ_ALIAS = {"scaryy": "scary", "velo": "velofps", "houndzee": "houndz", "nuti": "nutifps", "snevy": "snivy"}
    def lq(h, cc=""):
        # plusieurs joueurs peuvent porter le même pseudo : on prend celui du même pays
        es = LQ.get(LQ_ALIAS.get(norm(h), norm(h)))
        if not es: return None
        e = next((e for e in es if cc and e[1] == cc), es[0])
        return (e[1], e[2])
    by_org_name = {norm(v[0]): k for k, v in {**ORGS, **live_orgs}.items()}
    TEAM_ALIAS = {"havokbyvitality": "havok", "teamvitality": "vitality", "allgamersglobal": "ag", "gengesports": "geng",
                  "teamfalcons": "falcons", "teamliquid": "liquid", "twistedminds": "tm", "zetadivision": "zeta",
                  "100thieves": "100t", "teambds": "bds", "auroragaming": "aurora"}
    # classement Liquipedia des équipes (gains) et équipes actives du Portal:Teams : base de leur niveau
    LQ_TOP = ["teamfalcons", "teamliquid", "xset", "dignitas", "twistedminds", "solary", "havokbyvitality", "aight", "gentlemates", "big"]
    LQ_ACTIVE = {norm(t) for t in """1P Esport|AIGHT|All Gamers Global|Aurora Gaming|BIG|CGN Esports|Detect Esports|DynastyX Esport|EGY Esports|
        Enefy Esports|Fear Esports|Flawless Region|FLC Clan|FOKUS CLAN|GameWard|Gentle Mates|HavoK by Vitality|JMC Esport|K13 Esport|KoS Esports|
        Kosma Gaming|KPI Gaming|Lyost Esport|MGA Esport|Morning Stars|Natrix Esports|Northern Star Gaming|NTO Corp|ORA Esport|Poyo Esports|R4C Esport|
        Ravens Esports|Reality Zone|Red Bull eSports|ROC Esports|Royalsten Esports|RXB Esports|S8UL Esports|SK Gaming|Solary|T1|Team Atlantic|
        Team Orchid|Team Vitality|THE ONE|X6 E-SPORT|XP42 Esports|Zenn eSports|7VEN|Alliance Esport|Beneath Reality|Chronic|Clan Housen|CoveX|
        Cynapse Esports|Dignitas|Elite Esports|FNO|Force Esports|FUSION|Gen.G Esports|HYLND|Limit Esports|Marine Region|Matrix Gaming|MNRS Sports|
        OCE5N|Oni Esports|ONIC Esports|Precision Esports|Sly Enterprises|Swamp Gaming|Team Pulsar|Twisted Minds|TYT Esports|Void Esports|
        Winthrop University|Xen|XSET|F4TALITY|Fluxo W7M|FURIA|FUT Esports|Hero Base|Isurus Gaming|Leviatán|LOUD|Lynox Esport|ShindeN|
        SmokeSolid Gaming|T6 eSports|Team Liquid|Anarchy Esports|Chrome Realm|Coast Esports|Devious Esports|Hawk Esports|JFT Esports|JOGO|
        Lavish Esports|Loyal Esports|NXG JFT|Overlooked Esports|PWR|TRKF E-Sport|ZO Esports|Absolute First|Baron Clan|Blue Phoenix e-sports|
        Crazy Raccoon|Delta Esports|DetonatioN FocusMe|EDGE|ENTER FORCE.36|FISTERIA|Gz|KIT Gaming Elite|LYNX e-sports|NEXUS|NLT|OBI E-sports|
        orz e-Sports|QT DIG|REJECT|Riddle|S2 e-sports|VOLARE|ZETA DIVISION|RVL ESPORT|Team Falcons""".split("|")}
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
            if norm(p[0]) in CC_FIX: p[1] = CC_FIX[norm(p[0])]
            e = lq(p[0], p[1])
            if e and e[0]: p[1] = e[0]
        # 1) équipe Liquipedia d'un des deux joueurs ; 2) sinon, si Liquipedia les connaît tous les deux sans équipe : indépendants ;
        # 3) sinon l'organisation trouvée dans les autres sources
        teams = [lq(p[0], p[1])[1] for p in ps if lq(p[0], p[1]) and lq(p[0], p[1])[1]]
        if teams: org = org_of_team(teams[0], ps[0][1], ps[0][2])
        elif all(lq(p[0], p[1]) for p in ps): org = None
        else:
            key = tuple(sorted(norm(p[0]) for p in ps))
            org = next((o for k, o in FN_ORGS.items() if tuple(sorted(k)) == key), None)
        return [org, ps] if org else ps
    duos = [with_org(x) for x in duos]
    # duos supplémentaires : les autres joueurs des équipes Liquipedia (un duo par équipe), pour remplir les tiers 2 et 3
    used = {LQ_ALIAS.get(norm(p[0]), norm(p[0])) for x in duos for p in (x[1] if isinstance(x[0], str) else x)}
    free = {}
    for n, es in LQ.items():
        for h, cc, team in es:
            if team and n not in used: free.setdefault(norm(team), []).append((h, cc, team))
    rank = lambda t: (LQ_TOP.index(t) if t in LQ_TOP else 50 if t in LQ_ACTIVE else 99)
    extra = []
    for t in sorted(free, key=lambda t: (rank(t), t)):
        ms = free[t]
        if len(ms) < 2 or rank(t) == 99: continue
        r = 80 if rank(t) < 50 else 74
        ps = [[h, cc, r - i, 0] for i, (h, cc, _) in enumerate(ms[:2])]
        extra.append([org_of_team(ms[0][2], ms[0][1], r), ps])
    duos += extra[:100]
    # on garde tous les duos d'organisation et ceux du Global Championship, puis les meilleurs autres duos jusqu'à 210
    KEEP = {norm(h) for pair in LCQ for h in pair} | {"merstach", "akiira", "kurama"}
    must = [x for x in duos if isinstance(x[0], str) or any(norm(p[0]) in KEEP for p in x)]
    rest = [x for x in duos if not (isinstance(x[0], str) or any(norm(p[0]) in KEEP for p in x))]
    keep = must + rest[:max(0, 210 - len(must))]
    order = {id(x): i for i, x in enumerate(duos)}
    solos["fn"] = sorted(keep, key=lambda x: order[id(x)])   # 20 en tier 1, 60 en tier 2, le reste en tier 3 (lobbies de 50 complétés par des duos amateurs)

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

# ---------- tournois Valorant (Google Sheet de l'utilisateur, onglet « Tournois », d'après Liquipedia) ----------
# Calendrier d'une saison : l'édition la plus récente (2025 ou 2026) de chaque compétition. Historique : vainqueurs 2021-2025.
import csv, datetime, re as _re
live_tours, live_history = {}, {}
val_csv = os.path.join(ROOT, "tools/sources/valorant/tournois.csv")
if os.path.exists(val_csv):
    MONTHS = {m: i + 1 for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split())}
    def mid_doy(txt, year):
        # « Sep 24 – Oct 18, 2026 », « Jul 02–12, 2026 » -> jour de l'année au milieu du tournoi
        parts = _re.findall(r"([A-Z][a-z]{2}) (\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?", txt)
        if not parts: return None
        m1, d1, d1b = parts[0]
        start = datetime.date(year, MONTHS[m1], int(d1))
        if len(parts) > 1: end = datetime.date(year, MONTHS[parts[1][0]], int(parts[1][1]))
        else: end = datetime.date(year, MONTHS[m1], int(d1b or d1))
        if end < start: end = start
        mid = start + (end - start) / 2
        return mid.timetuple().tm_yday
    rows, tier, year = [], None, None
    for r in csv.reader(open(val_csv, encoding="utf-8")):
        r = (r + [""] * 8)[:8]
        if r[0].endswith("Tier Tournaments"): tier = r[0][0]; continue
        if _re.fullmatch(r"20\d\d", r[0].strip()): year = int(r[0]); continue
        if not r[1] or r[0] == "Tournament": continue
        prize = float(r[3].replace("$", "").replace(",", "")) if r[3].strip() else 0
        rows.append({"tier": tier, "year": year, "name": r[1].strip(), "date": r[2], "usd": prize, "loc": r[4].strip(),
                     "n": int(r[5]) if r[5].strip().isdigit() else 8, "win": r[6].split("\n")[0].strip(), "ru": r[7].split("\n")[0].strip()})
    def series(name):
        s = _re.sub(r"\b20\d\d\b:?", "", name)
        s = _re.sub(r"#\d+", "", s)
        return _re.sub(r"\s+", " ", s).replace(" :", ":").strip()
    def region(name):
        n = name.lower()
        if "game changers" in n: return None
        if "china" in n: return "CN"
        if "asian champions" in n: return "ASIA"
        if "pacific" in n or "korea" in n or "japan" in n or "asia" in n or "soop" in n or "ten valorant" in n: return "PAC"
        if "americas" in n: return "NA|SA"
        if "brazil" in n: return "SA"
        if "north america" in n: return "NA"
        if "emea" in n or "blender" in n: return "EU|MENA"
        if "saudi" in n or "mena" in n: return "MENA"
        return ""
    def tiers_of(row):
        n = row["name"].lower()
        # le tier 1 du jeu est une ligue mondiale : les compétitions régionales invitent aussi le tier 2
        if "ascension" in n or "threshold" in n or "emea clash" in n or "challengers" in n: return "23"
        # compétition régionale : les meilleures équipes de la région, tous tiers confondus
        if region(row["name"]): return "123"
        return "1"
    # famille d'une compétition : les Masters changent de ville chaque année, Threshold China remplace Ascension China, etc.
    def family(k):
        if "Masters" in k: return "Masters"
        if "Ascension China" in k or "Threshold China" in k: return "China T2"
        return _re.sub(r" x ACL$", "", k)
    fam_year = {}
    for row in rows:
        if row["year"] in (2025, 2026) and "game changers" not in row["name"].lower():
            f_ = family(series(row["name"])); fam_year[f_] = max(fam_year.get(f_, 0), row["year"])
    latest = {}
    for row in rows:
        if row["year"] not in (2025, 2026) or "game changers" in row["name"].lower(): continue
        k = series(row["name"])
        if row["year"] == fam_year[family(k)]: latest[k] = row
    cal = []
    for k, row in latest.items():
        doy = mid_doy(row["date"], row["year"])
        if doy is None: continue
        week = iso_week(row["year"], doy)
        name = "EWC — VALORANT" if k.startswith("Esports World Cup") else k
        eur = round(row["usd"] * 0.92 / 1000) * 1000
        t = [name, week, eur, tiers_of(row), max(4, min(16, row["n"]))]
        rg = region(row["name"])
        if rg: t.append(rg)
        cal.append(t)
    cal.sort(key=lambda t: (t[1], -t[2]))
    live_tours["val"] = cal
    hist = lambda gc: [[row["year"], row["name"], row["win"], row["ru"], round(row["usd"] * 0.92), row["tier"]]
                       for row in rows if row["year"] <= 2025 and row["win"] and row["win"] not in ("TBD", "Cancelled") and ("game changers" in row["name"].lower()) == gc]
    live_history["val"], live_history["valgc"] = hist(False), hist(True)
    gc_latest = max((r for r in rows if "game changers championship" in r["name"].lower()), key=lambda r: r["year"], default=None)
    if gc_latest:
        doy = mid_doy(gc_latest["date"], gc_latest["year"])
        live_tours["valgc"] = [["VALORANT Game Changers Championship", iso_week(gc_latest["year"], doy), round(gc_latest["usd"] * 0.92 / 1000) * 1000, "1", min(16, gc_latest["n"])]]
    print("Valorant : %d tournois au calendrier, %d résultats historiques" % (len(cal), len(live_history["val"])), file=sys.stderr)

# ---------- tournois Rocket League (Google Sheet de l'utilisateur, d'après Liquipedia) ----------
# Calendrier : la saison RLCS 2026 complète (Kick-Off, Majors de Boston et de Paris avec leurs Opens régionaux, EWC, Championnat du monde,
# CRL, Saudi eLeague, tournois B-Tier) ; il se répète chaque saison (2027, 2028…). Historique : résultats 2024-2025.
rl_csv = os.path.join(ROOT, "tools/sources/rocketleague_tournois.csv")
if os.path.exists(rl_csv):
    MON = {m: i + 1 for i, m in enumerate("jan feb mar apr may jun jul aug sep oct nov dec".split())}
    def rl_date(txt):
        # « Sep 15–20, 2026 », « Nov 14 – Dec 06, 2025 », « oct. 22, 2026 » -> (année, jour de l'année au milieu)
        y = re.search(r"(20\d\d)", txt)
        parts = re.findall(r"([A-Za-zéû]{3})[a-zéû.]*\s+(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?", txt)
        if not y or not parts or parts[0][0].lower()[:3] not in MON: return None, None
        year = int(y.group(1))
        m1, d1, d1b = parts[0]
        start = datetime.date(year, MON[m1.lower()[:3]], int(d1))
        end = datetime.date(year, MON[parts[1][0].lower()[:3]], int(parts[1][1])) if len(parts) > 1 and parts[1][0].lower()[:3] in MON else datetime.date(year, MON[m1.lower()[:3]], int(d1b or d1))
        if end < start: end = start
        return year, (start + (end - start) / 2).timetuple().tm_yday
    REG_KEYS = [("SSA", "MENA"), ("Africa", "MENA"), ("Johannesburg", "MENA"), ("MENA", "MENA"), ("Middle East", "MENA"), ("Riyadh", "MENA"),
                ("APAC", "ASIA"), ("Asia", "ASIA"), ("OCE", "OCE"), ("Oceania", "OCE"), ("SAM", "SA"), ("South America", "SA"),
                ("NA Open", "NA"), ("North America", "NA"), ("United States", "NA"), ("Toronto", "NA"), ("Montréal", "NA"), ("Midland", "NA"), ("CRL", "NA"),
                ("EU Open", "EU"), ("Europe", "EU"), ("Bern", "EU"), ("Cologne", "EU"), ("Jönköping", "EU"), ("UniRocketeers", "EU")]
    def rl_region(name, loc):
        found = []
        for k, r in REG_KEYS:
            if (k in name or k in loc) and r not in found: found.append(r)
        if "Europe MENA" in loc: return "EU|MENA"
        return found[0] if found else ""
    SKIP = re.compile(r"1v1|2v2|Showmatch|Bracket Rivalry|FIFAe|Nations Cup|Solo Cup|Ascension Protocol|Club Championship 2027|Veteran Gaming", re.I)
    rows, tier = [], None
    for r in csv.reader(open(rl_csv, encoding="utf-8")):
        r = (r + [""] * 8)[:8]
        if re.search(r"tier", r[0], re.I) and not r[1]: tier = r[0].strip()[0].upper(); continue
        if not r[1] or r[0] == "Tournament": continue
        name, (year, doy) = r[1].strip(), rl_date(r[2])
        if year is None: continue
        usd = float(re.sub(r"[^\d.]", "", r[3]) or 0)
        n = int(re.sub(r"\D", "", r[5]) or 16)
        rows.append({"tier": tier, "name": name, "year": year, "doy": doy, "usd": usd, "n": n, "loc": r[4].strip(),
                     "win": r[6].split("\n")[0].strip(), "ru": r[7].split("\n")[0].strip()})
    cal = []
    for row in rows:
        nm = row["name"]
        if SKIP.search(nm): continue
        season2026 = ("RLCS 2026" in nm) if "RLCS" in nm else row["year"] == 2026
        if not season2026: continue
        # semaine réelle (ISO) du tournoi ; ceux de la saison qui ont commencé en 2025 (Kick-Off) ouvrent le calendrier
        week = SEASON_FIRST if row["year"] < 2026 else iso_week(row["year"], row["doy"])
        clean = re.sub(r"\s*\b20\d\d\b\s*(-\s*)?", " ", nm).replace("  ", " ").strip()
        clean = re.sub(r"^RLCS\s*-?\s*", "RLCS ", clean).strip()
        if clean.startswith("Esports World Cup"): clean = "EWC — Rocket League"
        reg = rl_region(nm, row["loc"])
        if row["tier"] == "S": tiers = "1"
        elif "Open" in nm and "RLCS" in nm: tiers = "1230"       # Opens RLCS : toutes les équipes de la région, les meilleures sortent
        elif "Saudi eLeague" in nm: tiers = "123"
        else: tiers = "23"
        t = [clean, week, round(row["usd"] * 0.92 / 100) * 100, tiers, max(4, min(16, row["n"]))]
        if reg and row["tier"] != "S": t.append(reg)
        cal.append(t)
    cal.sort(key=lambda t: (t[1], -t[2]))
    live_tours["rl"] = cal
    live_history["rl"] = [[row["year"], row["name"], row["win"], row["ru"], round(row["usd"] * 0.92), row["tier"]] for row in rows
                          if row["year"] <= 2025 and "2026" not in row["name"] and not SKIP.search(row["name"]) and row["win"] not in ("", "TBD", "Cancelled")]
    print("Rocket League : %d tournois au calendrier, %d résultats historiques" % (len(cal), len(live_history["rl"])), file=sys.stderr)

with open(OUT, "w", encoding="utf-8") as f:
    f.write("// Généré par tools/build_live.py — effectifs récupérés sur les sites de données (VLR…).\n")
    # numéro de version attendu par data.js (LIVE_EXPECTED) : l'interface prévient si le navigateur sert un fichier périmé
    f.write("const LIVE_BUILD = %d;\n" % LIVE_FORMAT)
    f.write("// Ces données remplacent celles de data.js pour les jeux concernés.\n")
    f.write("const LIVE_ORGS = " + json.dumps(live_orgs, ensure_ascii=False) + ";\n")
    f.write("const LIVE_ROSTERS = " + json.dumps(rosters, ensure_ascii=False) + ";\n")
    f.write("const LIVE_SOLOS = " + json.dumps(solos, ensure_ascii=False) + ";\n")
    f.write("// âges réels (Wikidata, au 20 octobre 2026) : jeu|pseudo -> âge\n")
    f.write("const LIVE_AGES = " + json.dumps(age_fix, ensure_ascii=False) + ";\n")
    f.write("// calendrier réel des tournois [nom, semaine, dotation €, tiers admis, places, régions] et palmarès réel [année, tournoi, vainqueur, finaliste, dotation €, tier S/A]\n")
    f.write("const LIVE_TOURNAMENTS = " + json.dumps(live_tours, ensure_ascii=False) + ";\n")
    f.write("const LIVE_HISTORY = " + json.dumps(live_history, ensure_ascii=False) + ";\n")
    f.write("// vrais joueurs sans équipe, ajoutés comme agents libres : jeu -> [pseudo, pays, note, âge]\n")
    f.write("const LIVE_FREE_AGENTS = " + json.dumps(free_agents, ensure_ascii=False) + ";\n")
    f.write("""Object.assign(TOURNAMENTS, LIVE_TOURNAMENTS);
Object.assign(ORGS, LIVE_ORGS);
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
