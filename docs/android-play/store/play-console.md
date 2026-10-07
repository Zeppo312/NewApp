# Play Console · konkrete Antwortentwürfe

**Entwürfe, keine eingereichten Angaben.** Paketkennung aus dem Code: `com.LottiBaby.app`. Lokale Version `1.0.23`, Code `9`; EAS verwendet Remote-Versionierung. Diese Nummern nicht als finalen Play-Release übernehmen. Kontofreigabe/App-Anlage laut [Schritt 1](../step-01.md) noch offen; keine erneute Live-Kontoprüfung in Schritt 6.

## App-Einrichtung und Inhalte

| Feld / Erklärung | Entwurf | Vor Abschluss |
| --- | --- | --- |
| App oder Spiel | **App** | Belegt durch Produkt |
| Standardsprache | **Deutsch (Deutschland), de-DE** | OFFEN-NUTZER bestätigen |
| Kategorie | **Eltern / Parenting** | OFFEN-NUTZER bestätigen; Gesundheitserklärung bleibt trotzdem relevant |
| Tags | Passende verfügbare Eltern-/Schwangerschaft-/Baby-Tags wählen | Keine frei erfundenen Console-Tags eintragen |
| App-Name/Beschreibungen | [Deutsche Store-Texte](store-texte-de.md) | Funktionsnachweis/Zeichenlimits |
| Kostenlos/kostenpflichtiger Download | **ENTWURF kostenloser Download mit Abo-Zugang** | OFFEN-NUTZER bestätigen; kostenloser Download bedeutet nicht dauerhaft kostenlose Nutzung |
| Länder/Regionen | **OFFEN-NUTZER** | Gewünschte Test-/Verkaufsregionen, Sprachen und Verfügbarkeit bestimmen |
| In-App-Käufe/Abos | **Ja, vorgesehen** | Google-Produkte/Basispläne/Preise noch offen; keine Trial-/Rabattwerte aus iOS übernehmen |
| App-Zugang | **Alle oder einige Funktionen eingeschränkt** durch Konto und Berechtigung | [Reviewer-Konten](reviewer-zugang.md) bereitstellen und testen |
| Datenschutzerklärung / Datenlöschung | URLs und Entwürfe in [Support und Löschung](support-und-loeschung.md) | App-Datenflüsse ergänzen, Löschseite bereitstellen |
| Datensicherheit | **Erhebung: Ja**; alle Detailtypen in [Datensicherheit](datensicherheit.md) | Empfängerrollen, SDK-/WebView-Verhalten, Fristen, Löschung finalisieren |
| Enthält Werbung | **OFFEN**, vorläufig kein klassisches Anzeigen-SDK gefunden | Empfehlungen, native Anzeigen, Remote-Inhalte und Shop auf tatsächliche Anzeigen prüfen. Abos oder bezahlte Produktplatzierung allein bedeuten nicht automatisch „Enthält Werbung“ |
| Werbe-ID | **Vorläufig Nein, nicht belegt** | Finales AAB und SDK-Konfiguration prüfen; Install Referrer ist nicht gleich Werbe-ID |
| Gesundheits-Apps | **Ja, Funktionen vorhanden** | Unten aufgeführte Bereiche auswählen, nicht „keine Gesundheitsfunktionen“ |
| Finanzfunktionen | **ENTWURF keine Finanzdienstleistungsfunktionen** | Einkaufen/Abonnement allein ist kein Banking/Kredit/Trading; tatsächliche Console-Fragen prüfen |
| Behörden-/Nachrichten-App | **ENTWURF Nein** | Elterninhalte/Blog machen sie nicht zu einer Behörden- oder journalistischen Nachrichten-App |
| Besondere Berechtigungen | [Berechtigungsinventar](berechtigungen.md) | Finales Bundle kann FGS-/weitere Erklärungen auslösen |
| Kontakt/Identität/Trader-Status | **OFFEN-NUTZER** | Tatsächliche Betreiber- und Kontodaten, erforderliche Telefon-/Adressverifikation, ggf. Händlerstatus nach Console-Anforderung bestätigen |

