# Auftrag 7: Entscheidungsvorlage, 28.09.2026

> Fortschreibung vom 29.09.2026: [aktueller QA- und Release-Stand](../release-readiness-20260929.md). Die Apple-Rangfolge ist inzwischen nach Nutzerfreigabe korrigiert; die damalige gemeinsame Freigabe wird dadurch nicht automatisch erteilt.

Status: vorbereitet, keine Umfangsentscheidung und keine Produktionsfreigabe.

## Releaseumfang

Empfehlung: gemeinsames Release als Arbeitsziel beibehalten. Eine getrennte Familien-/Paywall-Auslieferung ist technisch möglich, spart aber nur die Aktivierung der neuen Löschverarbeitung; sie ersetzt keinen funktionierenden betreuten Löschbetrieb.

| Variante | Konkrete erforderliche Umsetzung und Abnahme | Risiko / Freigabe |
| --- | --- | --- |
| Gemeinsam (bisheriger Auftrag) | Paywall-/Gerätefälle plus Inventar, Fristen, OTP, Anbieter, CDN, Alarm und isolierter Restore abschließen. Finale Inventarfreigabe nach Familienmigration. | Aktuell blockiert. Aufträge 5/6 unverändert gültig, nicht freigegeben. |
| Getrennte Familie/Paywall | `deletion_private.blocked()` und ausschließlich Service-Role-RPC `account_deletion_worker('blocked', …)` samt Privilegien/Alt-Token-Sperre beibehalten. Request/Worker-Flag false und Scheduler inaktiv. App-Route `account-deletion` vor OTP-Anforderung auf betreuten Supportweg umstellen; Profil/Einstellungen/DSGVO und Deep Links müssen denselben Einstieg benutzen. Datenreset darf keine funktionslose Bestätigung anbieten. Öffentliche DE/EN/ES-Texte entsprechend angleichen. Betreuten Prozess mit Wegwerfkonto tatsächlich durchspielen. | Keine Umsetzung/Freigabe dieser Variante erfolgt. Die vollständige Migration ersetzt `delete_user_data` durch einen Verweis; bloß Flag=false ist deshalb kein betriebsfähiger Ersatz. Für getrennte Auslieferung entweder Migration gezielt zerlegen und testen oder betreuten Operatorweg vollständig betreiben. |

Codebefund: Der `blocked`-Zweig wird vor Fingerprint-/Fristenprüfung abgearbeitet. Er benötigt keine aktivierte Lösch-Function. Abnahmekriterien für Variante getrennt: Familienendpunkt/Sperrprüfung mit ungesetzten Fristen, ausgeschaltetem Worker, bestätigtem Entzug und fünfminütiger Lease; alter Client/RPC; neue App ohne OTP-Sackgasse; dokumentierter tatsächlicher Supportabschluss. Erst nach ausdrücklicher Umfangsentscheidung Aufträge 5/6 umschreiben.

## Offene Datenklassen: empfohlene Behandlung

Keine Regeländerung oder Entfernung eines Haltefalls ohne Entscheidung und synthetische Positiv-/Negativprobe.

| Klasse | Empfehlung und benötigter Nachweis |
| --- | --- |
| Globale `baby_recipes` | Nur tatsächlich redaktionell übernommene, auf personenbezogene Angaben/Medien geprüfte Inhalte auf ein bestehendes legitimes Redaktionskonto übertragen. Sonst eigene Rezepte entfernen. Keine pauschale Übertragung oder Löschung aller globalen Rezepte. Autoren-FK ist CASCADE: vor Auth-Löschung prüfen. |
| Geteilte Babys/Gruppen | Berechtigte Nachfolge einzeln dokumentieren, eigene/andere Beiträge und Medien trennen, Eigentum atomar übertragen oder gemeinsames Objekt nach Entscheidung löschen. Kein automatischer Entzug fremder Daten. |
| `content_reports`/Antwort-Snapshots | Offene Moderationsverfahren gesondert begründet aufbewahren, Identitäts-/Text-/Medienkopien minimieren und Enddatum nennen. Abgeschlossene Fälle nach beschlossener Frist redigieren/löschen. FK-SET-NULL allein anonymisiert keinen Snapshot. |
| `account_links_audit_log` | `changed_by` UND `old_data`/`new_data` prüfen; IDs, Einladungsdaten und freie Inhalte entfernen oder begründeten minimalen Beleg befristet getrennt erhalten. JSON-UUID-Suche findet keine E-Mail-/Namenskopie zuverlässig. |
| Admin-/Subscription-Audit | Konfigurationsänderung ohne Personenbezug erhalten; Akteursidentität und freie JSON-Inhalte redigieren nach Betreiberentscheidung. RESTRICT-FK `subscription_policy_audit.changed_by` vor Auth-Löschung lösen. |
| Medien-/JSON-Kopien | Jede URL/Pfadreferenz, Eigentümerschaft und weiterverwendete Kopie prüfen. Historische Uploads ohne Zuordnung bleiben separate Inventaraufgabe; keine Löschung anhand Namensfragmenten. |

## Betreiberentscheidungen

