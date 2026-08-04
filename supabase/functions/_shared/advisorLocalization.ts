import { localize, SupportedLocale } from './localization.ts';

type AdvisorSignals = {
  babyName?: string | null;
  feeding?: { totalCount?: number | null };
  weather?: { rainProbability?: number | null; uvIndex?: number | null };
};

type AdvisorCandidate = {
  ruleId: string;
  title: string;
  headline: string;
  body: string;
  coreContent: string;
  reasons: string[];
  [key: string]: unknown;
};

type LocalizedText = { title: string; headline: string; body: string; coreContent: string };

export const localizeAdvisorCandidate = <T extends AdvisorCandidate>(
  candidate: T,
  signals: AdvisorSignals,
  locale: SupportedLocale,
): T => {
  if (locale === 'de') return candidate;

  const name = signals.babyName?.trim() || localize(locale, { de: 'dein Baby', en: 'your baby', es: 'tu bebé' });
  const feeds = signals.feeding?.totalCount ?? 0;
  const rain = Math.round(signals.weather?.rainProbability ?? 0);
  const uv = signals.weather?.uvIndex ?? '–';

  const en: Record<string, LocalizedText> = {
    hot_low_feeding: { title: 'Important today', headline: 'Offer feeds more often today', body: `${name} has had a little less to drink than usual, and it will be warm. Offer breast or bottle more often; an extra feed can help on hot days.`, coreContent: 'Gently suggest offering breast or bottle more often because warm weather and fewer feeds occur together.' },
    hot_low_sleep: { title: 'Important today', headline: 'Keep the next sleep cool and calm', body: `${name} has slept a little less today, and it will be muggy. A cool, quiet room for the next sleep may help you both.`, coreContent: 'Suggest a cool, calm sleep environment because heat and less sleep occur together.' },
    hot: { title: 'Important today', headline: 'Protect from sun and heat', body: `It will be warm today. Keep ${name} out of direct sun, choose light clothing, and offer feeds a little more often.`, coreContent: 'Recommend shade, light clothing, and offering feeds more often in warm weather.' },
    high_uv: { title: 'Important today', headline: 'Remember sun protection', body: `The UV index will reach ${uv} today. Shade, a sun hat, and light long clothing protect ${name} best; avoid midday sun.`, coreContent: 'Recommend shade, a sun hat, light long clothing, and avoiding midday sun because the UV index is high.' },
    rain_likely: { title: 'Good to know today', headline: 'Plan for rain', body: `The forecast shows a ${rain}% chance of rain. Pack the stroller rain cover or enjoy a cozy day indoors.`, coreContent: 'Mention the rain probability and suggest packing rain protection or planning an indoor day.' },
    cold: { title: 'Important today', headline: 'Add a warm layer and hat', body: `It will be chilly today. An extra layer and a hat will help keep ${name} comfortably warm.`, coreContent: 'Recommend an extra layer and a hat in cold weather.' },
    low_sleep: { title: 'Important today', headline: 'Plan the next sleep a little earlier', body: `${name} has slept a little less than usual today. Consider an earlier next sleep – and take a short break yourself if you can.`, coreContent: 'Gently suggest an earlier next sleep and a small break for the parent.' },
    low_feeding: { title: 'Important today', headline: 'It may be time for another feed', body: `${name} has had ${feeds} feeds so far. Based on your usual rhythm, it may be time to offer another one soon.`, coreContent: 'Give a calm reminder that the next feed may be due based on the family’s usual rhythm.' },
    learning: { title: 'Lotti is learning your rhythm', headline: 'No comparison needed yet', body: `Track ${name}'s sleep and feeds for a few days. After three comparison days, Lotti can use your own rhythm.`, coreContent: 'Explain transparently that there are not enough personal comparison days yet.' },
    all_good: { title: 'Things are going smoothly today', headline: 'Everything is in the usual range', body: `${name}'s day looks nicely balanced – sleep, feeds, and diaper changes are within your usual range. Enjoy your day together!`, coreContent: 'Give brief positive feedback that today’s values are within the usual range, without asking the parent to act.' },
  };
  const es: Record<string, LocalizedText> = {
    hot_low_feeding: { title: 'Importante hoy', headline: 'Ofrece tomas con más frecuencia', body: `${name} ha bebido un poco menos de lo habitual y hará calor. Ofrece pecho o biberón con más frecuencia; una toma extra puede ayudar en días calurosos.`, coreContent: 'Sugiere con calma ofrecer pecho o biberón más a menudo porque coinciden calor y menos tomas.' },
    hot_low_sleep: { title: 'Importante hoy', headline: 'Un sueño fresco y tranquilo', body: `${name} ha dormido algo menos hoy y hará bochorno. Una habitación fresca y tranquila para el próximo sueño puede ayudaros.`, coreContent: 'Sugiere un entorno fresco y tranquilo porque coinciden calor y menos sueño.' },
    hot: { title: 'Importante hoy', headline: 'Protección frente al sol y el calor', body: `Hoy hará calor. Mantén a ${name} fuera del sol directo, usa ropa ligera y ofrece tomas algo más a menudo.`, coreContent: 'Recomienda sombra, ropa ligera y ofrecer tomas con más frecuencia cuando hace calor.' },
    high_uv: { title: 'Importante hoy', headline: 'Recuerda la protección solar', body: `El índice UV llegará a ${uv} hoy. La sombra, un sombrero y ropa ligera y larga protegen mejor a ${name}; evita el sol del mediodía.`, coreContent: 'Recomienda sombra, sombrero, ropa ligera y larga, y evitar el sol del mediodía por el índice UV alto.' },
    rain_likely: { title: 'Conviene saberlo hoy', headline: 'Prepárate para la lluvia', body: `La previsión indica un ${rain} % de lluvia. Lleva el protector del cochecito o disfrutad de un día tranquilo en casa.`, coreContent: 'Menciona la probabilidad de lluvia y sugiere llevar protección o planear un día en casa.' },
    cold: { title: 'Importante hoy', headline: 'Una capa más y gorro', body: `Hoy refrescará. Una capa adicional y un gorro ayudarán a mantener a ${name} a una temperatura agradable.`, coreContent: 'Recomienda una capa adicional y un gorro cuando hace frío.' },
    low_sleep: { title: 'Importante hoy', headline: 'Adelanta un poco el próximo sueño', body: `${name} ha dormido algo menos de lo habitual. Quizá convenga adelantar el próximo sueño y, si puedes, descansar tú también.`, coreContent: 'Sugiere con calma adelantar el próximo sueño y un pequeño descanso para quien cuida.' },
    low_feeding: { title: 'Importante hoy', headline: 'Quizá toque ofrecer otra toma', body: `${name} lleva ${feeds} tomas. Según vuestro ritmo habitual, quizá sea buen momento para ofrecer otra pronto.`, coreContent: 'Recuerda con calma que puede tocar otra toma según el ritmo habitual de la familia.' },
    learning: { title: 'Lotti está aprendiendo vuestro ritmo', headline: 'Aún no hace falta comparar', body: `Registra durante unos días el sueño y las tomas de ${name}. Tras tres días de comparación, Lotti podrá usar vuestro propio ritmo.`, coreContent: 'Explica con transparencia que aún no hay suficientes días personales para comparar.' },
    all_good: { title: 'Hoy todo va bien', headline: 'Todo dentro de vuestro rango habitual', body: `El día de ${name} parece equilibrado: sueño, tomas y cambios de pañal están dentro de lo habitual. ¡Disfrutad del día!`, coreContent: 'Da una valoración positiva breve de que los valores están dentro de lo habitual, sin pedir ninguna acción.' },
  };
  const fallback = locale === 'es' ? es.learning : en.learning;
  const text = (locale === 'es' ? es : en)[candidate.ruleId] ?? fallback;
  const reasons = locale === 'es'
    ? ['Basado en vuestro ritmo personal', `${feeds} tomas registradas hoy`]
    : ['Based on your personal rhythm', `${feeds} feeds recorded today`];
  return { ...candidate, ...text, reasons };
};
