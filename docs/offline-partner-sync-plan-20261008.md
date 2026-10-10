# Verbindliche Ergänzung: Schlaf-Offline-Stopp und Partnerabgleich

Stand: 08.10.2026. Projekt: `/Users/janzeppenfeld/Developer/LottiBaby`. Dies ist eine aktualisierte Planung, keine implementierte Funktion.

## 1. Neue Priorität und Vorrang

Der Nutzer hat den zuverlässigen Abgleich mit dem Partner und die Kontrolle über widersprüchliche Schlafstände ausdrücklich als besonders wichtig festgelegt. Ein lokal offline gestoppter Schlaf soll seine tatsächliche Stoppzeit behalten und nach Netzrückkehr zum gemeinsamen Stand werden können. Hat der Partner inzwischen etwas geändert, muss der Nutzer die Unterschiede sehen und bewusst entscheiden können.

**Diese Ergänzung hat bei Schlaf und Partnerabgleich Vorrang vor dem [bisherigen Phase-A-Plan](/Users/janzeppenfeld/Developer/LottiBaby/docs/offline-umsetzungsplan-phase-a-20261008.md).** Dessen Ausschlüsse „keine Offline-Timerwechsel“, „keine Outbox“ und „keine Serververtragsänderung“ gelten weiter für andere Funktionsbereiche, aber nicht mehr pauschal für den hier ausdrücklich angeforderten Schlaf-Stopp. Die bisherigen Konto-, Consent-, Tarif-, Bereinigungs- und Testgrenzen bleiben bestehen.

Der Arbeitsauftrag für den nächsten Agenten besteht jetzt aus **Phase A plus Schlaf-Paket S**. Dieses Paket ist erforderlich; es darf nicht als unbestimmte spätere Phase C verschwinden. Aktuell bleiben wir bei Planung und Prompt-Erstellung. Keine App- oder Datenbankänderung durch diese Analyse.

### Konkreter erster Schreibumfang

- Offline **einen bereits serverseitig bekannten, berechtigt angezeigten aktiven Schlaf stoppen**; exakte Eintrags-ID, ursprüngliche Startzeit und Bestätigungsstand verwenden.
- Offline-Stopp, ursprüngliche Endzeit und zugehörige Eingaben dauerhaft auf diesem Gerät sichern, lokale Anzeige stoppen und Übertragung als ausstehend kennzeichnen.
- Nach Netzrückkehr frischen gemeinsamen Stand prüfen, den Stopp sicher übernehmen oder einen Konflikt zur Nutzerentscheidung vorlegen.
- Online-Funktionen des Partners können währenddessen weiterhin Start/Stopp, Pause/Fortsetzen, Korrektur, Split/Merge oder Löschung ausführen; **alle diese Änderungen müssen beim Abgleich erkannt und korrekt behandelt werden**.
- Offline-Neustart darf einen nachweisbar passenden gespeicherten aktiven Schlaf als letzten bekannten Stand anzeigen und dessen Stoppen anbieten. Dieser Stand ist keine neue Bestätigung, dass er beim Partner noch läuft.

Neue Schlafstarts, Pausen/Fortsetzungen, Split/Merge, Freigabeänderungen und Löschungen werden im ersten Offline-Schreibumfang nicht allgemein in Warteschlangen aufgenommen. Bei fehlender Bestätigung diese Aktionen klar als momentan nicht verfügbar kennzeichnen und ihre Eingaben erhalten, soweit sinnvoll. Ein neuer Offline-Schlaf oder das automatische Stoppen eines anderen Eintrags braucht einen separaten fachlichen Vertrag. Keine scheinbar erfolgreiche Aktion ohne definierten Abgleich.

„Alle Ausnahmen berücksichtigen“ bedeutet: bekannte konkurrierende Aktionen testen und unbekannte/mehrdeutige Fälle sicher anhalten. Eine ungeprüfte Behauptung, jede denkbare Ausnahme sei gelöst, ist kein Fertigkriterium.

## 2. Nutzerverhalten und Kontrolle

### Offline stoppen

Beispiel: Schlaf startet um 20:10. Gerät A stoppt ohne Verbindung um 21:05. Die App sichert **21:05**, nicht den späteren Zeitpunkt der Netzrückkehr. Sofort zeigen:

> Auf diesem Gerät um 21:05 gestoppt. Noch nicht mit dem Partner abgeglichen.

Ein bloß fehlgeschlagener Abruf darf diesen lokalen Stopp nicht wieder in einen laufenden Timer verwandeln. Der Serverstand bleibt getrennt vorhanden. Lokaler Stopp und gemeinsamer bestätigter Stopp sind zwei Zustände desselben Schlafs, keine zwei unabhängigen Schlafeinträge.

Die eigentliche Stoppaktion erklärt vorab knapp, dass der Stopp bei Verbindung abgeglichen wird. Ausstehende Aktionen bleiben sichtbar und prüfbar. Solange noch nichts am Server bestätigt wurde, kann der Nutzer die Übertragung zurücknehmen, die eigene Endzeit korrigieren oder „vor Übertragung prüfen“ wählen. Bei bereits laufendem Request zuerst dessen Ergebnis klären; „Zurücknehmen“ kann einen möglicherweise schon bestätigten Server-Stopp nicht rückgängig garantieren.

