# Lecture des listes de tournois rendues par Liquipedia (pages « S-Tier Tournaments », « A-Tier Tournaments »)
import html as H, re
def _txt(s): return H.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s))).strip()
def tournaments(htmltext, tier=""):
    out, year = [], None
    for m in re.finditer(r'<h[23] id="(\d{4})"|<tr class="table2&#95;&#95;row--body[^"]*">(.*?)</tr>', htmltext, re.S):
        if m.group(1): year = int(m.group(1)); continue
        tds = re.findall(r"(<td[^>]*>)(.*?)</td>", m.group(2), re.S)
        cells = [b for a_, b in tds]
        a = re.search(r'class="column&#95;&#95;tournament"[^>]*><a href="/[^/]+/([^"]+)"[^>]*>(.*?)</a>', m.group(2), re.S)
        if not a or len(cells) < 6: continue
        page = H.unescape(a.group(1)).replace("_", " ")
        txt = [_txt(c) for c in cells]
        # colonnes : tier, jeu, icône, tournoi, dates, dotation, lieu, participants, vainqueur, finaliste
        i = max([k for k, (at, b) in enumerate(tds) if "column&#95;&#95;tournament" in at] or [3])
        date, prize, loc, n = txt[i + 1], txt[i + 2], txt[i + 3], txt[i + 4]
        win = txt[i + 5] if len(txt) > i + 5 else ""
        runner = txt[i + 6] if len(txt) > i + 6 else ""
        usd = int(re.sub(r"[^\d]", "", prize) or 0)
        out.append({"year": year, "tier": tier or txt[0], "page": page, "name": _txt(a.group(2)), "date": date, "usd": usd, "loc": loc,
                    "n": int(re.sub(r"[^\d]", "", n) or 0), "winner": win, "runner": runner})
    return out
