/**
 * Zyklus-Tracker – Übersetzungskatalog (Deutsch/Englisch).
 *
 * Dieser Katalog ist die i18n-Grenze des Zyklus-Trackers. Sichtbare Texte
 * werden im Screen, in der Prognose-Engine und in den Erinnerungen nur noch
 * über diese Keys bezogen. Deutsch bleibt vorerst die aktive App-Sprache;
 * weitere Sprachen können später an einen globalen Locale-Provider gehängt
 * werden, ohne die Fachlogik erneut anzufassen.
 *
 * Sobald i18n eingeführt wird (Empfehlung: expo-localization + i18next),
 * können die Keys 1:1 übernommen werden. Platzhalter im Format {{name}}.
 */

export type CycleLocale = 'de' | 'en';

export const DEFAULT_CYCLE_LOCALE: CycleLocale = 'de';

type Catalog = Record<string, string>;

const de: Catalog = {
  // Allgemein
  'common.error': 'Fehler',
  'common.today': 'Heute',
  'common.todayUpper': 'HEUTE',
  'common.later': 'Später',
  'common.save': 'Übernehmen',
  'common.saving': 'Speichert ...',
  'common.settings': 'Einstellungen',

  // Screen: Header & Hero
  'screen.title': 'Zyklus',
  'screen.loadError': 'Zyklusdaten konnten nicht geladen werden.',
  'screen.settings.open': 'Zyklus-Einstellungen öffnen',
  'screen.settings.close': 'Einstellungen schließen',
  'hero.backToToday': 'Zurück zu heute',
  'hero.ringDayOf': 'von {{cycleLength}}',
  'hero.ringOpen': 'Zyklus offen',
  'hero.extended': 'Zyklustag {{day}} · Zyklus aktuell verlängert',
  'hero.dataError': 'Tabellen noch nicht verfügbar oder Datenbasis leer: {{error}}',
  'hero.legend.period': 'Periode',
  'hero.legend.fertile': 'Fruchtbar',
  'hero.legend.ovulation': 'Eisprung',
  'hero.legend.luteal': 'Luteal',

  // Schnellzugriff
  'quickPeriod.logged': 'Periode ist eingetragen',
  'quickPeriod.startToday': 'Periode heute gestartet',
  'quickPeriod.edit': '{{intensity}} · zum Bearbeiten tippen',
  'quickPeriod.helper': 'Schnell erfassen und Stärke ergänzen',

  // Sektionen
  'section.glance.title': 'Auf einen Blick',
  'section.glance.subtitle':
    'Deine wichtigsten Termine aus der Prognose – jeweils als Zeitfenster, nicht als exakter Tag.',
  'section.glance.footnote':
    'Alle Fenster sind Schätzungen mit etwa ±{{uncertaintyDays}} Tagen Spanne. Die Prognose-Sicherheit zeigt, wie stabil deine bisherigen Zyklen waren.',
  'section.calendar.title': 'Kalender & Eintragen',
  'section.calendar.subtitle':
    'Wähle einen Tag aus und erfasse Blutung, Symptome und Körpersignale – Lotti speichert automatisch.',
  'section.forecast.title': 'Prognose verstehen',
  'section.forecast.subtitle': 'Was hinter der Vorhersage steckt – und wie du sie genauer machst.',
  'section.history.title': 'Dein Verlauf',
  'section.history.subtitle': 'So regelmäßig waren deine Zyklen zuletzt.',
  'section.settings.title': 'Erinnerungen & Einstellungen',
  'section.settings.subtitle': 'Alles optional – du entscheidest, wobei Lotti dich unterstützt.',

  // Auf einen Blick (Pills)
  'pill.nextPeriod': 'Nächste Periode',
  'pill.ovulationWindow': 'Ovulationsfenster',
  'pill.fertileWindow': 'Fruchtbares Fenster',
  'pill.confidence': 'Prognose-Sicherheit',
  'pill.currentlyOpen': 'Derzeit offen',
  'pill.currentlyUncertain': 'Derzeit unsicher',
  'forecast.windowHint':
    'Zeitfenster statt exakter Tage · mögliche Abweichung etwa ±{{uncertaintyDays}} Tage',
  'forecast.confidence':
    'Prognose-Sicherheit {{confidence}} % · verbessert sich mit jedem Zyklus',

  // Monatsansicht
  'monthLauncher.title': 'Monatsansicht',
  'monthLauncher.label': 'Monatsansicht · {{month}}',
  'monthLauncher.subtitle': 'Kalender öffnen und Tage direkt auswählen.',
  'monthLauncher.selectDays': 'Tage auswählen',

  // Tagesprotokoll
  'section.outlook': 'Dein Ausblick',
  'section.dailyLog': 'Tagesprotokoll',
  'section.analysis': 'Auswertung',
  'daily.selectedDay': 'AUSGEWÄHLTER TAG',
  'daily.status.saving': 'Speichert',
  'daily.status.saved': 'Gespeichert',
  'daily.status.empty': 'Noch leer',
  'daily.noBleeding': 'Keine Blutung',
  'daily.noSymptoms': 'Keine Symptome',
  'daily.symptomCount': '{{count}} Symptome',
  'daily.noTemperature': 'Keine Temperatur',
  'daily.edit': 'Eintrag bearbeiten',
  'daily.add': 'Diesen Tag eintragen',
  'daily.predictionLegend':
    'Umrandet = prognostiziert · ausgefüllt = tatsächlich eingetragen',

  // Faktoren-Karte
  'factors.title': 'Warum gerade diese Prognose?',
  'factors.patternTitle': '✨ Dein Muster',
  'factors.showDetails': 'Warum diese Prognose? Details anzeigen',
  'factors.hideDetails': 'Details ausblenden',
  'factors.subtitle':
    'Vier Signale fließen in die Prognose ein. Je mehr du davon erfasst, desto treffsicherer wird sie.',
  'factors.calendar': 'Kalender',
  'factors.lh': 'LH-Test',
  'factors.mucus': 'Zervixschleim',
  'factors.bbt': 'Basaltemperatur',

  // Zyklus-Verlauf (Timeline)
  'timeline.title': 'Zyklus-Verlauf',
  'timeline.subtitle':
    'So verteilen sich deine Phasen über den aktuellen Zyklus: Rot ist die Periode, Lila das fruchtbare Fenster mit Eisprung.',
  'timeline.hint': '◀ Wisch für den ganzen Zyklus',

  // Historie
  'history.title': 'Deine letzten Zyklen',
  'history.subtitle':
    'Jeder Balken ist ein Zyklus: Der rote Anteil ist deine Periode, die Länge der Abstand bis zur nächsten. Je ähnlicher die Balken, desto verlässlicher die Prognose.',
  'history.currentDay': 'Tag {{day}}',
  'history.lengthDays': '{{days}} Tage',
  'history.statsAverage': 'Ø {{days}} Tage',
  'history.statsVariability': 'Schwankung ±{{days}} Tage',
  'history.statsRange': '{{min}}–{{max}} Tage',
  'history.shortSubtitle':
    'Der rote Anteil ist deine Periode – je ähnlicher die Balken, desto verlässlicher die Prognose.',

  // Erinnerungen (Karte)
  'reminders.title': 'Erinnerungen',
  'reminders.subtitle': 'Lotti sagt dir rechtzeitig Bescheid – du musst nicht selbst rechnen.',
  'reminders.period.label': 'Periode kündigt sich an',
  'reminders.period.helper': '2 Tage vor dem prognostizierten Start',
  'reminders.fertile.label': 'Fruchtbares Fenster',
  'reminders.fertile.helper': '1 Tag bevor dein Fenster beginnt',
  'reminders.discreet.label': 'Diskrete Mitteilungen',
  'reminders.discreet.helper': 'Neutraler Text auf dem Sperrbildschirm',
  'reminders.permissionHint':
    'Mitteilungen sind in den Systemeinstellungen deaktiviert – die Erinnerungen können erst dann ankommen.',
  'reminders.permissionAlert.title': 'Mitteilungen deaktiviert',
  'reminders.permissionAlert.body':
    'Erlaube Lotti Mitteilungen in den Systemeinstellungen, damit Zyklus-Erinnerungen ankommen.',

  // Erinnerungen (Notification-Inhalte)
  'notification.period.title': 'Deine Periode kündigt sich an',
  'notification.period.body':
    'Deine Periode kommt voraussichtlich in etwa {{days}} Tagen. Pack dir gern schon alles zurecht.',
  'notification.fertile.title': 'Dein fruchtbares Fenster beginnt bald',
  'notification.fertile.body': 'Ab morgen beginnt laut Prognose dein fruchtbares Fenster.',
  'notification.discreet.title': 'Kleine Erinnerung 🌸',
  'notification.discreet.body': 'Wirf heute einen Blick in Lotti.',

  // Lebensphase
  'lifePhase.title': 'Deine Lebensphase',
  'lifePhase.subtitle':
    'Damit die Prognose ehrlich bleibt: Lotti rechnet dann mit größeren Spannen statt falscher Präzision.',
  'lifePhase.postpartum.label': 'Wochenbett / nach der Geburt',
  'lifePhase.postpartum.helper': 'Dein Zyklus pendelt sich gerade wieder ein',
  'lifePhase.breastfeeding.label': 'Ich stille',
  'lifePhase.breastfeeding.helper': 'Stillen kann den Eisprung verzögern',
  'lifePhase.perimenopause.label': 'Perimenopause',
  'lifePhase.perimenopause.helper': 'Zyklen dürfen unregelmäßiger werden',
  'lifePhase.saveError.title': 'Fehler',
  'lifePhase.saveError.body':
    'Einstellung konnte nicht gespeichert werden. Bitte versuche es erneut.',

  // Einstellungen
  'settings.subtitle': 'Zyklus & Erinnerungen',
  'settings.remindersGroup': 'ERINNERUNGEN',
  'settings.lifePhaseGroup': 'LEBENSPHASE · FÜR EINE EHRLICHE PROGNOSE',

  // Ersteinrichtung
  'setup.title': 'Wann war der Beginn deiner letzten Periode?',
  'setup.body':
    'Damit kann der Zyklus-Tracker direkt ein erstes Perioden- und Fruchtbarkeitsfenster schätzen.',
  'setup.hint':
    'Wir starten zunächst mit 28 Tagen Zykluslänge, 5 Tagen Blutung und 14 Tagen Lutealphase. Das kannst du später mit echten Daten verfeinern.',
  'setup.dateLabel': 'Letzte Periode gestartet am',
  'setup.pickerTitle': 'Beginn der letzten Periode',
  'setup.saveError': 'Die letzte Periode konnte nicht gespeichert werden.',

  // Engine: Modus-Hinweise
  'mode.breastfeeding':
    'Stillzeit-Modus: Solange du stillst, kann sich der Eisprung deutlich verschieben – Lotti rechnet darum mit größeren Spannen. Schwankungen sind völlig normal.',
  'mode.postpartum':
    'Wochenbett-Modus: Nach der Geburt pendelt sich dein Zyklus erst wieder ein – Lotti rechnet darum mit größeren Spannen. Schwankungen sind völlig normal.',
  'mode.perimenopause':
    'Perimenopause-Modus: Zyklen dürfen jetzt unregelmäßiger werden – die Prognose nutzt bewusst größere Spannen.',

  // Engine: Headlines & Texte
  'engine.headline.notEnoughData': 'Noch zu wenig Zyklusdaten',
  'engine.headline.peak': 'Heute Peak-Fertilität',
  'engine.headline.high': 'Heute hoch fruchtbar',
  'engine.headline.medium': 'Heute moderat fruchtbar',
  'engine.headline.periodSoon': 'Periode steht bevor',
  'engine.headline.fertileOver': 'Fertiles Fenster vermutlich vorbei',
  'engine.headline.low': 'Heute eher geringe Fruchtbarkeit',
  'engine.subline.default': 'Erfasse Periodenstart, Blutungstage und Körpersignale',
  'engine.subline.ovulationInDays': 'Zyklustag {{day}} · Eisprung vermutlich in {{days}} Tagen',
  'engine.subline.ovulationTomorrow': 'Zyklustag {{day}} · Eisprung vermutlich morgen',
  'engine.subline.ovulationToday': 'Zyklustag {{day}} · Eisprung wahrscheinlich heute',
  'engine.subline.ovulationYesterday': 'Zyklustag {{day}} · Eisprung vermutlich gestern',
  'engine.subline.nextPeriodInDays': 'Zyklustag {{day}} · Nächste Periode in ca. {{days}} Tagen',
  'engine.caption.default': 'Mit 2-3 erfassten Zyklen werden Vorhersagen deutlich besser.',
  'engine.caption.fertileOpen': 'Dein fruchtbares Fenster ist gerade geöffnet.',
  'engine.caption.likelyFertile': 'Du befindest dich wahrscheinlich im fruchtbaren Fenster.',
  'engine.caption.ovulationConfirmed':
    'Der Temperaturverlauf spricht dafür, dass der Eisprung bereits stattgefunden hat.',
  'engine.caption.nextPeriodUncertainty':
    'Die nächste Periode wird mit einer Unsicherheit von etwa {{days}} Tagen geschätzt.',
  'engine.insight.notEnoughData':
    'Speichere zunächst den letzten Periodenbeginn und einige Blutungstage, dann wird die Prognose persönlich.',
  'engine.insight.stable':
    'Deine letzten Zyklen wirken aktuell recht stabil. Der Kalenderanteil kann darum stärker gewichtet werden.',
  'engine.insight.variable':
    'Deine Zykluslängen schwanken stark. LH-Tests und Zervixschleim sollten für die Vorhersage mehr Gewicht bekommen.',
  'engine.insight.usable':
    'Deine Kalenderdaten sind brauchbar, aber Körpersignale machen die Ovulationsschätzung deutlich besser.',
  'engine.insight.fewCycles':
    'Aktuell arbeitet die Prognose noch mit wenigen Zyklen. Standardmäßig wird eine Lutealphase von ca. {{days}} Tagen genutzt.',
  'engine.factor.calendar.history':
    'Vorhersage aus {{cycles}} erkannten Zyklen, Unsicherheit etwa {{days}} Tage.',
  'engine.factor.calendar.none': 'Noch keine Periodenhistorie vorhanden.',
  'engine.factor.lh.peak':
    'LH-Peak gemeldet, Eisprung oft innerhalb der nächsten 24–48 Stunden.',
  'engine.factor.lh.high': 'LH steigt, das fruchtbare Fenster wird wahrscheinlicher.',
  'engine.factor.lh.negative': 'Noch kein LH-Anstieg protokolliert.',
  'engine.factor.lh.none': 'Kein LH-Test für heute gespeichert.',
  'engine.factor.mucus.eggwhite':
    'Spinnbarer Schleim passt sehr gut zum Eisprungfenster.',
  'engine.factor.mucus.watery': 'Wässriger Schleim spricht für hohe Fruchtbarkeit.',
  'engine.factor.mucus.creamy':
    'Cremiger Schleim zeigt ein mittleres Fertilitätssignal.',
  'engine.factor.mucus.sticky': 'Klebriger Schleim ist meist weniger fruchtbar.',
  'engine.factor.mucus.dry': 'Trockene Beobachtung spricht eher gegen hohe Fruchtbarkeit.',
  'engine.factor.mucus.none': 'Noch kein Zervixschleim-Eintrag für heute.',
  'engine.factor.bbt.none': 'Noch kein temperaturbasierter Eisprung-Hinweis gespeichert.',
  'engine.factor.bbt.confirmedRecent': 'Temperaturanstieg bestätigt den Eisprung rückwirkend.',
  'engine.factor.bbt.confirmedPast':
    'Der Temperaturverlauf spricht für einen bereits erfolgten Eisprung.',
  'engine.factor.bbt.unconfirmed':
    'Temperatur erfasst, aber noch kein bestätigter Anstieg über 3 Tage.',

  // Sonstiges
  'log.saveError': 'Der Zyklus-Eintrag für diesen Tag konnte nicht gespeichert werden.',
  'disclaimer':
    'Vorhersagen sind Schätzungen und ersetzen keine medizinische Beratung. Bei stark schwankenden Zyklen, Blutungen zwischen Perioden oder langem Kinderwunsch sollte die Situation ärztlich abgeklärt werden.',
};