### Unveränderter gemeinsamer Stand

Vom Nutzer am 08.10.2026 ausdrücklich gewählt: **gleicher unverändert aktiver Schlaf → ursprüngliche Offline-Stoppzeit automatisch übernehmen, danach kurz bestätigen; bei echten Partneränderungen verpflichtend fragen.** Das ist der verbindliche Standard. Pro ausstehendem Vorgang muss „vor Übertragung prüfen“ möglich sein, wenn der Nutzer für diesen Stopp mehr Kontrolle möchte.

Dass die Uhr beim Partner inzwischen weitergezählt hat, ist für sich allein kein Datenkonflikt. Verglichen werden gespeicherte Änderungen und Identitäten. Bei unverändertem Eintrag kann beispielsweise 21:05 auch bei Netzrückkehr um 21:20 übernommen werden.

Hinweis nach tatsächlicher Bestätigung:

> Offline-Stopp um 21:05 übernommen. Der gemeinsame Schlaf ist jetzt beendet.

Das bedeutet serverseitig gemeinsam gespeichert. „Auf dem Partnergerät angekommen“ nur behaupten, wenn dafür tatsächlich eine Empfangsbestätigung existiert. Ist dessen App geschlossen oder offline, zeigt sie den neuen Stand beim nächsten erfolgreichen Abgleich. Keine Garantie einer sofortigen Ausführung auf einem ausgeschalteten/gesperrten Partnergerät.

### Echte Unterschiede: Entscheidung erforderlich

Ein kompakter Dialog zeigt **Kind, Schlafbeginn mit Datum, ursprüngliche lokale Endzeit, frischen gemeinsamen Stand und die jeweilige Dauer**. Bei einem aktuell laufenden gemeinsamen Stand klar „noch aktiv“ statt einer erfundenen Endzeit anzeigen. Namen nur nennen, wenn die Änderung sicher einer Person zugeordnet werden kann; sonst „gemeinsamer Stand“.

Beispiel:

> Unterschiedliche Schlafzeiten für [Kind]
>
> Dein Offline-Stopp: 21:05 · 55 Minuten
>
> Gemeinsamer Stand: um 21:12 beendet · 62 Minuten
>
> Welche Zeit soll für diesen Schlaf gelten?

Aktionen:

- **Meine Stoppzeit 21:05 übernehmen.** Nur diesen ursprünglichen Schlaf anhand des gerade geprüften Versionsstands ändern. Existierende andere Felder nicht ungefragt überschreiben.
- **Gemeinsamen Stand beibehalten.** Lokalen Stopp bewusst verwerfen; aktuelle gemeinsame Version übernehmen. Falls sie noch aktiv ist, darf der Timer wieder als aktiv erscheinen, klar erklärt.
- **Später entscheiden.** Nichts schreiben oder verwerfen; ausstehender Konflikt bleibt sichtbar und nach Neustart wieder zugänglich.

Keine Zeit vorauswählen und durch Timeout übernehmen. Änderungen an Startzeit, Notiz, Qualität oder Sessionstruktur müssen sichtbar sein. Wenn beide Seiten dieselbe Endzeit, aber unterschiedliche Notizen/Bewertungen haben, diese Felder gesondert prüfen; keine automatische Komplett-Payload-Überschreibung. Bei manueller Zeitkorrektur Validierung gegen den gewählten aktuellen Start und bestehende Regeln ausführen; lokal geänderte Endzeit erneut versionieren.

Wenn der Partner während des geöffneten Dialogs erneut ändert, ist die alte Entscheidung nicht mehr gültig: frischen Stand zeigen und erneut entscheiden lassen. Ein „Meine Zeit übernehmen“ ohne Versionsprüfung wäre ein unkontrolliertes Überschreiben.

## 3. Technischer Vertrag: lokal, serverseitig und beim Partner

### 3.1 Bestätigter Snapshot und lokaler Vorgang getrennt

Vorgeschlagene kleine Dateien: `lib/sleepOfflineActions.ts`, `lib/sleepConflictResolution.ts`, ein appweit für das aufgelöste Konto gestarteter Recovery-Hook und `components/SleepSyncConflictModal.tsx`. Namen dürfen zur Repo-Struktur passen. Keine zusätzliche lokale Voll-Datenbank allein für dieses begrenzte Paket verlangen.

Aktiven bestätigten Sleep-Snapshot mit Konto, Backend-Host, tatsächlichem `baby_id`, Eintrags-ID, Startzeit, serverseitiger Revision und Bestätigungszeit persistent speichern. Legacy-Einträge mit `baby_id=null` nicht dem aktuell gewählten Kind umetikettieren. Sie dürfen nur mit nachgewiesenem bisherigen Zugriffs-/Auswahlkontext angeboten werden; bei Mehrdeutigkeit zunächst frischen Stand verlangen.

Ein lokaler Vorgang enthält mindestens:

