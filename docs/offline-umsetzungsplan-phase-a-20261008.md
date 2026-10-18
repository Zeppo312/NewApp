# Übergabeplan: robust bei kurzen Netzunterbrechungen

Stand: 08.10.2026. Projekt: `/Users/janzeppenfeld/Developer/LottiBaby`. Geprüfter Ausgangsstand: Commit `9cc9ed8`. Dieses Dokument beauftragt noch keine Umsetzung; es ist der konkrete Arbeitsplan, den der Nutzer einem nächsten Agenten geben kann.

**Aktualisierter Auftrag: Phase A plus verpflichtendes Schlaf-Paket S.** Der Nutzer hat den Offline-Stopp mit zuverlässigem Partnerabgleich zusätzlich priorisiert. Die [Partner-Sync-Ergänzung](/Users/janzeppenfeld/Developer/LottiBaby/docs/offline-partner-sync-plan-20261008.md) vollständig mitlesen; sie hat bei abweichenden Sleep-/Outbox-/Serververtragsregeln dieses Basisplans Vorrang. Unveränderte Offline-Stopps automatisch mit ursprünglicher Endzeit abgleichen; bei Partneränderungen verpflichtend fragen. Die folgende 4–7-Tage-Schätzung gilt nur für A.

## 1. Entscheidung und Ziel

**Phase A umsetzen: vorhandene Kernansichten bei Netzfehlern erhalten und neue Flaschen-/Windeleingaben als lokale Entwürfe sichern.** Hauptfall sind kurze Funklöcher und instabiles Netz im Alltag. Die App soll vorhandene Daten weiter anzeigen, eine ausgefallene Aktualisierung verständlich erklären und Eingaben nach einem Neustart wieder anbieten.

Die [Kosten-Nutzen-Prüfung](/Users/janzeppenfeld/Developer/LottiBaby/docs/offline-kosten-nutzen-20261008.md) enthält die Belege und die Abwägung größerer Lösungen. Die grobe Planungsspanne für Phase A beträgt **4–7 Personentage einschließlich gezielter QA**. Das ist eine Schätzung, kein Festpreis oder garantierter Termin. Bei einem notwendigen Ausbau des Server-Schreibvertrags neu schätzen; diesen Ausbau nicht stillschweigend mit umsetzen.

### Verbindlicher Umfang

| Bereich | Lieferung in Phase A |
| --- | --- |
| Baby-Home | Bestätigte heutige Pflegeeinträge und Schlafminuten bei ausgefallener Aktualisierung erhalten. Keine Fehler-Ersatzwerte als neue Daten speichern. |
| Kinderauswahl | Letzte vollständig bestätigte Liste für das aktuell lokal aufgelöste Konto anzeigen; Auswahl bei vorübergehendem Fehler erhalten. |
| Unser Tag | Bereits geladene einzelne Tagesverläufe dauerhaft begrenzt aufbewahren und bei Netzfehlern anzeigen. |
| Schwangerschafts-Home | Letzten bestätigten Namen/Termin anzeigen; Schwangerschaftsalter mit lokalem Datum neu berechnen. Vorhandene lokale Wocheninhalte bleiben nutzbar. |
| Neue Flasche / neue Windel | Eingaben einschließlich zugehöriger Notiz und ursprünglicher Zeit lokal sichern und in Home sowie Unser Tag wiederherstellen. Online-Speicherung bleibt eine bewusste Nutzeraktion. |
| Aktualisierung | Anzeigen während des Abrufs erhalten; begrenzte Lese-Wiederholungen, manuelle Wiederholung und Wiederherstellung bei Fokus/Vordergrund. |
| Bestehender Timer | Auf einer bereits geöffneten Ansicht bei fehlgeschlagenem Lesen den letzten bestätigten Zustand erhalten und als nicht aktuell bestätigt kennzeichnen. |

**Eingrenzung des Basis-Lesepakets A:** A selbst führt keine neue dauerhafte Schlaf-Verlaufsablage ein. Die inzwischen verpflichtende Erweiterung S ergänzt einen bekannten aktiven Snapshot, Offline-Stopp, Pendingaktion und Partnerkonflikte nach eigenem Vertrag. Ihre Ausnahmen nicht aus diesem Basisumfang ableiten. Arztfragen, eigenständige Notizen, Einkauf/Kundenkarten, Geburtsplan und Gewichtsentwürfe bleiben spätere Ergänzungen. Die Notiz *innerhalb* einer Flaschen-/Windeleingabe gehört zu A.

### Außerhalb des Auftrags

- SQLite, PowerSync, TanStack Query, neue native Netzwerk-Abhängigkeiten oder ein allgemeiner Architekturwechsel.
- Automatische Übertragung von Pflegeentwürfen, eine allgemeine Outbox und generisches Wiederholen von Schreibaufrufen. Das kleine idempotente Sleep-Stopp-Journal aus S ist die ausdrückliche Ausnahme.
- Offline-Bearbeitung/Löschung bestehender Einträge; Stillen, Pumpen, Beikost, Wasser und benutzerdefinierte Aktivitäten als neue Entwurfsarten.
- Weitere Offline-Timerwechsel über S hinaus. Partnerkonflikte und lokale/native Zustandsanzeige des Offline-Stopps sind in S ausdrücklich aufzunehmen; alte Snapshots gelten weiterhin nicht als neue Serverbestätigung.
- Medien-Uploads, Planer-/Kalendersynchronisation, Vorratsabgleich und offline erzeugte KI-Antworten.
- Änderung von Abos, Verlaufstarifen, Berechtigungen, Authentifizierung oder Einwilligungsregeln.
- Allgemeine Supabase-Umbauten, Produktionskonfiguration, EAS-Veröffentlichung, Push oder Merge. Nötige S-Migrationen/RPCs lokal vorbereiten und testen; produktive Bereitstellung bleibt ein separater Auftrag.

## 2. Ausgangslage und vor dem ersten Edit zu prüfen

Die Prüfung war rein lokal. Es gab keine App-/Backendänderung. Zum Zeitpunkt der Übergabe lag nur der Prüfbericht als neue Datei im Git-Status. Der nächste Agent muss den aktuellen Status selbst lesen und fremde Änderungen erhalten.

1. `git status --short`, `git log -1 --oneline` und anwendbare `AGENTS.md` prüfen. Nicht auf den Ausgangscommit zurücksetzen. Bei Änderungen die unten genannten Funktionen am aktuellen Stand lesen.
2. Relevante Expo-Datenabruf- und Supabase-Skills nach den geltenden Arbeitsregeln lesen. Keine Subagenten oder anderen Chats ohne entsprechende Autorisierung anlegen.
3. Bestehende Pakete verwenden: Expo SDK 57, AsyncStorage und Supabase sind vorhanden. Paketversionen vor Umsetzung aus `package.json` verifizieren.
4. Die bereits vorhandenen Schutzmechanismen für Kinderauswahl, Einwilligungen und Schlaf-Realtime erhalten. Keine zweite konkurrierende Wiederholungs- oder Timerlogik hinzufügen.

