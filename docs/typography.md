# Gemeinsame Textrollen

`constants/Typography.ts` definiert die Typografie. `constants/DesignGuide.tsx`
exportiert sie als `TYPOGRAPHY` und enthält sie in `designTokens`. Die Rollen
verwenden die Systemschrift; Textfarben bleiben beim bestehenden Theme und der
Anpassung an Hintergrundbilder.

| Rolle | Verwendung | Größe | Zeilenhöhe | Gewicht |
| --- | --- | ---: | ---: | ---: |
| `display` | Großer Titel außerhalb des normalen Headers | 32 | 40 | 700 |
| `pageTitle` | Seitentitel und Header | 22 | 28 | 700 |
| `dialogTitle` | Formular- und Dialogüberschrift | 24 | 32 | 700 |
| `sectionTitle` | Abschnittsüberschrift | 20 | 28 | 700 |
| `headline` | Kartenüberschrift und untergeordnete Überschrift | 18 | 24 | 700 |
| `body` | Fließtext und Leerzustand | 16 | 24 | 400 |
| `bodyStrong` | Hervorgehobener Fließtext | 16 | 24 | 600 |
| `bodySmall` | Kurze ergänzende Beschreibung | 14 | 20 | 400 |
| `label` | Feldbeschriftung | 14 | 20 | 600 |
| `caption` | Metadaten und kurze Hinweise | 12 | 16 | 400 |
| `button` | Hauptaktion | 16 | 24 | 700 |
| `buttonSmall` | Kompakte Aktion | 14 | 20 | 600 |
| `link` | Link; bisherige Zeilenhöhe bleibt erhalten | 16 | 30 | 400 |
| `timer` | Zeitwerte mit gleich breiten Ziffern | 32 | 40 | 700 |

## Verwendung

```tsx
<ThemedText type="sectionTitle">Heute</ThemedText>
<ThemedText type="body" style={{ marginTop: 8 }}>Deine Einträge</ThemedText>
<ThemedText type="bodySmall">Zuletzt aktualisiert vor einer Minute</ThemedText>
<ThemedText type="button">Speichern</ThemedText>
```

Neue Aufrufer wählen eine Rolle über `type`. Lokale Styles definieren Layout und
gegebenenfalls die Farbe. Größe, Gewicht und Zeilenhöhe kommen aus der Rolle.
Für native Eingabefelder oder andere Textkomponenten kann dieselbe Rolle direkt
als `TYPOGRAPHY.body` verwendet werden.

Die Systemschriftgröße skaliert weiterhin über React Natives normale
`allowFontScaling`-Vorgabe. Zeilen und Bedienelemente sollen mitwachsen können;
eine Rolle begrenzt die Skalierung nicht.

## Kompatibilität und Einführung

Bestehende Werte bleiben verfügbar: `title` entspricht `display`, `subtitle`
entspricht `sectionTitle`, `defaultSemiBold` entspricht `bodyStrong`. `subtitle`
hat damit auch eine definierte Zeilenhöhe. Ohne `type` gilt weiterhin `default`
mit 16/24; bei verschachtelten Texten bleibt das geerbte Gewicht erhalten.
Explizites `body` setzt dagegen das vollständige Profil einschließlich Gewicht.
`style` wird weiterhin zuletzt angewendet; bestehende Farb- und Layoutanpassungen
bleiben möglich. Die Linkfarben und die adaptiven Farben werden weiterhin durch
`ThemedText` bestimmt.

Header, Collapsible, EmptyState, Rechtstextansichten und die genannten
Überschriften in Anmeldung, Blog und Wehenverlauf verwenden die neuen Rollen.
Weitere Textbereiche werden schrittweise umgestellt: zuerst die Rolle am
Aufrufer setzen, dann lokale Typografie entfernen und Umbruch sowie große
Systemschrift auf dem Gerät prüfen. Besondere Darstellungen wie der kreisförmige
Schlaftimer benötigen dabei eine eigene Layoutprüfung.

## Umgesetzter Umfang

