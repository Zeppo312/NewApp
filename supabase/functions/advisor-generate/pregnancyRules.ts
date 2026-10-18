// Lottis Fürsorge — Regel-Engine für die Schwangerschaft (Kopie).
//
// Bewusst ohne Imports. Metro blockt den Ordner `supabase/`, Deno-Functions
// dürfen nicht aus `lib/` importieren – deshalb ist diese Datei eine 1:1-Kopie von
// lib/advisor/pregnancyRules.ts (dort ändern, dann hierher kopieren). Beide Dateien müssen
// identisch bleiben (Test: lib/__tests__/advisorPregnancy.test.ts prüft das).
// Die App nutzt die Regeln als Sofort-/Offline-Fallback, der Server für den
// persistierten Tageshinweis plus optionale KI-Formulierung.

export type PregnancyLocale = 'de' | 'en' | 'es';
export type PregnancyAdvisorTone = 'positive' | 'neutral' | 'gentle';
/** Gleiche Kategorien wie beim Baby, damit Themen-Einstellungen und die
 *  category-Spalte in advisor_messages unverändert gelten (feeding = Trinken). */
export type PregnancyAdvisorCategory = 'weather' | 'sleep' | 'feeding' | 'motivation';

/** Teilmenge von lib/advisor/pregnancySignals.ts (PregnancySignals). */
export interface PregnancyRuleSignals {
  motherName: string;
  week: number | null;
  day: number | null;
  trimester: 1 | 2 | 3 | null;
  daysUntilDue: number | null;
  selfcare: {
    hasToday: boolean;
    checkinsLast7Days: number;
    latestMood: 'great' | 'good' | 'okay' | 'bad' | 'awful' | null;
    latestSleepHours: number | null;
    latestWaterIntake: number | null;
    latestExerciseDone: boolean | null;
    averageSleepHours: number | null;
    averageWaterIntake: number | null;
    exerciseDaysLast7: number;
    lowMoodStreak: number;
  };
  weight: {
    latestKg: number | null;
    change30Days: number | null;
    entriesLast30Days: number;
  };
  contractions: {
    countLast24h: number;
    averageIntervalMinutes: number | null;
    averageDurationSeconds: number | null;
  };
  nextAppointment: { title: string; inDays: number } | null;
  openQuestionCount: number;
  checklist: { checked: number; total: number };
  hasBirthPlan: boolean;
  partnerFirstName: string | null;
  context?: { localHour: number; localMinute: number };
  weather: {
    available: boolean;
    temperature: number | null;
    isHot: boolean;
    isCold: boolean;
    uvIndex?: number | null;
    rainProbability?: number | null;
    isHighUv?: boolean;
    isRainy?: boolean;
  };
}

export interface PregnancyRuleCandidate {
  ruleId: string;
  priority: number; // 1 = höchste
  category: PregnancyAdvisorCategory;
  tone: PregnancyAdvisorTone;
  emoji: string;
  title: string;
  headline: string;
  body: string;
  /** Geprüfter Kerninhalt – einzige inhaltliche Quelle für die KI. */
  coreContent: string;
  reasons: string[];
  facts: Record<string, unknown>;
}

export const PREGNANCY_RULE_IDS = [
  'preg_contractions_regular',
  'preg_hot_low_water',
  'preg_high_uv',
  'preg_hot',
  'preg_cold',
  'preg_low_water',
  'preg_low_sleep',
  'preg_low_mood',
  'preg_appointment_soon',
  'preg_hospital_bag',
  'preg_birth_plan',
  'preg_open_questions',
  'preg_rain',
  'preg_no_checkin',
  'preg_all_good',
  'preg_learning',
] as const;
export type PregnancyRuleId = (typeof PREGNANCY_RULE_IDS)[number];

/** Unter dieser Trinkmenge (Gläser laut Check-in) erinnert Lotti ans Trinken. */
export const LOW_WATER_GLASSES = 6;
/** Unter dieser Schlafdauer (Std. laut Check-in) greift der Schlaf-Hinweis. */
export const LOW_SLEEP_HOURS = 6;
/** Ab SSW 34 gehört die Kliniktasche auf die Liste, ab SSW 30 der Geburtsplan. */
export const HOSPITAL_BAG_WEEK = 34;
export const BIRTH_PLAN_WEEK = 30;

