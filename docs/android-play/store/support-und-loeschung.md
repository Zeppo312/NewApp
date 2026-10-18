# Support, Datenschutz und Löschwege

## Kontaktfelder

| Feld | Konkreter Entwurf / Status |
| --- | --- |
| Öffentliche Support-E-Mail | `support@lottibaby.de` · im App-Code und auf Website belegt; Erreichbarkeit/Betreuung OFFEN-NUTZER |
| Support-URL | `https://lottibaby.de/support` · am 10.09.2026 öffentlich lesbar; deutsche Fassung vor Einreichung prüfen |
| Website | `https://lottibaby.de/` · erreichbar, aber lokale-Speicherungsbehauptung korrigieren |
| Datenschutz-URL | `https://lottibaby.de/datenschutz` · erreichbar, derzeit kein ausreichender app-spezifischer Nachweis; Supabase fehlt im gelesenen Seitentext |
| Lösch-URL | **OFFEN-NUTZER/TECHNIK:** konkrete öffentliche HTTPS-Seite bereitstellen, z. B. vorgeschlagener Pfad `/konto-loeschen`; Existenz wird nicht behauptet |
| Betreiber | Im App-/Website-Impressum: Laura-Michelle Zeppenfeld, Tilburger Str. 31, 28259 Bremen, Deutschland. Vor Console-Übernahme Übereinstimmung mit tatsächlichem Kontoinhaber/Unternehmen bestätigen |
| Öffentliche Telefonnummer | **OFFEN-NUTZER:** keine Nummer erfinden; öffentliche Store-Nummer von erforderlichen privaten Konto-/Identitätsangaben unterscheiden |
| Supportzeiten | **OFFEN-NUTZER.** Website nennt üblicherweise 24–48 Stunden; im Entwurf bewusst keine ungeprüfte Frist versprechen |