### Konkrete Einstiegspunkte

| Datei / Funktion | Ausgangsproblem bzw. bestehender Schutz |
| --- | --- |
| [Home](/Users/janzeppenfeld/Developer/LottiBaby/app/(tabs)/home.tsx:1251): `loadData`, `fetchTodaySleepMinutes`, `loadActiveDailyTimer` | Fehler werden teilweise zu `[]`, `0` oder `null`; danach wird der Home-Speicher überschrieben. |
| [homeCache](/Users/janzeppenfeld/Developer/LottiBaby/lib/homeCache.ts:74) | Konto/Kind/Datum vorhanden, aber ein gemeinsamer Zeitstempel kann Teilaktualisierungen als insgesamt frisch erscheinen lassen. |
| [screenCache](/Users/janzeppenfeld/Developer/LottiBaby/lib/screenCache.ts:66) | Frische überschritten bedeutet bisher löschen. Diese globale Regel nicht pauschal ändern. |
| [dailyCache](/Users/janzeppenfeld/Developer/LottiBaby/lib/dailyCache.ts:72) und [Unser Tag](/Users/janzeppenfeld/Developer/LottiBaby/app/(tabs)/daily_old.tsx:1583) | Tages-Cache bisher nur Kind/Datum; Loader unterscheiden bereits Fehler von erfolgreich leerem Ergebnis. |
| [Kinder laden](/Users/janzeppenfeld/Developer/LottiBaby/lib/baby.ts:365), [Wiederholungen](/Users/janzeppenfeld/Developer/LottiBaby/lib/babyListLoading.ts:70), [ActiveBabyContext](/Users/janzeppenfeld/Developer/LottiBaby/contexts/ActiveBabyContext.tsx:174) | Vollständige Zwei-Abfragen-Liste, begrenzte Wiederholung, Auswahl-/Kontoschutz vorhanden; lokale Liste wird bisher erst nach `getCachedUser()` gelesen. |
| [pregnancyCache](/Users/janzeppenfeld/Developer/LottiBaby/lib/pregnancyCache.ts:67), [Schwangerschafts-Home](/Users/janzeppenfeld/Developer/LottiBaby/app/(tabs)/pregnancy-home.tsx:875) | Hintergrundabruf schreibt den Cache; Bildschirm muss bestätigte neue Daten ebenfalls übernehmen. Pull-to-refresh löscht bisher vor dem Abruf und kann Erfolg trotz intern abgefangenem Fehler melden. |
| [ActivityInputModal](/Users/janzeppenfeld/Developer/LottiBaby/components/ActivityInputModal.tsx:54) | Gemeinsames Formular; Öffnungsinitialisierung kann eine späte Wiederherstellung überschreiben. Aktuelles `onSave` liefert keinen ausdrücklichen Erfolg. |
| [Home-Speichern](/Users/janzeppenfeld/Developer/LottiBaby/app/(tabs)/home.tsx:1522), [Tag-Speichern](/Users/janzeppenfeld/Developer/LottiBaby/app/(tabs)/daily_old.tsx:1953) | Fehler werden abgefangen; ein aufgelöstes Promise allein beweist keine Speicherung. |
| [addBabyCareEntry](/Users/janzeppenfeld/Developer/LottiBaby/lib/supabase.ts:523), [Vorrat](/Users/janzeppenfeld/Developer/LottiBaby/lib/shopping.ts:609) | Insert und Verbrauch sind gekoppelt, aber kein allgemeiner wiederholsicherer Vorgang. Bestehende Wirkung nicht durch erneutes Senden verdoppeln. |
| [Sleep-Sync](/Users/janzeppenfeld/Developer/LottiBaby/hooks/useSleepEntriesSync.ts), [Sleep-Screen](/Users/janzeppenfeld/Developer/LottiBaby/app/(tabs)/sleep-tracker.tsx:1977) | Frischer Snapshot nach Fokus/Vordergrund/Realtime-Verbindung, Schutz vor alten Antworten und offenen Mutationen bereits vorhanden. |
| [Consent-Bereinigung](/Users/janzeppenfeld/Developer/LottiBaby/lib/dataConsentCleanup.ts), [Account-Bereinigung](/Users/janzeppenfeld/Developer/LottiBaby/lib/accountDeletionCleanup.ts), [appCache](/Users/janzeppenfeld/Developer/LottiBaby/lib/appCache.ts:486) | Laufende Schreibvorgänge müssen vor dem Löschen beendet/entwertet sein, damit Daten danach nicht wieder erscheinen. |

Zeilennummern sind Einstiegshilfen des geprüften Stands; maßgeblich sind die Funktionen im aktuellen Checkout.

### Vorliegende Evidenz richtig verwenden

Die lokale [Reproduktion](/Users/janzeppenfeld/Developer/LottiBaby/output/offline-review-20261008/reproduction.json) zeigt: ein Pflegeeintrag und 120 Schlafminuten werden nach gescheitertem Home-Abruf als leer/null gespeichert; ein 24 Stunden alter Screen-Cache wird gelöscht. Das [Skript](/Users/janzeppenfeld/Developer/LottiBaby/output/offline-review-20261008/reproduce.cjs) extrahiert Originalfunktionen und nutzt synthetische Adapter, ohne Datenbankzugriff.

**Das Skript prüft den alten fehlerhaften Zustand. Nach einer Korrektur sind seine bisherigen Erwartungen kein Abnahmetest.** Historische JSON-Evidenz erhalten; neue Regressionstests müssen das korrekte Verhalten verlangen. Die Dateien liegen im lokalen `output/` und könnten beim nächsten Agenten fehlen. Der Prüfbericht reicht als Beschreibung, nicht als Geräteabnahme.

## 3. Verbindliche Daten- und Anzeigeverträge

### 3.1 Erfolgreich, leer, fehlgeschlagen und unbekannt unterscheiden

Für jeden betroffenen Datensatz einen ausdrücklichen Ladezustand verwenden. Geeigneter Vertrag:

```ts
type ReadResult<T> =
  | { status: 'confirmed'; data: T; verifiedAt: string }
  | { status: 'failed'; error: unknown };
```

- `confirmed` mit `[]`, `0` oder `null` ist ein gültiger Serverzustand und darf den alten Wert ersetzen.
- `failed` verändert weder bestätigte Daten noch deren Bestätigungszeit.
- Ohne bisherigen Snapshot bedeutet Fehler „noch nicht verfügbar“, nicht „es gibt keine Einträge“ oder „kein Timer aktiv“.
- Pflege, Schlafminuten und Timer getrennt behandeln. Eine erfolgreiche Pflege-Abfrage bestätigt keine fehlgeschlagene Schlaf-Abfrage.
- Reine Cache-Hydrierung, Wiederholungen und versuchte Schreibvorgänge erhöhen `verifiedAt` nicht.
- Konto-, Kind-, Datum- und Request-Generation vor **jeder** Anwendung einer späten Antwort und jedem Persistieren prüfen.

