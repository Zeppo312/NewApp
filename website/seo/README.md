# SEO-Paket für lottibaby.de · 17. Oktober 2026

Lokal umgesetzt, noch nicht auf Hostinger veröffentlicht. Die PHP-Quellen der
Hauptseite und der Hosting-Zugang liegen in diesem Checkout nicht vor.

Ein geprüftes Upload-ZIP der elf öffentlichen Dateien liegt zusätzlich unter
`output/aso-20261017/lottibaby-seo-upload.zip`. Es enthält ausschließlich die drei
neuen Seitenordner, deren Assets und die zusätzliche Sitemap. Hauptseiten-
Templates und bestehende Sitemap werden dadurch nicht ersetzt. Aktueller
Zugriffsstand: Hostinger verlangt eine Anmeldung; der Mac ist gesperrt.

## Erzeugen und prüfen

`node scripts/build-seo-pages.mjs` erzeugt unter `public/` drei eigenständige,
responsive Seiten: `/wehen-timer/`, `/stillprotokoll/` und `/babyschlaf/`.
Texte: `features.json`. Gestaltung: `features.css`. Die drei echten App-Bilder
stammen aus der vorhandenen deutschen Store-Serie vom 14. Oktober.

Jede Seite hat einen eigenen Titel, eine Meta-Beschreibung, Canonical-Link,
Open-Graph-Metadaten, WebPage-Strukturdaten, einen Smart App Banner, deutsche
Store-Links und Links auf die beiden anderen Funktionsseiten. Es werden keine
externen Fonts oder Tracking-Skripte geladen. Preise und Testphasen werden nicht
pauschal versprochen; die Abo-Abhängigkeit ist sichtbar.

Lokale Vorschau: `python3 -m http.server 8767 --directory website/seo/public`,
dann `http://localhost:8767/stillprotokoll/` öffnen.

## Einbau auf Hostinger

1. Die drei Seitenordner und `assets/seo/` aus `public/` in das bestehende
   `public_html/` übernehmen. Die `.htaccess` liegt jeweils nur im neuen
   Seitenordner und setzt dort `DirectoryIndex index.html`. Keine Root-
   `.htaccess`, PHP-Dateien oder vorhandenen Assets ersetzen.
2. `homepage-integration.html` als Vorlage für die vorhandenen deutschen
   PHP-Templates nutzen. Das Fragment selbst nicht als Startseite hochladen.
   Vorhandene Meta-Tags ersetzen, statt doppelte Tags hinzuzufügen. Banner
   zusätzlich im gemeinsamen Head der App-Seite einbauen. EN/ES-Lokalisierungen
   und Shop-Links erhalten.
3. In gemeinsamen deutschen Headern, Footern, Download-Buttons und JSON-LD-
   `installUrl` die `/us/`-Store-URL durch `/de/` ersetzen. Die Links-Seite im
   Repo nutzte bereits `/de/`; ihr Generator enthält jetzt zusätzlich den Banner.
4. Die drei neuen `<url>`-Einträge aus `public/seo-sitemap.xml` in die bestehende
   `sitemap.xml` aufnehmen. Die vorhandene Sitemap enthält auch Shop-Inhalte:
   **nicht durch diese Teilliste ersetzen**. Alternativ die zusätzliche Sitemap
   separat einreichen.
5. Live alle drei Seiten auf HTTP 200, Bilder, mobile Darstellung und Store-Ziel
   prüfen; deutsche Startseite auf genau einen Titel/H1 und Banner prüfen.

Die öffentliche Startseite wurde am 17. Oktober gelesen. Sie enthält bereits
Schwangerschafts-/Baby-Tracker-Begriffe in Keywords und Open Graph. Die
Verbesserung betrifft vor allem sichtbaren H1, Browser-Titel und gezielte Seiten;
die pauschale Aussage „keine Suchbegriffe“ aus der Ausgangsanalyse war zu weitgehend.
