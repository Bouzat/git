# Accès poli à l'API de Liquipedia (une requête toutes les 5 s, pause en cas de limite atteinte, réponses mises en cache dans tools/sources/liquipedia)
import json, os, re, time, urllib.parse, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools/sources/liquipedia")
UA = "EsportsManagerCEO/1.0 (fan game, roster import; non-commercial)"
_last = [0.0]
def _get(url, tries=6):
    import urllib.error
    for k in range(tries):
        try: return _get1(url)
        except urllib.error.HTTPError as e:
            if e.code != 429 or k == tries - 1: raise
            time.sleep(30 * (k + 1))
def _get1(url):
    wait = 5 - (time.time() - _last[0])
    if wait > 0: time.sleep(wait)
    _last[0] = time.time()
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            import gzip; data = gzip.decompress(data)
    return json.loads(data)
def search(wiki, q, n=10):
    u = f"https://liquipedia.net/{wiki}/api.php?action=query&list=search&srlimit={n}&format=json&srsearch=" + urllib.parse.quote(q)
    return [x["title"] for x in _get(u)["query"]["search"]]
def page(wiki, title):
    f = os.path.join(CACHE, wiki, re.sub(r"[^A-Za-z0-9_.-]", "_", title) + ".txt")
    if os.path.exists(f): return open(f, encoding="utf-8").read()
    u = f"https://liquipedia.net/{wiki}/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&redirects=1&format=json&titles=" + urllib.parse.quote(title)
    pages = _get(u)["query"]["pages"]
    p = next(iter(pages.values()))
    txt = p["revisions"][0]["slots"]["main"]["*"] if "revisions" in p else ""
    os.makedirs(os.path.dirname(f), exist_ok=True)
    open(f, "w", encoding="utf-8").write(txt)
    return txt
_lastp = [0.0]
def html(wiki, title):
    """Page rendue (action=parse, limitée par Liquipedia à une requête toutes les 30 s)."""
    f = os.path.join(CACHE, wiki, re.sub(r"[^A-Za-z0-9_.-]", "_", title) + ".html")
    if os.path.exists(f): return open(f, encoding="utf-8").read()
    wait = 32 - (time.time() - _lastp[0])
    if wait > 0: time.sleep(wait)
    _lastp[0] = time.time()
    u = f"https://liquipedia.net/{wiki}/api.php?action=parse&prop=text&format=json&page=" + urllib.parse.quote(title)
    txt = _get(u)["parse"]["text"]["*"]
    os.makedirs(os.path.dirname(f), exist_ok=True)
    open(f, "w", encoding="utf-8").write(txt)
    return txt