Google trennt Anzeigenkennzeichnung von anderen kommerziellen Inhalten; die Entscheidung muss dem tatsächlichen Inhalt folgen. [App zur Prüfung vorbereiten](https://support.google.com/googleplay/android-developer/answer/9859455?hl=en).

## Zielgruppe: Erwachsene bedienen die App

**Vorschlag für Altersgruppen: 18 Jahre und älter. OFFEN-NUTZER: Produktzielgruppe bestätigen.** Elternschaft allein beweist keine Volljährigkeit. Sollen minderjährige Eltern bewusst angesprochen werden, müssen die gewählte Altersgruppe, Ansprache und anwendbaren Anforderungen neu geprüft werden; nicht einfach 18+ ankreuzen, um Vorgaben zu umgehen.

Kopierbarer Begründungsentwurf:

> Lotti Baby richtet sich an erwachsene werdende Eltern, Eltern und Betreuungspersonen. Diese dokumentieren Schwangerschaft und Alltag mit einem Baby, organisieren Termine und teilen Familieninhalte mit berechtigten Betreuungspersonen. Die Kinder bedienen die App nicht selbst. Babyprofile und babybezogene Gestaltung beschreiben den Gegenstand der Dokumentation; sie sind kein Spiel- oder Lernangebot für Kinder.

Kein Kinderalter als Zielgruppe auswählen, nur weil Daten eines Babys gespeichert werden. Ebenso keine „Designed for Families“-/Lehrerempfehlungsbehauptung oder Kinderschutz-Zertifizierung erfinden. Kindliche Illustrationen und Texte trotzdem auf konsistente Erwachsenenansprache prüfen. [Google: Zielgruppe](https://support.google.com/googleplay/android-developer/answer/9867159?hl=en).

## Gesundheitsfunktionen

**Angabe: Die App bietet Gesundheitsfunktionen.** Unter **Richtlinien > App-Inhalte > Gesundheits-Apps** alle zutreffenden Bereiche auswählen, auch bei Store-Kategorie „Eltern“ und auch für Funktionen hinter einem Abo. „My app doesn’t provide any health features“ trifft nicht zu. Die folgende Zuordnung gilt für den implementierten Umfang; vor Einreichung mit den tatsächlich erreichbaren Funktionen des Android-Releases abgleichen. Stand: 11.09.2026; noch nicht in der Console gespeichert oder eingereicht.

| Console-Bereich | Entwurf und Beleg |
| --- | --- |
| Sleep Management | **Ja:** Schlafprotokoll, Timer, Auswertungen/Schlaffenster; `sleep-tracker`, `lib/bedtime.ts`, `lib/sleep-window.ts` |
| Period Tracking | **Ja:** Zyklus-/Periodenverlauf und Vorhersagen; `app/(tabs)/period-tracker.tsx`, `lib/cyclePredictions.ts` |
| Nutrition and Weight Management | **Ja:** Stillen/Flasche/Ernährungsprotokoll, Rezepte und Gewichtsverlauf; `lib/feedingOverview.ts`, `app/recipe-generator.tsx`, `app/(tabs)/weight-tracker.tsx`. Keine Gewichtsverlust-/Diätwirkung behaupten |
| Reproductive and Sexual Health | **Ja:** Schwangerschaftsbegleitung und Wehenprotokoll zusätzlich zum separat deklarierten Zyklustracking; `app/(tabs)/pregnancy-home.tsx`, `app/(tabs)/countdown.tsx`, `app/(tabs)/index.tsx`, `lib/contractionTranslations.ts`. Keine Fertilitätsbehandlung oder sichere Verhütung behaupten |
| Medication and Treatment Management | **Ja:** Vitamin-D-Erinnerung und Einnahme-Haken; `lib/vitaminDReminder.ts`, `app/app-settings.tsx`, `hooks/useVitaminDReminderNotifications.ts`, `app/(tabs)/daily_old.tsx`. Keine Dosierungsentscheidung oder Behandlungsempfehlung |
| Stress Management, Relaxation, Mental Acuity | **Ja:** Selfcare mit Entspannungs-/Achtsamkeitsübungen und Stimmungseinträgen; `app/(tabs)/selfcare.tsx`, `lib/selfcareTranslations.ts`. Keine Therapiebehauptung |
| Activity and Fitness | **Ja:** Selfcare enthält Bewegungsübungen und erfasst durchgeführte Bewegung; `app/(tabs)/selfcare.tsx`, `lib/selfcareTranslations.ts` |
| Healthcare Services and Management | **Ja:** Arztfragen und Organisation von Arztterminen in der Schwangerschaft; `app/doctor-questions.tsx`, `lib/services/DoctorQuestionsService.ts`, `app/planner/index.tsx`. Keine ärztliche Versorgung oder Telemedizin anbieten |
| Weitere Gesundheitsinhalte | Wachstum/Zähne und allgemeine KI-Orientierung im Freitext erläutern. Erreichbare Wiki-/Blog-/KI-Inhalte vor Einreichung auf zusätzliche Bereiche wie **Medical Reference and Education** oder **Emergency and First Aid** prüfen; diese Inhalte sind noch nicht vollständig gesichtet |
| Clinical Decision Support / Diseases and Conditions Management | Im geprüften Zweck keine professionelle klinische Entscheidungshilfe oder Krankheitsbehandlung belegt; nicht allein wegen allgemeiner Tracker auswählen |
| Physical Therapy and Rehabilitation | **Ja:** Selfcare bietet ausdrücklich „Rückbildung & Körperpflege“ und „Rückbildungsübung des Tages“ mit Beckenboden-/Bauchmuskelübungen; `app/(tabs)/selfcare.tsx`, `lib/selfcareTranslations.ts`. Keine individuelle physiotherapeutische Behandlung behaupten |
| Medical Device Apps | **Nein für die hier beschriebene Zweckbestimmung:** Dokumentation, Organisation und allgemeine Orientierung, kein Medizinprodukt. Keine Zulassung behaupten. Die noch offene fachliche/regulatorische Prüfung unter U09 in [Offene Angaben](offene-angaben.md) bleibt bestehen; der Hinweistext ersetzt diese Prüfung nicht |
| Health Connect / Forschung / Medizinprodukt-Hardware | Im geprüften Android-Code keine aktive Integration oder Forschungsstudie belegt; bei unverändertem Release entsprechend verneinen |

Die Zuordnung ist eine Prüfung der Funktionen, keine medizinische oder rechtliche Zulassungsfeststellung. Google führt diese Gesundheitstypen separat auf. [Health-Erklärung](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en), [Gesundheitskategorien](https://support.google.com/googleplay/android-developer/answer/13996367?hl=en).

Freitextentwurf:

> Eltern und erwachsene Betreuungspersonen dokumentieren Schlaf, Stillen und Flaschennahrung, Größe und Gewicht, Zyklus, Schwangerschaft und Wehen. Die App bietet Verlaufsdarstellungen, Zyklusvorhersagen, Vitamin-D-Erinnerungen mit Einnahme-Haken, Selfcare mit Stimmungseinträgen, Bewegungs- und Entspannungsübungen sowie die Organisation von Arztfragen und Terminen. KI-Funktionen können eigene Einträge zur allgemeinen Orientierung zusammenfassen. Lotti Baby ist kein Medizinprodukt und diagnostiziert, behandelt, heilt oder verhindert keine Krankheiten. Inhalte, Auswertungen und KI-Antworten ersetzen keine medizinische Beratung, Diagnose oder Behandlung. Nutzer sollen sich für medizinische Beratung, Diagnose oder Behandlung an eine Ärztin, einen Arzt oder anderes qualifiziertes medizinisches Fachpersonal wenden.

**Vor Veröffentlichung:** Gesundheitsbehauptungen auch in KI-Antworten, Schlaffenstern, Zyklusprognosen, Wehenanzeigen und Erinnerungen prüfen. Keine Diagnose, sichere Verhütung, garantierte Schlafverbesserung oder Dosierung versprechen. Den vollständigen Gesundheitshinweis aus der [Store-Beschreibung](listing/de-DE/full-description.txt) übernehmen und mit den bestehenden In-App-Warnhinweisen abgleichen. Die Gesundheitserklärung zusätzlich in der Console ausfüllen und speichern; ein Store-Hinweis ersetzt diese Erklärung nicht. [Google: Health Content and Services](https://support.google.com/googleplay/android-developer/answer/16679511?hl=en).

## Altersfreigabe / IARC: Antworten vorbereiten, keine Stufe raten

- Öffentliche Community, Direkt-/Gruppenchat und Kommentare: **im aktuellen App-Code deaktiviert** (`lib/communityAccess.ts`). Im IARC-Fragebogen diese Funktionen nicht als aktiv angeben. Private Freigaben für Partner und Betreuungspersonen bestehen weiter und sind anhand der konkreten Frage zu Nutzerkommunikation zu bewerten.
- Nutzer können Inhalte teilen: **Ja**, Text/Bilder/Audio je Funktion. Sichtbarkeitsbereiche unterscheiden.
- Käufe digitaler Inhalte/Abonnements: **Ja**, vorgesehen; keine zufallsbasierten Käufe im Code gefunden.
- Weitergabe des tatsächlichen Standorts an andere Nutzer: **nicht als Live-Ortung belegt**. Manuell geteilte Ortsangaben, Familientermine und Profilfelder anhand der exakten Frage prüfen.
- Gewalt, Sexualität/Nacktheit, Sprache, Drogen, Glücksspiel: keine Altersstufe aus Code ableiten. Medizinische Schwangerschafts-/Stillinhalte, Rezept-/Wiki-Medien, Nutzerinhalte und erreichbare Webansichten tatsächlich sichten und die konkreten Fragen beantworten. „Eltern-App“ bedeutet nicht automatisch „USK 0“.
- Ergebnis erst aus vollständig und wahrheitsgemäß beantwortetem IARC-Fragebogen übernehmen. Kontaktemail und Inhaltsverantwortliche bleiben zu bestätigen.

## Vor dem Test-/Release-Upload

**KI-/Freigabe-Nachprüfung:** Der KI-Melde-/Moderationsfluss für „Frag Lotti“ ist am 01.10.2026 durch den Betreiber manuell abgenommen; der produktive Backend-Fix wurde am 11.09.2026 technisch geprüft. [Abnahme und Nachweisgrenzen](../../ask-lotti-reporting.md#abnahme-vom-1-oktober-2026). Community und Chats sind deaktiviert. Verbleibende private Familienfreigaben separat prüfen. [Google: KI-Inhalte](https://support.google.com/googleplay/android-developer/answer/13985936?hl=en), [UGC](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en-GB).

Bei etwaigen Console-Fragen zur KI-Erstellung von Store-Assets die tatsächliche Herkunft jedes Assets angeben. Dieses Textpaket ist KI-unterstützt erstellt; QA-Bilder sind unveränderte echte Appaufnahmen. Die Herkunft der vorhandenen Icongestaltung ist noch zu bestätigen. [Google: KI-Assetdeklaration](https://support.google.com/googleplay/android-developer/answer/17262077?hl=en).

Store-Kontofreigabe, signiertes AAB, Version, Testtrack, Länder, Reviewer-Zugang, Datenschutz-/Löschseiten und verlangte Console-Erklärungen vervollständigen. Closed-Test-Veröffentlichung und späterer Produktionszugang sind getrennte Vorgänge. Ein fertiges Dokumentenpaket ist weder eine Google-Freigabe noch eine gestartete Testdauer.