- Belege: 365 Tage ist nur ein Vorschlag aus Auftrag 4, keine Rechtsfrist. Empfehlung: minimale Inhalte und kürzeste betrieblich begründbare Dauer beschließen; Person/Rolle, Datum und Begründung festhalten.
- Backups: bisher acht sichtbare tägliche Snapshots, PITR aus. 8 Tage nur vorläufige Untergrenze; Offsite-Exporte, Logs, Replikate und tatsächlicher Ablauf müssen einzeln erfasst werden. Kein pauschaler Acht-Tage-Abschluss.
- Betrieb: benannter Hauptverantwortlicher und Vertretung; täglich `needs_attention` und überfällige Provideraufgaben, festgelegte Reaktionszeit. Alarmkanal braucht Empfangsbestätigung für positive Testereignisse; Nullabfrage genügt nicht.
- Restore: separates temporäres Supabase-Ziel (Kosten vor Anlage bestätigen) oder ein vom Betreiber bereitgestelltes isoliertes PostgreSQL-/Storage-Ziel. Register außerhalb dieses Ziels geschützt sichern. Familien-QA nicht überschreiben. Lokaler SQL-Test ist kein realer Backup-Restore.
- Öffentliche Texte DE/EN/ES müssen beschlossene Werte nennen; bis dahin keine erfundenen Zahlen veröffentlichen. Entwurf: „Nach Abschluss informieren wir dich über die entfernten Daten und über begründete Restaufbewahrung mit Zweck und Enddatum.“ / “After completion, we tell you which data was removed and explain any remaining retention, its purpose and end date.” / “Al finalizar, te informamos de los datos eliminados y de cualquier conservación restante, su finalidad y fecha de fin.”

## Einzelentscheidungen für fehlende Storefälle

| Fall | Ersatznachweis und Grenze | Risiko bei Annahme | Erforderlicher echter Test |
| --- | --- | --- | --- |
| G01 | Ownership-Filter `family_shared`; kein Gerät in Apple-Familie | Bestandsfamilien können Zugang verlieren oder falsch klassifiziert werden | Apple-Käufer + Apple-Familienmitglied, auch Alt-App |
| G02 | A→D eigener Apple-Kauf/API/KI belegt; Apple-B fehlt | Parallelbezug Apple-Familie/Android ungeprüft | A mit Apple-B und verknüpftem Android-Partner gleichzeitig |
| G03 | Ein-Hop-/Ownership-Tests; keine reale Apple-Familie | Unbeabsichtigte Weitergabe oder Ablehnung | Apple-B als Einladender, eigenes Abo ausgeschlossen |
| G04 Varianten | Premium monatlich in beiden Richtungen; zusätzlich Android Lite jährlich/monatlich und Premium jährlich D→A echt, Premium-API403 für beide | Übrige Lite/Standard/Jahreskombinationen ungeprüft | Je Tarif/Laufzeit kostenloser nativer Sandbox-Kauf; letztes iPhone-B-Paywallbild |
| G05 | Synthetische Priorität eigenes Abo/Familie | Falscher höherer Tarif oder Verlust eigenen Zugangs | Zwei gleichzeitige eigene Sandbox-Abos im Paar |
| G06 Refund/Grace | Android Lite monatlich: echte Grace, Hold/Billing Retry, Erholung sowie Refund+Revoke mit API/Webhooks und D-Paywall | Kurze Partnerlücke vor Grace-Nachweis; Refund-Entzug A nach ca44,5s, D erst spätere Statusprüfung; Apple ungeprüft | Apple-Refund/Grace/Retry und gesonderte Bewertung der gemessenen Verzögerungen |
| G07 aktiv/iPhone | Android D→C→D sowie aktive Lite-Trennung D→A nativ/API; eigenes D-Abo bleibt, A→Paywall nach Kontowechsel | iOS-Identität und laufende iPhone-Reaktion noch ungeprüft | iPhone-Kontowechsel/aktiver Entzug, verspätete Antwort |
| G08 neuer Fix | Android12 installiert, eigener Lite-Kauf >5 min mit Offline-/Routen-/Vordergrundwechsel; kalter Offline-Fehler sichtbar | Lite- und Premium-Partner-Lease offline abgelaufen, native KI gesperrt; zusätzlicher Refresh-/Kontowechselfehler lokal korrigiert, neuer Build nötig | Neue Builds: Tastatur/Back/Retry und A→B→A mit Netzunterbrechung; isolierte Nativeinzelfehler bleiben offen |
| G09 Renewal | Echter verspäteter Webhook und Cron; ca.42s am26.09. und erneut ca.40s am28.09. mit nativer Partner-Paywall | Reale kurze Partner-Unterbrechung mit Paywall/KI-Sperre möglich | Kostenloser Renewal, API/Webhook/Cron-Timestamps; keine erfundene Laufzeit |
| G10 Alt-App | RPC-/Einladungskompatibilität lokal | Alte App reagiert auf neues Backend anders | QA-gebundener alter Quellstand mit gleichem Vertrag |
| Restore | SDK-/Backendtests; Android D→A→D und nativer datenbewahrender Restore mit aktivem Lite belegt; kein Datenverlust-Gerätebeleg | Storezuordnung/Cache-Wiederherstellung fehlerhaft | Zweites Testgerät oder datenbewahrender Restore; keine Samsung-Datenlöschung |

Jede Risikoannahme braucht Fall-ID, entscheidende Person, Datum und ausdrücklich akzeptierte Auswirkung. Keine pauschale Freigabe aus Unit-Tests.
