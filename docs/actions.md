# Gemeinsame Aktionen

`components/ui/action-button.tsx` stellt beschriftete Aktionen bereit. Die
Farben kommen aus `ActionColors` in `constants/Colors.ts`, Maße aus
`constants/Actions.ts` und Text aus den vorhandenen Rollen in
`constants/Typography.ts`. `DesignGuide` exportiert die Aktionsmaße ebenfalls;
sein bisheriges `PRIMARY` verweist auf dasselbe Brandlila mit unverändertem Wert.

```tsx
<ActionButton label={t('common.save')} busy={saving} onPress={save} isDark={isDark} />
<ActionButton variant="secondary" label={t('common.cancel')} onPress={close} isDark={isDark} />
```

Die Varianten sind `primary`, `secondary`, `ghost` und `destructive`. Pro
Aktionsgruppe gibt es eine Hauptaktion. `ghost` ist für lesbare Textaktionen
auf einer bekannten hellen oder dunklen Fläche vorgesehen; auf einem freien
Foto-/Glashintergrund ist dessen zusammengesetzter Kontrast gesondert zu prüfen.
`isDark` beschreibt die eigene Fläche. Ein heller Loginbereich verwendet die
helle Variante auch bei dunklem Gerätehintergrund.

Hauptaktionen verwenden die bestehende Rolle `button` mit 16/24/700 und
mindestens 52 Punkten Höhe. `size="compact"` verwendet `buttonSmall` und
mindestens 44 Punkte beziehungsweise 48 auf Android. Padding und Mindesthöhe
lassen Umbruch und Systemschrift wachsen. `style` passt nur Layout wie Rand,
Breite oder Flex an; Farbe und Schrift stammen aus der gemeinsamen Grundlage.

Normal, gedrückt, deaktiviert und beschäftigt haben vollständige Farbpaare.
Weiß auf dem normalen Brandlila ergibt für das opake Paar rund 5,18:1. Der
gedrückte Zustand verdunkelt die Fläche. Deaktivierte Aktionen erhalten eine
ruhige opake Fläche, statt das ganze Farbpaar durch Opacity abzuschwächen.
Die Farbumstellung hat keine räumliche Animation.

`busy` zeigt einen Spinner und verhindert `onPress`; der Name bleibt lesbar.
Ein optionales `busyLabel` beschreibt den Vorgang. Das Accessibility-Label
bleibt standardmäßig der ursprüngliche Aktionsname und der Zustand enthält
`disabled` und `busy`. Der Aufrufer behält den fachlichen Save-/Fehler-/Close-
Vertrag und setzt `busy` während seines laufenden Vorgangs. Die Komponente
speichert keine Daten und verändert keine Berechtigungen oder Einwilligungen.

Der erste lokale Umfang umfasst Anmeldung/Registrierung, TextInputOverlay,
Definition und Eintrag eigener Aktivitäten sowie das Melden einer KI-Antwort.
Fachfarben für Aktivitätsauswahl und -markierungen bleiben bestehen. Die
bisherige `accentColor`-Prop des Textoverlays bleibt als veraltete kompatible
Eingabe erhalten; seine Aktionen verwenden jetzt die gemeinsame Palette.
Bezeichnungen und Bestätigungswege des Overlays bleiben erhalten.

Der gemeinsame Formularrahmen und seine Übertragung auf Erfassungsdialoge
sind inzwischen in [forms.md](forms.md) dokumentiert. Native Darstellung,
Tastatur und große iOS-/Android-Systemschrift müssen am Gerät geprüft werden.

## Lokale Prüfung am 12. Oktober 2026

Typecheck und 30 gezielte Tests bestehen. Sie prüfen unter anderem deaktivierte
Callbacks, Busy-Label/Spinner, die opaken Kontraste aller Varianten und Zustände,
Anmeldung/Einwilligung, Meldungsfehler mit Wiederholen sowie erhaltene Aktivitäts-
und Texteingabeentwürfe. ESLint meldet keine Fehler und vier unveränderte
Warnungen aus Colors und den beiden Aktivitätsdialogen.

Die echte Expo-Web-Anmeldung wurde bei 390 und 320 Punkten und beim Wechsel zur
Registrierung geprüft. Der neue Hauptbutton verwendet Lila/Weiß, 16/24 und
52 Punkte Höhe. Eine separate Web-Prüfansicht verwendet den echten
ActionButton für hell/dunkel, lange DE/EN/ES-Texte, Busy/Disabled und eine
simulierte 1,6-fache Textgröße. Beschriftungen wachsen ohne Überlauf. Das ist
eine Web-Layoutprüfung und kein Nachweis nativer Systemschrift oder Tastatur.

`Typography.ts`, `ThemedText.tsx` und die übrigen bereits vorhandenen
Typografieänderungen bleiben erhalten. In Login und DesignGuide wurden nur
die beschriebenen Aktionsanbindungen ergänzt. Diese Prüfung erfolgte lokal;
das anschließende Kandidaten-Update ist in [actions-ota-20261012.md](actions-ota-20261012.md)
dokumentiert.

## Planer-Erweiterung am 12. Oktober 2026

`PlannerCaptureModal` verwendet die gemeinsamen Haupt-, Sekundär- und
Löschaktionen für Speichern, Abbrechen, Löschen, Datum hinzufügen/entfernen,
Serienende hinzufügen/entfernen, Endzeit hinzufügen/entfernen und Zeitraum
übernehmen. Ein leerer Titel deaktiviert Speichern; die bisher bereits
gesperrte Datumslöschung einer wiederkehrenden Aufgabe ist nun auch sichtbar
deaktiviert. Bestätigungen und Speicherdaten bleiben beim Planer.

