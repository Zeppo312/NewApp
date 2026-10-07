# Play-Datensicherheit · Antwortentwurf

**Nicht importieren oder absenden.** Die Tabelle ist eine Arbeitsgrundlage, kein ausgefülltes Formular. Grundlage: [Dateninventar](dateninventar.md). Für das spätere Formular zählt der gesamte aktive Android-Funktionsumfang einschließlich SDKs und eigener Shop-WebView.

„Erhoben“ umfasst Daten, die das Gerät verlassen, auch bei Verarbeitung durch Dienstleister. „Weitergegeben“ hat bei Google Ausnahmen etwa für Auftragsverarbeitung und erwartete, vom Nutzer ausgelöste Freigaben. Keine dieser Ausnahmen allein aus einem SDK-Namen ableiten. Kurzfristige Verarbeitung muss ebenfalls im Formular geprüft werden; `store:false` reicht als Nachweis für ausschließlich flüchtige Verarbeitung nicht. [Google-Definitionen](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).

## Grundfragen

| Frage | Vorgeschlagene Antwort / Stand |
| --- | --- |
| Werden relevante Nutzerdaten erhoben? | **Ja, BELEGT.** Supabase, Gesundheitsdaten, Fotos und weitere Flüsse |
| Werden Daten weitergegeben? | **OFFEN:** Empfänger sind belegt; Anwendung der Dienstleister-/Nutzeraktionsausnahme und externe SDK-/Shopintegrationen noch bestätigen. Nicht global „Nein“ wählen |
| Alle übertragenen Nutzerdaten verschlüsselt? | **ENTWURF Ja für geprüfte HTTPS-Pfade**; endgültige Gesamtaussage erst nach Release-Netzwerkprüfung einschließlich WebView, Remote-Inhalten und SDKs. Keine E2E-Zusage |
| Kontoerstellung? | **Ja. E-Mail/Passwort** im Android-Login. Apple-Anmeldung ist plattformabhängig und darf nicht automatisch als Android-Loginoption ausgewählt werden. Tatsächliche weiteren OAuth-/OTP-Pfade im Release prüfen |
| Kontolöschung möglich? | In-App-Aufruf vorhanden. Externe Lösch-URL und vollständiger Ablauf **OFFEN**, siehe Löschdokument. App-Code allein genügt nicht für „vollständig geprüft“ |
| Daten ohne Kontolöschung löschbar? | Einstellung „Nur Daten löschen“ vorhanden; Umfang/Restdaten **OFFEN-TECHNIK** |
| Unabhängige Sicherheitsprüfung / Zertifizierung? | Keine belegt; keine solche Prüfung bestätigen |

## Datentypen und Zwecke

Zwecknamen: **Funktion** = App functionality, **Konto** = Account management, **Analyse** = Analytics, **Personalisierung**, **Sicherheit** = Fraud prevention/security/compliance, **Kommunikation** = Developer communications. Die Zwecke der Weitergabe müssen separat aus dem tatsächlichen Empfängerzweck abgeleitet werden.

Spalte „Weitergabe“: **P** = Dienstleisterausnahme erst nach Bestätigung; **U** = Nutzerfreigabeausnahme erst nach Nachweis verständlicher Nutzeraktion; **W** = Website-/Anbieterkonfiguration offen. Bis dahin keine abschließende Ja/Nein-Eingabe. Für jeden Datentyp alle Empfänger berücksichtigen.

