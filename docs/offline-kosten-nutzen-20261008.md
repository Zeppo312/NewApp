# Offline-Nutzung: Kosten, Nutzen und sinnvoller Umfang

Stand: 08.10.2026. Geprüfter Quellstand: `9cc9ed8` (aktueller lokaler Projektstand). Der Nutzer hat als Hauptfall **kurze Funklöcher und instabiles Netz im Alltag** genannt. Dies ist eine Analyse und eine Planungsschätzung; App, Datenbankschema, Abos und externe Konfiguration wurden nicht geändert.

**Spätere Priorisierung vom selben Tag:** Offline-Schlafstopp mit ursprünglicher Endzeit, sicherem Partnerabgleich und bewusster Konfliktentscheidung ist inzwischen Pflicht im ersten Gesamtauftrag. Siehe [Partner-Sync-Plan](/Users/janzeppenfeld/Developer/LottiBaby/docs/offline-partner-sync-plan-20261008.md). Die frühere Empfehlung, den Timer-Ausbau insgesamt zurückzustellen, gilt damit nicht mehr für dieses gezielte Stop-/Konfliktpaket. Die Kosten unten bleiben historische Planungsspannen; 4–7 Tage für A umfassen das zusätzliche Schlaf-Paket nicht.

**Empfehlung: Zuerst bestehende Ansichten bei Netzfehlern stabil halten und wichtige Eingaben als lokale Entwürfe sichern. Einen vollständigen Umbau auf SQLite und automatische Synchronisation aktuell zurückstellen.** Die bisher vorgeschlagene lokale Datenbank ist eine mögliche spätere Grundlage, aber für den jetzt eingegrenzten Bedarf kein notwendiger erster Schritt.

Die Gewichtung des Nutzens beruht auf diesem Nutzungsszenario und den tatsächlich vorhandenen Funktionen. Es liegen für diese Prüfung keine ausgewerteten Zahlen zur Häufigkeit von Netzproblemen, Nutzung einzelner Funktionen, vermiedenen Kündigungen oder Supportkosten vor. Deshalb ist dies kein gemessener finanzieller ROI.

## 1. Was bereits vorhanden ist und wo es konkret scheitert