const pick = <T>(locale: PregnancyLocale, values: Record<PregnancyLocale, T>): T =>
  values[locale];

const weekLabel = (s: PregnancyRuleSignals, locale: PregnancyLocale) =>
  s.week == null
    ? ''
    : pick(locale, {
        de: `SSW ${s.week}`,
        en: `week ${s.week}`,
        es: `semana ${s.week}`,
      });

type Copy = {
  title: string;
  headline: string;
  body: string;
  coreContent: string;
  reasons: string[];
};

/** Lokalisierte Texte je Regel. `body` ist versandfertig (KI-Fallback). */
export const pregnancyRuleCopy = (
  ruleId: PregnancyRuleId,
  s: PregnancyRuleSignals,
  locale: PregnancyLocale,
): Copy => {
  const week = weekLabel(s, locale);
  const weekReason = s.week == null
    ? pick(locale, { de: 'Kein Entbindungstermin hinterlegt', en: 'No due date saved', es: 'Sin fecha prevista guardada' })
    : pick(locale, {
        de: `${week} (${s.trimester}. Trimester)`,
        en: `${week} (trimester ${s.trimester})`,
        es: `${week} (${s.trimester}.º trimestre)`,
      });
  const water = s.selfcare.latestWaterIntake ?? s.selfcare.averageWaterIntake ?? 0;
  const sleep = s.selfcare.latestSleepHours ?? s.selfcare.averageSleepHours ?? 0;
  const temp = s.weather.temperature ?? '–';
  const uv = s.weather.uvIndex ?? '–';
  const rain = Math.round(s.weather.rainProbability ?? 0);
  const appt = s.nextAppointment;
  const apptWhen = appt
    ? appt.inDays === 0
      ? pick(locale, { de: 'heute', en: 'today', es: 'hoy' })
      : appt.inDays === 1
        ? pick(locale, { de: 'morgen', en: 'tomorrow', es: 'mañana' })
        : pick(locale, { de: `in ${appt.inDays} Tagen`, en: `in ${appt.inDays} days`, es: `en ${appt.inDays} días` })
    : '';
  const questions = s.openQuestionCount;
  const bag = s.checklist;

  const important = pick(locale, { de: 'Heute wichtig', en: 'Important today', es: 'Importante hoy' });
  const goodToKnow = pick(locale, { de: 'Gut zu wissen', en: 'Good to know', es: 'Conviene saberlo' });

  switch (ruleId) {
    case 'preg_contractions_regular':
      return {
        title: important,
        headline: pick(locale, {
          de: 'Regelmäßige Wehen – melde dich',
          en: 'Regular contractions – reach out',
          es: 'Contracciones regulares: avisa',
        }),
        body: pick(locale, {
          de: `Du hast in den letzten 24 Stunden ${s.contractions.countLast24h} Wehen erfasst, im Schnitt alle ${s.contractions.averageIntervalMinutes} Minuten. Ruf bitte deine Hebamme oder die Klinik an – sie sagen dir, ob es losgeht.`,
          en: `You logged ${s.contractions.countLast24h} contractions in the last 24 hours, about every ${s.contractions.averageIntervalMinutes} minutes. Please call your midwife or the clinic – they can tell you whether it is time.`,
          es: `Has registrado ${s.contractions.countLast24h} contracciones en las últimas 24 horas, cada ${s.contractions.averageIntervalMinutes} minutos de media. Llama a tu matrona o al hospital: ellos te dirán si ha llegado el momento.`,
        }),
        coreContent:
          'Contractions are frequent and regular according to the log. Calmly recommend calling the midwife or clinic now; do not assess whether labour has started.',
        reasons: [
          pick(locale, {
            de: `${s.contractions.countLast24h} Wehen in 24 Std., Ø Abstand ${s.contractions.averageIntervalMinutes} Min.`,
            en: `${s.contractions.countLast24h} contractions in 24 h, avg. interval ${s.contractions.averageIntervalMinutes} min`,
            es: `${s.contractions.countLast24h} contracciones en 24 h, intervalo medio ${s.contractions.averageIntervalMinutes} min`,
          }),
          weekReason,
        ],
      };
    case 'preg_hot_low_water':
      return {
        title: important,
        headline: pick(locale, {
          de: 'Heute besonders viel trinken',
          en: 'Drink extra today',
          es: 'Hoy bebe más de lo habitual',
        }),
        body: pick(locale, {
          de: `Es wird heute ${temp}° warm und dein Check-in zeigt erst ${water} Gläser. In der Schwangerschaft braucht dein Körper bei Hitze deutlich mehr – stell dir eine Flasche in Reichweite und such dir Schatten.`,
          en: `It will reach ${temp}° today and your check-in shows only ${water} glasses so far. Pregnancy plus heat means your body needs noticeably more – keep a bottle within reach and stay in the shade.`,
          es: `Hoy hará ${temp}° y tu check-in muestra solo ${water} vasos. En el embarazo, con calor, tu cuerpo necesita bastante más: ten una botella a mano y busca la sombra.`,
        }),
        coreContent:
          'Warm weather and a low water intake in the check-in coincide. Gently recommend drinking more and staying in the shade; no medical assessment.',
        reasons: [
          pick(locale, { de: `Tageshöchstwert ${temp}°`, en: `Daily high ${temp}°`, es: `Máxima del día ${temp}°` }),
          pick(locale, { de: `${water} Gläser laut Check-in`, en: `${water} glasses per check-in`, es: `${water} vasos según el check-in` }),
          weekReason,
        ],
      };
    case 'preg_high_uv':
      return {
        title: important,
        headline: pick(locale, { de: 'Sonnenschutz nicht vergessen', en: 'Remember sun protection', es: 'No olvides la protección solar' }),
        body: pick(locale, {
          de: `Der UV-Index erreicht heute ${uv}. Schwangere Haut reagiert oft empfindlicher und neigt zu Pigmentflecken – Schatten, Hut und Sonnencreme sind heute deine Freunde.`,
          en: `The UV index reaches ${uv} today. Skin often reacts more sensitively in pregnancy and tends to pigment – shade, a hat and sunscreen are your friends today.`,
          es: `El índice UV llega hoy a ${uv}. En el embarazo la piel suele ser más sensible y tiende a manchas: sombra, sombrero y protector solar son tus aliados hoy.`,
        }),
        coreContent:
          'The UV index is high. Recommend shade, a hat and sunscreen because skin is often more sensitive in pregnancy.',
        reasons: [
          pick(locale, { de: `UV-Index ${uv}`, en: `UV index ${uv}`, es: `Índice UV ${uv}` }),
          weekReason,
        ],
      };
    case 'preg_hot':
      return {
        title: important,
        headline: pick(locale, { de: 'Hitze: leicht angehen lassen', en: 'Heat: take it easy', es: 'Calor: tómatelo con calma' }),
        body: pick(locale, {
          de: `Heute werden es ${temp}°. Plane Erledigungen auf den Morgen, trink regelmäßig und leg zwischendurch die Beine hoch – geschwollene Füße sind bei Hitze ganz normal.`,
          en: `It will be ${temp}° today. Plan errands for the morning, drink regularly and put your feet up now and then – swollen feet are normal in the heat.`,
          es: `Hoy hará ${temp}°. Deja los recados para la mañana, bebe con regularidad y sube los pies de vez en cuando: los pies hinchados con calor son normales.`,
        }),
        coreContent:
          'It is a hot day. Recommend errands in the morning, regular drinking and resting with feet up.',
        reasons: [
          pick(locale, { de: `Tageshöchstwert ${temp}°`, en: `Daily high ${temp}°`, es: `Máxima del día ${temp}°` }),
          weekReason,
        ],
      };
    case 'preg_cold':
      return {
        title: goodToKnow,
        headline: pick(locale, { de: 'Warm einpacken', en: 'Wrap up warm', es: 'Abrígate bien' }),
        body: pick(locale, {
          de: `Es wird heute nur ${temp}°. Zieh dich in Schichten an und achte auf rutschfeste Schuhe – dein Gleichgewicht ist mit Bauch ein anderes.`,
          en: `Only ${temp}° today. Dress in layers and choose non-slip shoes – your balance is different with a bump.`,
          es: `Hoy solo hará ${temp}°. Vístete por capas y elige calzado antideslizante: con barriga el equilibrio cambia.`,
        }),
        coreContent: 'It is cold. Recommend layers and non-slip shoes.',
        reasons: [
          pick(locale, { de: `Tageshöchstwert ${temp}°`, en: `Daily high ${temp}°`, es: `Máxima del día ${temp}°` }),
          weekReason,
        ],
      };
    case 'preg_low_water':
      return {
        title: important,
        headline: pick(locale, { de: 'Eine Flasche in Reichweite', en: 'Keep a bottle within reach', es: 'Una botella a mano' }),
        body: pick(locale, {
          de: `Dein letzter Check-in zeigt ${water} Gläser. Gerade in der Schwangerschaft hilft regelmäßiges Trinken gegen Müdigkeit, Kopfschmerzen und Übungswehen – ein Glas pro Stunde ist ein guter Rhythmus.`,
          en: `Your latest check-in shows ${water} glasses. In pregnancy, drinking regularly helps against tiredness, headaches and practice contractions – a glass an hour is a good rhythm.`,
          es: `Tu último check-in muestra ${water} vasos. En el embarazo beber con regularidad ayuda contra el cansancio, los dolores de cabeza y las contracciones de práctica: un vaso por hora es un buen ritmo.`,
        }),
        coreContent:
          'Water intake in the check-in is low. Gently remind about drinking regularly; no medical assessment.',
        reasons: [
          pick(locale, { de: `${water} Gläser laut Check-in`, en: `${water} glasses per check-in`, es: `${water} vasos según el check-in` }),
          weekReason,
        ],
      };
    case 'preg_low_sleep':
      return {
        title: important,
        headline: pick(locale, { de: 'Heute eine Pause einplanen', en: 'Plan a rest today', es: 'Planea un descanso hoy' }),
        body: pick(locale, {
          de: `Laut Check-in hast du nur ${sleep} Stunden geschlafen. Ein kurzer Mittagsschlaf oder 20 Minuten mit hochgelegten Beinen holen mehr zurück, als du denkst – dein Körper leistet gerade viel.`,
          en: `Your check-in says only ${sleep} hours of sleep. A short nap or 20 minutes with your feet up gives back more than you think – your body is working hard right now.`,
          es: `Según tu check-in solo has dormido ${sleep} horas. Una siesta corta o 20 minutos con los pies en alto recuperan más de lo que crees: tu cuerpo está trabajando mucho.`,
        }),
        coreContent:
          'Sleep in the check-in was short. Suggest a nap or a short rest during the day.',
        reasons: [
          pick(locale, { de: `${sleep} Std. Schlaf laut Check-in`, en: `${sleep} h sleep per check-in`, es: `${sleep} h de sueño según el check-in` }),
          weekReason,
        ],
      };
    case 'preg_low_mood':
      return {
        title: pick(locale, { de: 'Für dich', en: 'For you', es: 'Para ti' }),
        headline: pick(locale, { de: 'Du darfst dir Unterstützung holen', en: 'You’re allowed to ask for support', es: 'Puedes pedir apoyo' }),
        body: pick(locale, {
          de: `Deine letzten ${s.selfcare.lowMoodStreak} Check-ins waren eher schwer. Das ist in der Schwangerschaft nichts Ungewöhnliches – sprich es bei ${s.partnerFirstName ?? pick(locale, { de: 'deinem Partner', en: 'your partner', es: 'tu pareja' })} oder deiner Hebamme an, du musst das nicht allein tragen.`,
          en: `Your last ${s.selfcare.lowMoodStreak} check-ins were on the heavy side. That is not unusual in pregnancy – talk to ${s.partnerFirstName ?? 'your partner'} or your midwife, you don’t have to carry it alone.`,
          es: `Tus últimos ${s.selfcare.lowMoodStreak} check-ins fueron más bien difíciles. No es raro en el embarazo: háblalo con ${s.partnerFirstName ?? 'tu pareja'} o con tu matrona, no tienes que cargar con ello sola.`,
        }),
        coreContent:
          'Several consecutive check-ins show a low mood. Warmly encourage talking to the partner or midwife; do not diagnose.',
        reasons: [
          pick(locale, {
            de: `${s.selfcare.lowMoodStreak} Check-ins in Folge mit gedrückter Stimmung`,
            en: `${s.selfcare.lowMoodStreak} consecutive low-mood check-ins`,
            es: `${s.selfcare.lowMoodStreak} check-ins seguidos con ánimo bajo`,
          }),
          weekReason,
        ],
      };
    case 'preg_appointment_soon':
      return {
        title: important,
        headline: pick(locale, {
          de: `Termin ${apptWhen}: ${appt?.title ?? ''}`.trim(),
          en: `Appointment ${apptWhen}: ${appt?.title ?? ''}`.trim(),
          es: `Cita ${apptWhen}: ${appt?.title ?? ''}`.trim(),
        }),
        body: pick(locale, {
          de:
            questions > 0
              ? `Du hast ${questions} Frage${questions === 1 ? '' : 'n'} für den Termin notiert – nimm die Liste mit und lass dir alles in Ruhe erklären. Mutterpass nicht vergessen.`
              : `Nimm den Mutterpass mit und notier dir vorher, was dich gerade beschäftigt – im Termin fällt einem oft nichts mehr ein.`,
          en:
            questions > 0
              ? `You have ${questions} question${questions === 1 ? '' : 's'} saved for the visit – bring the list and take your time. Don’t forget your maternity record.`
              : `Bring your maternity record and jot down what is on your mind beforehand – questions tend to vanish in the room.`,
          es:
            questions > 0
              ? `Tienes ${questions} pregunta${questions === 1 ? '' : 's'} guardada${questions === 1 ? '' : 's'} para la cita: lleva la lista y tómate tu tiempo. No olvides la cartilla de embarazo.`
              : `Lleva la cartilla de embarazo y apunta antes lo que te preocupa: en la consulta las preguntas se olvidan.`,
        }),
        coreContent:
          'A checkup is coming up very soon. Remind about the maternity record and the saved doctor questions.',
        reasons: [
          pick(locale, { de: `Termin ${apptWhen}`, en: `Appointment ${apptWhen}`, es: `Cita ${apptWhen}` }),
          pick(locale, { de: `${questions} offene Arztfragen`, en: `${questions} open doctor questions`, es: `${questions} preguntas pendientes` }),
        ],
      };
    case 'preg_hospital_bag':
      return {
        title: goodToKnow,
        headline: pick(locale, { de: 'Kliniktasche fertig packen', en: 'Finish the hospital bag', es: 'Termina la bolsa del hospital' }),
        body: pick(locale, {
          de:
            bag.total === 0
              ? `Ab ${week} ist es Zeit für die Kliniktasche – deine Checkliste ist noch leer. Fang mit den Papieren und dem Mutterpass an, der Rest kommt nach und nach.`
              : `${bag.checked} von ${bag.total} Punkten der Kliniktasche sind erledigt. Ab ${week} sollte sie griffbereit stehen – ein paar Punkte pro Tag reichen.`,
          en:
            bag.total === 0
              ? `From ${week} it is time for the hospital bag – your checklist is still empty. Start with the documents and maternity record, the rest can follow.`
              : `${bag.checked} of ${bag.total} hospital-bag items are done. From ${week} it should be ready to grab – a few items a day is enough.`,
          es:
            bag.total === 0
              ? `A partir de la ${week} toca la bolsa del hospital: tu lista sigue vacía. Empieza por los documentos y la cartilla; el resto irá llegando.`
              : `${bag.checked} de ${bag.total} puntos de la bolsa del hospital están listos. A partir de la ${week} debería estar preparada: unos pocos puntos al día bastan.`,
        }),
        coreContent:
          'The pregnancy is far enough along that the hospital bag should be ready, and the checklist is incomplete. Encourage finishing it step by step.',
        reasons: [
          pick(locale, { de: `Kliniktasche ${bag.checked}/${bag.total}`, en: `Hospital bag ${bag.checked}/${bag.total}`, es: `Bolsa del hospital ${bag.checked}/${bag.total}` }),
          weekReason,
        ],
      };
    case 'preg_birth_plan':
      return {
        title: goodToKnow,
        headline: pick(locale, { de: 'Zeit für deinen Geburtsplan', en: 'Time for your birth plan', es: 'Hora de tu plan de parto' }),
        body: pick(locale, {
          de: `Ab ${week} lohnt es sich, deine Wünsche für die Geburt festzuhalten. Der Geburtsplan in Lotti führt dich Schritt für Schritt durch – und ist eine gute Grundlage fürs Gespräch mit deiner Hebamme.`,
          en: `From ${week} it is worth writing down your wishes for the birth. Lotti’s birth plan guides you step by step – and is a good basis for talking to your midwife.`,
          es: `A partir de la ${week} merece la pena anotar tus deseos para el parto. El plan de parto de Lotti te guía paso a paso y es una buena base para hablar con tu matrona.`,
        }),
        coreContent:
          'No birth plan exists yet although the third trimester has begun. Invite the parent to fill in the birth plan.',
        reasons: [
          pick(locale, { de: 'Noch kein Geburtsplan angelegt', en: 'No birth plan yet', es: 'Aún sin plan de parto' }),
          weekReason,
        ],
      };
    case 'preg_open_questions':
      return {
        title: goodToKnow,
        headline: pick(locale, { de: 'Deine Fragen liegen bereit', en: 'Your questions are ready', es: 'Tus preguntas están listas' }),
        body: pick(locale, {
          de: `Du hast ${questions} Fragen für die Praxis gesammelt. Wenn eine davon dich beschäftigt, musst du nicht bis zum nächsten Termin warten – Hebammen sind auch zwischendurch erreichbar.`,
          en: `You have collected ${questions} questions for the practice. If one of them is on your mind, you don’t have to wait until the next visit – midwives are reachable in between.`,
          es: `Tienes ${questions} preguntas guardadas para la consulta. Si alguna te preocupa, no hace falta esperar a la próxima cita: las matronas también atienden entre visitas.`,
        }),
        coreContent:
          'Several doctor questions are saved and no appointment is imminent. Reassure that the midwife can be contacted in between.',
        reasons: [
          pick(locale, { de: `${questions} offene Arztfragen`, en: `${questions} open doctor questions`, es: `${questions} preguntas pendientes` }),
          weekReason,
        ],
      };
    case 'preg_rain':
      return {
        title: goodToKnow,
        headline: pick(locale, { de: 'Regen eingeplant', en: 'Rain on the way', es: 'Lluvia a la vista' }),
        body: pick(locale, {
          de: `Heute sind ${rain}% Regen angesagt. Ein gemütlicher Tag drinnen ist erlaubt – vielleicht mit einem Punkt von der Kliniktasche oder einem Check-in für dich.`,
          en: `There is a ${rain}% chance of rain today. A cozy day indoors is allowed – maybe with one hospital-bag item or a check-in for yourself.`,
          es: `Hoy hay un ${rain}% de probabilidad de lluvia. Un día tranquilo en casa está permitido, quizá con un punto de la bolsa del hospital o un check-in para ti.`,
        }),
        coreContent: 'Rain is likely. Suggest a calm indoor day.',
        reasons: [
          pick(locale, { de: `${rain}% Regenwahrscheinlichkeit`, en: `${rain}% chance of rain`, es: `${rain} % de probabilidad de lluvia` }),
          weekReason,
        ],
      };
    case 'preg_no_checkin':
      return {
        title: goodToKnow,
        headline: pick(locale, { de: 'Ein Moment für dich', en: 'A moment for you', es: 'Un momento para ti' }),
        body: pick(locale, {
          de: `Heute fehlt noch dein Selfcare-Check-in. Zwei Minuten reichen – Stimmung, Schlaf, Trinken – und Lotti kann dir morgen genauer sagen, was dir gerade guttut.`,
          en: `Your self-care check-in is still missing today. Two minutes are enough – mood, sleep, water – and Lotti can tell you more precisely tomorrow what is doing you good.`,
          es: `Hoy aún falta tu check-in de autocuidado. Bastan dos minutos —ánimo, sueño, agua— y mañana Lotti podrá decirte mejor qué te sienta bien.`,
        }),
        coreContent: 'No self-care check-in today yet. Invite a short check-in.',
        reasons: [
          pick(locale, { de: 'Kein Check-in heute', en: 'No check-in today', es: 'Sin check-in hoy' }),
          weekReason,
        ],
      };
    case 'preg_all_good':
      return {
        title: pick(locale, { de: 'Heute läuft es rund', en: 'Things are going smoothly', es: 'Hoy todo va bien' }),
        headline: pick(locale, { de: 'Alles im grünen Bereich', en: 'Everything looks good', es: 'Todo en orden' }),
        body: pick(locale, {
          de: `${week ? `${week}: ` : ''}Dein Check-in, deine Vorbereitung und der Tag passen zusammen. Genieß den Moment – und leg die Beine hoch, wenn du magst.`,
          en: `${week ? `${week}: ` : ''}Your check-in, your preparation and the day fit together. Enjoy the moment – and put your feet up if you like.`,
          es: `${week ? `${week}: ` : ''}Tu check-in, tu preparación y el día encajan. Disfruta del momento y sube los pies si te apetece.`,
        }),
        coreContent: 'Give brief positive feedback that the day looks balanced, without asking for action.',
        reasons: [
          pick(locale, { de: 'Check-in erfasst', en: 'Check-in recorded', es: 'Check-in registrado' }),
          weekReason,
        ],
      };
    case 'preg_learning':
    default:
      return {
        title: pick(locale, { de: 'Lotti lernt dich kennen', en: 'Lotti is getting to know you', es: 'Lotti te está conociendo' }),
        headline: pick(locale, { de: 'Noch kein Vergleich nötig', en: 'No comparison needed yet', es: 'Aún no hace falta comparar' }),
        body: pick(locale, {
          de:
            s.week == null
              ? `Hinterlege deinen Entbindungstermin und mach ein paar Selfcare-Check-ins – dann kann Lotti dir Hinweise passend zu deiner Woche geben.`
              : `Mach in den nächsten Tagen ein paar Selfcare-Check-ins (Stimmung, Schlaf, Trinken). Danach kann Lotti dir Hinweise passend zu ${week} geben.`,
          en:
            s.week == null
              ? `Save your due date and do a few self-care check-ins – then Lotti can give you insights that fit your week.`
              : `Do a few self-care check-ins over the next days (mood, sleep, water). Then Lotti can give you insights that fit ${week}.`,
          es:
            s.week == null
              ? `Guarda tu fecha prevista y haz algunos check-ins de autocuidado: así Lotti podrá darte consejos según tu semana.`
              : `Haz algunos check-ins de autocuidado en los próximos días (ánimo, sueño, agua). Después Lotti podrá darte consejos según la ${week}.`,
        }),
        coreContent: 'Explain transparently that there is not enough personal data yet.',
        reasons: [
          pick(locale, {
            de: `${s.selfcare.checkinsLast7Days} Check-ins in 7 Tagen`,
            en: `${s.selfcare.checkinsLast7Days} check-ins in 7 days`,
            es: `${s.selfcare.checkinsLast7Days} check-ins en 7 días`,
          }),
          weekReason,
        ],
      };
  }
};

