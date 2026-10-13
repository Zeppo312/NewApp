# Lotti: Onboarding mit persönlichem Nutzen

Stand: 9. September 2026. Ziel ist ein ausführlicher, relevanter Einstieg, kein auf vier Screens gekürztes Formular. Die öffentlich zugänglichen Fallstudien belegen keine Rangliste der Apps mit der weltweit höchsten Conversion. Anbieterberichte enthalten begrenzte Angaben zu Stichprobe und Signifikanz; ihre Ergebnisse sind Hypothesen für Lotti, keine Prognosen.

## Referenzen und Übertragung

| Referenz | Veröffentlichtes Ergebnis | Übertragung auf Lotti |
| --- | --- | --- |
| [ASL Bloom / Applica, RevenueCat, 8. Mai 2025](https://www.revenuecat.com/blog/growth/asl-bloom-applica-case-study) | Berichtete Steigerung der Trial-Conversion um 15 %, ARPU um 12 %. Der Umbau verband Funktionen mit den persönlichen Zielen der Lernenden. | Erst nach Ziel und Schwierigkeit fragen; danach eine dazu passende Funktion erleben und ihren Alltagsnutzen erklären. |
| [Speak4Me, Superwall, 13. Januar 2026](https://superwall.com/case-studies/speak4me) | Laut Fallstudie gewann im A/B-Test eine mehrstufige Nutzen-Erklärung vor dem Angebot: +27 % Conversion, +36 % Erlöse. | Interaktion, Erklärung und persönlicher Einstieg erhalten eigene Bildschirme. Umfang ist sinnvoll, wenn jede Seite einen anderen Zweck erfüllt. |
| [Mimo, Bericht der damaligen Growth-Verantwortlichen, RevenueCat, 19. Mai 2026](https://www.revenuecat.com/blog/growth/optimize-funnel-metrics-mimo) | Verständliche Trial-Erklärung: Trial-Opt-ins mehr als verdoppelt, Trial-to-Purchase im Artikel mit +50 % angegeben. | Vor Kauf Unsicherheiten zu Leistungsumfang und Abrechnung klären. Nur tatsächlich verfügbare Store-Angebote und implementierte Erinnerungen versprechen. |
| [Duolingo](https://blog.duolingo.com/lessons-from-asia-turning-local-research-into-global-experiments/) | Die Umformulierung eines Einstufungstests zu einer Prüfung des eigenen Sprachniveaus verdoppelte laut Bericht dessen Nutzung. | Fragen aus Elternsicht formulieren, keine internen Feature-Namen oder prüfungsartige Sprache. |
| [Superwall, 26. Mai 2026](https://superwall.com/blog/new-postmulti-page-onboarding-paywalls-convert-37-better-than-single-page-heres-why) | 40 Mio. Onboarding-Paywall-Aufrufe; 12,41 % versus 9,07 % Trial-Start oder Direktkauf. | Mehrstufige Angebote sind einen Test wert. Dies ist ein beobachtender Vergleich, kein kausaler A/B-Beweis: Paywalls ohne Transaktionen wurden ausgeschlossen, Mindestgröße nur 50 Aufrufe. Nicht als erwarteten Lotti-Uplift verwenden. |

## Umgesetzter Ablauf

1. Sichtbarer Nutzen: Tagesverlauf mit lokalen Einträgen zur Vorstellung der Funktion.
2. Vorname: persönliche Ansprache.
3. Rolle: eigener Frageschritt, Einladung als Nebenpfad.
4. Schwangerschaft oder geborenes Baby: relevanten Pfad bestimmen.
5. Termin/Geburtstag und optionaler Babyname.
6. Freiwillige Momentaufnahme der eigenen Stimmung: Regler mit fünf Gefühlen.
7. Freiwillige Energiefrage: fünf Stufen, passende wertschätzende Rückmeldung.
8. Wichtigstes Bedürfnis: Schlaf, Tagesübersicht oder Erinnerungen; bei Schwangerschaft Wochenübersicht, Vorbereitung oder Erinnerungen.
9. Passende Produktansicht: konkret zeigen, was sich mit der gewählten Funktion wiederfinden lässt.
10. Konkrete Schwierigkeit: Details merken, Überblick gewinnen, Abstimmung oder Überforderung.
11. Alltagssituation → Eintrag: den gewählten Gedanken mit einem sichtbaren Produktbeispiel verbinden.
12. Gewünschte Nutzung: allein, gemeinsam oder später entscheiden.
13. Passender Nutzen: eigener Überblick oder gemeinsamer Verlauf mit ausdrücklichem Hinweis auf notwendige Kontoverknüpfung.
14. Passende Interaktion: Schlaf-Timer, Beispielmahlzeit, Aufgabe, Schwangerschaftsvergleich oder Erinnerungssatz.
15. Freiwilliges Feedback auf einer eigenen Seite; bei übersprungener Demo entfällt diese Seite auch beim Zurückgehen.
16. Freiwilliger Alltagsmoment für die gewählte Funktion.
17. Persönliche Zusammenfassung mit konkreter erster Aktion und Wohlbefinden, anschließend bestehende Zugangs-/Paywall-Prüfung.

Die vom Nutzer bereitgestellten Cal-AI-Screenshots liefern das Layoutprinzip: große linksbündige Überschriften, eine Frage pro Seite, Fragen und Produktnutzen im Wechsel, kontinuierlicher Fortschrittsbalken, feste untere Aktion. Lottis warmer Hintergrund, Glaskarten und lila Akzente bleiben. Pflichtantworten aktivieren die Weiter-Schaltfläche. Logo und Wortmarke bleiben entfernt. Alle neuen Texte sind auf Deutsch, Englisch und Spanisch verfügbar. Fremde Nutzerzahlen, Wirkungsversprechen, Gewichtsdiagramme und Trial-Konditionen wurden nicht übernommen.

Einladungscode bleibt als expliziter Nebenpfad erreichbar. Verknüpfte Eltern geben die bereits geteilten Babydaten nicht erneut ein. Bedürfnis, Schwierigkeit, Unterstützung, Alltagsmoment und freiwilliges Wohlbefinden werden beim Abschluss unter `user_metadata.onboarding_preferences` mit `version: 1` gespeichert. Sie dienen nur der Personalisierung, nicht der Autorisierung. Die gewählte Funktion wird als Zielroute durch die Paywall weitergereicht. Demo-Einträge werden nicht in Familien-/Babydaten geschrieben.

## Was noch nicht als Erfolg belegt ist

Es wurde kein Conversion-Zuwachs gemessen und kein A/B-Test ausgerollt. Die Änderungen sind lokal. Die bestehende Preis-/Trial-Logik wurde nicht durch fiktive Angebote ersetzt.

Für einen späteren Vergleich stabile Varianten zufällig zuweisen und mindestens diese Stationen messen: Onboarding-Start, jeder Schritt, Antwortauswahl, Demo-Aktion, Abschluss, Paywall-Ansicht, Trial-/Kaufstart, tatsächlicher Erstkauf. Kennzahlen getrennt nach Schwangerschaft/Baby, neuem/verknüpftem Konto, Sprache und Akquisitionsquelle auswerten. Primär zahlende Nutzer pro Onboarding-Start bzw. Erlös pro neuem Nutzer; sekundär Abschlussrate, Trial-to-Paid, Stornos/Erstattungen und D7-Nutzung. Ein Anstieg der Trial-Starts allein ist kein ausreichender Erfolg. Ereignisse und Antworten nicht mit Freitext, Namen oder Demo-Erinnerungen in Telemetrie vermischen.

## Persönlicher Einstieg, Aha-Moment und Wiederkommen

Die Ansprache wurde in Deutsch, Englisch und Spanisch auf konkrete Elternsituationen umgestellt. Die Anmeldung selbst bleibt unverändert; dieser Teil beginnt mit dem persönlichen Onboarding nach der Anmeldung.

- **Sign-up → persönlicher Einstieg:** Fragen aus der eigenen Lebenssituation statt Funktionssprache. Eine Antwort auf die Schwierigkeit wird wertschätzend aufgegriffen.
- **Aha-Moment:** Eine passende Nutzen-Rückmeldung erscheint erst nach einer tatsächlich ausgeführten Demo-Aktion. Die Vorschau erzeugt weiterhin keine echten Babydaten.
- **Habit-Moment vorbereiten:** Auf einer eigenen Seite kann freiwillig ein zur gewählten Funktion passender Alltagsmoment gewählt werden. `onboarding_preferences.habit` speichert `in_moment`, `quiet_moment` oder `null`; bei einem anderen Startziel wird die Auswahl zurückgesetzt. Das ist eine Absicht, noch keine beobachtete Gewohnheit. Es werden keine Benachrichtigungen eingerichtet.
- **Retention begründen:** Die abschließende Erklärung zeigt konkret, was beim Wiederkommen nützt: vorhandene Einträge, offene Aufgaben, Erinnerungen oder die aktuelle Schwangerschaftswoche. Wiederholte Nutzung und Retention sind damit noch nicht gemessen oder belegt.

Für die spätere Messung Demo-Nutzung von der ersten echten Kernaktion unterscheiden. Wiederholte echte Kernaktionen an getrennten Tagen und D7-/D30-Rückkehr zeigen, ob aus dem Einstieg tatsächliche Nutzung entsteht. Kein Freitext und keine Babynamen in Analytics-Ereignisse aufnehmen.

## Ergänzung aus dem bereitgestellten Userpilot-Artikel

Quelle: vom Nutzer eingefügter Volltext „12 Web and Mobile App Onboarding Best Practices to Drive User Retention“, Abrar Abutouq, Stand im Text 11. Juni 2026. Die allgemeinen Empfehlungen und Anbieterbeispiele dienen als Anregung; ihre berichteten Effekte werden nicht als Lotti-Ergebnisse übernommen.

Ergänzt wurden eine explizite Überspringen-Beschriftung für nicht abgeschlossene Demos sowie freiwilliges Feedback nach einer ausgeführten Demo. „Ich brauche gerade etwas anderes“ führt zurück zur Bedürfnis-Auswahl und passt dadurch den weiteren Einstieg an. Die Rückmeldung wird für diese Interaktion verwendet; sie ist kein implementiertes Analytics-Ereignis und wird nicht dauerhaft gespeichert. Im aktuellen Ablauf stehen Feedback und Alltagsmoment auf eigenen Seiten.

Noch offen: kontextuelle Begleitung bis zur ersten echten Kernaktion nach der Paywall sowie Messung tatsächlicher Aktivierung und Wiederkehr. Demo-Abschluss, Zustimmungsantwort und gewählter Alltagsmoment werden nicht mit diesen Ergebnissen gleichgesetzt.


## Echte Tracker-Komponenten und Baby-Illustrationen

Die Vorschauen für „Unser Tag“ und den Schlaftracker verwenden dieselben `ActivityCard`-, `DailyQuickAction`- und `SleepTimerFace`-Komponenten wie die produktiven Screens. Beispiele bleiben lokal; Karten sind schreibgeschützt und Demo-Aktionen speichern keine echten Einträge. Der Schlaf-Timer misst weiterhin die tatsächlich verstrichene Demo-Zeit.

Die bestehenden Baby-Illustrationen sind bei Vorname, Rolle und Baby-Status wieder eingebunden. Logo und Wortmarke bleiben entfernt. Die Bilder stammen aus den vorhandenen App-Assets.

Stimmung und Energie werden vor der Funktionsauswahl gefragt und bleiben ohne bewusste Auswahl `null`. Zurückgehen erhält die Antworten, Zurücksetzen entfernt sie, Überspringen bleibt möglich. Beide Regler werden beim Fragenwechsel getrennt gemountet, damit ein nativer Wert nicht auf die nächste Frage übergeht. `onboarding_preferences.wellbeing` enthält `mood` und `energy` (1–5 oder `null`); das ist eine subjektive Momentaufnahme, kein klinischer Score und kein automatisch angelegter Selfcare-Eintrag. Die Abschlussseite greift wenig Energie oder eine schwere Stimmung auf und verweist auf den vorhandenen Bereich „Für dich“.


## Layout-Korrektur nach Prüfung der Screenshots

Die verschachtelten vertikalen Inhaltscontainer verwenden `flexGrow: 1` und `flexShrink: 0` statt `flex: 1`. Damit kann der Inhalt seine natürliche Höhe einnehmen und der ScrollView bei Überlänge tatsächlich scrollen. Die untere Aktion bleibt außerhalb des Scrollbereichs. Ein äußerer Touch-Wrapper wurde entfernt; das Schließen der Tastatur übernimmt der ScrollView. Der Scrollindikator ist sichtbar, wenn Inhalt überläuft.

„So kann es aussehen · Beispiel“ ist in allen Sprachen entfernt. Die Schlaf-Vorstellung behält Uhr und echte Eintragskarte. Entlastung und gemeinsamer Überblick zeigen nur eine kompakte Eintragskarte. Der Abschluss wiederholt keine Testeinträge mehr und konzentriert sich auf den ersten Schritt, den Alltagsmoment und das Wohlbefinden. Feste dekorative Tracker-Elemente entfallen bei großer Schrift zugunsten der lesbaren Eintragskarten. Der Hintergrund wird als zusammenhängendes Bild eingepasst.

Im iPhone-Simulator geprüft: die vier beanstandeten Seiten bei normaler Schrift, tatsächliches Scrollen bis zur letzten Karte bei Accessibility-Schriftgröße und Erreichbarkeit der festen unteren Aktion. Testdaten wurden nicht gespeichert.