```ts
type PendingSleepStop = {
  schemaVersion: 1;
  operationId: string; // stabile UUID; bei Retry identisch
  localRevision: number;
  scope: { backendHost: string; userId: string; babyId: string | null };
  originalEntryId: string;
  baseEntry: ConfirmedSleepSnapshot;
  originalStopAt: string; // Zeitpunkt der ersten lokalen Stoppaktion
  chosenStopAt: string; // zunächst identisch; nur bewusst korrigieren
  proposedQuality: string | null;
  proposedNotes: string | null;
  reconcilePolicy: 'auto_if_unchanged' | 'ask_always';
  state: 'pending' | 'checking' | 'needs_decision' | 'sending'
    | 'confirmation_unknown' | 'blocked' | 'confirmed' | 'discarded';
};
```

`ConfirmedSleepSnapshot` ist ein neu zu definierender validierter Datentyp, keine bereits vorhandene Datei/garantierte API. Er enthält Identität und Version sowie die für den Vergleich benötigten Felder. Nachtnachts-Session/Segmentzugehörigkeit aus vorhandenen Klassifizierungsregeln einbeziehen, wenn für die Entscheidung relevant.

- Vorgang **vor** lokalem Erfolgshinweis und Dispatch dauerhaft sichern. Storagefehler bedeutet keinen nach Neustart gesicherten Offline-Stopp; Eingaben erhalten und lokalen Sicherungsfehler ausdrücklich anzeigen.
- Ein ausstehender Stopp je Originaleintrag. Wiederholter Klick erzeugt keine zweite Operation. Korrektur eines noch nicht versendeten Stopps verändert die lokale Revision. Bei bereits möglicherweise versendeter Revision erst deren Ergebnis klären, bevor eine neue Änderung übertragen wird.
- Payload beim ersten Dispatch für diese `operationId` festschreiben. Eine nach tatsächlichem Commit gewünschte neue Zeitkorrektur braucht einen neuen ausdrücklich bestätigten Vorgang mit neuer ID und aktuellem erwarteten Versionsstand. Ein bestehendes Receipt nicht mit anderem Payload wiederverwenden.
- Nach Neustart aus `sending` in `confirmation_unknown` wechseln und denselben Vorgang klären. Kein neuer Insert, kein anderes Schlafziel, keine Stoppzeit „jetzt“.
- Keine automatische Ablaufzeit für ungesendete Stopps. Alte Vorgänge benötigen vor Übernahme aktuelle Prüfung und nötigenfalls Entscheidung. Begrenzte Anzahlen durch eine Aktion je Originaleintrag; kein unbegrenztes paralleles Journal ohne Aufräumvertrag.
- Aktive Snapshots wie im A-Plan begrenzt aufbewahren. Ein länger bestehender Pending-Vorgang behält die zur Klärung nötige Basis; daraus keinen neuen laufenden Timer oder neue Serverberechtigung ableiten.

### 3.2 Frischer Abgleich muss rein lesend und vollständig sein

Vor Klassifikation den Originaleintrag, aktuellen aktiven Stand desselben Kind-Scopes und nötige Session-/Segmentidentitäten mit aktuell erlaubtem Zugriff prüfen. Ein fehlender Eintrag ist ohne gesicherte Autorisierung **nicht automatisch gelöscht**; auch Zugriffsverlust oder unvollständige Abfrage sind möglich.

Keinen konfliktentscheidenden Read ausführen, der gleichzeitig Daten verändert:

- [SleepEntriesService.getEntries](/Users/janzeppenfeld/Developer/LottiBaby/lib/services/SleepEntriesService.ts:98) ruft `autoCloseStaleActiveEntries` auf. Das kann aktive Einträge nach 24 Stunden schließen.
- [loadVisibleSleepEntries](/Users/janzeppenfeld/Developer/LottiBaby/app/(tabs)/sleep-tracker.tsx:1920) kann eigene abgeschlossene Einträge unter einer Minute löschen.
- [loadAllVisibleSleepEntries](/Users/janzeppenfeld/Developer/LottiBaby/lib/sleepSharing.ts:18) vereinigt RPC, Partner-/Legacyfelder und explizite Shares. Der vorhandene Pfad darf für diese Konfliktprüfung nicht allein durch `success: true` als vollständig gelten: einzelne Teilfehler können aktuell mit leeren/teilweisen Ergebnissen enden.
- Der Service-Pfad berücksichtigt andere Sichtbarkeitswege als dieser Union-Pfad. Für den neuen Vertrag die tatsächlich zulässigen Owner-, Partner-, Baby-Membership-, Legacy-Share- und expliziten Share-Fälle abgleichen. Lesezugriff bedeutet nicht automatisch Schreibzugriff.

Daher eine dedizierte nebenwirkungsfreie, autorisierte Snapshot-/Prüfoperation schaffen. Automatische Alt-Timer-Schließung und Kurzschlafbereinigung dürfen Pending-Ziele nicht vor der Entscheidung verändern/löschen. Jede serverseitig bereits eingetretene Automatik ist dagegen ein gemeinsamer geänderter Stand und muss als solcher verglichen werden.

### 3.3 Atomarer Commit und wiederholsichere Bestätigung

Ein frischer Read plus normales späteres `.update(...).eq('id', ...)` reicht nicht: Zwischen beiden kann der Partner schreiben. Erforderlich ist ein **serverseitiger bedingter Vorgang in einer Transaktion** mit stabiler `operationId`, überprüfter Identität, aktueller Autorisierung und dem erwarteten geprüften Versionsstand.