| Befund | Konkreter Beleg | Bedeutung für den Ausbau |
| --- | --- | --- |
| Home speichert Daten dauerhaft in AsyncStorage und lädt sie vor dem Netzabruf. | [homeCache.ts](/Users/janzeppenfeld/Developer/LottiBaby/lib/homeCache.ts:74), [Home](/Users/janzeppenfeld/Developer/LottiBaby/app/(tabs)/home.tsx:1262) | Ein Teil der Grundlage ist schon vorhanden. Eine neue Datenbank ist für bessere Lesbarkeit bei Funklöchern zunächst nicht erforderlich. |
| Ein fehlgeschlagener Home-Abruf kann gespeicherte Daten mit Fehler-Ersatzwerten überschreiben. | [Home](/Users/janzeppenfeld/Developer/LottiBaby/app/(tabs)/home.tsx:1298), [Reproduktion](/Users/janzeppenfeld/Developer/LottiBaby/output/offline-review-20261008/reproduction.json) | Vorhandenen Speicher korrekt behandeln bringt unmittelbaren Nutzen mit begrenztem Eingriff. |
| Screen-Caches unterscheiden Frische und Aufbewahrung noch nicht: 30 Sekunden, zwei oder zehn Minuten überschritten bedeutet löschen. | [screenCache.ts](/Users/janzeppenfeld/Developer/LottiBaby/lib/screenCache.ts:66) | Einen gültigen älteren Datenstand für ausgewählte Ansichten behalten; Alter anzeigen und im Hintergrund erneuern. |
| Kinderauswahl hat bereits vollständige Ergebnismengen, begrenzte Wiederholungen und Schutz gegen alte Antworten. Ein frischer Prozess muss aber vor dem Lesen des gespeicherten Kinder-Caches noch `getCachedUser()` auflösen. | [listBabies](/Users/janzeppenfeld/Developer/LottiBaby/lib/baby.ts:365), [Wiederholungen](/Users/janzeppenfeld/Developer/LottiBaby/lib/babyListLoading.ts:70), [Kontext](/Users/janzeppenfeld/Developer/LottiBaby/contexts/ActiveBabyContext.tsx:174) | Bestehende Schutzmechanismen weiterverwenden. Für lokale Anzeige die bereits aufgelöste Konto-ID verwenden, ohne Serverberechtigungen zu verändern. |
| Einwilligungen und ausstehende Widerrufe sind lokal gespeichert. | [dataConsents.ts](/Users/janzeppenfeld/Developer/LottiBaby/lib/dataConsents.ts:54) | Diesen Bereich nicht neu erfinden. Neue Entwürfe müssen dieselben Konto- und Widerrufsgrenzen beachten. |
| Erfassungen schreiben unmittelbar in Supabase; Eingaben bleiben bei vielen Speicherfehlern im geöffneten Formular erhalten. | [Home-Speichern](/Users/janzeppenfeld/Developer/LottiBaby/app/(tabs)/home.tsx:1522), [Unser Tag](/Users/janzeppenfeld/Developer/LottiBaby/app/(tabs)/daily_old.tsx:1953), [Arztfragen](/Users/janzeppenfeld/Developer/LottiBaby/app/doctor-questions.tsx:155) | Formularerhalt existiert teilweise. Persistente Entwürfe würden zusätzlich Schließen und Neustart überstehen. Es ist nicht belegt, dass alle Formularwerte derzeit bei einem Netzfehler verschwinden. |
| Familienzugang ist absichtlich kurz gültig und wird nach Neustart nicht aus einem dauerhaften Familien-Snapshot übernommen. | [familySubscriptionAccess.ts](/Users/janzeppenfeld/Developer/LottiBaby/lib/familySubscriptionAccess.ts:9), [subscriptionAccess.ts](/Users/janzeppenfeld/Developer/LottiBaby/lib/subscriptionAccess.ts:125) | Keine pauschale TTL-Verlängerung. Funktionszugang bleibt eine eigene Produktregel, unabhängig vom Alter einer lokalen Anzeige. |

### Isoliert reproduzierter Home-Fall

Mit den **originalen Funktionen** aus Home, `homeCache` und `screenCache`, synthetischen Daten und absichtlich fehlgeschlagenen Netzwerkadaptern:

- Ausgangszustand im Home-Speicher: ein Pflege-Eintrag und 120 Schlafminuten.
- Nach fehlgeschlagenem Aktualisieren: gespeicherter Pflege-Verlauf leer, gespeicherte Schlafminuten null.
- Die bereits geöffnete Ansicht behält zunächst den Pflege-Eintrag, setzt aber die Schlafminuten auf null. Beim nächsten Lesen des Home-Speichers fehlen die Pflege-Einträge.
- Ein 24 Stunden alter Screen-Cache mit Strategie `long` wird entfernt.

Das bestätigt einen konkreten Quellcode-Fall. Es ist keine Beobachtung eines betroffenen Produktionskontos und kein Flugmodus-Test auf einem installierten Gerät. Reproduzierbar mit `node output/offline-review-20261008/reproduce.cjs`; das Skript kontaktiert keine Datenbank. Die [JSON-Evidenz](/Users/janzeppenfeld/Developer/LottiBaby/output/offline-review-20261008/reproduction.json) enthält Prüfsummen der verwendeten Quelldateien.

## 2. Nutzen je Funktion bei kurzen Netzunterbrechungen

Die Aufwandseinstufungen sind relativ; sie lassen sich nicht als einzelne Tage addieren, weil mehrere Funktionen dieselben Grundlagen nutzen.

