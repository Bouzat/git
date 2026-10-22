# Récupère les classements et effectifs Valorant sur vlr.gg (1 requête / 1,5 s).
# Usage : python3 tools/fetch_vlr.py sortie.json
import re, json, sys, time, urllib.request, html
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) EsportsManagerFanGame/1.0"}
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40).read().decode("utf-8", "replace")
REGIONS = {"europe": 20, "north-america": 14, "brazil": 10, "asia-pacific": 14, "korea": 8, "japan": 8, "china": 12, "la-s": 6, "la-n": 6, "oceania": 4, "mena": 8}
teams = []
for reg, n in REGIONS.items():
    h = get(f"https://www.vlr.gg/rankings/{reg}")
    seen = set(); rank = 0
    for m in re.finditer(r'href="/team/(\d+)/([^"]+)"[^>]*>.*?<div class="ge-text">\s*([^<]+?)\s*<', h, re.S):
        if m.group(1) in seen: continue
        seen.add(m.group(1)); rank += 1
        if rank > n: break
        teams.append({"id": m.group(1), "slug": m.group(2), "name": html.unescape(m.group(3)), "region": reg, "rank": rank})
    time.sleep(1.5)
print(len(teams), "teams")
for t in teams:
    h = get(f"https://www.vlr.gg/team/{t['id']}/{t['slug']}")
    sec = h.split('players', 1)[-1].split('staff', 1)[0] if 'players' in h else ''
    roster = []
    for it in sec.split('class="team-roster-item"')[1:]:
        cc = re.search(r'flag mod-([a-z]{2})', it); alias = re.search(r'team-roster-item-name-alias">(.*?)</div>', it, re.S)
        role = re.search(r'team-roster-item-name-role">\s*([^<]+?)\s*<', it)
        if not alias: continue
        a = re.sub(r'<[^>]+>', '', alias.group(1)).strip()
        roster.append({"h": html.unescape(a), "cc": cc.group(1).upper() if cc else "", "role": role.group(1).strip().lower() if role else ""})
    t["roster"] = roster
    time.sleep(1.5)
json.dump(teams, open(sys.argv[1] if len(sys.argv) > 1 else "vlr_teams.json", "w"), ensure_ascii=False, indent=0)
for t in teams: print(t["region"], t["rank"], t["name"], "|", ", ".join(p["h"] + (f"[{p['role']}]" if p["role"] else "") for p in t["roster"]))
