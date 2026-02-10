# Lotti Baby Coming Soon (Hostinger Builder kompatibel)

Diese Version ist **ohne PHP** und funktioniert in Hostinger Custom-Code/Builder.

## Aktueller Stand
- Kein E-Mail-Formular aktiv (auf Wunsch entfernt).
- Countdown aktiv.
- App-Icon wird in der Seite angezeigt und als Browser-/iPhone-Icon genutzt.

## Warum der vorherige Fehler kam
Hostinger Builder hat den Code als HTML gerendert, nicht als PHP. Deshalb wurden `<?= ... ?>`-Teile sichtbar.

## Zusätzlich gefixt
- Fehlerhaftes Logo-Bild wird jetzt automatisch ausgeblendet statt als kaputtes Icon angezeigt.
- Embed-Höhe wird per JS nachgezogen, damit nichts abgeschnitten wird.

## Datei fuer das Icon
- Lege `icon.PNG` in denselben Ordner wie `index.php` (z. B. `public_html/icon.PNG`).