### 3.2 Speicheridentität und Grenzen

Eine kleine gemeinsame, explizit eingeschaltete Snapshot-Hilfe auf AsyncStorage aufbauen. Vorgeschlagene neue Datei: `lib/localReadSnapshots.ts`. Bestehende Loader anbinden; kein zusätzlicher globaler Datenprovider und keine allgemeine Umstellung aller Screens.

```ts
type ReadSnapshot<T> = {
  schemaVersion: 1;
  scope: {
    backendHost: string;
    userId: string;
    babyId?: string;
    localDateKey?: string; // YYYY-MM-DD aus lokalem Kalenderdatum
  };
  dataset: string;
  data: T;
  verifiedAt: string;
};
```

Neue Schlüssel eindeutig unter `local_read_snapshot_v1:` ablegen, mit Backend, Konto, Datensatz und nötigem Kind/Datum. Backend-Identität aus vorhandener Supabase-Konfiguration ableiten; keine Tokens/Secrets in Schlüssel oder Payload speichern.

| Datensatz | Frische | Aufbewahrung / Anzeige |
| --- | --- | --- |
| Home-Pflege und Home-Schlafminuten | 5 Minuten, je Datensatz | Nur exakt passender heutiger lokaler Tag auf Home. Gespeicherte Tage außerhalb des unten genannten Sieben-Tage-Fensters entfernen. |
| Unser Tag, einzelne Tage | 2 Minuten | Nur heute und die sechs vorherigen lokalen Kalendertage, soweit vorher geladen und durch den bestehenden Verlaufstarif erlaubt. Zusätzlich höchstens sieben Tage seit Bestätigung. |
| Vollständige Kinderliste | 5 Minuten | Höchstens sieben Tage seit letzter vollständiger Bestätigung; Herkunft als gespeicherter Stand kennzeichnen. |
| Schwangerschaftsname und Termin | 10 Minuten | Höchstens sieben Tage seit jeweiliger Bestätigung. Termin lokal als Datum interpretieren; aktuelle SSW neu berechnen. |

Frische ist die Entscheidung zum Erneuern; Aufbewahrung ist die Grenze, innerhalb der ein älterer Stand noch angezeigt werden darf. Frische überschritten löscht keinen erlaubten Snapshot. Aufbewahrung überschritten liefert „nicht verfügbar“ und entfernt den ungültigen Snapshot. Kein Nachladen der sieben Tage auf Vorrat. Wochen-/Monatsansichten behalten in A ihre bestehenden Cache-Regeln und vorhandene UI bei Fehlern; neue dauerhafte Offline-Auswertung ist auf einzelne Tage begrenzt.

Weitere Regeln:

- Neue lokale Tage mit `getFullYear/getMonth/getDate` oder bestehender getesteter lokaler Datumsfunktion bilden. `toISOString().split('T')[0]` ist dafür ungeeignet. Cache-Datum und bestehende serverseitige Tagesgrenzen konsistent halten; keine neue globale Zeitzonenlogik einführen.
- Beim lokalen Tageswechsel sofort auf den neuen Scope wechseln. Gestern bestätigte Zahlen nicht heute als aktuelle Zahlen anzeigen. Schwangerschaftsalter bei Tageswechsel und Rückkehr in den Vordergrund neu berechnen.
- Alte Keys ohne überprüfbaren Konto-/Backendbezug nicht in das neue langlebige Format importieren. Bestehende fremde Cache-Formate nicht pauschal löschen. Für die neue längere Aufbewahrung ist einmaliges erfolgreiches Online-Laden erforderlich.
- Nur tatsächlich benötigte Felder speichern; keine Mediendateien, Auth-Tokens oder komplette ungefilterte API-Antworten hinzufügen.
- Cache-Nutzbarkeit verlangt aufgelöste Kontoidentität und erlaubte Health-Einwilligung. Neue Speicherung folgt denselben Runtime-Consent-Prüfungen wie vorhandene Gesundheits-Caches.
- Ein bestätigter Berechtigungsentzug oder eine frische vollständige Kinderliste ohne dieses Kind beendet die lokale Anzeige dieses Kind-Scopes. Bloßer Netzwerkfehler beweist keinen Entzug. Einträge nicht als neue Autorisierung an den Server weiterreichen.
- Die geltenden Abo-/Verlaufsgrenzen bei **jeder Anzeige**, auch aus lokalem Speicher, prüfen. `familySubscriptionAccess`, Paywall und Zugangs-Leases nicht verlängern.
- Serialisierte Writes, Generation und Schema-/Payload-Validierung verwenden. Kaputtes JSON oder falscher Scope ist ein Cache-Miss; keine Navigation/Neuanlage aus solchen Werten ableiten.

### 3.3 Sichtbarer Status und Wiederholung

Status am betroffenen Bereich zeigen, ohne vorhandene Inhalte durch einen Ladebildschirm zu verdecken:

- „Wird aktualisiert …“ bei Abruf mit vorhandenem Stand.
- „Gespeicherter Stand: [Datum/Uhrzeit]. Aktualisierung derzeit nicht möglich.“ nach vorübergehendem Fehler.
- „Für diesen Tag noch keine Daten auf diesem Gerät.“ ohne Snapshot bei fehlgeschlagenem Abruf.
- „Entwurf auf diesem Gerät gespeichert. Noch nicht im Verlauf.“ für bestätigte lokale Entwurfssicherung.

Diese Texte sinngemäß in die vorhandene Übersetzungsstruktur für DE/EN/ES aufnehmen. Keinen globalen „offline“-Status allein aus einem fehlgeschlagenen Dienst ableiten. Keine Erfolgsmeldung für einen erfolglosen Refresh.

Pro Datensatz/Scope maximal ein laufender Leseabruf. Bei transientem Fehler höchstens zwei automatische Wiederholungen nach 500 ms und 1.500 ms; pro Versuch maximal zehn Sekunden, anschließend manuelle Aktion. Bestehende `babyListLoading`-Regeln weiterverwenden. Neue Wiederholungen dürfen vorhandene nicht zusätzlich umschließen. Nicht bei sicherem Berechtigungs-/Validierungsfehler oder Consent-Abbruch wiederholen.

Refresh auslösen beim Öffnen/Fokus, Rückkehr in den Vordergrund und bewusster Nutzeraktion. Wiederholte gleichzeitige Ereignisse zusammenführen; vorhandenes 30-Sekunden-Polling in Unser Tag berücksichtigen und Doppelabrufe verhindern. Keine zusätzliche globale Endlosschleife. Abgebrochene/überholte Requests dürfen weder UI noch Speicher verändern. Wo ein Adapter nicht wirklich abbrechbar ist, die späte Antwort mindestens durch Generation entwerten und keine überlappende Anfrage desselben Scopes starten.

## 4. Entwurfsvertrag

### 4.1 Welche Eingaben persistiert werden

Vorgeschlagene neue Dateien: `lib/activityDrafts.ts` und `hooks/useActivityDraft.ts`. Entwurfsmodus in `ActivityInputModal` ausdrücklich nur aktivieren für:

1. **Neue abgeschlossene Flasche:** `entry_type='feeding'`, `feeding_type='BOTTLE'`, kein `initialData.id`, kein Timerstart.
2. **Neue Windel:** `entry_type='diaper'`, kein `initialData.id`, kein Timerstart.

Bearbeitung, Vorschau und eingeschränkte Betreuermodi bleiben außerhalb der Persistenz. Einen Wechsel in eine andere Aktivitätsart nicht automatisch in eine neue Entwurfsart umwandeln; vorhandenen Entwurf erhalten und den aktuellen unterstützten Scope sauber verlassen.

Ein Entwurf je Backend/Konto/Kind/Art; Home und Unser Tag verwenden **denselben** Schlüssel. Schlüsselpräfix: `local_activity_draft_v1:`. Entwurf besitzt Schema-Version, lokale UUID, Revision, Scope, Erstell-/Änderungszeit und Zustand. Die UUID identifiziert nur den lokalen Entwurf und macht den bestehenden Server-Insert nicht wiederholsicher.

Schema, Scope und Feldtypen vor Wiederherstellung validieren. Fremde, beschädigte oder nicht unterstützte Versionen niemals senden oder als neu initialisierten Entwurf überschreiben. Für einen beschädigten lokalen Entwurf einen verständlichen Fehler mit bewusster Verwerfen-Aktion anbieten; keine Rohdaten in Logs ausgeben.

Payload enthält ursprüngliche Start-/Endzeit, ausgewählten Flaschen-/Windeltyp, Menge, zugehörige Notiz und gewählte Vorrats-IDs einschließlich der expliziten Auswahl „kein Vorrat“. Bei Windel auch Messungs-/Medikationsschalter und Temperatur/Dosis als ursprüngliche Eingabestrings sichern; unvollständige Eingabe wie `37,` darf durch Persistenz nicht zu `null` werden. Notiz aus einem geöffneten Eingabeoverlay gehört ebenfalls zum Entwurf, auch vor dem endgültigen Overlay-Bestätigen.

Kein Datum beim Wiederherstellen auf „jetzt“ setzen. Kein unsichtbares Kind wechseln. Nicht mehr verfügbare Vorrats-IDs nach frischer Optionsprüfung als erneut zu prüfende Auswahl markieren; nicht still einen anderen Vorrat wählen. Bestehende Formularvalidierung gilt erst beim Senden und bleibt erhalten.

### 4.2 Lebenszyklus und Rennen

- Nach tatsächlicher Eingabeänderung mit 300 ms Verzögerung persistieren; Änderungen zusammenführen und pro Key serialisieren.
- Vor bewusstem Schließen, vor einem Speicheraufruf und bei App-Hintergrundwechsel ausstehende Änderung flushen. Beim Unmount mindestens geplante Writes sauber behandeln. Keine Garantie für einen vom Betriebssystem sofort beendeten Prozess vor Abschluss eines Storage-Writes behaupten.
- „Auf diesem Gerät gespeichert“ erst nach erfolgreichem AsyncStorage-Write zeigen. Bei lokalem Speicherfehler Formular erhalten, verständlichen Hinweis und lokale Wiederholung anbieten; bestehende Online-Speicherung darf weiterhin möglich sein.
- Wiederherstellung vor neuer Formularinitialisierung entscheiden. Öffnungsinitialisierung, Hydrierung und neue Nutzereingabe durch Revision/Generation schützen. Eine verspätete Hydrierung überschreibt keine neueren Eingaben.
- Bei vorhandenem Entwurf Auswahl „Fortsetzen“ / „Verwerfen“ mit Kind, Art, Originaldatum und Hinweis „nur auf diesem Gerät“. Standardmäßig Fortsetzen anbieten. Einen zweiten Entwurf derselben Art erst nach bewusstem Verwerfen beginnen.
- Bei fremdem Konto/Kind/Backend niemals anbieten oder senden. Wechsel entwertet offene Formulare/Requests; Rückkehr zum passenden Kind kann dessen noch gültigen Entwurf wieder anbieten.
- Unsynchronisierte Entwürfe haben in A **keine automatische Zeitlöschung**. Die Anzahl ist durch einen Entwurf je Art/Kind begrenzt. Älteres Originaldatum bei Wiederherstellung deutlich zeigen. Entfernen nur nach bestätigtem Speichern, bewusstem Verwerfen oder vorgeschriebener Konto-/Consent-Bereinigung.
- Löschen nach Erfolg nur, wenn lokale UUID und Revision dem gesendeten Entwurf entsprechen. Eine inzwischen neuere Eingabe nicht löschen. Parallelöffnungen desselben Scopes durch das bestehende Modal oder einen gemeinsamen Schreibschutz verhindern.
- Beim Logout werden diese lokalen Entwürfe zusammen mit bestehender Konto-Bereinigung gelöscht. Den Hinweis im Entwurfsbereich aufnehmen: „Nur auf diesem Gerät; wird beim Abmelden oder Widerruf gelöscht.“ Kein neues globales Logout-Dialogprojekt beginnen.

### 4.3 Speicherbestätigung: keine blinde Doppelübertragung

Der Server kann den Insert ausgeführt haben, obwohl seine Antwort fehlt. Phase A baut keinen neuen Serververtrag. Daher folgende ausdrückliche Ergebnisse in der unterstützten Save-Integration verwenden:

```ts
type ActivitySaveOutcome =
  | { status: 'confirmed'; entryId: string }
  | { status: 'rejected'; error: unknown }
  | { status: 'confirmation_unknown'; error: unknown };
```

`onSave` löst heute auch bei Fehlern mit `void` auf. Das reicht nicht. Für die beiden unterstützten Wege eine ausdrücklich bestätigte Rückgabe bzw. einen gleichwertigen Opt-in-Adapter ergänzen. Andere Formular- und Timeraufrufer kompatibel lassen. `confirmed` verlangt einen bestätigten erfolgreichen Insert mit Eintrags-ID; später fehlgeschlagener Refresh ändert daran nichts. Ein Vorrats-/Reminder-Nebenfehler darf einen bereits bestätigten Pflege-Insert nicht als neuen Insertbedarf ausgeben.

| Ausgang / Ereignis | Entwurf und erlaubte Aktion |
| --- | --- |
| Vorprüfung schlägt fehl, bevor ein Insert versendet wurde | `editing`; Fehler anzeigen, Eingaben erhalten. Nach Behebung bewusster neuer Save erlaubt. |
| Insert eindeutig vom Server abgelehnt | `editing`; keine Erfolgsmeldung, keine Timer-/Vorratswirkung zusätzlich ausführen. |
| Nutzer startet Speicherung | Im normalen Entwurfsweg aktuellen Entwurf flushen; Zustand `sending` vor Dispatch persistieren; Mehrfachklick sperren. Bei gescheiterter lokaler Sicherung greift die unten beschriebene begrenzte Online-Ausweichaktion. |
| Server bestätigt Insert mit ID | Zugehörige Entwurfsrevision entfernen; bestehende Erfolgs-/Refresh-/Reminderwege ausführen. |
| Transportfehler nach möglichem Dispatch, Timeout oder sonstige nicht eindeutig abgelehnte Speicherung | `confirmation_unknown`; Entwurf behalten. Normalen Save sperren, keine automatische Wiederholung. |
| Neustart findet `sending` | Als `confirmation_unknown` wiederherstellen. Die beendete App beweist keinen fehlgeschlagenen Insert. |

