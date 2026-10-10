# Offline-Erfassung: Schlaf und Unser Tag

Stand: 08.10.2026. Servermigration angewandt und EAS Update für iOS/Android veröffentlicht. Physische Geräteabnahme bleibt offen. Auslieferungsnachweis: [Offline-Tracking OTA](offline-tracking-ota-20261008.md).

## Verhalten

- Schlaf lässt sich aus dem lokalen Zustand starten und stoppen. Die Startschaltflächen warten nicht mehr auf einen erfolgreichen Serverabruf. Laufende lokale Timer werden nach einem Neustart wiederhergestellt.
- Manuelle Schlafeinträge und Nachtpausen warten nach lokaler Speicherung ebenfalls nicht auf Partnerabfragen, Servererinnerungen oder den Verlauf.
- Unser Tag speichert Stillen, Fläschchen, Beikost, Abpumpen, Wasser, Wickeln, Einträge vorhandener eigener Aktivitäten und Vitamin D lokal. Laufende Aktivitätstimer können offline beendet werden.
- Einträge zeigen „lokal gespeichert“; die Statusanzeige erklärt den automatischen Partnerabgleich. Das Formular schließt erst nach einer erfolgreichen dauerhaften Speicherung. Bei einem Speicherfehler bleibt die Eingabe erhalten.
- Der Abgleich läuft beim Öffnen der App, bei Rückkehr in den Vordergrund, nach erfolgreichem Serverkontakt und alle 15 Sekunden, während die App aktiv ist. Nach einer Verbindungsunterbrechung werden ausstehende Einträge erneut übertragen. Bei einer vom Betriebssystem angehaltenen App erfolgt der nächste Versuch beim Öffnen.
- Partneränderungen lösen eine sichtbare Entscheidung aus. Ein unveränderter Stop wird automatisch übernommen. Eine aktive Partnerschlafaufzeichnung wird durch einen konkurrierenden lokalen Start nicht beendet. Ein eigener abgeschlossener Schlaf kann ausdrücklich als Verlaufseintrag behalten werden.

Voraussetzung für Offline-Erfassung ist eine bereits angemeldete Sitzung mit lokal bekanntem Kind und gültiger Gesundheitsdateneinwilligung. Die Verwaltung neuer eigener Aktivitätsarten benötigt weiterhin eine Verbindung; deren vorhandene Arten werden lokal geladen.

## Speicherung und Abgleich

`lib/trackingOutbox.ts` schreibt ein dauerhaftes Journal, getrennt nach Backend, Konto und Kind. Jede Aktion erhält eine feste Operations-ID; neue Einträge behalten ihre UUID. Start, Stop und weitere Änderungen werden in Reihenfolge übertragen. Unbestätigte Aktionen verfallen nicht automatisch.

Die additive Migration `20261008183517_tracking_offline_outbox.sql` stellt `tracking_sync_operation` bereit. Eintrag, Vorratsänderung, Vorratsprotokoll und Empfangsbeleg werden in einer Datenbanktransaktion gespeichert. Eine verlorene Antwort wird mit unveränderter ID und Nutzlast wiederholt; dabei entstehen weder doppelte Einträge noch doppelte Vorratsabbuchungen. Der Beleg enthält die ursprünglich angewandte Version, auch wenn der Partner den Eintrag danach geändert hat.

Änderungen bestehender Einträge vergleichen deren `updated_at` atomar mit dem gespeicherten Ausgangsstand. Der Server prüft Konto, Gesundheitsdateneinwilligung, Kindzugriff und vorhandene RLS-Regeln. Das Journal wird bei Einwilligungsentzug, Kontowechsel/Logout und Verlust des Kindzugriffs über die bestehende lokale Bereinigung entfernt. Vor einem Logout warnt die App vor ausstehenden Einträgen. Empfangsbelege sind im Datenexport und in der Löschregistrierung berücksichtigt.

Frische erfolgreiche Serverantworten bleiben maßgeblich, auch wenn ein Eintrag inzwischen gelöscht wurde. Alte Empfangsbelege überschreiben keine neueren Serverstände. Lokale Aktionen werden in den Tages-, Wochen- und Monatsansichten eingeblendet.