| Funktion / Verhalten | Erwarteter Nutzen | Aufwand / besondere Abhängigkeit | Entscheidung |
| --- | --- | --- | --- |
| Home, Kinderauswahl und kürzlich geladene Tagesverläufe sichtbar halten | Hoch: Orientierung bleibt möglich | Gering bis mittel; vorhandener Speicher, gültiger Kontobezug, Tageswechsel | Zuerst |
| Schwangerschaftswoche und vorhandene Wocheninformationen anzeigen | Hoch für Schwangerschaftsnutzung | Gering bis mittel; Datenkonstanten sind lokal, Termin/Profile benötigen einen nutzbaren letzten Stand | Zuerst, begrenzt auf vorhandene Inhalte |
| Flasche, Windel, Notizen und Arztfragen als Entwurf behalten | Hoch: eingegebene Werte müssen nicht erneut erfasst werden | Mittel; Originalzeit, Konto und Kind binden, nach Neustart wiederherstellen | Zuerst in ausgewählten Eingabewegen |
| Abgeschlossene Flaschen-/Windeleinträge automatisch später senden | Hoch, falls Speichern während Funklöchern häufig gebraucht wird | Mittel bis hoch; eindeutiger Vorgang plus gekoppelte Vorratsbuchung | Zweite Stufe nach Prüfung des verbleibenden Bedarfs |
| Bereits laufenden Timer lokal anzeigen und die eingegebene Endzeit erhalten | Hoch | Mittel; gespeicherter Start, Zeitberechnung, unsicherer Partnerstand kennzeichnen | In erster Stufe nur Anzeige/Entwurf, vollständige Synchronisation separat |
| Gemeinsamen Schlaf-/Stilltimer offline starten, stoppen, pausieren, teilen oder korrigieren | Hoch, aber viele Sonderfälle | Hoch; zwei Geräte, Reihenfolge, gleichzeitige Timer, Zusammenführen/Splitten, Widgets und Erinnerungen | Gezielt später; kein generischer automatischer Replay |
| Einkaufsliste und Kundenkarten lesen | Hoch im Laden, sofern vorher geladen | Gering bis mittel; persistente Liste bzw. Karteninhalte erforderlich | Sinnvolle Ergänzung des Lesepakets |
| Einkauf abhaken und zugleich Vorräte ändern | Mittel bis hoch | Hoch bei Mengenänderungen; Käufe, Korrekturen und Verbrauch müssen zusammenpassen | Offline-Schreiben zunächst zurückstellen |
| Gewicht und Größe erfassen | Mittel | Mittel; aktueller Speicherweg prüft bestehenden Tageswert vor Insert/Update | Entwurf günstig, automatischer Abgleich später |
| Geburtsplan und Arztfragen lesen | Mittel bis hoch bei Arzt-/Klinikbesuchen | Mittel; separate Datenabrufe benötigen gespeicherte Ansichten | Nach den Kernansichten ergänzen |
| Gemeinsamen Planer offline vollständig bearbeiten | Mittel im gewählten Hauptfall | Sehr hoch; Serien, Ausnahmen, Zuständigkeiten und Apple-Kalender-Abgleich | Aktuell zurückstellen; bei Bedarf nur kürzlich geladene Termine lesen |
| Fotos und Audio offline bearbeiten/hochladen | Begrenzter Zusatznutzen im Hauptfall | Hoch; eigene Dateien, Speichergrenzen, Wiederaufnahme und Bereinigung | Keine allgemeine Upload-Warteschlange in erster Stufe |
| Neue KI-Antworten, Sprachverarbeitung und Wetterdaten | Offline weiterhin externer Dienst nötig | Sehr hoch für einen lokalen Ersatz | Online-Funktion beibehalten; Texteingaben erhalten, vorhandene Ergebnisse ggf. mit Stand zeigen |