const candidate = (
  ruleId: PregnancyRuleId,
  priority: number,
  category: PregnancyAdvisorCategory,
  tone: PregnancyAdvisorTone,
  emoji: string,
  s: PregnancyRuleSignals,
  locale: PregnancyLocale,
  facts: Record<string, unknown>,
): PregnancyRuleCandidate => ({
  ruleId,
  priority,
  category,
  tone,
  emoji,
  ...pregnancyRuleCopy(ruleId, s, locale),
  facts: { ...facts, week: s.week, trimester: s.trimester },
});

/** Alle heute zutreffenden Regeln, nach Priorität sortiert (1 = zuerst). */
export const evaluatePregnancyRules = (
  s: PregnancyRuleSignals,
  locale: PregnancyLocale = 'de',
): PregnancyRuleCandidate[] => {
  const out: PregnancyRuleCandidate[] = [];
  const localHour = s.context?.localHour ?? 12;
  const water = s.selfcare.latestWaterIntake ?? s.selfcare.averageWaterIntake;
  const sleep = s.selfcare.latestSleepHours ?? s.selfcare.averageSleepHours;
  const lowWater = typeof water === 'number' && water > 0 && water < LOW_WATER_GLASSES;
  const lowSleep = typeof sleep === 'number' && sleep > 0 && sleep < LOW_SLEEP_HOURS;
  const hasData = s.selfcare.checkinsLast7Days > 0 || s.weight.entriesLast30Days > 0;

  if (
    s.contractions.countLast24h >= 6 &&
    s.contractions.averageIntervalMinutes != null &&
    s.contractions.averageIntervalMinutes <= 10
  )
    out.push(candidate('preg_contractions_regular', 1, 'motivation', 'gentle', '⏱️', s, locale, { ...s.contractions }));

  if (s.weather.available) {
    if (s.weather.isHot && lowWater)
      out.push(candidate('preg_hot_low_water', 1, 'weather', 'gentle', '💧', s, locale, { temperature: s.weather.temperature, water }));
    if (s.weather.isHighUv)
      out.push(candidate('preg_high_uv', 2, 'weather', 'neutral', '☀️', s, locale, { uvIndex: s.weather.uvIndex }));
    if (s.weather.isHot)
      out.push(candidate('preg_hot', 2, 'weather', 'neutral', '🌡️', s, locale, { temperature: s.weather.temperature }));
    if (s.weather.isCold)
      out.push(candidate('preg_cold', 3, 'weather', 'neutral', '🧣', s, locale, { temperature: s.weather.temperature }));
  }

  if (lowWater)
    out.push(candidate('preg_low_water', 2, 'feeding', 'gentle', '🥤', s, locale, { water }));
  if (lowSleep)
    out.push(candidate('preg_low_sleep', 2, 'sleep', 'gentle', '😴', s, locale, { sleep }));
  if (s.selfcare.lowMoodStreak >= 2)
    out.push(candidate('preg_low_mood', 2, 'motivation', 'gentle', '🫶', s, locale, { streak: s.selfcare.lowMoodStreak }));

  if (s.nextAppointment && s.nextAppointment.inDays <= 1)
    out.push(candidate('preg_appointment_soon', 2, 'motivation', 'neutral', '🩺', s, locale, { inDays: s.nextAppointment.inDays, questions: s.openQuestionCount }));

  if (s.week != null && s.week >= HOSPITAL_BAG_WEEK && (s.checklist.total === 0 || s.checklist.checked < s.checklist.total))
    out.push(candidate('preg_hospital_bag', 2, 'motivation', 'neutral', '🧳', s, locale, { ...s.checklist }));
  if (s.week != null && s.week >= BIRTH_PLAN_WEEK && !s.hasBirthPlan)
    out.push(candidate('preg_birth_plan', 3, 'motivation', 'neutral', '📝', s, locale, {}));
  if (s.openQuestionCount >= 3 && !(s.nextAppointment && s.nextAppointment.inDays <= 1))
    out.push(candidate('preg_open_questions', 3, 'motivation', 'neutral', '❓', s, locale, { questions: s.openQuestionCount }));

  if (s.weather.available && s.weather.isRainy)
    out.push(candidate('preg_rain', 3, 'weather', 'neutral', '🌧️', s, locale, { rain: s.weather.rainProbability }));

  // Erst erinnern, wenn die Nutzerin überhaupt schon Daten pflegt.
  if (!s.selfcare.hasToday && localHour >= 17 && (hasData || s.week != null))
    out.push(candidate('preg_no_checkin', 3, 'motivation', 'neutral', '🌿', s, locale, { localHour }));

  if (out.length === 0 && hasData && s.week != null)
    out.push(candidate('preg_all_good', 4, 'motivation', 'positive', '🌸', s, locale, {}));
  out.push(candidate('preg_learning', 5, 'motivation', 'neutral', '✨', s, locale, { checkins: s.selfcare.checkinsLast7Days }));

  return out.sort((a, b) => a.priority - b.priority);
};

/** Regel-Ids, die trotz Themenfilter/Cooldown immer erlaubt bleiben. */
export const isPregnancyFallbackRule = (ruleId: string) =>
  ruleId === 'preg_all_good' || ruleId === 'preg_learning' || ruleId === 'preg_contractions_regular';

export const selectPregnancyCandidate = (
  candidates: PregnancyRuleCandidate[],
  options: { themes?: PregnancyAdvisorCategory[] | null; recentRuleIds?: string[] },
): PregnancyRuleCandidate => {
  const themes = options.themes;
  const recent = new Set(options.recentRuleIds ?? []);
  const allowed = candidates.filter((c) => {
    const fallback = isPregnancyFallbackRule(c.ruleId);
    if (themes && themes.length > 0 && !themes.includes(c.category) && !fallback) return false;
    if (recent.has(c.ruleId) && !fallback) return false;
    return true;
  });
  return allowed[0] ?? candidates[candidates.length - 1];
};