Vorgeschlagenes RPC-Verhalten, keine bereits existierende Funktion:

```ts
type SleepStopResult =
  | { status: 'applied'; operationId: string; committedSnapshot: SleepSnapshot }
  | { status: 'already_applied'; operationId: string; receipt: CommitReceipt }
  | { status: 'conflict'; currentSnapshot: SleepScopeSnapshot }
  | { status: 'not_available' }
  | { status: 'forbidden' }
  | { status: 'invalid'; reason: string };
```

Serververtrag:

1. Actor ausschließlich aus `auth.uid()` ableiten; aktuellen Consent, Lösch-/Accountstatus und zulässigen Schreibzugriff prüfen. Sichtbarkeit allein reicht nicht. Scope vom gespeicherten Ziel bestätigen, nicht unbesehen aus Clientdaten übernehmen.
2. Bereits bearbeitete `operationId` mit identischem gebundenem Payload erkennen. Wiederholung liefert Receipt, ohne Schlaf oder Nebenwirkungen erneut zu ändern. Andere Payload unter derselben möglicherweise schon angewendeten ID ablehnen.
3. Erwartete Eintragsrevision und relevante aktive-/Sessionidentität atomar prüfen. Bei Partneränderung oder neuem Schlaf keine Wirkung, stattdessen `conflict`. Strukturänderungen und Eintragsverschiebung in anderes Kind ebenfalls erkennen.
4. Nur die bewusst gewählten Felder des Originaleintrags verändern. Dauer serverseitig aus bestätigtem Start und gewählter ursprünglicher Endzeit berechnen. `updated_by` aus dem tatsächlichen Actor setzen. Keine blanket Upserts oder Wiederanlage eines gelöschten Eintrags.
5. Änderungswirkung und Receipt gemeinsam committen. Bei verlorener Antwort denselben Vorgang abfragen/wiederholen; kein neuer Vorgang und keine erneuten Quality-/Reminder-/Event-Wirkungen.
6. Nach bestätigtem Commit aktuellen gemeinsamen Stand lesen. Ein altes Receipt beweist die frühere Ausführung, aber darf spätere Partnerkorrekturen nicht mit dem alten Resultat überdecken.

Ein echter monotoner serverseitiger Revisionswert ist vorzuziehen. Vorhandenes `updated_at` nur verwenden, wenn Trigger, alle Writer, Zeitpräzision und eindeutige Änderungserkennung nachweislich ausreichen. Eine vom Client behauptete Version oder ein Zeitvergleich allein reicht nicht. Revision muss auch bei direkten Updates, Legacy-RPCs, Pause, Qualität, Split/Merge und Automatiken korrekt wechseln. Änderungen an mehreren Segmenten/aktiven Einträgen brauchen einen entsprechend geschützten Scope-/Sessionvergleich; bloß die Originalzeile zu sperren erkennt nicht jede neue Zeile.

**Kompatibilitätsgate:** Alle tatsächlichen Sleep-Writer einschließlich älterer Appversionen und Caretakerpfade erfassen. Revisionszähler allein verhindert nicht, dass ein alter Client später einen unbedingten stale Write ausführt. Für das aktivierte neue Konfliktmodell müssen kritische konkurrierende Schreibwege ebenfalls eine wirksame Bedingung/Serverregel respektieren. Wenn das eine bewusst brechende Änderung oder Mindestversion erfordert, diese Rolloutentscheidung ausdrücklich vorbereiten und das Feature bis dahin geschlossen halten. Keine vollständige Konfliktkontrolle behaupten, während ungeschützte parallele Writer sie umgehen können.

Server-Receipt/Journaltabelle oder entsprechende dauerhafte Felder in lokalen Migrationen vorbereiten, mit enger RLS, begrenzten EXECUTE-Rechten, Einwilligungs-/Export-/Kontolöschungsintegration und minimalen Inhalten. Keine Gesundheits-Payloads in ein dauerhaftes Diagnosearchiv kopieren. Erst das tatsächliche bestehende Schema verifizieren; historisch vorhandene `group_id`/`external_id` sind kein Beweis eines aktuellen Session-/Operationsvertrags.

Für die lokale/QA-Verifikation dürfen nötige Schemaänderungen **vorbereitet und lokal getestet** werden. Produktive Migration/Deployment sind weiterhin nicht autorisiert. Ohne bereitgestellten Serververtrag bleibt das neue Offline-Schreiben hinter einer sicheren Capability-/Featuregrenze; Lesepaket A kann unabhängig fertig werden. Kein stiller unsicherer Fallback auf den alten unbedingten Updatepfad.

### 3.4 Recovery und Partneranzeige

Abgleich darf nicht erst davon abhängen, dass Sleep Tracker geöffnet wird. Nach aufgelöster Konto-/Consent-Hydrierung ein zentraler Runner für dieses Konto: Appstart, Rückkehr in den Vordergrund, bestätigte Wiederverbindung/erfolgreicher API-Kontakt und manuelle „Jetzt abgleichen“-Aktion. Foreground-Wiederverbindung bei geöffneter App aus vorhandenen Signalen erkennen; falls ein zusätzlicher Netzwerkindikator notwendig wird, seinen Nutzen/native Abhängigkeit konkret begründen.

