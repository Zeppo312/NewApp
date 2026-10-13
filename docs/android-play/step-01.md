# Schritt 1 – Bestand und Produktzuordnung

Abgeschlossen am 10.09.2026. Umfang: Bestandsprüfung und Übergabe, keine Implementierungsänderung, kein Deployment, keine Produktanlage. Gemeinsame Matrix und belegte Lücken: [product-map.md](product-map.md).

## Ergebnis

- Sechs fachliche Tarif-/Laufzeitkombinationen sind eindeutig den bestehenden iOS-IDs und RevenueCat-Packages zugeordnet. Die vorgeschlagenen Google-Abos `lottibaby_lite`, `lottibaby_standard`, `lottibaby_premium` mit `monthly`/`yearly` bleiben ausdrücklich noch nicht angelegte Vorschläge.
- Das bestehende Offering `default` hat sechs Packages. Standard verwendet tatsächlich `$rc_monthly` und `$rc_annual`; Lite/Premium verwenden `lite_monthly`, `lite_yearly`, `premium_monthly`, `premium_yearly`.
- Entscheidende Live-Abweichung: Alle sechs iOS-Produkte hängen an `LottiBabyAbo` (`entl7a7b4e9838`); separate Lite-/Premium-Entitlements fehlen. Der Client erkennt iOS-Tarife über Produkt-IDs. Die lokale Backend-Auflösung nur nach Entitlement-ID kann diese drei Tarife im Live-Bestand nicht unterscheiden. Schritt 4 muss Bestandskompatibilität ausdrücklich behandeln.
- Play Console: noch keine App, Identitätsprüfung läuft, Telefonbestätigung abhängig davon, App-Erstellung gesperrt. RevenueCat: nur App Store, keine Google-App; die aktuelle RC-Sitzung hat laut UI keine Berechtigung, App-Konfigurationen hinzuzufügen.
- Google-Preise, Regionen und Testangebote sind offen. Die EUR-Werte und die 14-Tage-Konstante im Repository sind kein Google-Store-Nachweis.
- Bestehender Webhook ist deployed, JWT-Gatewayprüfung aus. RevenueCat-Verbindung ist aktiv, HMAC eingeschaltet, alle Apps/Ereignisse und beide Umgebungen ausgewählt; Ereignisse zeigen `Sent`. Aktuelle offizielle Dokumentation bestätigt das lokale HMAC-Format einschließlich neuem Signaturzeitpunkt bei Retries. Die Tarifwirkung wurde nicht durch Testevents oder Kundendatenänderungen geprüft.

## Geänderte Dateien dieses Auftrags

- `docs/android-play/product-map.md`: Matrix, Live-/Zielzustand, Quellen, Default-Featurematrix, SDK-/Backendvertrag und Lücken G01–G15.
- `docs/android-play/step-01.md`: Abschluss, Prüfungen, vorhandene Änderungen und Übergabe.

Alle anderen Änderungen bestanden bereits. Keine Commits, kein Reset, keine Staging-Änderung, keine Installation, keine Schlüsselrotation und keine externen Schreibvorgänge.

## Bereits laufende Änderungen

Branch `main`, HEAD `0adbccd` („Refactor application structure and remove obsolete code“). Inventar vor den Dokumentationsänderungen: **78 geänderte versionierte Dateien, 14 unversionierte Status-Einträge** (darunter das Verzeichnis `supabase/tests/`). `git diff --stat`: 1.356 Einfügungen, 680 Löschungen. Keine gestagten Änderungen. Vollständiger damaliger Pfadbestand unten; einzelne Verzeichniseinträge sind keine Dateizählung.

| Bereich | Bereits vorhandene Arbeit / Konfliktfläche |
| --- | --- |
| RevenueCat | `lib/revenuecat.ts` trimmt SDK-Keys, fällt bei leerem bevorzugten Key auf Legacy-Variable zurück, meldet fehlenden Key plattformspezifisch und drosselt Konfigurationswarnungen/Telemetry in Development. `lib/__tests__/revenuecat.test.ts` ergänzt den Android-Test dafür. Diese Arbeit ersetzt noch keine Google-Produktzuordnung |
| Android-Oberflächen | Neue gemeinsame DateTimePicker-/Glass-Komponenten; Änderungen an vielen Tabs, Header/Safe-Area, Modals, Tracking, Icons und Fürsorge. `app/subscription.tsx` enthält lediglich die zusätzliche Header-Prop `topSafeAreaHandled` |
| Auth/Login | Größere Änderungen in `app/(auth)/login.tsx` und neuer Android-Tastaturtest; weitere Auth-/Profil-Safe-Area-Anpassungen |
| Benachrichtigungen | Änderungen in Notifications, Hintergrund-/Sleep-Services, App-Einstellungen/Übersetzungen und bestehenden/neuen Tests |
| Wehen/Backend | `lib/supabase.ts` behandelt wiederhergestellte RPC-Fehler zurückhaltender und normalisiert Zeitfelder; neue Migration `20260910113554_fix_contractions_sync_info_order.sql`, neue Tests. Nicht mit Abo-Backendarbeit verwechseln |
| Weitere Arbeit | Geburtsplan-/PDF-, Krankenhauslisten-, Rezept- und Schlaf-Tests/Anpassungen sowie README und der unversionierte Android-Agentenplan |