`FloatingAddButton` zeigt nach der folgenden Korrektur wieder ein rundes Plus mit
dem gemeinsamen opaken Lila/Weiß-Farbpaar. Der manuelle
Apple-Kalender-Sync in `app/planner/index.tsx` verwendet eine kompakte
Sekundäraktion mit Busy-Zustand. Die Beschriftungen sind in DE/EN/ES vorhanden.
Die Aktionsgruppen können umbrechen. Fachfarben, Tabs, Datumsauswahl,
Auswahllisten, Schalter und Navigationssymbole behalten ihre bestehenden Rollen.

Der im Planer verwendete gemeinsame `IOSBottomDatePicker` hat jetzt
Abbrechen/Fertig als gemeinsame Aktionen unterhalb des Datumsrads. Diese
Umstellung gilt auch für seine übrigen Aufrufer; individuelle Labels,
Datumsgrenzen, Entwurfszustand und Bestätigungs-/Abbruchcallbacks bleiben erhalten.

47 Tests in sechs Suites und App-/Test-Typechecks der eingefrorenen Quelle
bestehen. Die Tests prüfen unter anderem Datumsübernahme, erforderliche
Serienzeiten, Speichern einzelner Vorkommen und bestätigtes Löschen von
Vorkommen oder Serien. ESLint hat keine Fehler und keine neuen Warnungen
(neun bereits vorhandene Warnungen in den betroffenen Dateien).

Die echten Formular- und Pickerkomponenten wurden in einer Web-Prüfansicht
mit 320/390 Punkten, DE/EN/ES, hell/dunkel und normaler/simuliert vergrößerter
Aktionsschrift geprüft. Alle 72 Nachher-Varianten haben lesbare
Aktionsbeschriftungen ohne Überlauf; der Formularinhalt bleibt scrollbar.
Native Picker und Blur sind in dieser Ansicht Fixtures. Vorher/Nachher-Bilder
und die Vergleichsansicht liegen außerhalb des Repos unter
`/Users/janzeppenfeld/Documents/Codex/2026-10-12/LottiBaby-Planer-Buttons/`.

Alle zuvor vorhandenen Typografieänderungen sind per Hash unverändert erhalten.
Die Veröffentlichung ist in [planner-actions-ota-20261012.md](planner-actions-ota-20261012.md)
dokumentiert; die native Geräteabnahme bleibt offen.

## Einheitliche Popup-Bestätigung und Plus-Korrektur

Der neue `DialogActions` setzt Bestätigungsaktionen unterhalb des scrollbaren
Formularinhalts. Standard: Abbrechen links, Speichern rechts, mit Umbruch bei
begrenzter Breite, gemeinsamen Farben/Textrollen und Busy-/Disabled-Zuständen.
Kontextbezogene Labels wie Fertig, Zeitraum übernehmen, Timer starten und
Archivieren bleiben erhalten. Fertig/Übernehmen bestätigt eine Untereingabe;
Speichern schreibt den Eintrag. Der Header enthält keinen Speicherhaken mehr.

Angebunden sind Gewicht, Größe, manuelle Schlafaufnahme, Schlaf-Schnelleingabe,
Mahlzeiten/Windeln, Zahn- und Wehenaufnahme, Planer einschließlich Zeitraum,
TextInputOverlay, IOSBottomDatePicker, die Zeitpicker der Schlaf-/Aktivitäts-
eingaben, eigene Aktivitätsdefinitionen/-einträge und der Namenseditor.

`FloatingAddButton` ist wieder rund und zeigt ausschließlich das Plus. Größe
und Accessibility-Name bleiben erhalten; normal/gedrückt verwenden die
gemeinsamen kontrastfesten Farbpaare. Das gilt auch für die Gewicht-/Größe-
Screens, die denselben Baustein benutzen.

Zeitraum-Abbrechen im Planer stellt den vorherigen Zeitraum wieder her.
Die verschachtelten Schlaf-/Aktivitäts-Zeitpicker übernehmen Entwürfe nur mit
Fertig; Abbrechen und Hintergrund-/Systemschließen verwerfen sie.

69 Tests in neun Suites und App-/Test-Typechecks bestehen in der eingefrorenen
Quelle. 202 Web-Layoutvarianten bestehen, einschließlich kleiner Displays.
Die 17 fachlichen Save-/Delete-/Commit-Callbacks und die übrigen Textstile
der geprüften Formulare entsprechen unverändert dem Kandidaten-Ausgangsstand.
Die Typografiedateien sowie übrige lokale Änderungen sind per Hash erhalten.

ESLint hat keine Fehler. 116 Warnungen entsprechen dem Ausgangsstand; eine
weitere Purity-Warnung zeigt auf das schon vorher vorhandene `Date.now()` in
der Wehenauswertung. Dieser Ausdruck wurde nicht verändert. Die Eingabe-
Tests für Betreuung wurden von Auth/Billing/Storage isoliert, damit sie die
UI prüfen können, ohne den bekannten ESM-Importfehler der Billing-Abhängigkeit.

Vorher/Nachher und Layoutnachweise liegen außerhalb des Repositorys unter
`/Users/janzeppenfeld/Documents/Codex/2026-10-12/LottiBaby-Popup-Aktionen/`.
Die Veröffentlichung ist in [popup-actions-ota-20261012.md](popup-actions-ota-20261012.md)
dokumentiert. Native Darstellung und Geräteinstallation sind getrennt zu prüfen.
