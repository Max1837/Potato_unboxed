#!/usr/bin/env python3
"""
Potato Unboxed – Website-Update aus Google Sheets.

Liest die öffentliche Tabelle, extrahiert alle Produkte (Name, Link, Preis,
Bewertung, Feedback, Foto, QC-Foto), lädt neue Bilder herunter und schreibt
  data/products.json   – alle Produkte + Kategorien
  img/<hash>.webp       – Produktbilder (nur neue werden geladen)

Benutzung (im Ordner der Website):
    pip install pillow
    python3 update.py

Danach die geänderten Dateien hochladen (git add -A && git commit && git push).
Kategorien-Namen stehen in sections.json – wenn du in der Tabelle eine neue
Kategorie (neues Banner) einfügst, trag sie dort an der passenden Stelle ein.
"""
import concurrent.futures as cf
import hashlib
import html
import http.cookiejar
import io
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from html.parser import HTMLParser

SHEET_ID = "1In27Tyf9DnuvnpmoZM942dRA1M5vbkVGOSgnw2mo2V8"
ROOT = os.path.dirname(os.path.abspath(__file__))
IMG_DIR = os.path.join(ROOT, "img")
DATA_DIR = os.path.join(ROOT, "data")
IMG_SIZE = 600          # max. Kantenlänge der Produktbilder
IMG_QUALITY = 72

CONFIG = json.load(open(os.path.join(ROOT, "sections.json"), encoding="utf-8"))


# ---------------------------------------------------------------- HTTP
def opener():
    cj = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    op.addheaders = [("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) PotatoUnboxedUpdater")]
    return op


OP = opener()


def fetch_tab(gid):
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/htmlview/sheet?headers=false&gid={gid}"
    return OP.open(url, timeout=120).read().decode("utf-8")


# ---------------------------------------------------------------- Grid parser
class GridParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows, self.cur, self.cell, self.intable = [], None, None, False

    def handle_starttag(self, tag, a):
        a = dict(a)
        if tag == "table" and "waffle" in (a.get("class") or ""):
            self.intable = True
        if not self.intable:
            return
        if tag == "tr":
            self.cur = []
            self.rows.append(self.cur)
        elif tag in ("td", "th") and self.cur is not None:
            self.cell = {"tag": tag, "t": "", "h": None, "i": None,
                         "cs": int(a.get("colspan", 1)), "rs": int(a.get("rowspan", 1))}
            self.cur.append(self.cell)
        elif tag == "a" and self.cell is not None and not self.cell["h"]:
            self.cell["h"] = a.get("href")
        elif tag == "img" and self.cell is not None and not self.cell["i"]:
            self.cell["i"] = a.get("src")
        elif tag == "br" and self.cell is not None:
            self.cell["t"] += " "

    def handle_endtag(self, tag):
        if tag == "table":
            self.intable = False
        if tag in ("td", "th"):
            self.cell = None

    def handle_data(self, d):
        if self.cell is not None:
            self.cell["t"] += d


def parse_grid(page):
    p = GridParser()
    p.feed(page)
    grid, occ = {}, set()
    rows = [r for r in p.rows if r and r[0]["tag"] == "th" and r[0]["t"].strip().isdigit()]
    width = 0
    for r in rows:
        ri = int(r[0]["t"].strip())
        c = 0
        for cell in r[1:]:
            while (ri, c) in occ:
                c += 1
            cell["t"] = re.sub(r"\s+", " ", cell["t"]).strip()
            grid[(ri, c)] = cell
            for dr in range(cell["rs"]):
                for dc in range(cell["cs"]):
                    occ.add((ri + dr, c + dc))
            c += cell["cs"]
            width = max(width, c)
    maxr = max((k[0] for k in grid), default=0)
    return [[grid.get((ri, c)) for c in range(width)] for ri in range(1, maxr + 1)]


def unwrap(h):
    if not h:
        return None
    if "google.com/url" in h:
        return urllib.parse.parse_qs(urllib.parse.urlparse(h).query).get("q", [h])[0]
    return h


def txt(c):
    return c["t"] if c else ""


def parse_price(s):
    m = re.search(r"(\d+(?:[.,]\d+)?)", s or "")
    return round(float(m.group(1).replace(",", ".")), 2) if m else None


def parse_rating(s):
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*/+\s*10", s or "")
    if not m:
        return None
    v = float(m.group(1).replace(",", "."))
    return min(v, 10.0)


# ---------------------------------------------------------------- Extract
def header_map(row):
    m = {}
    for i, c in enumerate(row):
        t = txt(c).upper()
        if not t:
            continue
        if t.startswith("PHOTO") and "photo" not in m:
            m["photo"] = i
        elif t.startswith("NAME"):
            m["name"] = i
        elif t == "CW":
            m["cw"] = i
        elif t.startswith("LINK"):
            m["link"] = i
        elif t.startswith("PRICE (USD)"):
            m["usd"] = i
        elif t.startswith("RATING"):
            m["rating"] = i
        elif t.startswith("FEEDBACK"):
            m["feedback"] = i
        elif t == "QC":
            m["qc"] = i
    return m if "name" in m and "link" in m else None


