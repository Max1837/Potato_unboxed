# Potato Unboxed – Finds-Website

Statische Website (HTML/CSS/JS, kein Server nötig) mit allen Produkten aus der
Google-Tabelle „POTATOREPS SPREADSHEET“.

## Aufbau

| Datei / Ordner        | Inhalt |
|-----------------------|--------|
| `index.html`          | Die Seite |
| `css/style.css`       | Design |
| `js/app.js`           | Logik (Kategorien, Suche, Favoriten, Währungen, Details) |
| `js/i18n.js`          | Texte in 16 Sprachen |
| `js/config.js`        | **Deine Links** (Discord, TikTok, Einladungslink …) und Wechselkurse |
| `data/products.json`  | Alle Produkte – wird vom Update-Skript erzeugt |
| `img/`                | Produktbilder – werden vom Update-Skript erzeugt |
| `sections.json`       | Namen der Kategorien in der Reihenfolge der Banner in der Tabelle |
| `update.py`           | Update-Skript |

## Produkte aktualisieren

**Automatisch (GitHub):** Die Datei `.github/workflows/update.yml` führt das
Update jeden Tag aus und lädt neue Produkte und Bilder hoch. Sofort starten:
GitHub → *Actions* → „Produkte aus Google Sheets aktualisieren“ → *Run workflow*.

**Von Hand:**

```bash
pip install pillow
python3 update.py
```

Danach die Änderungen hochladen.

### Neue Kategorie in der Tabelle?

Wenn du in der Tabelle eine neue Kategorie mit Banner anlegst, trag den Namen in
`sections.json` an derselben Stelle ein (und ggf. in einer Gruppe unter
`groups`). Das Skript warnt, wenn die Anzahl nicht passt.

Wichtig: Die Tabelle muss für „Jeder mit dem Link“ sichtbar bleiben.

## Lokal ansehen

```bash
python3 -m http.server 8000
```

Dann http://localhost:8000 öffnen.
