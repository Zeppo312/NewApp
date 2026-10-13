# Quellen und Prüfgrenzen

Erstellt am 10.09.2026 in `/Users/janzeppenfeld/Developer/LottiBaby`. Umfang: Dokumentation und Materialvorbereitung. Zahlreiche App-/Android-/Backendänderungen waren bereits vorhanden. Dieses Paket ändert ausschließlich Dateien unter `docs/android-play/store/`; nichts gestagt, committet, hochgeladen oder versendet.

## Lokale Grundlagen

- [Schritt 1](../step-01.md), [Produktmatrix](../product-map.md), [Schritt 3](../step-03.md), [Schritt 4](../step-04.md), [Schritt 5](../step-05.md). Frühere Livebefunde werden als solche gekennzeichnet und nicht als neue Liveprüfung ausgegeben.
- `package.json`, `package-lock.json`, `app.json`, `app.config.js`, Hauptmanifest und Debug-Merge des tatsächlich eingebundenen Moduls `android/app` (nicht `android/app 2`).
- Auth-/Onboarding-, Tracking-, Kalender-, Wetter-, Community-, Medien-, Support-, Shop-, KI-, Abo- und Löschpfade laut [Dateninventar](dateninventar.md). Ein Manifest-/SDK-Inventar beweist allein weder tatsächlichen Netzwerkverkehr noch Store-Zulässigkeit.
- Snapshot der wesentlichen Quellen, Versionen, PNG-Metadaten und SHA-256: [evidence/source-inventar.json](evidence/source-inventar.json). Keine Auth-Schlüssel, Passwörter oder Testpersonenadressen aufgenommen.

## Externe Primärquellen, abgerufen am 10.09.2026

| Thema | Quelle |
| --- | --- |
| Storefelder und Kontakt | [Google: App erstellen/einrichten](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en) |
| Screenshots, Icon, Feature Graphic | [Google: Preview Assets](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en) |
| Datensicherheit | [Google: Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en) |
| Externe und interne Kontolöschung | [Google: Account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en) |
| Zugang für Review | [Google: Sign-in details](https://support.google.com/googleplay/android-developer/answer/15748846?hl=en) |
| App-Inhalte und Anzeigen | [Google: Prepare for review](https://support.google.com/googleplay/android-developer/answer/9859455?hl=en) |
| Zielgruppe | [Google: Target audience](https://support.google.com/googleplay/android-developer/answer/9867159?hl=en) |
| Gesundheitsdeklaration | [Google: Health declaration](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en) |
| Gesundheitskategorien | [Google: Health categories](https://support.google.com/googleplay/android-developer/answer/13996367?hl=en) |
| Gesundheitsinhalte | [Google: Health Content and Services](https://support.google.com/googleplay/android-developer/answer/16679511?hl=en) |
| KI / Nutzerinhalte / Assetherkunft | [Google: KI-Inhalte](https://support.google.com/googleplay/android-developer/answer/13985936?hl=en), [UGC](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en-GB), [KI-Assetdeklaration](https://support.google.com/googleplay/android-developer/answer/17262077?hl=en) |
| Berechtigungen / FGS | [Google: Permissions](https://support.google.com/googleplay/android-developer/answer/9214102?hl=en), [Foreground services](https://support.google.com/googleplay/android-developer/answer/13392821?hl=en) |
| Mindesttest bei neuen persönlichen Konten | [Google: Testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en) |
| Tracks und Opt-in | [Google: Set up tests](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en) |
| RevenueCat-Datentypen | [RevenueCat: Google Data Safety](https://www.revenuecat.com/docs/platform-resources/google-platform-resources/google-plays-data-safety) |
| Sentry-Daten | [Sentry: React Native Data Collected](https://docs.sentry.io/platforms/react-native/data-management/data-collected/) · über direkten HTTP-Abruf geprüft, da Web-Tool Markdown-Antwort zunächst ablehnte |
| Supabase-Änderungen | [Supabase Changelog](https://supabase.com/changelog.md) · direkter Abruf; keine Supabase-API-/Schemaänderung durchgeführt |
| Website-Aussagen/Kontakt | [Startseite](https://lottibaby.de/), [Support](https://lottibaby.de/support), [Datenschutz](https://lottibaby.de/datenschutz), [Impressum](https://lottibaby.de/impressum) |

Die Website wurde als zu prüfende öffentliche Aussage und für bestehende Kontaktwege verwendet, nicht als Beweis der App-Architektur. Der gelesene Abruf lieferte englische Texte; deutsche Seitenfassung vor Veröffentlichung ebenfalls prüfen. Öffentliche Erreichbarkeit beweist weder tatsächliche Supportbetreuung noch Vollständigkeit der Datenschutzerklärung.

## Prüfung dieses Pakets

Nachprüfung am 11.09.2026: Die drei Google-Quellen zu Gesundheitsinhalten, Gesundheitserklärung und Gesundheitskategorien erneut gelesen. Store-Hinweis um „kein Medizinprodukt“ und den ausdrücklichen Ausschluss von Diagnose, Behandlung, Heilung und Vorbeugung ergänzt; Arztverweis konkretisiert. Die vorbereitete Gesundheitserklärung anhand der Tracker, Vitamin-D-Erinnerung, Selfcare und Arztorganisation präzisiert. Zusätzliche Inhalts-/Reha-Prüfungen und die tatsächliche Console-Einreichung bleiben als offen gekennzeichnet. Zeichenlimits und lokale Links der geänderten Unterlagen erneut geprüft; Ergebnis als `health_notice_update` im Prüfbericht. Die übrigen Prüfwerte stammen weiterhin aus der ursprünglichen Paketprüfung.

- Zeichenlimits der kopierbaren Texte, lokale Markdown-/HTML-Verweise und CSV-Struktur automatisiert geprüft; Ergebnis in [evidence/pruefung.json](evidence/pruefung.json).
- Alle sieben QA-PNGs und die Iconquelle unverändert kopiert; Hashgleichheit/Abmessungen geprüft. Onboarding-Zusammenfassung zusätzlich visuell gesichtet. Keine gefälschte App-UI erzeugt, kein QA-Bild als final markiert.
- Alle acht künftigen Screenshotmotive enthalten Aufnahmeanweisung und Alttext; Dateien bleiben bis Schritt 5 offen. Store-Icon und Feature Graphic sind als ausstehende Exporte gekennzeichnet.
- Kein erneuter App-Build oder Testlauf für diese Dokumentationsänderung. Kein Login, keine echten Daten, keine Netzwerkverkehrsmessung der App, keine reale Löschung/Käufe/Shopbestellungen. Bereits erfolgte QA aus Schritt 5 ist nicht mit eigenen End-to-End-Tests verwechselt.
- Keine Play-Formulare abgeschickt, keine Tester kontaktiert. Die zwölf/14-Regel ist anhand offizieller Quelle vorbereitet; die tatsächliche Kontopflicht und Teilnahme müssen noch belegt werden.

Der Entwurf bewertet technische Tatsachen und erforderliche Nachweise. Er trifft keine medizinische oder rechtliche Zulassungsentscheidung.
