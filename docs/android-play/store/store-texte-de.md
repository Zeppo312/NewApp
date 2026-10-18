# Deutsche Store-Texte · Entwurf

Diese Texte beschreiben den implementierten Funktionsumfang. Vor Veröffentlichung müssen die beworbenen Funktionen im finalen Android-Build mit echten Testzugängen aus Schritt 5 erreichbar sein. Insbesondere Synchronisierung, KI und Tarifgrenzen sind noch nicht abschließend auf Android geprüft.

| Feld | Entwurf / Datei |
| --- | --- |
| Sprache | Deutsch, `de-DE` |
| App-Name | **Lotti Baby: Alltag mit Baby** · [Kopiertext](listing/de-DE/title.txt) |
| Kurzbeschreibung | **Schlaf, Stillen und Windeln erfassen, Schwangerschaft und Familienalltag planen** · [Kopiertext](listing/de-DE/short-description.txt) |
| Vollständige Beschreibung | [Kopiertext](listing/de-DE/full-description.txt) |
| Test-Versionshinweise | [Kopiertext](listing/de-DE/release-notes.txt), nur für den tatsächlich bereitgestellten Testbuild |

Google begrenzt Name/Kurztext/Langtext auf 30/80/4.000 Zeichen. Die konkreten Zählwerte stehen im Prüfbericht. [Store-Felder](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en).

## Belege zu den Aussagen

Der Abschnitt „HINWEIS ZU GESUNDHEIT“ im vollständigen Kopiertext enthält ausdrücklich die Einordnung „kein Medizinprodukt“, den Ausschluss von Diagnose, Behandlung, Heilung und Vorbeugung von Krankheiten sowie den Verweis an medizinisches Fachpersonal. Diesen Abschnitt vollständig in die Play-Store-Beschreibung übernehmen; vorhandene Warnhinweise innerhalb der App ersetzen ihn nicht. Grundlage: [Google: Gesundheitsrichtlinie](https://support.google.com/googleplay/android-developer/answer/16679511?hl=en), geprüft am 11.09.2026. Die zugehörigen Gesundheitsfunktionen sind in der [Gesundheitserklärung](play-console.md#gesundheitsfunktionen) zu deklarieren.

| Aussage im Entwurf | Implementierung, relativ zum Repository |
| --- | --- |
| Schlaf, Stillen, Flasche, Windeln, Verlauf | `app/(tabs)/sleep-tracker.tsx`, `lib/supabase.ts`, `lib/feedingOverview.ts`, `components/ActivityInputModal.tsx` |
| Schwangerschaft, Klinikliste und Arztfragen | `app/(tabs)/pregnancy-home.tsx`, `app/(tabs)/countdown.tsx`, `lib/supabase.ts`, `lib/services/DoctorQuestionsService.ts` |
| Familienplanung und Einkaufslisten | `app/planner/index.tsx`, `lib/plannerCalendarSync.ts`, `lib/shopping.ts` |
| Verknüpfte Konten | `app/(tabs)/account-linking.tsx`, `lib/accountLinks.ts`, `lib/sleepSharing.ts` |
| Erinnerungen, Größe/Gewicht | `app/milestones.tsx`, `lib/milestones.ts`, `lib/size.ts`, `lib/weight.ts` |
| KI | `app/frag-lotti.tsx`, `supabase/functions/ask-lotti/index.ts` |
| Abo statt pauschal kostenlos | `app/_layout.tsx`, `app/paywall.tsx`, `lib/paywallDecision.ts`, [Schritt 3](../step-03.md) |

Keine festen Preise, Trial-Dauer, Rabatte oder kostenlose Dauernutzung versprechen: Google-Angebote sind noch nicht bestätigt. Standard ist ein Bestandstarif und wird nicht als neues Angebot beworben. Im Text keine iOS-Widgets/Live Activities, gesicherten Push-Empfang, gesicherte Gesundheitswirkung oder Ende-zu-Ende-Verschlüsselung versprechen. Kategorie „Eltern“ und erwachsene Zielgruppe sind Vorschläge, keine bereits eingereichten Angaben.

Die Webseite behauptet derzeit lokale Speicherung; diese Behauptung widerspricht dem Code. Auch dortige Aussagen über Expertinnen/Experten, Datenschutzkonformität und kostenlose Testangebote werden ohne Nachweis nicht übernommen. [Webseitenbefund](https://lottibaby.de/).