**Klärungsweg bei `confirmation_unknown`:** Text „Speicherung konnte nicht bestätigt werden. Bitte den Verlauf prüfen.“ Aktion „Verlauf prüfen“ lädt für genau Konto/Kind/Originaltag einen frischen Serververlauf. Nur ein tatsächlich erfolgreicher frischer Abruf ermöglicht die weitere Entscheidung. Passende Einträge anzeigen; keine automatische Zuordnung anhand gleicher Uhrzeit/Menge/Notiz, da zwei ähnliche Erfassungen möglich sind.

Danach entscheidet der Nutzer ausdrücklich: „Bereits im Verlauf – Entwurf entfernen“ oder „Nach Prüfung nicht vorhanden – erneut speichern“. Letzteres setzt den Entwurf zurück in `editing` und erlaubt einen neuen bewussten Versuch. Ohne erfolgreiche Prüfung bleibt er gesperrt. Die Prüfung führt keine Vorratsbuchung aus. Bei lokalem Speicherausfall und unklarer Serverantwort bleibt die Sperre mindestens in der laufenden Ansicht erhalten; die fehlende Neustartabsicherung klar anzeigen.

Bei ausgefallenem AsyncStorage nicht automatisch aus der Sicherung in einen ungesicherten Save wechseln: Eingaben erhalten, lokale Sicherung erneut anbieten und als bewusste Ausweichaktion „Trotzdem online speichern“ ermöglichen. Vor dieser Aktion erklären, dass der Entwurf den Neustart derzeit nicht sicher übersteht. Auch dieser einmalige Online-Aufruf verlangt eine ausdrückliche Serverbestätigung und darf nicht automatisch wiederholt werden. Nach verlorenem Reply kann ohne funktionierenden Gerätespeicher keine Neustartabsicherung garantiert werden; das gehört in den Abschlussbericht, falls dieser Fehler auftritt.

Das ist eine bewusst begrenzte manuelle Klärung, **keine technische Garantie gegen jeden doppelten Insert**. Eine solche Garantie einschließlich Vorratswirkung gehört zu Phase B mit stabilem Vorgang und serverseitiger Deduplizierung. Wenn sich der beschriebene Klärungsweg im aktuellen Save-Code nicht sicher abgrenzen lässt, die betroffene Integration offen benennen und den Serververtrag separat zur Entscheidung vorlegen; unabhängig sichere Lese-Korrekturen fertigstellen. Keinen unsicheren automatischen Retry als Abkürzung einbauen.

## 5. Umsetzung in dieser Reihenfolge

### P0 – Ausgangsstand und Verträge sichern

Den aktuellen Stand und bestehende Änderungen erfassen. Die oben genannten Funktionen lesen. Testfälle aus Abschnitt 7 anlegen, die die belegten Risiken abdecken; keine Tests nur zur Nachbildung interner Hilfsfunktionen. Datums-/Scope-/Consent-Konventionen des aktuellen Repos übernehmen. Keine neue Abhängigkeit installieren.

**Ergebnis:** Liste der tatsächlich geänderten Einstiegspunkte, definierte Read-/Save-Ergebnisse und bestätigter Umfang. Keine allgemeine Cache-/Auth-Refaktorierung.

### P1 – Home vor Datenverlust bei Lesefehlern schützen

`loadData`, `fetchTodaySleepMinutes`, `loadActiveDailyTimer` und `loadDailyEntriesOnly` so anbinden, dass nur bestätigte Teilresultate übernommen/gespeichert werden. Sleep-Lesen darf im Fehlerfall keine Schlafminuten auf null setzen. Aktive Schlaf-/Pflege-Timer getrennt bestätigt halten; bei unvollständigem Lesen nicht mit einem zufällig erfolgreichen Teilresultat den bisherigen gemeinsamen Home-Timer löschen/ersetzen. Vollständig bestätigter Snapshot darf beendete Timer weiter korrekt entfernen.

Home-Schreibzeit je Datensatz führen. Bei vorhandenem Stand Hintergrundladen statt vollständiger Ladeüberdeckung. Ohne Stand fehlenden Bereich als unbekannt anzeigen. Konto-/Kind-/Datum-Wechsel und späte Antworten absichern. Tageswechsel entwertet alte Tagesdaten.

**Abnahme:** Ein Eintrag + 120 Schlafminuten überstehen jeden der drei separat ausfallenden Abrufe, einschließlich erneutem lokalen Laden. Bestätigte leere Daten und bestätigte null Minuten werden trotzdem übernommen. Der Partner-Stopp eines Timers wird nach vollständig frischem Snapshot sichtbar.

### P2 – Ausgewählte Ansichten dauerhaft, begrenzt und korrekt lesen

Snapshot-Hilfe samt Schema, Scope, serialisierten Writes und Aufbewahrungsgrenzen umsetzen. Home-Pflege/Schlafminuten, Tagesloader, vollständige Kinderliste und Schwangerschaftsname/-termin anbinden. Andere `screenCache`-Aufrufer behalten ihre bisherigen Regeln.

Bei der Kinderauswahl zuerst den Snapshot mit `useAuth().user.id` und erlaubtem Consent lesen. `getCachedUser()` nicht global zu einer stale Serveridentität umbauen. Frischer Serverabruf folgt weiterhin der bestehenden Auth- und vollständigen Zwei-Abfragen-Logik. Cached-only oder gescheiterte Abfrage darf keine Platzhalter-Kindanlage, Korrektur der aktiven Auswahl oder Schlussfolgerung „keine Kinder“ auslösen. Tatsächlich vollständig bestätigte leere Liste bleibt ein eigenständiger gültiger Fall.

Schwangerschafts-Home muss bestätigte Hintergrundresultate in derselben aktuellen Screen-Generation anwenden. Pull-to-refresh erzwingt einen Abruf, ohne vorher den letzten bestätigten Snapshot zu löschen. Empfehlungsliste und Bilder nicht zusätzlich für Offline vorladen; lokal vorhandene Wocheninhalte nutzen. Kein erfolgreicher Refresh-Toast, wenn die Daten nicht bestätigt wurden.

Nach bestätigter eigener Erstellung/Änderung/Löschung betroffene neue Snapshots aktualisieren oder als erneuerungsbedürftig markieren, damit kein bekannter alter Datensatz als frisch zurückkehrt. Bestehende `invalidateDailyCache`-/Pregnancy-Invalidierungen auf die neuen Keys abstimmen. Bei normalem Refresh nicht destruktiv invalidieren. Gewöhnliche Cache-Aktualisierung löscht keine Entwürfe.

