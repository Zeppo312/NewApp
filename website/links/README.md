# Lottis Links

Live: https://lottibaby.de/links/

Schlanke deutsche Linkseite im Stil der bestehenden Website. Stand: 11. September 2026.

## Inhalt ändern

- Ziele und Originaltitel: `content.json`.
- Texte, Reihenfolge und HTML: `../../scripts/build-links-page.mjs`.
- Gestaltung: `styles.css`.
- Nach Änderungen: `node scripts/build-links-page.mjs` im Projektverzeichnis.
- `index.html`, `styles.css`, `.htaccess` und `assets/` nach `/public_html/links/` hochladen.
  `content.json` und diese Anleitung werden nicht veröffentlicht. Bei CSS-Änderungen
  die Versionskennung des Stylesheet-Links im Generator erhöhen.
- `.htaccess` setzt für dieses Verzeichnis `DirectoryIndex index.html`, weil der
  Server ansonsten die Startdatei `default.php` erwartet. Die übrige Website wird
  dadurch nicht verändert.

## Übernahme

Quelle: https://linktr.ee/anyhelptoolate (Live-Seite und aktuelle Profildaten am 11. September 2026).
Von 14 Linkkarten bleiben nach dem Update zehn erhalten; zusätzlich ist der eigene
Lotti Baby Shop unter https://lottibaby.de/prints?lang=de direkt unter der App verlinkt.
Ausgeschlossen sind District4Kids, Momcozy BabyPhone, Najell Babytrage und Najell Sleepcarrier; auch die District4Kids-Angabe in der Profilbeschreibung
wurde nicht übernommen. Instagram, TikTok und E-Mail bleiben erhalten.
Die vorhandenen Affiliate- und Kurzlinks bleiben unverändert, damit die Zuordnung
zum bisherigen Profil erhalten bleibt. Keine zusätzlichen Shop-Angebote oder Rabatte erfunden.

Alle Bilder wurden aus der bestehenden Linkseite bzw. von lottibaby.de übernommen,
als kleine WebP-Dateien optimiert und lokal gehostet. Auch die beiden Schriften
Inter und Playfair Display stammen aus den bereits selbst gehosteten Website-Fonts.
Die veröffentlichte Seite lädt keine Linktree-Ressourcen, Social-Media-Embeds,
Tracking-Skripte, JavaScript-Pakete oder externen Fonts. Externe Dienste werden erst
beim Aufruf des jeweiligen Links geöffnet. Produktlinks sind als Werbung gekennzeichnet.

## Geprüft

- Die behaltenen Partnerziele entsprechen den Original-URLs; alle vier ausgeschlossenen Angebote fehlen. Der Shop-Link entspricht dem Shop der Lotti-Baby-Website.
- Browserprüfung bei 320, 390 und 1440 Pixeln: kein horizontaler Überlauf;
  Karten mindestens 83 Pixel hoch, sichtbarer Tastaturfokus, keine kaputten Bilder.
- Die gesamte Seite inklusive CSS, allen Bildern und beiden Fonts umfasst 141.968 Bytes;
  HTML und CSS gzip-komprimiert rund 4,4 KB. Bilder unterhalb des sichtbaren Bereichs laden verzögert.
- FTPS-Upload mit geprüftem TLS-Zertifikat, SHA-256-Verifikation aller hochgeladenen Dateien.
- Live-URL und sämtliche 15 Seiten-/Asset-Dateien: HTTP 200, bytegleich mit den lokalen Dateien.
  `/links` leitet korrekt auf `/links/` weiter.
- Prüfprotokolle unter `output/lotti-links/`. Automatische HEAD-Abfragen externer
  Anbieter können blockiert werden; sie sind kein Nachweis für eine defekte Zielseite.

## Offene Partnerlinks

Die GET-Prüfung am 11. September 2026 ergab HTTP 404 für Koala Babycare
(`https://www.koalababycare.com/LOTTI10`). Dieser bereits in der Quelle enthaltene
Link bleibt unverändert. Für einen Austausch wird ein aktueller Partnerlink benötigt.
Die beiden ebenfalls defekten Najell-Angebote wurden auf Wunsch entfernt.
Amazon blockiert automatisierte HEAD-Anfragen mit HTTP 405; daraus lässt sich
kein defekter Link ableiten.

Das Instagram-/TikTok-Profil und die alte Linktree-Seite wurden nicht geändert.
Als neuen Bio-Link `https://lottibaby.de/links/` verwenden.

Instagram-Update: Der persönliche Account ist auf Nutzerwunsch überall als
`@lottismomlife` mit `https://www.instagram.com/lottismomlife/` verlinkt.
Instagram-Icons erscheinen im Social-Button und in beiden Instagram-Karten.