Belege: Schwangerschaft nutzt lokale Konstanten in [pregnancy-home.tsx](/Users/janzeppenfeld/Developer/LottiBaby/app/(tabs)/pregnancy-home.tsx:19) und [Termin-Cache](/Users/janzeppenfeld/Developer/LottiBaby/lib/pregnancyCache.ts:67); [Gewicht](/Users/janzeppenfeld/Developer/LottiBaby/lib/weight.ts:19) prüft vorhandene Datensätze; [Planer](/Users/janzeppenfeld/Developer/LottiBaby/app/planner/index.tsx:1178) unterscheidet Serien und Einzeltermine; [Kalender-Abgleich](/Users/janzeppenfeld/Developer/LottiBaby/lib/plannerCalendarSync.ts) verbindet weitere lokale und serverseitige Daten; [KI](/Users/janzeppenfeld/Developer/LottiBaby/lib/askLotti/api.ts:66) ruft eine Edge Function auf, [Sprachverarbeitung](/Users/janzeppenfeld/Developer/LottiBaby/lib/voiceLog/api.ts) hat eigene Serveraufrufe, [Wetter](/Users/janzeppenfeld/Developer/LottiBaby/lib/weatherService.ts) ruft einen externen Dienst auf.

## 3. Warum eine kleine Warteschlange nicht alle Probleme löst

**Unklare Serverbestätigung:** Der Server kann einen Eintrag bereits gespeichert haben, obwohl die Antwort auf dem Handy verloren geht. Der nächste Versuch muss denselben Vorgang erkennen. Ein blind wiederholtes `insert` mit neuer serverseitiger ID reicht nicht.

**Flasche und Windel sind gekoppelte Vorgänge:** [addBabyCareEntry](/Users/janzeppenfeld/Developer/LottiBaby/lib/supabase.ts:523) speichert den Eintrag und startet danach zusätzliche Verbrauchsbuchungen. [adjustInventoryQuantity](/Users/janzeppenfeld/Developer/LottiBaby/lib/shopping.ts:609) aktualisiert einen berechneten Bestand und schreibt separat einen Transaktionseintrag. Ein künftiger Sync-Pfad muss Eintrag und zugehörigen Verbrauch eindeutig verbinden und serverseitig wiederholbar ohne Doppelwirkung machen. Das ist ein Mehraufwand, kein hier nachgewiesener Produktionsvorfall mit Doppelbuchung.

**Partneränderungen:** Ein Offline-Gerät kann einen inzwischen korrigierten oder gelöschten Datensatz noch besitzen. Einfach die zuletzt gesendete Handy-Version zu übernehmen kann Änderungen überschreiben. Ein Offline-Timer darf deshalb nur den zuletzt bekannten gemeinsamen Stand darstellen; der Partner kann offline nicht in Echtzeit informiert werden.

**Berechtigungen und Einwilligungen:** Lokale Lesbarkeit ist keine neue Serverfreigabe. Konto-/Kindwechsel, entzogenes Teilen, Logout, Löschung und Widerruf müssen Entwürfe und gespeicherte Ansichten korrekt behandeln. Für spätere ausstehende Einträge braucht Logout eine klare Regel, damit Daten weder unbemerkt verschwinden noch im nächsten Konto gesendet werden. Die bestehenden [Bereinigungswege](/Users/janzeppenfeld/Developer/LottiBaby/lib/dataConsentCleanup.ts:5) entfernen bereits Gerätespeicher.

**Neustart:** Der vorhandene Auth-Test bestätigt, dass ein Fehler bei `getSession()` die App im Wiederherstellungszustand lässt. Im installierten Auth-SDK liest eine noch gültige Sitzung lokal; bei Ablauf versucht es einen Token-Refresh. Ein vollständig offline nutzbarer Kaltstart mit abgelaufenem Token erfordert deshalb mehr als einen größeren Cache. Für das erste Paket garantieren wir nicht beliebig lange Nutzung mit abgelaufener Sitzung. Belege: [AuthContext](/Users/janzeppenfeld/Developer/LottiBaby/contexts/AuthContext.tsx:95), [Auth-Test](/Users/janzeppenfeld/Developer/LottiBaby/lib/__tests__/authStartupRecovery.test.tsx:26), `node_modules/@supabase/auth-js/src/GoTrueClient.ts`, Methode `__loadSession`.