Ein Runner je Scope, persistente Zustandswechsel und Schutz gegen doppelte Trigger. Transiente Fehler begrenzt mit Backoff behandeln; nach Fehlerbudget sichtbarer Status und manuelle Aktion. Konflikte, Consent-Abbruch und sichere Ablehnung nicht automatisch wiederholen. Wiederholungen dieses **idempotenten Sleep-Vertrags** sind die eng begrenzte Ausnahme vom A-Verbot generischer Schreib-Retries. Keine Garantie, dass ein beendeter App-Prozess im Hintergrund sofort weiterarbeiten kann.

Bei Rückkehr ins Netz dürfen normale Reloads den lokalen Pending-Stopp nicht optisch zurücksetzen: Server-Snapshot laden, dann lokalen Overlayzustand getrennt anwenden. Konflikte bleiben als Konflikte sichtbar. Runner/Consent-Bereinigung/Accountwechsel durch Generation entwerten; Server prüft auch selbst aktuelle Erlaubnis.

Beim Partner vorhandene [useSleepEntriesSync](/Users/janzeppenfeld/Developer/LottiBaby/hooks/useSleepEntriesSync.ts) weiterverwenden: Ereignis führt zu autorisiertem frischem Read; bei Rejoin/Fokus/Vordergrund erneut lesen. Zusätzlich Share-/Membershipänderungen und alle tatsächlich unterstützten Sichtbarkeitswege berücksichtigen, damit eine Änderung nicht nur über `partner_id` zufällig ankommt. Verlorene/doppelte Events müssen durch den Snapshot heilbar sein.

Ein dauerhaftes kurzes Abgleichergebnis darf beim nächsten Öffnen angezeigt werden, wenn die Synchronisation schon zuvor bestätigt war. Pro Ereignis/Version einmal bestätigen; ein ungelöster Konflikt dagegen bleibt über einen Hinweis jederzeit wieder erreichbar. Keine Popup-Schleife und keine modale Unterbrechung jeder normalen Partneraktion.

Native Live Activity, Home, Widget, Schlafminuten und Sleep-Screen auf beiden Geräten müssen aus derselben Trennung „bestätigter Serverstand + eigener Pendingzustand“ arbeiten. Lokal darf eine Live Activity nach lokalem Stopp enden, ohne globalen Erfolg zu behaupten. Remote native Beendigung nur entsprechend tatsächlich verfügbarer App-/Pushmechanik testen; In-App-Realtime garantiert keine Fernbedienung aller nativen Flächen.

## 4. Pflichtmatrix: Fälle, Entscheidungen und Grenzen