Die Paywall-Dateien, `lib/subscriptionAccess.ts`, `lib/subscriptionManagement.ts`, `supabase/functions/revenuecat-webhook/index.ts`, `supabase/functions/_shared/premiumAccess.ts`, `app.json`, `app.config.js` und `eas.json` waren bei Aufnahme gegenüber HEAD unverändert. Ihre bestehenden Lücken sind deshalb nicht den laufenden Android-Änderungen zuzuschreiben.

## Prüfung und Grenzen

1. Git-Status/HEAD, Diff und relevante Implementierung gelesen: Android-Appmodul `:app` aus `android/settings.gradle` (nicht die ebenfalls vorhandene Kopie `android/app 2`), Gradle/Expo/EAS, RevenueCat-Client, Paywall/Verwaltung, Rechte-/Featurecache und lokaler Webhook/Backendhelper/Migrationen.
2. Installierte Pakete geprüft: Expo 57.0.14, React Native 0.86.2, RevenueCat 9.10.5. Native iOS-/Android-Verzeichnisse sind versioniert. Android-Paketkennung `com.LottiBaby.app`, lokale Version 1.0.23/Code 9; EAS nutzt remote Versionierung. Release referenziert lokal Debug-Signierung. Kein Build in diesem Bestandsauftrag.
3. Lokale RevenueCat-Umgebung ausschließlich auf Vorhandensein/Präfix geprüft: iOS `appl_` vorhanden, Android leer. Keine Werte in die Übergabe übernommen. EAS-Environment- und Credential-Bestand nicht live geprüft.
4. Read-only-Dashboardprüfung per Browser: RevenueCat Apps/Offering/Packages/Entitlements einschließlich `All`/Produktdetails/Webhookdetails, Play-Appübersicht und Supabase-Funktionsliste/Webhookübersicht/Settings. URLs und genaue Befunde in `product-map.md`. Backend-Codeansicht erreichbar, aber kein vollständiger Vergleich des deployed Codes; keine Behauptung, Live-Secrets/Migrationen/Featurematrix seien mit Git identisch.
5. Supabase-MCP zeigt andere Projekte und verweigert den Zielprojektzugriff. Browserzugriff auf das korrekte Projekt funktioniert. Kein fremdes Projekt als Ersatz verwendet. Supabase-Changelog-URL war im Webabruf nicht verfügbar; es wurde keine Supabase-API-/Schemaänderung implementiert.
6. Offizielle RevenueCat-Dokumentation zu Google-Basisplänen sowie Webhook-HMAC/Retry-Zeitstempeln mit dem Ist-Code/Dashboard abgeglichen. Die HMAC-Voraussetzung ist unterstützt.
7. Bestehende Tests ausgeführt, **5 Suiten / 29 Tests bestanden**:

```sh
npm test -- --runInBand lib/__tests__/revenuecat.test.ts lib/__tests__/subscriptionAccess.test.ts lib/__tests__/subscriptionFeaturePolicy.test.ts lib/__tests__/paywall-screen.test.tsx lib/__tests__/paywallState.test.ts
```

Die Tests nutzen Mocks. Sie belegen weder reale Play-Käufe noch Android-Basisplanunterstützung, erfolgreiche Backend-Tarifsynchronisation oder Store-Freigabe. Keine neuen Tests für die reine Dokumentationsänderung erstellt. Abschließend Markdown-Matrix, Pfade und ausschließlich eigene Dateiänderungen geprüft.

## Übergabe und nächste Schritte

Schritt 1 ist fertig; Google-Freigabe war hierfür nicht nötig. Schritte 2, 3, 4 und 6 können mit diesem Bestand vorbereitet werden. In separaten Worktrees müssen **diese beiden Dateien, der Agentenplan und die jeweils benötigten laufenden Änderungen** verfügbar sein; ein Worktree von HEAD enthält sie nicht automatisch.

- **Schritt 2:** Android-Build/Signatur und tatsächliche EAS-Umgebung prüfen; vorhandene Android-UI-Arbeit übernehmen. Paketkennung erhalten; die aktuelle lokale Debug-Release-Signierung nicht als produktionsreif behandeln.
- **Schritt 3:** Google-Matrix hinter den vorhandenen RC-Packages implementieren; Store-Preise/Kaufbarkeit, tatsächlichen Herkunftsstore, Bestandsabo-/Doppelaboschutz, Laufzeitwechsel, Login/Logout/Restore prüfen. Die bestehenden sechs iOS-IDs und die Änderungen an Key-Fallback/Logging erhalten.
- **Schritt 4:** Vorrangig gemeinsames Live-Entitlement versus drei fachliche Tiers auflösen. HMAC nicht als erfunden entfernen; stattdessen vorhandenen Vertrag, Ereignisbehandlung, interne REST-IDs, Cache und Live-Deployment abgleichen. Noch keine Produktionsänderung.
- **Schritt 6:** Preis-/Trial-/Regionenaussagen nicht aus Defaults in Store-Texte übernehmen.
- **Schritte 7–10:** Play-Kontofreigabe, App/Build, RC-Rechte/Google-Verbindung und bestätigte kommerzielle Konfiguration sind reale externe Voraussetzungen. Vor Produktanlage Live-Bestand erneut abgleichen und gültige IDs übernehmen.
- **Schritt 11:** Erst nach aktiven Angeboten und installierbarem Play-Testbuild Kauf-/Berechtigungsmatrix mit echten Testzahlungen prüfen.