**Abnahme:** Online geladen → App-Neustart mit gültiger lokal aufgelöster Sitzung → Netzabruf scheitert → richtiger erlaubter Snapshot sichtbar. Unterschiedliches Konto, Backend, Kind, lokales Datum oder abgelaufene Aufbewahrung liefert keinen fremden/alten Stand.

### P3 – Wiederholung und Anzeige verständlich machen

Begrenzte, deduplizierte Lese-Erholung und Status aus Abschnitt 3.3 integrieren. Bestehende Kinderauswahl-Wiederholungen und Schlaf-Realtime-Reloads erhalten. Realtime bleibt Anlass für einen frischen Read; Events nicht direkt als vollständige UI-Wahrheit verwenden.

Bei Schlaf bleiben `useSleepEntriesSync`, Mutationsschutz und Partnerzugriff erhalten. Ein gespeicherter Pflegeverlauf ist kein Beweis dafür, dass kein gemeinsamer Timer läuft. Ohne passenden erlaubten aktiven Snapshot „Status nicht aktuell verfügbar“ zeigen. S erlaubt den ausdrücklich gekennzeichneten letzten bekannten Stand und lokalen Pending-Stopp; dieser darf niemals als frisch gemeinsamer Zustand gelten. Online-Start-/Stopp-/Split-/Merge-Writer gemäß S auf Konfliktsicherheit und Kompatibilität prüfen; nicht einfach jede bisher unbedingte Mutation unverändert als sicher voraussetzen.

**Abnahme:** Fokus/Vordergrund/manuelle Aktion lösen genau eine Recovery pro Scope aus; Ende nach begrenzten Versuchen. Ein Dienstfehler markiert passende Daten als nicht aktualisiert und lässt andere erfolgreich geladene Bereiche nutzbar.

### P4 – Entwurfsablage und Bereinigung gemeinsam implementieren

Schema und Lebenszyklus aus Abschnitt 4.1/4.2 implementieren. Noch bevor diese Speicherung in die UI kommt, den Bereinigungsweg anbinden: bei Logout, Kontolöschung, Health-Widerruf und bestätigtem Kind-Zugriffsverlust Generation erhöhen, Debounce abbrechen, begonnene Storage-Writes abwarten und passende Schlüssel entfernen. Erst danach dürfen neue Scopes schreiben.

Vorhandene wartende Consent-Widerrufe erhalten. AI-Widerruf allein löscht manuelle Flaschen-/Windelentwürfe nicht. Ein normaler Account-/Kindwechsel verhindert Nutzung im anderen Scope; Health-Widerruf verhindert bereits sofort weitere Anzeige, Wiederherstellung und Writes. Neue Read-Snapshots in dieselben geeigneten Bereinigungswege aufnehmen. `invalidateAllCaches` darf keine weiterhin gewollten Entwürfe nur wegen eines gewöhnlichen Refreshs löschen; destructive Consent-/Logout-Bereinigung explizit behandeln.

**Abnahme:** Einen bereits gestarteten langsamen Write simulieren, dann Widerruf/Logout: nach Abschluss bleibt kein neuer Snapshot/Entwurf zurück und keine späte Antwort reaktiviert die Anzeige. Pending Withdrawals bleiben erhalten.

### P5 – Gemeinsames Formular und bewusste Online-Speicherung anbinden

Entwurfsmodus als Opt-in in `ActivityInputModal` integrieren. Alle Formularaufrufer vor Typänderungen suchen; neue/editierte/Timer-Eingaben sauber unterscheiden. Home und Unser Tag erhalten identische Fortsetzen-/Verwerfenregeln und denselben Entwurf.

Für neue abgeschlossene Flasche und Windel explizites `ActivitySaveOutcome` an beiden Parent-Handlern integrieren. Bei Bedarf nur die Rückgabe/Fehlerklassifikation von `addBabyCareEntry` ergänzen, kompatibel mit bestehenden Aufrufern. Kein neues Insert/RPC, keine Vorratsmigration. Festhalten, ob der Insert bereits dispatcht wurde; unbekannte Fehler nach möglichem Dispatch konservativ als unklar behandeln.

Klärungsansicht aus Abschnitt 4.3 umsetzen. Keine Payload-/Gesundheitswerte für neues Logging ausgeben. Vorhandene ausführliche Payload-Logs in den unmittelbar bearbeiteten Save-Pfaden durch nicht-inhaltliche Statusinformationen ersetzen, sofern dort noch aktiv. Sonstige Logging-Bereiche nicht als Nebenprojekt umbauen.

**Abnahme:** Eingaben bleiben bei bestätigtem Fehler; genau zugehöriger Entwurf verschwindet nach bestätigtem Insert. Verlorene Antwort sperrt erneutes direktes Senden, auch nach Neustart, bis ein frischer Verlauf kontrolliert wurde. Ein fehlgeschlagener Refresh nach erfolgreichem Insert erzeugt keinen neuen Saveversuch.

### P6 – Automatisierte Prüfung und Geräteabnahme

Tests, Typecheck und Diff-Prüfung aus Abschnitt 7 ausführen. Dann die Geräteszenarien aus Abschnitt 8 mit der tatsächlich installierten Version prüfen. Keine Veröffentlichung aus dem Plan ableiten. Bei fehlendem Gerät die Geräteabnahme als offen markieren und eine genaue reproduzierbare Anleitung liefern.

**Ergebnis:** Reviewbare lokale Änderungen mit Testevidenz, klaren Grenzen und Gerätestatus. Keine Behauptung „vollständig offline nutzbar“.

## 6. Erwartete Dateien und Änderungsgrenzen

Neue Dateinamen sind Vorschläge; gleichwertige passende Namen im Projekt sind zulässig. Die Verhaltensverträge sind verbindlich.

| Art | Dateien |
| --- | --- |
| Neue kleine Hilfen | `lib/localReadSnapshots.ts`, `lib/activityDrafts.ts`, `hooks/useActivityDraft.ts`; höchstens ein kleiner gemeinsamer Status-/Klärungsbaustein bei sinnvoller Wiederverwendung. |
| Lesewege | `lib/homeCache.ts`, `lib/dailyCache.ts`, `lib/pregnancyCache.ts`, `lib/baby.ts`, `contexts/ActiveBabyContext.tsx`, `app/(tabs)/home.tsx`, `app/(tabs)/daily_old.tsx`, `app/(tabs)/pregnancy-home.tsx`. |
| Eingaben | `components/ActivityInputModal.tsx`, beide oben genannten Save-Handler; `lib/supabase.ts` nur soweit explizite Savebestätigung/Fehlerklassifikation nötig. |
| Bereinigung | `lib/dataConsentCleanup.ts`, `lib/accountDeletionCleanup.ts`, passender bestehender Logoutweg und `lib/appCache.ts`, soweit die neuen Prefixes und Write-Generationen anzubinden sind. |
| Status / Sprache | Bestehende Translation-Module bzw. `assets/locales/de.json`, `en.json`, `es.json` gemäß aktuellem Übersetzungsweg. |
| Regressionen | Neue Tests für bestätigungsabhängige Home-Updates, Snapshot-Grenzen und Entwurfswiederherstellung; bestehende passende Suiten ergänzen. |