const en: Catalog = {
  // General
  'common.error': 'Error',
  'common.today': 'Today',
  'common.todayUpper': 'TODAY',
  'common.later': 'Later',
  'common.save': 'Apply',
  'common.saving': 'Saving ...',
  'common.settings': 'Settings',

  // Screen: header & hero
  'screen.title': 'Cycle',
  'screen.loadError': 'Cycle data could not be loaded.',
  'screen.settings.open': 'Open cycle settings',
  'screen.settings.close': 'Close settings',
  'hero.backToToday': 'Back to today',
  'hero.ringDayOf': 'of {{cycleLength}}',
  'hero.ringOpen': 'Cycle ongoing',
  'hero.extended': 'Cycle day {{day}} · cycle currently extended',
  'hero.dataError': 'Tables not available yet or no data: {{error}}',
  'hero.legend.period': 'Period',
  'hero.legend.fertile': 'Fertile',
  'hero.legend.ovulation': 'Ovulation',
  'hero.legend.luteal': 'Luteal',

  // Quick action
  'quickPeriod.logged': 'Period is logged',
  'quickPeriod.startToday': 'Period started today',
  'quickPeriod.edit': '{{intensity}} · tap to edit',
  'quickPeriod.helper': 'Quickly log it and add the flow intensity',

  // Sections
  'section.glance.title': 'At a glance',
  'section.glance.subtitle':
    'Your key dates from the forecast – shown as time windows, not exact days.',
  'section.glance.footnote':
    'All windows are estimates with a range of about ±{{uncertaintyDays}} days. Forecast confidence shows how stable your past cycles have been.',
  'section.calendar.title': 'Calendar & logging',
  'section.calendar.subtitle':
    'Pick a day and log bleeding, symptoms and body signals – Lotti saves automatically.',
  'section.forecast.title': 'Understanding your forecast',
  'section.forecast.subtitle': 'What drives the prediction – and how to make it more accurate.',
  'section.history.title': 'Your history',
  'section.history.subtitle': 'How regular your recent cycles have been.',
  'section.settings.title': 'Reminders & settings',
  'section.settings.subtitle': 'Everything is optional – you decide how Lotti supports you.',

  // At a glance (pills)
  'pill.nextPeriod': 'Next period',
  'pill.ovulationWindow': 'Ovulation window',
  'pill.fertileWindow': 'Fertile window',
  'pill.confidence': 'Forecast confidence',
  'pill.currentlyOpen': 'Currently ongoing',
  'pill.currentlyUncertain': 'Currently uncertain',
  'forecast.windowHint':
    'Time windows instead of exact days · possible variation about ±{{uncertaintyDays}} days',
  'forecast.confidence':
    'Forecast confidence {{confidence}}% · improves with every cycle',

  // Month view
  'monthLauncher.title': 'Month view',
  'monthLauncher.label': 'Month view · {{month}}',
  'monthLauncher.subtitle': 'Open the calendar and pick days directly.',
  'monthLauncher.selectDays': 'Select days',

  // Daily log
  'section.outlook': 'Your outlook',
  'section.dailyLog': 'Daily log',
  'section.analysis': 'Analysis',
  'daily.selectedDay': 'SELECTED DAY',
  'daily.status.saving': 'Saving',
  'daily.status.saved': 'Saved',
  'daily.status.empty': 'Still empty',
  'daily.noBleeding': 'No bleeding',
  'daily.noSymptoms': 'No symptoms',
  'daily.symptomCount': '{{count}} symptoms',
  'daily.noTemperature': 'No temperature',
  'daily.edit': 'Edit entry',
  'daily.add': 'Log this day',
  'daily.predictionLegend':
    'Outlined = predicted · filled = actually logged',

  // Factors card
  'factors.title': 'Why this forecast?',
  'factors.patternTitle': '✨ Your pattern',
  'factors.showDetails': 'Why this forecast? Show details',
  'factors.hideDetails': 'Hide details',
  'factors.subtitle':
    'Four signals feed into the forecast. The more of them you track, the more accurate it gets.',
  'factors.calendar': 'Calendar',
  'factors.lh': 'LH test',
  'factors.mucus': 'Cervical mucus',
  'factors.bbt': 'Basal temperature',

  // Cycle timeline
  'timeline.title': 'Cycle timeline',
  'timeline.subtitle':
    'How your phases spread across the current cycle: red is your period, purple the fertile window with ovulation.',
  'timeline.hint': '◀ Swipe to see the whole cycle',

  // History
  'history.title': 'Your recent cycles',
  'history.subtitle':
    'Each bar is one cycle: the red part is your period, the length is the gap to the next one. The more alike the bars, the more reliable the forecast.',
  'history.currentDay': 'Day {{day}}',
  'history.lengthDays': '{{days}} days',
  'history.statsAverage': 'Avg {{days}} days',
  'history.statsVariability': 'Variation ±{{days}} days',
  'history.statsRange': '{{min}}–{{max}} days',
  'history.shortSubtitle':
    'The red part is your period – the more alike the bars, the more reliable the forecast.',

  // Reminders (card)
  'reminders.title': 'Reminders',
  'reminders.subtitle': "Lotti lets you know in time – no need to do the math yourself.",
  'reminders.period.label': 'Period coming up',
  'reminders.period.helper': '2 days before the predicted start',
  'reminders.fertile.label': 'Fertile window',
  'reminders.fertile.helper': '1 day before your window begins',
  'reminders.discreet.label': 'Discreet notifications',
  'reminders.discreet.helper': 'Neutral text on your lock screen',
  'reminders.permissionHint':
    'Notifications are disabled in your system settings – reminders can only arrive once they are allowed.',
  'reminders.permissionAlert.title': 'Notifications disabled',
  'reminders.permissionAlert.body':
    'Allow notifications for Lotti in your system settings so cycle reminders can reach you.',

  // Reminders (notification content)
  'notification.period.title': 'Your period is coming up',
  'notification.period.body':
    'Your period is expected in about {{days}} days. Feel free to get everything ready.',
  'notification.fertile.title': 'Your fertile window starts soon',
  'notification.fertile.body': 'According to your forecast, your fertile window starts tomorrow.',
  'notification.discreet.title': 'A little reminder 🌸',
  'notification.discreet.body': 'Take a look at Lotti today.',

  // Life phase
  'lifePhase.title': 'Your life phase',
  'lifePhase.subtitle':
    'To keep the forecast honest, Lotti uses wider ranges instead of false precision.',
  'lifePhase.postpartum.label': 'Postpartum / after birth',
  'lifePhase.postpartum.helper': 'Your cycle is still settling back in',
  'lifePhase.breastfeeding.label': "I'm breastfeeding",
  'lifePhase.breastfeeding.helper': 'Breastfeeding can delay ovulation',
  'lifePhase.perimenopause.label': 'Perimenopause',
  'lifePhase.perimenopause.helper': 'Cycles may become more irregular',
  'lifePhase.saveError.title': 'Error',
  'lifePhase.saveError.body': 'The setting could not be saved. Please try again.',

  // Settings
  'settings.subtitle': 'Cycle & reminders',
  'settings.remindersGroup': 'REMINDERS',
  'settings.lifePhaseGroup': 'LIFE STAGE · FOR AN HONEST FORECAST',

  // Initial setup
  'setup.title': 'When did your last period start?',
  'setup.body':
    'This lets the cycle tracker estimate an initial period and fertile window right away.',
  'setup.hint':
    'We start with a 28-day cycle, 5 days of bleeding and a 14-day luteal phase. You can refine this later with real data.',
  'setup.dateLabel': 'Last period started on',
  'setup.pickerTitle': 'Start of last period',
  'setup.saveError': 'Your last period could not be saved.',

  // Engine: mode notes
  'mode.breastfeeding':
    'Breastfeeding mode: While you are nursing, ovulation can shift considerably – Lotti therefore uses wider ranges. Fluctuations are completely normal.',
  'mode.postpartum':
    'Postpartum mode: After birth your cycle needs time to settle back in – Lotti therefore uses wider ranges. Fluctuations are completely normal.',
  'mode.perimenopause':
    'Perimenopause mode: Cycles may become more irregular now – the forecast deliberately uses wider ranges.',

  // Engine: headlines & texts
  'engine.headline.notEnoughData': 'Not enough cycle data yet',
  'engine.headline.peak': 'Peak fertility today',
  'engine.headline.high': 'Highly fertile today',
  'engine.headline.medium': 'Moderately fertile today',
  'engine.headline.periodSoon': 'Period coming up',
  'engine.headline.fertileOver': 'Fertile window probably over',
  'engine.headline.low': 'Rather low fertility today',
  'engine.subline.default': 'Log your period start, bleeding days and body signals',
  'engine.subline.ovulationInDays': 'Cycle day {{day}} · ovulation likely in {{days}} days',
  'engine.subline.ovulationTomorrow': 'Cycle day {{day}} · ovulation likely tomorrow',
  'engine.subline.ovulationToday': 'Cycle day {{day}} · ovulation likely today',
  'engine.subline.ovulationYesterday': 'Cycle day {{day}} · ovulation likely yesterday',
  'engine.subline.nextPeriodInDays': 'Cycle day {{day}} · next period in about {{days}} days',
  'engine.caption.default': 'With 2-3 tracked cycles, predictions get much better.',
  'engine.caption.fertileOpen': 'Your fertile window is open right now.',
  'engine.caption.likelyFertile': 'You are probably in your fertile window.',
  'engine.caption.ovulationConfirmed':
    'Your temperature curve suggests ovulation has already happened.',
  'engine.caption.nextPeriodUncertainty':
    'Your next period is estimated with an uncertainty of about {{days}} days.',
  'engine.insight.notEnoughData':
    'Save the start of your last period and a few bleeding days first, then your forecast becomes personal.',
  'engine.insight.stable':
    'Your recent cycles currently look quite stable, so calendar data can carry more weight.',
  'engine.insight.variable':
    'Your cycle lengths vary considerably. LH tests and cervical mucus should carry more weight in the forecast.',
  'engine.insight.usable':
    'Your calendar data is useful, but body signals make the ovulation estimate much more accurate.',
  'engine.insight.fewCycles':
    'The forecast is still based on only a few cycles. A luteal phase of about {{days}} days is used by default.',
  'engine.factor.calendar.history':
    'Forecast based on {{cycles}} detected cycles, with about {{days}} days of uncertainty.',
  'engine.factor.calendar.none': 'No period history is available yet.',
  'engine.factor.lh.peak': 'LH peak logged; ovulation often follows within 24–48 hours.',
  'engine.factor.lh.high': 'LH is rising, making the fertile window more likely.',
  'engine.factor.lh.negative': 'No LH rise has been logged yet.',
  'engine.factor.lh.none': 'No LH test is saved for today.',
  'engine.factor.mucus.eggwhite': 'Egg-white mucus fits the ovulation window very well.',
  'engine.factor.mucus.watery': 'Watery mucus suggests high fertility.',
  'engine.factor.mucus.creamy': 'Creamy mucus indicates a moderate fertility signal.',
  'engine.factor.mucus.sticky': 'Sticky mucus is usually less fertile.',
  'engine.factor.mucus.dry': 'Dry mucus tends to argue against high fertility.',
  'engine.factor.mucus.none': 'No cervical mucus entry is saved for today.',
  'engine.factor.bbt.none': 'No temperature-based ovulation signal is saved yet.',
  'engine.factor.bbt.confirmedRecent': 'The temperature rise confirms ovulation retrospectively.',
  'engine.factor.bbt.confirmedPast':
    'The temperature curve suggests ovulation has already occurred.',
  'engine.factor.bbt.unconfirmed':
    'Temperature logged, but no confirmed rise across 3 days yet.',

  // Misc
  'log.saveError': 'The cycle entry for this day could not be saved.',
  'disclaimer':
    'Predictions are estimates and do not replace medical advice. If your cycles fluctuate strongly, you bleed between periods or you have been trying to conceive for a long time, please see a doctor.',
};

export const CYCLE_TRANSLATIONS: Record<CycleLocale, Catalog> = { de, en };

/**
 * Mini-Helfer für die spätere Anbindung: Text zu einem Key inkl.
 * {{platzhalter}}-Ersetzung. Fällt auf Deutsch zurück.
 */
export const translateCycleText = (
  locale: CycleLocale,
  key: string,
  params?: Record<string, string | number>,
): string => {
  const template = CYCLE_TRANSLATIONS[locale]?.[key] ?? CYCLE_TRANSLATIONS.de[key] ?? key;
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
    params[name] !== undefined ? String(params[name]) : '',
  );
};