Die vollständige Liste offener Implementierungs- und Konfigurationspunkte samt Zuständigkeit steht unter G01–G15 in `product-map.md`. Es wurden keine weiteren Agenten gestartet und keine Nachrichten an andere versendet.

## Vollständiger vorgefundener Git-Status

`M` = bereits geändert, `??` = bereits unversioniert. Aufnahme vor Anlage dieser beiden Dokumente.

```text
 M README.md
 M app/(auth)/getUserInfo.tsx
 M app/(auth)/login.tsx
 M app/(tabs)/account-linking.tsx
 M app/(tabs)/baby.tsx
 M app/(tabs)/babyweather.tsx
 M app/(tabs)/countdown.tsx
 M app/(tabs)/daily_old.tsx
 M app/(tabs)/explore.tsx
 M app/(tabs)/home.tsx
 M app/(tabs)/index.tsx
 M app/(tabs)/period-tracker.tsx
 M app/(tabs)/pregnancy-home.tsx
 M app/(tabs)/selfcare.tsx
 M app/(tabs)/shopping-list.tsx
 M app/(tabs)/size-tracker.tsx
 M app/(tabs)/sleep-tracker.tsx
 M app/(tabs)/weight-tracker.tsx
 M app/_layout.tsx
 M app/app-settings.tsx
 M app/auth/reset-password.tsx
 M app/frag-lotti.tsx
 M app/lottis-fuersorge.tsx
 M app/loyalty-cards.tsx
 M app/milestones.tsx
 M app/pregnancy-setup.tsx
 M app/profil.tsx
 M app/recipe-generator.tsx
 M app/subscription-features-admin.tsx
 M app/subscription.tsx
 M app/support.tsx
 M app/tooth-tracker.tsx
 M app/wochenmoment.tsx
 M components/ActivityCard.tsx
 M components/ActivityInputModal.tsx
 M components/BabySizeDetail.tsx
 M components/BabySwitcherButton.tsx
 M components/CareAnalyticsSection.tsx
 M components/CustomActivityDefinitionModal.tsx
 M components/CustomActivityEntryModal.tsx
 M components/FloatingVoiceButton.tsx
 M components/Header.tsx
 M components/LockedFeatureScreen.tsx
 M components/LottiCollection.tsx
 M components/LottiJourneyMap.tsx
 M components/LottiMomentToast.tsx
 M components/LottiWeekCard.tsx
 M components/NightSleepEditor.tsx
 M components/PremiumHighlights.tsx
 M components/ProgressCircle.tsx
 M "components/SleepQuickAddModal 2.tsx"
 M components/SleepQuickAddModal.tsx
 M components/VoiceLogModal.tsx
 M components/advisor/CareDayTimeline.tsx
 M components/caretaker/caretaker-guest-screen.tsx
 M components/caretaker/caretaker-screen.tsx
 M components/modals/IOSBottomDatePicker.tsx
 M components/modals/TextInputOverlay.tsx
 M components/planner/PlannerCaptureModal.tsx
 M components/tracking/SleepTimerFace.tsx
 M components/ui/GlassAvatar.tsx
 M components/ui/GlassCard.tsx
 M components/ui/IconSymbol.tsx
 M hooks/useNotifications.ts
 M lib/__tests__/caretaker-input-restrictions.test.tsx
 M lib/__tests__/caretaker-time-picker.test.tsx
 M lib/__tests__/notifications.test.ts
 M lib/__tests__/onboarding-product-moment.test.tsx
 M lib/__tests__/revenuecat.test.ts
 M lib/appSettingsTranslations.ts
 M lib/background-tasks.ts
 M lib/geburtsplan-utils.ts
 M lib/notificationService.ts
 M lib/notifications.ts
 M lib/revenuecat.ts
 M lib/sleepNotificationService.ts
 M lib/sleepNotificationUtils.ts
 M lib/supabase.ts
?? components/advisor/CareGlassCard.tsx
?? components/ui/DateTimePicker.tsx
?? components/ui/glass-sheet-surface.tsx
?? components/ui/home-glass.tsx
?? docs/android-play-agent-plan.md
?? lib/__tests__/android-date-time-picker.test.tsx
?? lib/__tests__/contractions.test.ts
?? lib/__tests__/geburtsplanPdf.test.ts
?? lib/__tests__/hospital-checklist-localization.test.tsx
?? lib/__tests__/login-android-keyboard.test.tsx
?? lib/__tests__/notification-warnings.test.tsx
?? lib/__tests__/sleep-timer-face.test.tsx
?? supabase/migrations/20260910113554_fix_contractions_sync_info_order.sql
?? supabase/tests/
```
