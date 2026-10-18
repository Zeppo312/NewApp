# Gezielte QA-Audit- und OTP-Bereinigung – 02.10.2026

Dieser Einzelauftrag betrifft ausschließlich die vorbereiteten 18 Supabase-Auth-Auditzeilen und drei exakt zugeordnete OTP-Testmails. Der bestehende QA-Auftrag B `6434ecdb-7d04-482d-a709-fd991932c142` bleibt angehalten in `needs_attention` / `providers`. Keine Geräte-, Kontolösch-, Restore-/Replay- oder Register-Neustartprüfung wurde wiederholt. Keine Produktion, Anbieterstatusauflösung, Nachricht, neue Identität, Projekt, Build, Tarif oder kostenpflichtige Leistung wurde ausgelöst.

## Audit: exakt 18 aktive QA-Kopien entfernt

Die dokumentierte Behandlung im [Supabase-Dossier](deletion-provider-supabase-review-20261001.md#konkrete-vorbereitete-auditaktion) sieht bei beauftragter Bereinigung die Entfernung dieser QA-Auditkopien vor, sofern keine konkrete Aufbewahrungsausnahme besteht. Eine solche Ausnahme ist in den geprüften Unterlagen nicht dokumentiert. Die 90-Tage-Frist für minimale abgeschlossene Belege verlangt keine Aufbewahrung dieser vollständigen Authprotokolle. Der ausdrückliche Einzelauftrag vom 02.10.2026 erlaubt genau diese Behandlung.

Der aktuelle Management-Zugang bestätigte das vorhandene QA-Projekt `ggyonianphloycmqrwvj`, Branch `917136d3-49fb-463b-9026-30e62b9533a5` / `family-subscription-qa`, Parent `kwniiyayhzgjfqjsjcfu` und Organisation `xqbmotyjxjdeqoisbgow`. Die vorhandene Enable-Secret-Prüfung entspricht `false`. Einstellungen bleiben `unapproved`, Freigaben und Fristen `NULL`; Workercron aus, Alarmcron an. Der Supabase-Connector verweigerte den Projektzugriff; der bereits authentifizierte lokale Management-Zugang funktionierte ohne neue Berechtigungen oder Zugangsdaten.

Alle 18 vorbereiteten IDs wurden frisch nach exakter Kontozuordnung und vollständigem Zeilen-SHA-256 geprüft. Die tatsächliche Transaktion wurde neu aus dem erhaltenen ROLLBACK-Entwurf vorbereitet: zusätzliche Bindung an den frischen Digest/Bestand der **553 fremden Auditzeilen** und an Anzahl/Digest von **129 anderen QA-Relationen**, einschließlich Auth, Profile, eigener und geteilter App-Inhalte, Auftrags-/Anbieter-/Registerdaten, Storage und Cron. Vor und nach dem DELETE werden die Schutzbedingungen in derselben serialisierbaren Transaktion geprüft; einziges DELETE-Ziel ist `auth.audit_log_entries` mit den 18 exakten IDs und Hashes.

Der erste Ausführungsversuch brach **vor dem DELETE** ab, weil `public.lotti_subscription_entitlements` seit dem Vorvergleich unabhängig geändert wurde. Dieser Abbruch und seine Vorbereitung bleiben unter `audit-attempt-1/` erhalten. Nach neuer lesender Vorbereitung und weiterhin unveränderten 18 Zielhashes wurde der zweite Lauf erfolgreich committed. Der ursprüngliche Entwurf wurde nicht geändert.

| Frische Vorher-/Nachherprüfung | Ergebnis |
| --- | --- |
| 18 gebundene Audit-IDs / exakte Kontozuordnung | Vorher 18 unverändert; nachher 0 |
| Alle übrigen Auditzeilen | 553 erhalten; Digest und alle einzelnen Vollzeilenhashes unverändert |
| Weitere geschützte QA-Relationen | 129; sämtliche Anzahlen und Digests unverändert im erfolgreichen Lauf und im separaten Nachvergleich |
| Auftrag und zwölf Anbieterzeilen | Unverändert; zehn `pending`, RevenueCat aktiv `completed`, Apple-Anmeldewiderruf `not_applicable` |
| Register und ursprüngliche Worker-/Geräte-/Restorebelege | Unveränderte SHA-256 und vorhandene Rechte; kein Writer-/Ack-/Replay-Aufruf |
| Laufzeit | QA aus / `unapproved`; Worker aus, Alarm an; keine Lease |

Nachweise: [frischer Vorvergleich](../../output/deletion-targeted-cleanup-20261002/audit-before.json), [neues bewachtes SQL](../../output/deletion-targeted-cleanup-20261002/audit-execution.sql), [Quell-/Ausführungsmanifest](../../output/deletion-targeted-cleanup-20261002/audit-execution-manifest.json), [Ausführung](../../output/deletion-targeted-cleanup-20261002/audit-execution-result.json), [separater Nachvergleich](../../output/deletion-targeted-cleanup-20261002/audit-after.json), [Verifikation](../../output/deletion-targeted-cleanup-20261002/audit-verification.json), [Erhalt vorher](../../output/deletion-targeted-cleanup-20261002/preservation-before.json), [Erhalt nachher](../../output/deletion-targeted-cleanup-20261002/preservation-after.json).

## OTP-Mails: drei bestätigte Testmails endgültig entfernt

Das erhaltene Webmail ist frisch als `support@lottibaby.de` angemeldet. Der verbundene Hostinger-Mail-API-Zugang umfasst dagegen ausschließlich `business@zeppi.eu`; er gewährt keinen Zugriff auf das Supportpostfach. Es wurde weder ein Schlüssel angefordert noch eine Berechtigung erweitert. Die Bearbeitung erfolgt daher im bereits zugänglichen Support-Webmail.

| Ursprüngliches Ziel | Frisch bestätigter Ordner / UID | Message-ID | RFC822-Datum UTC | Empfänger |
| --- | --- | --- | --- | --- |
| INBOX 111 | INBOX.Trash 75 | `<4hw0P3349jz30Vl@fr-int-smtpout27.hostinger.io>` | 30.09.2026 16:09:43 | `support@lottibaby.de` |
| INBOX 114 | INBOX.Trash 76 | `<4hwWxb69bmz30Tm@fr-int-smtpout27.hostinger.io>` | 01.10.2026 12:51:15 | `support@lottibaby.de` |
| INBOX 116 | INBOX.Trash 66, bereits vor diesem Lauf dort | `<4hwXnk0bRgzyyY@fr-int-smtpout11.hostinger.io>` | 01.10.2026 13:29:30 | `support@lottibaby.de` |

Ordner, Message-ID, Datum, To und Delivered-To wurden frisch aus den Originalheadern verglichen. Der leere Originalaufruf für INBOX 116 wurde nicht als Löschbeleg gewertet: dieselbe Nachricht wurde anhand aller Merkmale im Papierkorb wiedergefunden. UIDVALIDITY wird nicht angezeigt; UIDs allein begründen keine Auswahl. Inhalte, Magic Links oder OTPs wurden nicht gespeichert.

Die zwei frisch bestätigten Posteingangsnachrichten wurden gezielt in den Papierkorb verschoben und dort erneut über Originalheader zugeordnet. Die dritte lag bereits dort. **39 andere sichtbare Posteingangszeilen und 12 andere sichtbare Papierkorbzeilen bleiben erhalten**, einschließlich Alarmmails. Beide Listen umfassen eine angezeigte Seite (1/1). Die frische exakte Message-ID-Suche im verbundenen Gmail mit `in:anywhere` enthält null Treffer; sie schließt andere Postfächer oder historische Weiterleitungen nicht aus.

Nach der vom Browser-Werkzeug verlangten unmittelbaren Bestätigung durch Jan ("Ja, genau diese drei endgültig löschen") wurde die Auswahl der exakt drei UIDs nochmals geprüft und ausschließlich diese Auswahl endgültig gelöscht. Die frisch geladenen Ordnerlisten vom 02.10.2026 06:54 UTC zeigen null verbleibende Zielmails: INBOX ohne 111/114/116, Papierkorb ohne 75/76/66. Die 39 anderen Posteingangszeilen und zwölf anderen Papierkorbzeilen sind identisch erhalten, einschließlich Alarmmails. Das Postfach besteht weiter; der übrige Papierkorb wurde nicht geleert. Der Zwischennachweis vor der Bestätigung bleibt separat erhalten.

Nachweise: [Header-Vorprüfung und Ordnerlisten](../../output/deletion-targeted-cleanup-20261002/mail-before.json), [bestätigte Papierkorbzuordnung](../../output/deletion-targeted-cleanup-20261002/mail-staged.json), [konkrete Auswahl](../../output/deletion-targeted-cleanup-20261002/mail-three-selected.png), [Ausführung nach Bestätigung](../../output/deletion-targeted-cleanup-20261002/mail-execution.json), [frische Nachprüfung](../../output/deletion-targeted-cleanup-20261002/mail-after.json), [Nachheransicht](../../output/deletion-targeted-cleanup-20261002/mail-after.png), [Zugangs-/Abfragelimitierungen](../../output/deletion-targeted-cleanup-20261002/read-errors.json).

## Restbedingungen und Aufgaben

- [x] 18 aktive Auditkopien gezielt entfernt und separat nachgeprüft; fremde Zeilen und QA-Zustand erhalten.
- [x] Drei Mails nach aktuellen Originalheadern zugeordnet; alle drei als konkrete Papierkorbziele geprüft; übrige Listen erhalten.
- [x] Nach der erforderlichen Browserbestätigung genau diese drei Papierkorbziele endgültig entfernt; frische Abwesenheit und Erhalt aller übrigen sichtbaren Ordnerzeilen belegt.
- [ ] Supabase externe/interne Logs und betroffene Backups unabhängig offen halten. Die vorher belegten Backupkandidaten `1831779519` und `1841321535` werden durch Tabellenbereinigung nicht physisch gelöscht; in diesem begrenzten Auftrag wurde kein Backupkatalog erneut geprüft.
- [ ] Hostinger-interne Archive/Backups und unbekannte manuelle, lokale oder historische Weiterleitungen unabhängig offen halten. Eine Papierkorbfrist ist keine garantierte Kopien-Löschfrist.

`external_logs`, `backups` und `support_mail` bleiben unverändert `pending`. Kein Gesamtabschluss und keine automatische Belegbereinigung. Das frühere Produktionsinventar und seine zusätzlichen Voraussetzungen bleiben eine eigene, hier nicht beauftragte Aufgabe; QA-Erfolg erteilt keine Produktionsfreigabe. Ein Prüftermin ist lediglich eine Wiedervorlage, keine garantierte Löschfrist. Die ursprünglichen sechs Eingangsdokumente wurden separat als [Vorstand](../../output/deletion-targeted-cleanup-20261002/input-manifest.json) gesichert; ursprüngliche Testbelege und unabhängiges Register wurden nicht überschrieben.
