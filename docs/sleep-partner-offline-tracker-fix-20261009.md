# Partnerschlaf: Offline-Stopp und stehengebliebener Schlaftracker

Nutzerbefund: Ein online empfangener Partnerschlaf wird auf dem anderen Handy offline gestoppt. Nach dem Wiederverbinden verschwindet der Synchronisationshinweis, der geöffnete Schlaftracker des Partners läuft jedoch weiter. Startseite, Sperrbildschirm und Widget sind laut abschließender Klarstellung nicht betroffen.

Die konkrete Lücke im bisherigen Tracker ist im Regressionstest reproduziert: Ohne Realtime-Ereignis, erneuten Channel-Join oder Wechsel von Fokus/AppState erfolgt kein weiterer Serverabgleich. Ein bereits beendeter Schlaf bleibt dadurch als aktiver Timer sichtbar. Die tatsächliche Ursache einer verpassten Meldung auf den beiden Handys wurde nicht gemessen.

`useSleepEntriesSync` prüft jetzt im geöffneten Tracker alle 15 Sekunden ausschließlich `id,end_time` des angezeigten aktiven Eintrags. Ein erfolgreich bestätigtes Ende oder ein nicht mehr zugänglicher/gelöschter Eintrag löst den bestehenden autorisierten Snapshot-Loader aus. Der Probeinhalt ersetzt keine Bildschirmdaten. Unveränderte Einträge und fehlgeschlagene Prüfungen lösen keinen History-Reload aus. Die Prüfung hat acht Sekunden Zeitlimit, läuft nicht parallel zu weiteren Prüfungen oder einem Snapshot-Reload und wird im Hintergrund beziehungsweise beim Verlassen des Trackers abgebrochen. Ergebnisse für einen inzwischen anderen Timer werden verworfen.

Nachweise vom 09.10.2026:

- Die neu ergänzten Tests für einen ausbleibenden Partner-Stopp-/DELETE-Event schlagen vor der Korrektur fehl und bestehen danach.
- 108 Jest-Tests in sechs fokussierten Suiten bestanden, einschließlich Tracker, Realtime, Outbox und Offline-Recovery.
- Acht Tests mit lokalem PostgreSQL bestanden. Der neue Zwei-Konten-Test startet den Schlaf mit Konto A, liest und stoppt denselben Eintrag als Konto B mit dessen beobachteter Version und ursprünglicher Endzeit und bestätigt das Ende wieder als Konto A. Eine Wiederholung mit derselben Operation bleibt idempotent.
- App- und Test-TypeScript-Prüfung bestanden. Hook und Hook-Tests: ESLint ohne Fehler oder Warnungen. Der bestehende Tracker hat 47 Warnungen und keine Lintfehler. `git diff --check` bestanden.
- Der aktuelle Produktionskatalog wurde ausschließlich lesend geprüft; der Tracking-RPC ist vorhanden. Es wurden keine Produktions-Facheinträge gelesen oder verändert.

Die Korrektur wurde anschließend auf Nutzerauftrag per [EAS Update für iOS und Android](sleep-partner-offline-tracker-ota-20261009.md) veröffentlicht. Keine Servermigration oder Änderung der Schlaf-Paket-S-Freigabe ausgeführt. Installation und erneute Abnahme des beschriebenen Ablaufs auf zwei Handys stehen aus.
