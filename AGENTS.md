# AGENTS.md - gymbo-website

Dieses Dokument beschreibt, wie in diesem Repository gearbeitet werden soll.

## 1) Projektueberblick
- Produkt: Marketing-Website fuer die iOS-App GymBo.
- Stack: statisches HTML/CSS/JS ohne Build-Tool.
- Deployment: Vercel als statisches Hosting (`vercel.json` mit `outputDirectory: "."`).
- Sprachen (DE): Root (`/index.html`, `/faq.html`, `/roadmap.html`, `/manifest.html`, `/datenschutz.html`)
- Sprachen (EN): Unter `/en/` (`/en/index.html`, `/en/faq.html`, `/en/roadmap.html`, `/en/manifest.html`)

## 2) Repo-Struktur (relevant)
- `index.html`, `faq.html`, `roadmap.html`, `manifest.html`, `datenschutz.html`: DE-Seiten
- `en/index.html`, `en/faq.html`, `en/roadmap.html`, `en/manifest.html`: EN-Seiten
- `sitemap.xml`, `robots.txt`: SEO/Indexing
- `og-preview.png`, `og-image.svg` (+ EN-Varianten): Social Preview Assets
- `docs/plans/2026-01-14-redesign-dark-bold.md`: Designleitbild fuer den aktuellen Look
- `vercel.json`: Deployment-Konfiguration

## 3) Wichtige Architektur-Realitaet
- Die Seiten sind weitgehend self-contained mit viel Inline-CSS pro Datei.
- Die Seiten enthalten viel Inline-JS pro Datei (Theme Toggle, Mobile Menu, Animationen).
- `style.css` ist aktuell nicht die primaere Source of Truth fuer die Hauptseiten.
- Es gibt Legacy-Backend-Dateien (`app.py`, `subscribe.php`), aber die Website wird primaer statisch betrieben.

## 4) Verbindliche Edit-Regeln
- DE/EN konsistent halten: Aenderungen an einer DE-Seite immer gegen das EN-Pendant pruefen und spiegeln (wo inhaltlich passend).
- Relative Links korrekt halten: Root-Seiten verlinken EN mit `en/...`, EN-Seiten verlinken DE mit `../...`.
- SEO-Metadaten bei Struktur-/Textaenderungen mitziehen: `title`, `description`, Canonical, `hreflang`, Open Graph, Twitter Cards, JSON-LD.
- Wenn URLs, Seitennamen oder Verlinkung geaendert werden: `sitemap.xml` und interne Navigationen aktualisieren.
- Keine grossflaechige Reformatierung ganzer HTML-Dateien ohne fachlichen Grund.
- Bestehenden Stil beibehalten (Dark-first, Amber-Akzent, Inter, starke Hero-Inszenierung), siehe `docs/plans/2026-01-14-redesign-dark-bold.md`.

## 5) Inhaltliche Guardrails
- App-Store-Links konsistent halten (DE/EN Seiten auf dieselbe Ziel-URL-Strategie angleichen).
- Privacy/Data-Protection Kommunikation nicht unbeabsichtigt abschwaechen oder rechtlich umformulieren.
- Claims zu Preis/Features nur aendern, wenn es explizit angefordert ist.

## 6) QA-Checkliste vor Abschluss
- Alle betroffenen Seiten lokal im Browser pruefen (mind. DE + EN Gegenstueck).
- Header/Footer-Links pruefen (inkl. Language Switcher).
- Theme Toggle pruefen (dark/light, persisted via `localStorage`).
- Mobile Menu pruefen.
- In-Page Anchor/Smooth-Scroll pruefen (z. B. `#features`).
- Browser-Konsole auf JS-Fehler pruefen.
- Bei SEO-Aenderungen: Canonical + `hreflang` + Sitemap querchecken.

## 7) Bekannte Inkonsistenzen (Stand jetzt)
- `index.html` und `en/index.html` enthalten Subscribe-JS (`subscribeForm`), aber kein entsprechendes Formular-Markup mit dieser ID.
- Es gibt keine separate englische Datenschutz-Seite; EN-Footer verlinkt auf die deutsche Datenschutzseite.
- `style.css` und `app.py` existieren, werden aber vom aktuellen statischen Haupt-Setup nicht zentral genutzt.

## 8) Empfohlene lokale Vorschau
- Schnelltest statisch: `python3 -m http.server 8080`
- Aufruf: `http://localhost:8080/` und `http://localhost:8080/en/`