| Play-Datentyp | Erhoben / Beispiele | Pflicht oder optional | Flüchtig? | Zwecke, Entwurf | Weitergabe |
| --- | --- | --- | --- | --- | --- |
| Personenbezogene Daten → Name | Ja: Elternvorname, Babyname; Shopname | Elternvorname im Onboarding erforderlich; Babyname/Shop nur je Pfad. Gesamttyp voraussichtlich erforderlich | Nein | Funktion, Konto, Personalisierung; Shopabwicklung | P/U/W |
| E-Mail-Adresse | Ja: Auth und Support, Shop | Für persönliches Hauptkonto erforderlich | Nein | Konto, Funktion, Kommunikation, Sicherheit | P/W |
| Nutzer-IDs | Ja: Supabase-ID, RC-AppUserID, pseudonymer Fehlerhash | Erforderlich | Nein | Konto, Funktion, Analyse, Sicherheit | P |
| Adresse | Shop-Rechnungs-/Lieferadresse laut Website; App-Termine enthalten Orte | Optional beim Kauf; Checkoutfelder im Android-WebView bestätigen | Nein | Funktion | P/W |
| Telefonnummer | Checkout-/Supportfeld möglicherweise vorhanden; kein belegter nativer Telefonbuchzugriff | **OFFEN**, Feld und Pflichtgrad im WebView prüfen | OFFEN | Funktion/Konto nur falls tatsächlich erhoben | P/W |
| Sonstige personenbezogene Daten | Ja: Geburts-/Entbindungstermin, Familienrolle, Geschlechtsangaben, Vorlieben; gesundheitsbezogene Inhalte zusätzlich unten | Datum je Onboardingpfad erforderlich; übrige Angaben je Eingabe optional | Nein | Funktion, Personalisierung | P/U |
| Gesundheit und Fitness → Gesundheitsdaten | Ja: Schlaf, Ernährung, Ausscheidungen, Wachstum, Zyklus, Schwangerschaft/Wehen, Check-ins, Arztfragen, Vitamin D; KI-Kontext | Hauptfunktion/Onboarding benötigt entsprechende Daten: konservativer Entwurf **erforderlich**; einzelne Tracker optional. Nicht den gesamten Datentyp als optional erklären, nur weil einzelne Felder leer bleiben können | Nein; auch KI-Logs/Anbieterfristen prüfen | Funktion, Personalisierung | P/U |
| Fitnessdaten | Keine aktive Schritte-/Workout-Erhebung belegt. Gewicht ist hier als Gesundheitsdatum eingeordnet | Nicht wählen ohne tatsächlichen zusätzlichen Fitnesspfad | — | — | — |
| Standort → ungefähr | Ja: Stadt/PLZ, gerundete Koordinaten für Fürsorge-Wetter; ggf. IP-abgeleiteter Ort bei Webdiensten | App-Wetter optional; weitere automatische SDK-/Shopzwecke offen | Anbieterfristen offen; keine neuen Standort-Uploads für den stillgelegten täglichen Job | Funktion, Personalisierung; weitere Zwecke offen | P/W |
| Standort → präzise | Ja: ungerundete Koordinaten in Wetteraufrufen | Standortpfad optional, manuelle Ortseingabe vorhanden | **OFFEN**, Anbieterlogs nicht geprüft; nicht als flüchtig voraussetzen | Funktion, Personalisierung | P/W |
| Nachrichten → sonstige In-App-Nachrichten | Ja: KI-Fragen/Historie; Direkt-/Gruppenchat im aktuellen Release deaktiviert | Optional | KI nicht als sicher flüchtig belegt | Funktion, Sicherheit bei Meldung/Moderation | P/U |
| Nachrichten → E-Mails | Supporttext wird an Mail-App übergeben und bei Versand empfangen; kein Postfachlesen | Optional; an erwartete Nutzeraktion gebunden | Nein beim Supportempfänger | Kommunikation, Funktion | P/U |
| Fotos und Videos → Fotos | Ja: ausgewählte Fotos und Uploads | Optional | Nein | Funktion | P/U |
| Videos | Kein allgemeiner Nutzer-Video-Upload belegt; Replay-Integration im neuen Code entfernt, beide Raten null | Nicht allein wegen eingebetteter YouTube-Videos auswählen; im finalen AAB prüfen | — | — | — |
| Audiodateien → Sprach-/Tonaufnahmen | Ja: KI-Spracheingabe; Chats deaktiviert | Optional | KI-Audiofristen offen | Funktion | P/U |
| Dateien und Dokumente | Erzeugte PDF-/JSON-Exporte werden lokal gespeichert und auf Wunsch geteilt; Shopdatei-Uploads nicht belegt | Optional | Exportdatei lokal, Empfänger kann speichern | Funktion; Nutzerexport auf Ausnahme prüfen | U/W |
| Kalender | Ja: App-Termininhalt in Backend; ausgewählter Systemkalender erhält Einträge. Kein belegter Vollupload fremder Termine | Optional | Nein | Funktion | P/U |
| App-Aktivität → sonstige nutzergenerierte Inhalte | Ja: Tagebuch, Listen, Arzt-/Planernotizen, Karten-/Produktangaben, Support-/Moderationsinhalte, Shop-Personalisierung | Optional | Nein | Funktion, Personalisierung, Sicherheit | P/U/W |
| App-Aktivität → App-Interaktionen | Ja: Sentry-Breadcrumbs; Replays im neuen Code deaktiviert; KI-Nutzungsmetadaten, ggf. Shopaktivität | Diagnose ohne gefundenen Opt-out: erforderlich; Shop zusätzlich prüfen | Nein | Analyse; Funktion/Sicherheit für Quoten | P/W |
| App-Aktivität → In-App-Suchverlauf | Fragen/Suchbegriffe/Barcode-Lookups verlassen je Funktion das Gerät; ggf. Shop-Suche | Optional; getrennte Suchprotokolle/Anbieterlogs **OFFEN** | OFFEN | Funktion; Shopanalyse falls belegt | P/W |
| Finanzinformationen → bisherige Käufe | Ja bei aktivem RC/Play; Shopbestellungen | RC prüft Zugang automatisch: Entwurf erforderlich; Shopkäufe optional | Nein | Funktion, Analyse bei RC; Konto/Abwicklung im Shop | P/W |
| Finanzinformationen → Zahlungsinformationen | Kein Karteneingabe-Upload im nativen Abo-Code belegt; eigener Shop-Checkout verarbeitet Zahlungsangaben über Zahlungsanbieter | **OFFEN:** tatsächlichen eingebetteten Checkout prüfen; nicht allein wegen Google Play „Nein“ wählen | Anbieterfristen offen | Funktion, Sicherheit | P/W |
| App-Informationen und Leistung → Absturzprotokolle | Ja: Sentry | Erforderlich, kein Opt-out im Init gefunden | Nein | Analyse | P |
| Diagnose / sonstige App-Leistungsdaten | Ja: Geräte-/Versions-/Fehlerkontext; weitere native Messdaten prüfen | Erforderlich bei aktivem SDK | Nein | Analyse, Funktion | P |
| Geräte- oder andere IDs | Push-Token und technische SDK-/Installationskennungen; install-referrer-Komponente im Merge | Teilweise Push optional, SDK-IDs potenziell erforderlich; vor globaler Auswahl finalisieren | Nein | Funktion, Analyse/Sicherheit soweit belegt | P/W |
| Kontakte, SMS/MMS, Web-Browserverlauf | Kein Telefonbuch-/SMS-Upload oder Zugriff auf externen Browserverlauf gefunden | Vorläufig nicht auswählen. Eigene WebView-Interaktionen sind gesondert oben erfasst | — | — | — |