AuthContext, Familienzugang und Shopping-Schema sind Schutzgrenzen. Dort keinen fachlichen Umbau beginnen. Timer-Service, Sleep-Screen, native Flächen und kritische Sleep-Writer dürfen im jetzt beauftragten S-Umfang geändert werden; dafür gelten dessen Serververtrag, Kompatibilitätsgate und Zwei-Geräte-Abnahme. Sonstige Abweichungen begründen und dokumentieren.

## 7. Automatisierte Abnahme

Folgende beobachtbaren Fälle müssen gezielt abgedeckt werden; mehrere Fälle dürfen in einer passenden Suite liegen:

| Gruppe | Pflichtfälle |
| --- | --- |
| Home | Pflegefehler erhält Daten; Schlaffehler erhält Minuten; Timerfehler löscht keinen letzten bestätigten Zustand; vollständig bestätigte Leere/Null entfernt alte Werte; Teil-Erfolg aktualisiert nur seinen Bereich und dessen Zeitstempel; Neustart liest erhaltene Daten. |
| Snapshots | Frisch vs. älter aber erlaubt vs. Aufbewahrung überschritten; kein fremdes Konto/Kind/Backend; lokaler Tageswechsel nahe UTC-Grenze; sieben lokale Tage und Tarifgrenze; beschädigtes JSON; keine Hintergrundantwort nach Scopewechsel; neue Writes nach Cleanup ausgeschlossen. |
| Kinderauswahl | Vollständiger gespeicherter Stand ohne zusätzliche Netz-Userabfrage sichtbar, wenn AuthContext Konto lokal bereits aufgelöst hat; Teilfehler überschreibt keine vollständige Liste; kein Placeholder aus Offline-Fehler; echte vollständige leere Liste korrekt behandelt. |
| Schwangerschaft | Termin über Neustart korrekt geparst; SSW nach Tageswechsel korrekt; fehlgeschlagener Refresh erhält Termin und meldet keinen Erfolg; erfolgreicher Hintergrundabruf erreicht aktuellen Screen. |
| Entwurf | Rohwerte, Notizoverlay und Originalzeit erhalten; Home ↔ Tag gleicher Entwurf; Öffnungsinitialisierung überschreibt keine Wiederherstellung; späte Hydrierung überschreibt keine neue Eingabe; Verwerfen; Storagefehler; Scopewechsel; nur neue Flasche/Windel aktiviert. |
| Save | Bestätigter Insert entfernt nur passende Revision; abgelehnter Insert behält Entwurf; Doppelklick führt zu einem Dispatch; unklare Antwort wird nicht wiederholt; Neustart aus `sending` bleibt gesperrt; Verlauf aus Cache reicht zur Klärung nicht; Post-Save-Refreshfehler lässt Save bestätigt. |
| Cleanup | Langsamer bereits gestarteter Write + Logout/Health-Widerruf/Löschung; ausstehender Widerruf bleibt erhalten; AI-Widerruf allein erhält manuellen Entwurf; bestätigter Kind-Zugriffsverlust beendet betroffenen Scope. |
| Timerregression | Frischer Partner-Stopp entfernt lokalen alten Timer; bestätigter leerer Snapshot gilt; überholter Read während Mutation gilt nicht; keine native Nebenwirkung aus gespeicherter Anzeige. |

Sinnvolle vorgeschlagene neue Suiten: `homeNetworkRecovery.test.tsx`, `localReadSnapshots.test.ts`, `activityDrafts.test.ts`, `activityDraftRestore.test.tsx`. Tests dürfen passend in vorhandene Suiten integriert werden. Nicht nur Private Helpers nachprogrammieren: Save-Ergebnisse, UI-Verhalten und Scope-/Cleanup-Rennen über die tatsächlichen Integrationen prüfen.

Vor der Planung bestanden acht vorhandene Suiten mit 122 Tests. Dies ist historische Baseline, kein Nachweis für die neuen Funktionen. Nach Umsetzung gezielt erneut prüfen:

```sh
npx --no-install jest --runInBand --runTestsByPath \
  lib/__tests__/authStartupRecovery.test.tsx \
  lib/__tests__/appCacheStartup.test.ts \
  lib/__tests__/dailyCache.test.ts \
  lib/__tests__/babyListLoading.test.ts \
  lib/__tests__/babySwitcherRefresh.test.tsx \
  lib/__tests__/dataConsents.test.ts \
  lib/__tests__/dataConsentCleanup.test.ts \
  lib/__tests__/accountDeletionLocalStorage.test.ts \
  lib/__tests__/familySubscriptionAccess.test.ts \
  lib/__tests__/shopping.test.ts \
  lib/__tests__/pregnancy-age.test.ts \
  lib/__tests__/pregnancy-age-hook.test.tsx \
  lib/__tests__/sleepEntriesSync.test.tsx \
  lib/__tests__/sleep-tracker-sync.test.ts \
  lib/__tests__/sleepNightSplit.test.ts \
  lib/__tests__/sleepWidgetSnapshot.test.ts
```

Zusätzlich die tatsächlich angelegten/ergänzten neuen Suiten ausführen, dann `npm run typecheck` und `git diff --check`. Lint für die bearbeiteten Dateien gemäß Repo-Regel. Bei neuen Fehlern Ursache klären; vorher vorhandene Fehler separat mit Baseline belegen. Bestehende Auth-/Abo-Tests dürfen nicht an eine neue Offline-Freigabe angepasst werden. Kein Bedarf an umfassenden Last-/Performance-Tests für dieses begrenzte Paket, sofern keine neue Regression Anlass gibt.

## 8. Geräteabnahme: iOS und Android

Je eine installierte, mit dem Umsetzungsstand übereinstimmende App prüfen. Gültige lokale Sitzung, bestätigter Health-Consent und bereits geladene Daten sind Vorbedingungen. Eine Neuinstallation ohne je geladenen Stand kann keine früheren Daten anzeigen.