| Fall | Verbindliches Verhalten |
| --- | --- |
| Originalschlaf unverändert aktiv; Partneranzeige zählt nur weiter | Original-Stoppzeit übernehmen nach gewählter Policy; keine neue Zeit aus Netzrückkehr. |
| Partner stoppt denselben Schlaf zur identischen Zeit | Als bereits vereinbarte Zeit erkennen; abweichende Qualität/Notiz gesondert prüfen. Nicht wegen ähnlicher Werte ein Receipt oder falsche Actorzuordnung erfinden. |
| Partner stoppt denselben Schlaf früher/später | Zeiten/Dauer zeigen; bewusst eine Zeit übernehmen oder später entscheiden. Kein automatisches frühestes/spätestes Ende. |
| Partner verändert Startzeit, Notiz oder Qualität | Unterschiede zeigen; nicht unbemerkt mit altem Payload überschreiben. Endzeit gegen aktuellen Start validieren. |
| Partner beendet Originalschlaf und startet einen neuen | Original anhand ID klären; **neuen Schlaf niemals mit dem alten Offline-Stopp stoppen**. Neuen aktiven Stand zusätzlich zeigen. |
| Partner pausiert und setzt Nacht fort | Frühere/aktuelle Segmente zeigen; alter Stopp darf nicht die neue Fortsetzung beenden. Keine Zuordnung nur nach gleicher Nacht/ähnlicher Uhrzeit. |
| Partner splittet/merged Original | Geänderte Struktur = Entscheidung/Detailansicht. Ursprüngliche ID nicht blind auf Nachfolger übertragen; ohne eindeutige autorisierte Zuordnung keine automatische Wirkung. |
| Original gelöscht/nicht mehr sichtbar | Nicht wiederherstellen. Fehlender Datensatz ohne ausreichende Evidenz nur als „nicht mehr verfügbar“ erklären. Lokales Original bei erlaubtem Consent zur bewussten Klärung erhalten. |
| Anderes Kind oder Legacy-NULL-Zuordnung | Keine Umzuordnung aus aktueller UI-Auswahl. Exakten Originalscope prüfen; Mehrdeutigkeit blockiert Commit. |
| Zwei Geräte stoppen offline verschieden | Einer kann zunächst übernehmen; zweiter bekommt die aktuelle Version zur Entscheidung. Keine timestampbasierte Gewinnerwahl. Gleichzeitige Entscheidungen atomar absichern. |
| Partner ändert während Dialog/zwischen Read und Commit | Erwartete Version veraltet → keine Wirkung; aktuelle Unterschiede erneut vorlegen. |
| Stopp unter einer Minute | Bestehendes Verwerfen-Kurzschlaf-Verhalten vorab erklären; als versionierter, wiederholsicherer Stopp-/Verwerfenvorgang behandeln. Nicht versehentlich beim Konflikt-Read löschen. |
| Automatischer 24-Stunden-Abschluss | Tatsächlich geänderten Serverstand vorlegen. Nicht vorab in der Read-Prüfung ausführen; ursprüngliche Offlinezeit nicht durch Automatik ersetzen. |
| Geräteuhr falsch, negative/ungültige Dauer, Zeitzone/Datumswechsel | Originalzeit samt Datum zeigen; ungültiges Ergebnis zur Korrektur blockieren. Keine künstliche Zeitkorrektur ohne Nutzerwissen. Bestehende Nachtzuordnung beachten. |
| Nachtqualität soll andere Segmente ändern | Änderungen zusätzlich previewen und versioniert/atomar auf überprüfte Segmente begrenzen; konkurrierende Bewertungen erhalten. Bestehendes `applyNightQualityToSession` nicht blind auf altem Cache nachholen. Falls diese gruppierte Wirkung noch nicht sicher vorhanden ist, explizit nur das gestoppte Segment bewerten und breitere Änderung als offen kennzeichnen, statt Gesamt-Nacht-Erfolg zu behaupten. |
| Timeout/Antwortverlust nach tatsächlichem Commit | Stable-ID-Receipt klärt Wirkung; kein zweiter Stopp und keine zweite Segment-/Side-Effect-Ausführung. |
| Neustart, Netzflattern, doppelte Events oder gleichzeitig offene Flächen | Persistenten Vorgang einmal fortsetzen; keine unabhängige zweite Warteschlange. |
| Access Token abgelaufen | Bestehende Auth-Recovery; nichts unter anderem Konto senden. Erlaubte lokale Informationen entsprechend bestehenden Grenzen erhalten; keine Serverfreigabe erfinden. |
| Freigabe/Partner/Membership inzwischen geändert | Erlaubnis neu prüfen. Lesbarer fremder Eintrag kann trotzdem nicht schreibbar sein. Keine unerlaubte Übernahme; lokaler Status zeigt blockierte Klärung. Bei bestätigtem Verlust auch des Lese-/Kindzugriffs betroffene fremde Snapshots und Pendinginhalte gemäß A bereinigen; nur einen nicht-inhaltlichen Hinweis zum gescheiterten Abgleich behalten. |
| Health-Widerruf/Kontolöschung | Sofort weitere Reads/Writes blockieren; Pending-/Snapshot-Persistenz sicher bereinigen; alte Serverrequests können nicht einfach ungeschehen gemacht werden. Keine Healthdaten nach Widerruf weiter anzeigen. |
| AI-Widerruf allein | Manuellen Schlafabgleich entsprechend Health-Erlaubnis erhalten. |
| Logout mit ausstehendem Schlaf-Stopp | Vor bewusstem Logout Anzahl und Verlust der lokalen ausstehenden Aktionen erklären; Optionen zurück/Logout mit Verwerfen. Kein Versand nach Logout oder im nächsten Konto. Health-Widerruf niemals wegen dieses Dialogs verzögern. |
| Lokaler Storage voll/fehlerhaft | Kein behaupteter dauerhaft gesicherter Offline-Stopp. Formular/Zeit im laufenden Prozess erhalten; klare Sicherungsgrenze. |
| Verschiedene alte/neue Clients | Kompatibilitätsgate testen; gefährlicher Fallback bleibt aus. |
| Unbekannter Konflikt/mehrere aktive Schlaf-IDs | Kein „nächstbester“ Schlaf als Ziel. Details + spätere Entscheidung; keine automatische fachliche Auflösung. |

Diese Matrix ist die Mindestabdeckung. Zusätzliche konkrete Sonderfälle, die im aktuellen Code auftauchen, in dieselbe Matrix und Tests aufnehmen.

## 5. Übrige Funktionen: begrenzte, nachvollziehbare Regeln

| Funktion | Regel für den ersten Ausbau |
| --- | --- |
| Home/Tagesverlauf/Schwangerschaft lesen | Bestätigten Snapshot erhalten und Alter zeigen. Neue Serverwerte übernehmen, wenn vollständig/erlaubt bestätigt. Keine Entscheidung für einen bloßen Lesefehler. |
| Neue Flasche/Windel mit Notiz | Gemeinsame lokale Entwürfe aus A. Bewusster Online-Save; unklare Insertbestätigung über frischen Verlauf prüfen. Noch kein automatischer Upload mit Vorratswirkung. |
| Ähnliche Einträge beider Partner | Ähnlichkeit ist kein Beweis einer Dublette. Nicht automatisch löschen/zusammenführen. In späterem Uploadpaket stable-ID-Vorgänge und bewusste Dublettenprüfung. |
| Bearbeitung gemeinsam genutzter Werte | Später ebenfalls erwartete Version und Feldunterschiede; kein generisches „letzte Handyzeit gewinnt“. Im ersten Paket kein neues Offline-Update. |
| Vorräte/Einkauf | Offline keine alten absoluten Mengen überschreiben. Später eindeutige Verbrauchs-/Kaufbuchungen und Servertransaktion statt Payload-Replay. |
| Planer, Serien, Freigaben | Offline-Schreiben zurückstellen; zuletzt erlaubte Inhalte nur im getrennt beauftragten Lesepaket. Keine automatische Reinterpretation von Serien/Teilungen. |

