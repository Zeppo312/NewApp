# Weißere Flächen, Glas-Pills und kompakter Schlaftimer – 13. Oktober 2026

Diese Korrektur setzt das Nutzerfeedback zum ersten Gestaltungspaket um.
Sie ergänzt die unmittelbar vorher veröffentlichte Baby-Switcher-Version
`4eed878e-c35e-4cc0-be79-9f49dcbf3496` und erhält deren Lavendelgestaltung
und Übergang. Die bisherige Veröffentlichung des Home-Pakets ist historisch
in [home-unity-ota-20261012.md](home-unity-ota-20261012.md) dokumentiert.

## Gestaltung

- `constants/Colors.ts`: gemeinsame helle Kartenfläche von cremefarbenem
  `rgba(255,248,240,0.88)` auf weißes `rgba(255,255,255,0.94)` umgestellt.
  Sekundäre Standardaktionen und Formularfelder sind weiß, gedrückte
  Sekundäraktionen verwenden ein leichtes Graulila. Fachfarben, Brandlila,
  warme Textfarben, dunkle Palette und die Hintergrundauswahl bleiben erhalten.
- `GlassSheetSurface`: die helle Standardfläche ist weiß; der bisher beige
  Abschluss des Verlaufs ist leicht kühl. Die explizite Lavendelvariante
  des Baby-Switchers bleibt erhalten.
- `PeriodTabs`: einzelne Glas-Pills mit Abstand statt einer zusammenhängenden
  Leiste. Die Auswahl zeigt violetten Text und eine violette Kontur.
  Mindestens 44 Punkte Touchhöhe, skalierbare Beschriftungen und die
  Accessibility-Auswahl bleiben erhalten. Der Aufrufer prüft weiterhin
  den Monat-Zugang und entscheidet über den tatsächlichen Ansichtswechsel.
- `CentralTimerComponent` und `SleepTimerFace`: normale Uhr wieder kompakt
  (60 Prozent Bildschirmbreite, höchstens 260 Punkte) mit bläulichem Glas,
  Progressring und bestehenden Sonne-/Mond-Symbolen. Status, Startzeit und
  Vorhersage stehen wieder in der Uhr. Der bestehende Puls bleibt erhalten.
  Die unteren Texte nutzen in der kompakten Uhr die gemeinsamen Rollen
  `caption` und `label`.
- Ab Schriftfaktor 1,3 wächst die Uhr auf bis zu 280 Punkte; Hinweise fließen
  darunter mit voller Textskalierung. Timerziffern skalieren bis 1,4.
  Start-/Stopphinweise verwenden die gut lesbare Rolle `bodyStrong` statt
  die Zifferngröße für lange Wörter zu übernehmen.

Schriftfamilie, Einträge, Vorhersageberechnung, Speichern, Abbrechen,
Timerstart/-stopp und bestehende Berechtigungsentscheidungen bleiben erhalten.
Der PeriodTabs-Test ersetzt ausschließlich die dekorative native Glasfläche
im Test, um keine Hintergrund-/Billing-Provider zu laden.

## Prüfung

- Typecheck im Arbeitsverzeichnis und in der eingefrorenen Veröffentlichungsquelle
  erfolgreich. 65 Tests in acht Suites bestehen, darunter Timerabgleich,
  Tagesübersicht, Zeitauswahl, Formulare und Kontraste der Aktionsfarben.
- ESLint: keine Fehler und keine neuen Diagnosen; 41 bestehende Warnungen
  in den geprüften Dateien. Zeilenverschiebungen wurden normalisiert verglichen.
- 33 bestehende Lade-/Speicher-/Timer-Callbacks sind per normalisiertem
  TypeScript-AST mit der vorherigen Veröffentlichung identisch.
- 72 Web-Layoutvarianten von Home, Unser Tag und Schlaf: 320/390 Punkte,
  DE/EN/ES, hell/dunkel, normale und simuliert 1,6-fache Textgröße.
  Kein festgestellter horizontaler Text-/Seitenüberlauf.
- Zusätzlich 48 Timer-Vorschauen für Nacht-/Lern-/Start-/Stoppzustände bei
  320 Punkten, drei Sprachen, zwei Schriftgrößen und beiden Modi.
  Kein festgestellter Überlauf der Uhrtexte. Die Auswahl Woche/Tag wurde
  außerdem über die gerenderte Tab-Bedienung geprüft.

Die Vorschau verwendet reale Komponenten und ausgeschnittenes originales
Screen-JSX mit Beispieldaten und dem bestehenden Standardhintergrund.
Header, native Icons und Unschärfe sind vereinfacht. Dies ist eine
Web-Layoutprüfung, kein Nachweis der installierten App, nativen Systemschrift,
Blurqualität, Haptik oder einer Geräteabnahme. Eigene Fotohintergründe und
native iOS-/Android-Darstellung bleiben am Gerät zu prüfen.

Vorschau außerhalb des Repositorys:
`/Users/janzeppenfeld/Documents/Codex/2026-10-13/LottiBaby-Weisse-Flaechen-Schlaf/Vergleich.html`.

## Veröffentlichung

- Gruppe: `47303d97-7d35-404c-9f0a-15ae6f88efd2`
- Kanal und Branch: `release-candidate-20261003`
- Projekt: `@janzeppi/LottiBaby`, `d7120520-e4ff-4967-a797-627a2cb3680b`
- Umgebung: `production`; iOS und Android; Runtime `1.0.25`
- Link: https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/47303d97-7d35-404c-9f0a-15ae6f88efd2
- Isolierte Quelle: `.family-qa/home-refinement-20261013/source`
- Änderungen gegenüber der Basis: fünf UI-Dateien und ein dekorativer Test-Mock.
- Native Konfiguration, Paketdefinitionen und Lockfile bleiben identisch.
  Die Assets beider Plattformen entsprechen der Basis (120 iOS / 125 Android).
  Produktive Backend-/Billing-Konfiguration und bestehende Feature-Flags
  wurden beim Export geprüft.

Die ausgelieferten Manifest-IDs, Runtime-, Bundle- und Asset-Hashes sind
in `output/home-refinement-20261013/served-manifest-verification.json` belegt.
Kanalzuordnungen und das Main-Update sind nach der Veröffentlichung unverändert.
Der direkte Abruf der CDN-Bundle-Bytes liefert hier HTTP 403; die
Manifest-IDs und alle veröffentlichten Hashes wurden erfolgreich verglichen.
Eine Veröffentlichung belegt keine Installation auf einem Gerät.

Zur Übernahme in einer kompatiblen Installation: online vollständig beenden,
neu öffnen, das Update herunterladen lassen und erneut vollständig starten.
Es wurden keine Pakete installiert, kein neuer nativer Build ausgelöst und
keine Git-Änderungen gestaged, committed oder gepusht.