Der gemeinsame Header verwendet `pageTitle` und `bodySmall`. Die Seitenaktionen
werden gemessen; der Titel reserviert auf beiden Seiten die größere gemessene
Breite plus 12 Punkte Abstand. Auch ohne Untertitel beträgt die Mindesthöhe
44 Punkte zuzüglich oberem und unterem Padding und gegebenenfalls Android-Inset.

| Seiten | Anwendung |
| --- | --- |
| Datenschutz, Nutzungsbedingungen, Impressum einschließlich Übersetzungen | Seitentitel, Abschnittstitel, Fließtext, Hinweise und Links |
| Krankenhaus-Checkliste | Header sowie Überschriften und Fortschrittsangaben der aufklappbaren Kategorien |
| Anmelden / Registrieren | Formularüberschrift `dialogTitle`, 24/32/700 |
| Lotti Baby Blog | Header, Beitragsüberschriften `sectionTitle` und Formular-/Entwurfsüberschriften `dialogTitle` |
| Wehen-Tracker | Header und Verlaufsüberschrift `sectionTitle`, 20/28/700 |
| Unser Tag (`daily_old.tsx`, aktive Route von Home) | Header und EmptyState |
| Mein Baby, Schlaf-Tracker, Gewichtskurve, Größenkurve, Zahn-Tracker, Meilensteine, Wochenmoment, Babywetter | Header |
| Countdown, Babygröße, Geburtsplan, Arztfragen, Babynamen, Schwangerschaft anlegen | Header |
| Planer, Einkaufsliste, Kundenkarten, Mama Selfcare | Header |
| Frag Lotti, Lottis Fürsorge, Lottis Empfehlungen, BLW-Rezepte, Meine Rezepte, Lotti Baby Shop | Header |
| Profil, Mehr, App-Einstellungen, Kontoverknüpfung einschließlich QR-Code, Abo, Passwort zurücksetzen, Support, Verbesserungen | Header |
| Aufpasser-Modus, Betreuungseinstieg und Betreuungssitzung | Header |
| Zyklus | Header der Ladeansicht |
| Admin-Dashboard, Moderation, Paywall-Editor, Paywall-Zugänge, Abo-Funktionen, Startmeldungen | Header |
| Schwangerschaftsbriefing | Header der gesperrten Abo-Ansicht über LockedFeatureScreen |

Die Bereiche mit Anwendung „Header“ erben die Änderung über die gemeinsame
Komponente. Ihre übrigen Text-, Formular- und Kartenstile sind damit noch nicht
vollständig auf Rollen umgestellt.

## Prüfung

Typecheck und ESLint für die geänderten Quelldateien wurden ausgeführt. Im Blog
und Wehen-Tracker bestehen insgesamt 14 ESLint-Warnungen bereits in HEAD; der
Vergleich der Diagnosen ergab keine neuen Meldungen und keine Fehler.

Die lokale Expo-Webansicht wurde bei 390 und 320 Punkten Breite geprüft. Eine
temporäre Prüfansicht zeigte den echten Header mit langem Titel, zwei Aktionen
und ohne Untertitel. Bei 320 Punkten war der Titel exakt auf Bildschirmmitte
(160) ausgerichtet und hatte 12 Punkte Abstand zur rechten Aktion; die
Bedienelemente blieben 44×44. Ohne Untertitel betrug die Headerhöhe 64 mit
6 Punkten unterem Abstand zum Bedienelement. Testaktionen und Zurück-Handler
reagierten. Die Prüfansicht und die dafür nötigen temporären Einbindungen wurden
anschließend entfernt.

Die echte Anmeldung und ihr Wechsel zur Registrierung sowie die Rechtstextansicht
wurden im Browser betrachtet. Die Anmeldeüberschrift verwendet 24/32/700.

Native Darstellung, große iOS-/Android-Systemschrift und die vollständige
Umstellung aller übrigen Seiten sind noch offen. Die Browserprüfung ersetzt
diese Prüfung auf dem Gerät nicht. Bei der Geräteprüfung am 12. Oktober 2026
waren alle iOS-Simulatoren ausgeschaltet und kein Android-Gerät verbunden.