Nutzerkontrolle heißt nicht ein Popup für jede harmlose Aktualisierung. Entscheidung ist dort nötig, wo zwei fachliche Versionen oder Folgen gegeneinanderstehen. Normale bestätigte Partneränderungen müssen weiterhin zügig sichtbar werden.

## 6. Reihenfolge, Kosten und Abnahme

1. **S0: Writer- und Rechteinventar.** Aktuellen Sleep-Screen/Service, `lib/sleepData.ts`, `lib/sleepNightSplit.ts`, Caretaker-RPCs, SQL/Trigger/RLS und native Stop-Einstiege prüfen. Keine Kommentare über historische „Dual-write“-Backends als Architekturbeleg nehmen: aktueller `BaseDataService` arbeitet mit Supabase, Secondary-Ergebnis ist Kompatibilität. Datenbankstand separat verifizieren, wenn read-only Zugang vorhanden ist.
2. **S1: Serverseitigen Vertrag lokal entwerfen und prüfen.** Nebenwirkungsfreier vollständiger Snapshot, Revision/Sessionvergleich, idempotenter bedingter Stopp mit Receipt, Berechtigungs- und Legacy-Gate. Echte konkurrierende DB-Transaktionen testen; Client-Mocks beweisen keine Atomarität.
3. **S2: Durable Pendingaktion + Overlay.** Sichere Ablage, Coldstart, lokaler Stopp, Widerruf/Logout und abgebrochene Writes. Core-Home-Korrekturen aus A zuerst oder begleitend umsetzen; alte Reads dürfen den Overlayzustand nicht zerstören.
4. **S3: Recovery + Konfliktdialog.** Wiederverbindung auch außerhalb des Sleep-Screens, eindeutige Entscheidungen, Version erneut prüfen, persistentes Später und einmalige Hinweise.
5. **S4: Partner-/Session-/Nativeintegration.** Gleichen Eintrag auf beiden Geräten, nachträgliche Korrektur, Nachtqualität, kurze Schläfe, Auto-Close, Pause/Split/Merge und Home/Widgets prüfen. Offene Teilwirkungen getrennt markieren.
6. **S5: Vollständige Fallmatrix und Geräteabnahme.** Bestehende Sleep-/Consent-/Auth-/Cleanup-Regressionen plus gezielte neue UI-/Journal-/RPC-Tests. Typechecks und Diff-Check. Zwei unabhängige Konten auf zwei installierten Geräten, Richtungen A→B und B→A; iOS und Android einschließlich gemischter Paarung prüfen. Keine produktiven Testduplikate oder produktive Regeln verändern.

Die frühere **4–7-Tage-Spanne deckt nur A** ab. Der Prüfbericht nennt für umfassenderen gemeinsamen Offline-Timer weitere 7–15 Personentage. Das jetzt engere Stop-/Konfliktpaket muss nach S0/S1 separat geschätzt werden: Serververtrag und Clientkompatibilität sind maßgebliche Kostentreiber. Die alte Spanne nicht als Gesamtbudget weiterverwenden. Eine serverseitige Grundlage ist für die gewünschte Garantie gerechtfertigt; ein breiter Offline-Umbau aller Funktionen folgt daraus nicht.

Pflichtnachweise zusätzlich zu A:

- Jede Zeile der Fallmatrix durch beobachtbare Tests oder begründete bewusste Blockierung abgedeckt; keine stillschweigend als erfolgreich markierte Ausnahme.
- Zwei gleichzeitig laufende serverseitige Transaktionen: eine veraltete Entscheidung verändert keine neue Version; doppelte `operationId` hat genau eine Wirkung.
- Verlust der Reply nach Commit; Neustart; Bestätigung anhand Receipt plus aktueller Version.
- Partner stoppt und startet neuen Schlaf: alter Offline-Stopp beendet den neuen Schlaf nicht.
- Gleichzeitige offline Stopps, Partneränderung während Dialog und strukturelle Nachtänderung.
- Gegenwärtige und ältere unterstützte Client-Schreibpfade können die Konfliktregeln nicht umgehen; sonst Feature-/Rolloutgate offen benennen.
- Auf beiden Geräten Sleep-Screen, Home und native Flächen getrennt prüfen. Server-Commit, Partner-App-Empfang und native Aktualisierung sind getrennte Abnahmen.
- Storage-/Logout-/Consent-Rennen: kein Wiedererscheinen oder unautorisierter Versand nach Bereinigung.

Solange Backendbereitstellung, Legacy-Kompatibilität oder Zwei-Geräte-Abnahme offen sind, **keinen fertigen Partner-Offlinemodus behaupten**. Lokale Implementierung, lokaler/QA-Serververtrag, Produktivbereitstellung und Geräteabnahme getrennt berichten.