1. **Warme Ansicht:** Home und einen erlaubten Tagesverlauf online laden; Verbindung unterbrechen; Refresh ausführen. Vorhandene Einträge und Minuten bleiben sichtbar, Hinweis mit Stand erscheint, kein falscher Erfolg.
2. **Neustart:** App vollständig beenden und ohne Verbindung neu öffnen. Mit weiterhin aufgelöster gültiger Sitzung passende Kinderliste/Tagesdaten/Schwangerschaftstermin anzeigen. Auth-Recovery bei abgelaufener Sitzung nicht umgehen.
3. **Entwurf:** Neue Flasche mit Uhrzeit, Menge, Vorratsauswahl und Notiz beginnen, schließen, Home ↔ Tag wechseln, App neu öffnen. Fortsetzen stellt genau diese Werte wieder her. Windel separat einschließlich unvollständiger Temperatur-/Dosisstrings prüfen.
4. **Zurück online:** Daten erneuern, Entwurf bewusst speichern. Ein bestätigter neuer Eintrag im Verlauf; passender Entwurf entfernt. Gewählte vorhandene Vorratswirkung höchstens durch den einen Save auslösen. Kein Hintergrundversand zuvor.
5. **Teilfehler:** Nur einen Home-Dienst kontrolliert scheitern lassen. Andere Bereiche können erneuert werden; fehlgeschlagener Bereich behält seinen bestätigten Stand. Für kontrollierte Fehler lokale Mock-/Testadapter nutzen, keine produktiven Netzregeln ändern.
6. **Verlorene Antwort:** Testadapter bestätigt den Insert serverseitig/synthetisch, verliert aber die Antwort. Kein zweiter Dispatch durch erneuten Klick oder Neustart. Frischer Verlauf zeigt den Eintrag; Nutzer entfernt den Entwurf über den Klärungsweg. Diesen Fall nicht durch echte doppelte Produktionseinträge testen.
7. **Tageswechsel:** Lokale Mitternacht sowie Datum nahe UTC-Tagesgrenze über kontrollierte Uhr im Test prüfen. Gestern wird nicht als heute angezeigt; Originaldatum des Entwurfs bleibt erhalten; SSW stimmt.
8. **Identität:** Kind wechseln, Konto wechseln, anderes Backend im Test. Keine alten Inhalte/Entwürfe in falschem Scope. Bestätigten Kind-Zugriffsverlust prüfen.
9. **Consent/Logout:** Health widerrufen, während ein lokaler Write aussteht; anschließend neu starten. Keine Wiederherstellung, keine neue Speicherung; Pending Withdrawal bleibt. AI-Widerruf separat: manuelle Entwürfe bleiben. Logout entfernt Geräteentwürfe gemäß Hinweis.
10. **Timerregression:** Bestehenden Online-Timer auf zweitem Gerät beenden; erstes Gerät nach Netzrückkehr aktualisieren. Frischer Zustand entfernt den alten Timer. Keine Offline-Start-/Stopp-Erfolgsmeldung oder zusätzliche Live Activity aus einem alten Snapshot.

Wenn eine tatsächliche Geräteprüfung nicht möglich ist, Testanleitung und Zustand „Geräteabnahme offen“ liefern. Simulator-/Unit-Test, lokal installierte App, OTA-Veröffentlichung und Produktionsabnahme sind getrennte Nachweise.

## 9. Fertigkriterien und Abschlussbericht

Phase A ist vollständig abgenommen, wenn alle Pflichtverträge erfüllt, relevante automatisierte Prüfungen bestanden und die genannten Geräteszenarien auf iOS/Android bestätigt sind. Bei fehlender Geräteprüfung darf der nächste Agent die lokale Umsetzung samt automatischer Prüfung abschließen, muss die Geräteabnahme aber ausdrücklich offen lassen.

Abschlussbericht knapp mit:

- Tatsächlich umgesetztem Umfang und den wichtigsten geänderten Dateien.
- Anzahl/Ergebnis der relevanten Tests, Typecheck und Diff-Prüfung; bestehende Einschränkungen getrennt.
- Geräteplattform, installierter Version/Commit und beobachtetem Ergebnis oder offener Abnahme.
- Bekanntem manuellen Klärungsweg bei verlorener Speicherbestätigung und Grenzen bei abgelaufener Sitzung.
- Aussage, ob Code nur lokal vorliegt. Keine Veröffentlichung/Backendänderung als erledigt ausgeben, wenn nicht beauftragt und verifiziert.

Geeignete Produktbeschreibung: **„Vorhandene Ansichten und Eingaben bleiben bei kurzen Netzunterbrechungen nutzbar.“** Nicht „vollständig offline“ oder „wird später automatisch synchronisiert“.

Phase B erst separat entscheiden, wenn trotz A häufig wichtige Erfassungen nicht abgeschlossen werden können. Dann stabile Server-Vorgangs-ID, wiederholsicherer Pflege-Insert **und** zugehöriger Vorratsverbrauch gemeinsam planen. Dieses Dokument löst keine automatische Beauftragung von B aus.

## 10. Kopierbarer Auftrag an den nächsten Agenten

Dieser aktualisierte Auftrag umfasst auch die inzwischen verpflichtende Partner-Sync-Ergänzung. Deren Abschnitt 8 enthält eine ausführlichere Variante.

```text
Bitte setze Phase A plus das verpflichtende Schlaf-Paket S im aktuellen
LottiBaby-Checkout um. Lies beide Pläne vollständig:
/Users/janzeppenfeld/Developer/LottiBaby/docs/offline-umsetzungsplan-phase-a-20261008.md
/Users/janzeppenfeld/Developer/LottiBaby/docs/offline-partner-sync-plan-20261008.md

Der Partner-Sync-Plan hat bei abweichenden Schlafregeln Vorrang. Unser Hauptfall
sind kurze Funklöcher und instabiles Netz. Zusätzlich zu stabilen Kernansichten
und lokalen Flaschen-/Windelentwürfen ist ein dauerhaft gesicherter Offline-
Schlafstopp mit ursprünglicher Endzeit und zuverlässigem Partnerabgleich Pflicht.
Unveränderte Stopps automatisch übernehmen und kurz bestätigen; bei echten
Partneränderungen Unterschiede zeigen und verpflichtend entscheiden lassen.
Später entscheiden muss möglich sein. Kein alter Stopp darf einen neuen Schlaf
beenden. Bewahre Konto-/Kind-/Backend-, Consent- und Tarifgrenzen sowie die
vorhandenen Schutzmechanismen gegen alte Antworten und unvollständige Listen.

Arbeite P0 bis P6 und S0 bis S5 ab. Prüfe alle Sleep-Writer, ältere Clients und
die vollständige Partner-Fallmatrix. Baue den nötigen versionierten, atomaren
und idempotenten Sleep-Serververtrag lokal; ohne sichere Bereitstellung bleibt
das Offline-Schreiben gated. Kein generischer Schreib-Retry, keine allgemeine
Outbox, keine neue Offline-Datenbank. Für Pflegeentwürfe bleibt bei unklarer
Speicherbestätigung der manuelle Klärungsweg. Erhalte fremde Änderungen.

Nötige S-Migrationen/RPCs lokal vorbereiten und testen. Keine Produktionsmigration,
Produktionsänderung, EAS-Veröffentlichung, keinen Push oder Merge durchführen.
Führe Regressionen, Typechecks, lokale DB-Konkurrenztests und verfügbare Zwei-
Geräte-Prüfungen aus. Berichte lokale Umsetzung, Serverbereitstellung,
Clientkompatibilität und Geräteabnahme getrennt. Die alte A-Aufwandsspanne deckt
das zusätzliche S-Paket nicht ab. Sonstige Phase-B-Funktionen nicht ergänzen.
```