Die neue Schlaf-Erfassung nutzt den aktuellen Standardpfad mit `EXPO_PUBLIC_SLEEP_OFFLINE_ENABLED` ungesetzt/false. Das frühere versionierte Schlaf-Paket S wird hierdurch weder aktiviert noch ersetzt; seine Aktivierung bleibt eine eigene Kompatibilitätsprüfung. Bestehende direkte Serverwriter bleiben zulässig. Ein Client mit aktiviertem Paket S benötigt gesonderte Abnahme und darf nicht als Abnahme dieses Standardpfads gelten.

## Lokale Prüfung

| Prüfung | Ergebnis |
| --- | --- |
| 22 betroffene Client-Testsuiten | 212 Tests bestanden |
| Neue Migration in temporärem PostgreSQL mit authentifizierten Rollen und RLS-Testschema | 7 Tests bestanden |
| App- und Test-TypeScript | bestanden |
| ESLint auf den betroffenen Dateien | keine Fehler; vorhandene und neue Hook-Hinweise separat im lokalen Protokoll |
| Expo-Export für iOS und Android | beide Bundles erstellt |
| `git diff --check` | bestanden |

Die Tests prüfen unter anderem Speicherung ohne Verbindung, App-Hydrierung, automatischen Wiederholungsversuch im Vordergrund, Reihenfolge von Start/Stop, verlorene Antworten, Partnerkonflikte, spätere Partneränderung/-löschung, Vorratsabbuchung genau einmal, Transaktionsrollback, Kontobindung und Einwilligungsentzug. Die PostgreSQL-Prüfung verwendet ein Testschema und bestätigt keine aktuelle Produktions-RLS.

## Auslieferung und Geräteabnahme

Die Zieltabellen, Defaults, Timestamp-Trigger, RLS und Grants wurden live geprüft. Der lokal angemeldete Supabase-CLI-Zugang besitzt Zugriff auf `kwniiyayhzgjfqjsjcfu`, obwohl der separate MCP-Connector den Zugriff verweigert. Die neue additive Migration wurde vor der Client-Auslieferung angewandt. Sie ergänzt die bisher fehlende Realtime-Publikation für `baby_care_entries` und einen Löschsperr-Trigger für die Empfangsbelege.

Tests gegen das tatsächliche Serverschema vor und nach der Migration prüfen alle Aktivitäten, Partneransicht und -stopp, aktive Schlafkonflikte, Versionskonflikte, Vitamin D, private Belege, fremde Konten und einmalige Vorratsabbuchung. Synthetische Nutzer und Einträge werden ausschließlich innerhalb vollständig zurückgerollter Transaktionen erstellt; ihre Abwesenheit wurde anschließend geprüft. Der REST-Endpunkt ist verfügbar und verweigert anonymen Zugriff. Bestehende Einwilligungs-/Löschfreigaben wurden nicht geändert; die Löschinventarfreigabe war und bleibt ausstehend.

Offen ist die physische Abnahme auf iOS und Android mit zwei Familiengeräten:

1. Flugmodus → Schlaf/Stilltimer starten → mehrere Aktivitäten/Vitamin D speichern → App beenden und öffnen → Timer und Einträge prüfen → Timer stoppen → Verbindung wiederherstellen → gleichen Verlauf beim Partner und einmalige Vorratsabbuchung prüfen.
2. Parallel einen Partnerschlaf starten bzw. einen gemeinsamen Eintrag ändern/löschen, bevor das Offline-Gerät zurückkehrt. Entscheidung anzeigen, keinen Partnerstand automatisch überschreiben und keinen gelöschten Eintrag durch einen Wiederholungsversuch neu anlegen.

Der vorhandene Kandidatenkanal erhält das OTA-Update mit Runtime `1.0.25`. Es wurde kein neuer nativer oder Store-Build, Commit oder Push erstellt. Die übrigen bereits vorhandenen Arbeitskopieänderungen bleiben erhalten.