def extract(grid, tab):
    """Gibt (products, sections) zurück. Sections werden durch Banner-Zeilen getrennt."""
    names = tab.get("sections") or []
    products, sections = [], []
    cols = None
    headers_seen = 0
    cur_section = None

    def new_section(label):
        nonlocal cur_section
        cur_section = {"name": label, "count": 0}
        sections.append(cur_section)

    for row in grid:
        hm = header_map(row)
        if hm:
            cols = hm
            headers_seen += 1
            if tab.get("header_section"):           # z. B. Merch: "PHOTO Travis Scoot"
                label = re.sub(r"(?i)^photo\s*", "", txt(row[hm.get("photo", 0)])).strip() or tab["title"]
                new_section(label.title())
            elif names:
                idx = headers_seen - 1
                label = names[idx] if idx < len(names) else f"{tab['title']} {idx + 1}"
                new_section(label)
            elif not cur_section:
                new_section(tab["title"])
            continue
        if not cols:
            continue
        name_c, link_c = row[cols["name"]], row[cols["link"]]
        name, link = txt(name_c), unwrap(link_c["h"] if link_c else None)
        if not name or not link or not link.startswith("http"):
            continue
        g = lambda k: row[cols[k]] if k in cols and cols[k] < len(row) else None
        photo, qc = g("photo"), g("qc")
        p = {
            "n": name,
            "u": link,
            "p": parse_price(txt(g("usd"))),
            "r": parse_rating(txt(g("rating"))),
            "f": txt(g("feedback")),
            "cw": txt(g("cw")),
            "s": len(sections) - 1,
            "_img": photo["i"] if photo else None,
            "_qc": qc["i"] if qc else None,
        }
        products.append(p)
        cur_section["count"] += 1
    return products, sections


# ---------------------------------------------------------------- Images
def download_image(url):
    try:
        big = re.sub(r"=w\d+-h\d+$", "=w800-h800", html.unescape(url))  # größere Version anfordern
        data = OP.open(big, timeout=60).read()
    except Exception as e:  # noqa: BLE001
        return url, None, str(e)
    key = hashlib.sha1(data).hexdigest()[:16]
    path = os.path.join(IMG_DIR, key + ".webp")
    if not os.path.exists(path):
        from PIL import Image
        try:
            im = Image.open(io.BytesIO(data))
            im = im.convert("RGBA") if im.mode in ("P", "LA", "RGBA") else im.convert("RGB")
            if im.mode == "RGBA":
                bg = Image.new("RGB", im.size, (18, 18, 20))
                bg.paste(im, mask=im.split()[3])
                im = bg
            im.thumbnail((IMG_SIZE, IMG_SIZE))
            im.save(path, "WEBP", quality=IMG_QUALITY, method=5)
        except Exception as e:  # noqa: BLE001
            return url, None, str(e)
    return url, key, None


def main():
    os.makedirs(IMG_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)
    all_products, collections = [], []
    for tab in CONFIG["tabs"]:
        print(f"→ Lade Reiter „{tab['title']}“ …", flush=True)
        grid = parse_grid(fetch_tab(tab["gid"]))
        prods, secs = extract(grid, tab)
        if tab.get("sections") and len(secs) != len(tab["sections"]):
            print(f"  ⚠ {len(secs)} Kategorien in der Tabelle, aber {len(tab['sections'])} Namen in sections.json – bitte prüfen!")
        base = sum(len(c["sections"]) for c in collections)
        for p in prods:
            p["s"] += base
        collections.append({"id": tab["id"], "title": tab["title"], "sections": secs})
        all_products += prods
        print(f"  {len(prods)} Produkte, {len(secs)} Kategorien")

    urls = sorted({u for p in all_products for u in (p["_img"], p["_qc"]) if u})
    print(f"→ Lade {len(urls)} Bilder (vorhandene werden übersprungen) …", flush=True)
    keymap, errors = {}, 0
    with cf.ThreadPoolExecutor(16) as ex:
        for i, (u, key, err) in enumerate(ex.map(download_image, urls), 1):
            if key:
                keymap[u] = key
            else:
                errors += 1
            if i % 250 == 0:
                print(f"  {i}/{len(urls)}", flush=True)
    if errors:
        print(f"  ⚠ {errors} Bilder konnten nicht geladen werden")

    out = []
    for i, p in enumerate(all_products):
        q = {k: v for k, v in p.items() if not k.startswith("_") and v not in ("", None)}
        q["s"] = p["s"]
        q["id"] = i
        if keymap.get(p["_img"]):
            q["i"] = keymap[p["_img"]]
        if keymap.get(p["_qc"]):
            q["q"] = keymap[p["_qc"]]
        out.append(q)

    used = {p.get("i") for p in out} | {p.get("q") for p in out}
    removed = 0
    for f in os.listdir(IMG_DIR):
        if f.endswith(".webp") and f[:-5] not in used:
            os.remove(os.path.join(IMG_DIR, f))
            removed += 1

    sections = [s for c in collections for s in c["sections"]]
    groups = CONFIG["groups"]
    for idx, s in enumerate(sections):
        s["g"] = next((g["id"] for g in groups if s["name"] in g.get("sections", [])), None)
    for c in collections:
        for s in c["sections"]:
            if not s["g"]:
                s["g"] = c["id"]

    payload = {
        "updated": __import__("datetime").date.today().isoformat(),
        "groups": groups,
        "collections": [{"id": c["id"], "title": c["title"]} for c in collections],
        "sections": sections,
        "products": out,
    }
    with open(os.path.join(DATA_DIR, "products.json"), "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    print(f"✓ Fertig: {len(out)} Produkte, {len(keymap)} Bilder, {removed} alte Bilder entfernt.")


if __name__ == "__main__":
    sys.exit(main())