Ein Datentyp mit einem automatischen Pflichtpfad darf nicht allein wegen einer optionalen anderen Funktion als „optional“ markiert werden. Authentifizierungsgeheimnisse gehören zur Erklärung der Kontoerstellung und Verarbeitung, nicht in erfundene Play-Datentypen.

RevenueCat beschreibt Kaufhistorie als nicht flüchtige, erforderliche Erhebung für Funktion und Analyse. Die eigene AppUserID und aktivierte Integrationen ergänzen den app-spezifischen Befund. [RevenueCat-Deklarationshilfe](https://www.revenuecat.com/docs/platform-resources/google-platform-resources/google-plays-data-safety).

## Vor der finalen Auswahl

1. Verantwortliche Person bestätigt Empfängerliste, Dienstleisterrollen, tatsächliche Zwecke und Dashboardintegrationen. Auch serverseitige Weiterleitungen zählen.
2. Release-AAB installieren; ohne und mit Einwilligungen/Funktionsnutzung SDK-Ereignisse und Zielhosts erfassen. Keine echten Familieninhalte in Protokolle aufnehmen.
3. Eigene Shop-WebView bis zum Checkout ohne Bestellung prüfen: tatsächlich abgefragte Daten, Cookies/IDs, Empfänger und etwaige externe Browserübergabe dokumentieren.
4. Anbieterfristen und Löschverfahren prüfen. Erst danach flüchtig/gespeichert und Weitergabeausnahmen endgültig bestimmen.
5. Abgleich aller Typen mit öffentlicher Datenschutzerklärung, In-App-Hinweisen und [offenen Angaben](offene-angaben.md). Dieser Entwurf ist absichtlich kein automatisch importierbares Play-Formular.