## 4. Architekturvergleich

| Option | Vorteil | Zusätzliche Kosten und Grenzen | Eignung jetzt |
| --- | --- | --- | --- |
| Bestehende AsyncStorage-Caches + persistente Entwürfe | Viel vorhandenen Code nutzen, ausgewählte Ansichten und Eingaben absichern | Keine gemeinsame Datenbanktransaktion; Entwurf ist noch kein synchronisierter Eintrag; lokale Ablage ist nicht automatisch verschlüsselt | Beste erste Stufe |
| Begrenzter SQLite-Datenbestand + eigene Warteschlange für bestimmte Vorgänge | Lokale Anzeige und Warteschlange können gemeinsam gespeichert werden; Neustarts überstehen | Native Integration, Datenmigrationen, Upload-Vertrag, Konfliktregeln, Aufräumen; Synchronisation muss weiterhin gebaut werden | Sinnvoll bei nachgewiesenem Bedarf für automatische Offline-Erfassung |
| TanStack Query mit Persistenz | Einheitliches Laden, Cache und Wiederaufnahme pausierter Mutationen | Im Projekt noch nicht vorhanden; Umbau der Zugriffswege; ersetzt keine fachlichen Konflikt- oder Deduplizierungsregeln | Nicht allein wegen Offline einführen |
| PowerSync mit Supabase | Fertige Basis für lokales SQLite und Datensynchronisation | Weiterhin eigene Schreiblogik und Fachregeln; zusätzlicher Anbieter oder eigener Betrieb; Download-Berechtigungen als Sync Streams zusätzlich zu Supabase-RLS pflegen | Prüfen, falls breite Offline-Nutzung eine feste Produktanforderung wird |