## 7. Technische Quellen und konkrete Codebelege

Die technischen Architekturregeln sind Empfehlungen für dieses Projekt, keine Behauptung einer bereits vorhandenen Supabase-Offlinesynchronisation. Datenbankfunktionen ermöglichen serverseitige Vorgänge; dabei ist `security invoker` die bevorzugte Grundlage und Berechtigungen müssen ausdrücklich stimmen. [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)

Ein bedingtes `UPDATE` ändert nur passende Zeilen; null betroffene Zeilen sind nicht automatisch ein SQL-Fehler. Locks/Transaktionen sind Grundlage der Konkurrenzkontrolle und müssen gegen die tatsächlich verwendete Postgres-Version geprüft werden. [PostgreSQL UPDATE](https://www.postgresql.org/docs/current/sql-update.html), [PostgreSQL Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html)

Realtime liefert Datenbankänderungen an abonnierende Clients. Event-Payload, Autorisierung und DELETE-Verhalten haben eigene Grenzen; daraus folgt für dieses Projekt die Empfehlung, Ereignisse durch autorisierte Snapshot-Reads abzusichern. [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)

Repo-Einstiege: [Stop/Pause](/Users/janzeppenfeld/Developer/LottiBaby/app/(tabs)/sleep-tracker.tsx:2240), [Night-Quality](/Users/janzeppenfeld/Developer/LottiBaby/app/(tabs)/sleep-tracker.tsx:2077), [Split](/Users/janzeppenfeld/Developer/LottiBaby/app/(tabs)/sleep-tracker.tsx:2878), [Service-Updates](/Users/janzeppenfeld/Developer/LottiBaby/lib/services/SleepEntriesService.ts:165), [24h-Guard](/Users/janzeppenfeld/Developer/LottiBaby/lib/sleepEntryGuards.ts), [Night-Split-Helfer](/Users/janzeppenfeld/Developer/LottiBaby/lib/sleepNightSplit.ts), [Realtime](/Users/janzeppenfeld/Developer/LottiBaby/hooks/useSleepEntriesSync.ts). Zeilen vor Umsetzung am aktuellen Stand prüfen.

## 8. Aktualisierter Auftrag an den nächsten Agenten

```text
Bitte setze im aktuellen LottiBaby-Checkout Phase A plus das verbindliche
Schlaf-Paket S um. Lies zuerst vollständig:
/Users/janzeppenfeld/Developer/LottiBaby/docs/offline-umsetzungsplan-phase-a-20261008.md
/Users/janzeppenfeld/Developer/LottiBaby/docs/offline-partner-sync-plan-20261008.md

Die Partner-Sync-Ergänzung hat bei widersprüchlichen Schlafregeln Vorrang.
Unser Hauptfall sind kurze Funklöcher. Besonders wichtig sind ein dauerhaft
gesicherter Offline-Stopp mit ursprünglicher Endzeit, zuverlässiger späterer
Abgleich mit dem Partner und volle Kontrolle bei unterschiedlichen Ständen.
Vom Nutzer festgelegt: unveränderte Stopps automatisch abgleichen und kurz
bestätigen; bei Partneränderungen verpflichtend fragen, mit Später-Option.

Implementiere zuerst den sicheren Serververtrag lokal: vollständiger rein
lesender Snapshot, atomare Versionsprüfung, stabile Operation-ID und Receipt.
Dann Pendingaktion, lokalen Overlayzustand, Recovery und Konfliktdialog.
Partneränderungen, neue Schlaf-IDs, Pause/Fortsetzen, Split/Merge, Löschung,
verlorene Antworten, zwei Offline-Geräte, Consent-/Rechteänderungen und native
Flächen gemäß Pflichtmatrix prüfen. Eine alte Offlineaktion darf niemals einen
neu gestarteten Schlaf stoppen. Kein stilles Überschreiben oder allgemeiner
Schreib-Retry. Unbekannte Konflikte anhalten und verständlich zur Entscheidung
vorlegen. Reine Serveränderung und Empfang auf dem Partnergerät unterscheiden.

Für andere Funktionen bleibt der begrenzte A-Umfang mit geschützten Ansichten
und bewussten Entwurf-Saves; kein allgemeiner Sync-Umbau. Erhalte fremde Edits.
Prüfe alle tatsächlichen Sleep-Writer und ältere unterstützte Clients. Ohne
sicher bereitgestellten Serververtrag bleibt das neue Offline-Schreiben gated.

Nötige Migrationen/RPCs lokal vorbereiten und testen. Keine Produktionsmigration,
Produktionsänderung, EAS-Veröffentlichung, keinen Push oder Merge durchführen.
Führe relevante Regressionen, Typechecks, echte lokale DB-Konkurrenztests und
verfügbare Zwei-Geräte-Prüfungen aus. Schätze das zusätzliche S-Paket nach dem
Writer-/Rechteinventar; das bisherige A-Budget gilt nicht für den erweiterten
Gesamtumfang. Berichte lokale Umsetzung, Serverbereitstellung, Kompatibilität
und Geräteabnahme getrennt; offene Nachweise nicht als erledigt darstellen.
```
