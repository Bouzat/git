# Récupère sur esportsearnings.com les meilleurs joueurs 2026 d'un jeu (pays, date de naissance)
# et les équipes/duos des tournois 2026 où ils ont joué. 1 requête toutes les 1,5 s.
# Usage : python3 tools/fetch_esportsearnings.py 534-fortnite sortie.json [filtre_url_tournois] [filtre_titre_tournois]
import html, json, re, sys, time, urllib.request
GAME, OUT = sys.argv[1], sys.argv[2]
TFILTER = re.compile(sys.argv[3] if len(sys.argv) > 3 else r"2026", re.I)
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) EsportsManagerFanGame/1.0"}
def get(path):
    time.sleep(1.5)
    return urllib.request.urlopen(urllib.request.Request("https://www.esportsearnings.com" + path, headers=UA), timeout=40).read().decode("utf-8", "replace")
txt = lambda s: html.unescape(re.sub(r"<[^>]+>", "", s)).strip()

from datetime import datetime
def parse_date(d):
    for f in ("%B %d, %Y", "%Y-%m-%d", "%b %d, %Y"):
        try: return datetime.strptime(d, f).strftime("%Y-%m-%d")
        except ValueError: pass
    return ""
GAMEWORDS = re.compile(sys.argv[4] if len(sys.argv) > 4 else r".", re.I)
players, tours = {}, set()
h = get(f"/history/2026/games/{GAME}")
for r in re.findall(r"<tr[^>]*>(.*?)</tr>", h, re.S):
    m = re.search(r'href="(/players/(\d+)-[^"]+)">([^<]+)</a>', r)
    if not m: continue
    cc = re.search(r"flags/16/(\w+)\.png", r)
    year = re.findall(r"\$[\d,.]+", r)
    players[m.group(2)] = {"url": m.group(1), "h": html.unescape(m.group(3)), "cc": cc.group(1).upper() if cc else "", "earn": year[0] if year else ""}
print(len(players), "joueurs", file=sys.stderr)
for pid, p in players.items():
    h = get(p["url"])
    dob = re.search(r"Date of Birth:</div><div[^>]*>(.*?)</div>", h, re.S)
    p["dob"] = parse_date(txt(dob.group(1))) if dob else ""
    age = re.search(r"Age:</div><div[^>]*>\s*(\d+)", h)
    p["age"] = int(age.group(1)) if age else 0
    real = re.search(r"Name:</div><div[^>]*>(.*?)</div>", h, re.S)
    p["name"] = txt(real.group(1)) if real else ""
    for t in re.findall(r'href="(/tournaments/\d+-[^"]+)"', h):
        if TFILTER.search(t): tours.add(t)
print(len(tours), "tournois", file=sys.stderr)
results = []
for t in sorted(tours):
    h = get(t)
    title = txt(re.search(r"<title>(.*?)</title>", h).group(1)).split(" - Tournament Results")[0]
    if not GAMEWORDS.search(title): continue
    # chaque bloc de résultat : équipe (ou "-") puis ses joueurs
    for blk in re.split(r'tournament_team_highlight_box|<tr class="format_row', h)[1:]:
        team = re.search(r'tournament_team_medalist_name">(.*?)</div>|detail_list_team[^>]*>(.*?)</td>', blk, re.S)
        mem = re.findall(r'flags/16/(\w+)\.png[^>]*>\s*</a>\s*<a[^>]*href="/players/(\d+)-[^"]+">([^<]+)</a>', blk)
        if not mem: continue
        tn = txt(next(g for g in team.groups() if g)) if team else ""
        results.append({"t": title, "team": "" if tn in ("-", "") else tn, "members": [{"id": i, "h": html.unescape(n), "cc": c.upper()} for c, i, n in mem]})
json.dump({"players": players, "results": results}, open(OUT, "w"), ensure_ascii=False, indent=0)
print(len(results), "résultats", file=sys.stderr)