Belege: `app/support.tsx:32`, `app/impressum.tsx`, [Supportseite](https://lottibaby.de/support), [Impressum](https://lottibaby.de/impressum), [Datenschutzseite](https://lottibaby.de/datenschutz).

## Kopierbarer Supporttext

> Fragen zu Lotti Baby oder ein Problem mit der App? Schreibe an support@lottibaby.de. Nenne bitte App-Version, Android-Version und Gerätemodell sowie die Schritte, bei denen das Problem auftritt. Verwende möglichst Testdaten und entferne persönliche Angaben aus Screenshots. Sende keine Passwörter oder Zahlungsdaten. Die Supportfunktion in der App öffnet dein E-Mail-Programm und ergänzt App-Version und Nutzer-ID; du kannst die Nachricht vor dem Versand prüfen.

## Löschwege aus dem Code

1. **App-Einstellungen → Daten & Datenschutz → Alle Daten löschen → Fortfahren → Daten + Konto löschen.** Dialogtexte in `lib/appSettingsTranslations.ts:164`, Ablauf `app/app-settings.tsx:863`. „Nur Daten löschen“ ist ein separater Zweig, der das Auth-Konto behalten soll.
2. **Profil → Konto löschen** ruft `deleteUserAccount({ avatarUrl })` auf (`app/profil.tsx:301`). Zusätzlich existiert `app/dsgvo.tsx` mit Export und Konto-Löschaufruf. Sichtbare Navigationswege auf Android mit Testkonto bestätigen.
3. `lib/profile.ts:248` ruft `supabase.rpc('delete_user_data', { delete_auth: … })` auf. Account-Löschung setzt `delete_auth:true`. Apple-Verknüpfungen lösen vorher einen Widerrufspfad aus; Android mit Apple-Bestandskonto gesondert prüfen.
4. Lokale Migration `20261226000001_fix_delete_user_data_and_partner_fk.sql`: authentifizierte Nutzer-ID, gemeinsame Referenzen lösen, ausgewählte Verknüpfungs-/Nachrichtentabellen löschen, Tabellen mit `user_id` bearbeiten, Profil und optional `auth.users` löschen. `EXCEPTION` liefert Fehler zurück. **Dateidatum und SQL-Existenz belegen kein Deployment.**
5. Einzelne Medienlöschungen existieren für Avatar, Babyfoto, Meilensteinbild und Chat-Audio. Chat-Löschung über `delete-chat-message` entfernt dort auch die Audiodatei. Der allgemeine Account-RPC enthält dagegen keine vollständige Storage-Objektbereinigung und keine Sentry-/OpenAI-/RevenueCat-/Shop-Löschung.

**Wesentliche Grenzen:** Kein Beleg, dass alle Tabellen ohne `user_id`, spätere FK-Strukturen, Partnerdaten, Medien, lokale Caches, Backups, Logs und Daten bei Dienstleistern vollständig beseitigt werden. Das Profil löscht explizit den übergebenen Avatar; andere Einstiegspunkte übergeben ihn nicht. Eine entfernte Datenbankzeile bedeutet nicht automatisch eine entfernte Storage-Datei. Keine Löschung an einem echten Nutzerkonto wurde ausgeführt.

Der JSON/PDF-Export in `lib/dataExport.ts` arbeitet mit einer festen Tabellenliste. Neuere Bereiche wie vollständige Chats, Storage-Dateien, Fürsorge und Shop sind dadurch nicht vollständig abgedeckt. Deshalb keine Aussage „vollständiger Export aller Daten“ verwenden.

Kontolöschung kündigt ein Store-Abonnement **nicht automatisch**. Die App zeigt dazu einen Hinweis und führt abhängig vom Herkunftsstore zur Verwaltung. Das muss auch bei Konten mit Apple-Abo auf Android funktionieren. Bereits vom Empfänger gespeicherte Exporte, Systemkalendereinträge und Shopbestellungen benötigen eigene Abläufe.

## Entwurf für eine öffentliche Löschseite

**Noch nicht veröffentlichen, bis Zuständigkeit, Fristen und Vollständigkeit feststehen.** Platzhalter ersetzen; ein tatsächlicher Kontakt-/Löschprozess muss erreichbar sein.

> **Lotti Baby: Konto und Daten löschen**
>
> Du kannst die Löschung in Lotti Baby unter App-Einstellungen → Daten & Datenschutz → Alle Daten löschen → Daten + Konto löschen anstoßen.
>
> Du hast die App nicht mehr? Schreibe von der E-Mail-Adresse deines Lotti-Baby-Kontos an support@lottibaby.de mit dem Betreff „Lotti Baby – Konto löschen“. Nenne, ob du dein Konto mit allen zugehörigen App-Daten oder bestimmte Daten löschen lassen möchtest. Sende kein Passwort. Zur Zuordnung und zum Schutz deines Kontos kann eine Bestätigung erforderlich sein.
>
> Verantwortlich für die Bearbeitung: **[OFFEN-NUTZER: Betreiber bestätigen]**. Wir bearbeiten die Anfrage innerhalb von **[OFFEN-NUTZER: bestätigte Frist]**.
>
> Gelöscht werden **[OFFEN-TECHNIK: bestätigte Kategorien einschließlich Medien und Daten bei Dienstleistern]**. **[OFFEN-NUTZER: ggf. aufbewahrte Daten, konkrete Gründe und jeweilige Fristen]** bleiben davon ausgenommen. Backups werden **[OFFEN: tatsächlicher Ablauf und Frist]** bereinigt beziehungsweise laufen aus.
>
> Die Kontolöschung beendet dein Abonnement nicht automatisch. Verwalte es zusätzlich im Store, in dem du es abgeschlossen hast. Für Bestellungen im Lotti-Baby-Shop nenne bitte gesondert die Bestellnummer; dortige Aufbewahrungsregeln werden **[OFFEN: Shopregeln verlinken]** erklärt.

Die Seite muss ohne App-Installation nutzbar sein, die App/den Betreiber nennen und den tatsächlichen Ablauf samt Aufbewahrung erklären. Eine allgemeine Supportseite ohne Löschhinweise oder ein reiner App-Deep-Link ersetzt sie nicht. [Google: Kontolöschung](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).

## Baustein zur Korrektur der Speicherungsbehauptung

> Lotti Baby verarbeitet Kontodaten sowie gespeicherte Familien- und Trackingdaten über Supabase. Zusätzlich speichert die App bestimmte Inhalte und Zwischenspeicher auf deinem Gerät. Je nach verwendeter Funktion werden Daten an weitere Dienste übertragen, beispielsweise für KI-Verarbeitung, Wetter, Benachrichtigungen, Abonnements, Fehlerdiagnose und den Shop. Welche Daten betroffen sind und welche Wahlmöglichkeiten bestehen, erläutert unsere Datenschutzerklärung.

Dieser Baustein ersetzt keine vollständige Datenschutzerklärung. Diese muss konkrete Empfänger/Zwecke, Rechtsgrundlagen, Regionen/Übermittlungen, Fristen, Rechte, Kontakt und optionale Funktionen mit dem bestätigten Betrieb abgleichen. Keine Zulassung oder pauschale DSGVO-Konformität wird festgestellt.

## Nachweisplan für Löschung

Nur freigegebenes Wegwerfkonto verwenden: Familienverknüpfung, Tracking, ein Testbild, Audiotest, Planertermin, KI-Nutzung und Push-Token anlegen. Vorher IDs/Objektpfade intern protokollieren. Account-Löschung ausführen; Auth-Zugriff einschließlich vorhandener Sitzung, DB-Zeilen, Medien-URLs, Partneransicht und lokale Caches prüfen. Dienstleister-/Shop-Tickets und Backupfristen separat dokumentieren. Fehlgeschlagene oder unvollständige Löschung beheben, bevor der Store vollständige Löschung behauptet. Reviewer-Hauptkonto und reale Familien bleiben davon unberührt.