AsyncStorage ist persistenter, unverschlüsselter Key-Value-Speicher. Für begrenzte vorhandene Ansichten und ausgewählte Entwürfe lässt sich darauf aufbauen; eine unbegrenzte Sammlung von Gesundheitsdaten und Medien ist damit nicht automatisch begründet. [Expo AsyncStorage](https://docs.expo.dev/versions/v57.0.0/sdk/async-storage/)

Expo SQLite bietet dauerhafte Datenbanken und Transaktionen, optional SQLCipher. Verschlüsselung benötigt passende native Konfiguration; Web-Unterstützung ist als Alpha beschrieben. SQLite allein stellt keine Supabase-Synchronisation bereit. [Expo SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)

TanStack dokumentiert, dass persistierte Mutationen nach Neustart eine registrierte Standard-Mutationsfunktion zur Wiederaufnahme brauchen. Aus dieser API folgt keine Lösung für die app-spezifischen Partner-/Vorratskonflikte. [TanStack Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations)

PowerSync Cloud Pro beginnt am Prüftag bei **49 US-Dollar pro Monat**, zuzüglich Nutzung oberhalb der enthaltenen Mengen. Der Free-Tarif hat niedrigere Grenzen und deaktiviert Projekte nach einer Woche Inaktivität. Das ist eine Anbieterpreisangabe, keine Prognose für LottiBaby. [PowerSync Preise](https://powersync.com/pricing) Für Downloads gelten eigene Sync Streams; CRUD am Server bleibt durch RLS geschützt. [PowerSync Berechtigungen](https://docs.powersync.com/integrations/supabase/rls-and-sync-streams), [Supabase-Integration](https://docs.powersync.com/integrations/supabase/guide)

## 5. Aufwand und wirtschaftliche Entscheidung

**Die folgenden Werte sind grobe technische Planungsspannen aus den geprüften Codepfaden, keine gemessenen Zeiten und kein Festpreis.** Ein Personentag bedeutet einen aktiven Arbeitstag einer mit dem Projekt vertrauten Entwicklungsperson. Enthalten sind Implementierung, relevante automatisierte Prüfungen und gezielte iOS-/Android-Geräteabnahme. Build-/Store-Wartezeiten, neue umfassende Designarbeit und ein zusätzlicher Web-Offlinemodus sind nicht enthalten. Die Spannen müssen bei konkreter Beauftragung in kleine Arbeitspakete zerlegt werden.

| Paket | Grobe Spanne | Wiederkehrender Aufwand | Bewertung |
| --- | --- | --- | --- |
| A: stabile Kernansichten, korrektes Cache-Verhalten, gezieltes Wiederholen, persistente Entwürfe in ausgewählten Eingaben | **4–7 Personentage** | Begrenzte Pflege von Speicherformat, Konto-/Widerrufsregeln und betroffenen Eingabefeldern | Empfohlen |
| B: zusätzlich abgeschlossene Flasche-/Windeleinträge automatisch synchronisieren, einschließlich wiederholsicherer Vorratswirkung | **weitere 8–15 Personentage** | Neue Felder, fachliche Nebenwirkungen und API-Änderungen müssen beide Zustände berücksichtigen | Nur wenn A den häufigen Speicherbedarf nicht ausreichend abdeckt |
| C: zusätzlich vollständiger Offline-Timer mit Partnerkonflikten und Nebenfunktionen | **weitere 7–15 Personentage** | Dauerhafte Zwei-Geräte-Abnahme bei Änderungen an Timer, Split, Erinnerungen und Widgets | Separat entscheiden |
| Breiter Umbau einschließlich gemeinsamer Bestände, Planer, Korrekturen/Löschungen und Medien | **insgesamt etwa 30–60+ Personentage** | Eigener dauerhaft zu betreuender Sync-Bereich; zusätzliche Plattform- und Anbieterpflege | Für kurze Funklöcher derzeit nicht gerechtfertigt |

Paket A setzt auf vorhandene Abhängigkeiten; ein neuer Sync-Anbieter ist dafür nicht nötig. SQLite/PowerSync würden native Integration und neue Builds hinzufügen. Auch ohne zusätzliche Lizenzgebühr kostet ein selbst entwickelter Sync laufend Entwicklung und QA. Eine relevante Senkung der Supabase-Kosten ist aus dieser Analyse nicht belegbar: weniger wiederholte Abrufe können helfen, zusätzliche Abgleiche können wiederum Traffic erzeugen. Die Cloud-Ersparnis sollte nicht die wirtschaftliche Begründung sein.

Mit eurem tatsächlichen internen Tagessatz `T` liegt der grobe Entwicklungsrahmen für A bei `4T–7T`, für A+B bei `12T–22T`. Ein externer Stundensatz oder eine konkrete Codex-Abrechnung wurde nicht ermittelt. Der wirtschaftliche Nutzen besteht zunächst in weniger erneuter Eingabe, verlässlicherer Anzeige und weniger Verwirrung bei Funklöchern. Vermiedene Kündigungen oder Umsatzsteigerung lassen sich derzeit nicht seriös beziffern.

## 6. Konkreter erster Umfang und Abnahme

1. Fehlgeschlagene Aktualisierung darf keinen bestätigten Verlauf durch leer/null ersetzen. Ein erfolgreich geladener leerer Verlauf muss weiterhin als leer übernommen werden können.
2. Frische und Aufbewahrung für ausgewählte Ansichten trennen. Home/Unser Tag zuletzt geladene Tage, Kinderauswahl und Schwangerschaftstermin erhalten; keine komplette Datenbank vorsorglich herunterladen. Als anfänglichen Umfang höchstens die letzten sieben **bereits geladenen** Tage prüfen und an bestehende Verlaufstarife anpassen. Alte Home-Tageswerte dürfen nicht als heutige Werte erscheinen.
3. Originalzeit, Kind und Konto in ausgewählten Flasche-/Windel-/Notizentwürfen sichern; Datum und Kontext bei Wiederherstellung sichtbar machen. Bestätigten Online-Erfolg abwarten, bevor der Entwurf entfernt wird. Zunächst bewusst erneut speichern lassen.
4. Bei unklarer Serverbestätigung keinen blinden automatischen Insert wiederholen. Den Vorgang abgleichen oder für die betroffenen Wege bereits eine stabile ID und serverseitige Deduplizierung ergänzen; das kann die Aufwandsspanne erhöhen. Wiederholungen bei reinen Leseabrufen sind deutlich einfacher.
5. Bestehende Inhalte während Hintergrundabrufen anzeigen, Hinweis zum letzten Stand, ein gemeinsamer begrenzter Wiederholungsmechanismus. Wiederherstellung bei Rückkehr in den Vordergrund und manuell ermöglichen. Keine Garantie für sofortige Synchronisation einer vom Betriebssystem beendeten App.
6. Bei Timer-Anzeige zwischen lokalem Start/letztem gemeinsamen Stand und frisch bestätigtem Zustand unterscheiden. Im ersten Paket Start-/Stoppversuche als wiederherstellbare Eingabe behandeln, statt sie schon als gemeinsamen erfolgreichen Timerwechsel auszugeben.

Geräteabnahme: Daten online laden → Verbindung unterbrechen → zwischen Ansichten wechseln → Eingabe machen → App schließen → mit gültiger lokaler Sitzung wieder öffnen → Entwurf korrekt wiederherstellen → Verbindung herstellen → Daten erneuern und Eingabe kontrolliert speichern. Zusätzlich: nur ein API-Aufruf schlägt fehl, Tageswechsel, Konto-/Kindwechsel, Widerruf, echter leerer Verlauf, Server übernimmt Speicherung/Antwort fällt aus. Für B/C kommen Doppelübertragung und widersprüchliche Aktionen auf zwei Geräten hinzu.

Die erste Stufe sollte als **robust bei Netzunterbrechungen** beschrieben werden. Die Aussage „vollständig offline nutzbar“ wäre mit diesem Umfang zu weitgehend.

## 7. Überprüfung und Entscheidung über einen weiteren Ausbau

Aktuell ausgeführt: acht vorhandene Testsuiten, **122 Tests bestanden** (`authStartupRecovery`, `appCacheStartup`, `dailyCache`, `babyListLoading`, `babySwitcherRefresh`, `dataConsents`, `familySubscriptionAccess`, `shopping`). Sie prüfen vorhandene Schutzmechanismen; ihr Bestehen bestätigt keinen umfassenden Offline-Modus. Zwei Cache-Verhaltensweisen wurden zusätzlich mit extrahierten Originalfunktionen isoliert reproduziert. Es wurden keine neuen App-Tests und keine Funktionsänderungen vorgenommen.

Nach A empfiehlt sich eine begrenzte Auswertung aus vorhandenem Support und, falls passend, sparsamen technischen Zählern: betroffene Nutzungssitzungen, Speicherabbrüche wegen Netzproblemen, wiederhergestellte/noch ungesendete Entwürfe und Wiederholungen ohne Klärung. Keine Eingabetexte oder Gesundheitswerte dafür protokollieren. Die Betrachtung sollte eine festgelegte Zeitspanne, dieselben Nenner und das jeweilige Funktionsgebiet verwenden. Ein größerer Ausbau lohnt sich, wenn trotz A regelmäßig wichtige Erfassungen nicht abgeschlossen werden oder Nutzer ausdrücklich sofortiges Offline-Speichern und automatische spätere Übertragung benötigen.

**Entscheidungsvorschlag:** A planen; B erst anhand des verbleibenden Problems entscheiden; C und den breiten Umbau vorerst zurückstellen. Der erste konkrete Eingriff wäre die belegte Home-Cache-Korrektur, anschließend gezielte Speicher-/Entwurfsregeln in den Kernfunktionen.
