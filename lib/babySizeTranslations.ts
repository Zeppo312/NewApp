import { babySizeData, type BabySizeData } from './baby-size-data';

/** Translation boundary for the baby-size screen and all 42 weekly development records. */
export type BabySizeLocale = 'de' | 'en' | 'es';
export const DEFAULT_BABY_SIZE_LOCALE: BabySizeLocale = 'de';

const de = {
  'screen.title': 'Babygröße', 'screen.waitingSubtitle': 'Deine Schwangerschaft im Größenvergleich',
  'screen.weekSubtitle': 'Schwangerschaftswoche {{week}}', 'hero.week': 'SSW {{week}}', 'hero.comparison': 'So groß wie {{comparison}}',
  'metric.length': 'Größe', 'metric.weight': 'Gewicht', 'development.title': 'Entwicklung in dieser Woche',
  'weeks.title': 'Andere Wochen entdecken', 'week.accessibility': 'Schwangerschaftswoche {{week}} öffnen',
} as const;
export type BabySizeTranslationKey = keyof typeof de;
type Catalog = Record<BabySizeTranslationKey, string>;

const en: Catalog = {
  'screen.title': 'Baby size', 'screen.waitingSubtitle': 'Your pregnancy in size comparisons',
  'screen.weekSubtitle': 'Pregnancy week {{week}}', 'hero.week': 'WEEK {{week}}', 'hero.comparison': 'About the size of {{comparison}}',
  'metric.length': 'Length', 'metric.weight': 'Weight', 'development.title': 'Development this week',
  'weeks.title': 'Explore other weeks', 'week.accessibility': 'Open pregnancy week {{week}}',
};
const es: Catalog = {
  'screen.title': 'Tamaño del bebé', 'screen.waitingSubtitle': 'Tu embarazo comparado por tamaños',
  'screen.weekSubtitle': 'Semana {{week}} de embarazo', 'hero.week': 'SEMANA {{week}}', 'hero.comparison': 'Del tamaño de {{comparison}}',
  'metric.length': 'Longitud', 'metric.weight': 'Peso', 'development.title': 'Desarrollo durante esta semana',
  'weeks.title': 'Descubre otras semanas', 'week.accessibility': 'Abrir la semana {{week}} de embarazo',
};

export const BABY_SIZE_TRANSLATIONS: Record<BabySizeLocale, Catalog> = { de, en, es };
export const translateBabySizeText = (locale: BabySizeLocale, key: BabySizeTranslationKey, params: Record<string, string | number> = {}) =>
  (BABY_SIZE_TRANSLATIONS[locale]?.[key] ?? de[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, token: string) => String(params[token] ?? `{{${token}}}`));

const comparisons: Record<BabySizeLocale, Record<string, string>> = {
  de: {
    poppy: 'ein Mohnkorn', appleSeed: 'ein Apfelkern', pea: 'eine Erbse', blueberry: 'eine Heidelbeere', raspberry: 'eine Himbeere',
    strawberry: 'eine Erdbeere', apricot: 'eine Aprikose', lime: 'eine Limette', plum: 'eine Zwetschge', peach: 'ein Pfirsich', lemon: 'eine Zitrone',
    orange: 'eine Orange', avocado: 'eine Avocado', sweetPotato: 'eine Süßkartoffel', mango: 'eine Mango', papaya: 'eine Papaya',
    eggplant: 'eine Aubergine', pumpkin: 'ein kleiner Kürbis', honeydew: 'eine Honigmelone', watermelon: 'eine Wassermelone',
  },
  en: {
    poppy: 'a poppy seed', appleSeed: 'an apple seed', pea: 'a pea', blueberry: 'a blueberry', raspberry: 'a raspberry',
    strawberry: 'a strawberry', apricot: 'an apricot', lime: 'a lime', plum: 'a plum', peach: 'a peach', lemon: 'a lemon',
    orange: 'an orange', avocado: 'an avocado', sweetPotato: 'a sweet potato', mango: 'a mango', papaya: 'a papaya',
    eggplant: 'an eggplant', pumpkin: 'a small pumpkin', honeydew: 'a honeydew melon', watermelon: 'a watermelon',
  },
  es: {
    poppy: 'una semilla de amapola', appleSeed: 'una semilla de manzana', pea: 'un guisante', blueberry: 'un arándano', raspberry: 'una frambuesa',
    strawberry: 'una fresa', apricot: 'un albaricoque', lime: 'una lima', plum: 'una ciruela', peach: 'un melocotón', lemon: 'un limón',
    orange: 'una naranja', avocado: 'un aguacate', sweetPotato: 'un boniato', mango: 'un mango', papaya: 'una papaya',
    eggplant: 'una berenjena', pumpkin: 'una calabaza pequeña', honeydew: 'un melón', watermelon: 'una sandía',
  },
};

const comparisonIds = [
  'poppy', 'poppy', 'poppy', 'poppy', 'appleSeed', 'pea', 'blueberry', 'raspberry', 'strawberry', 'apricot', 'lime', 'plum',
  'peach', 'lemon', 'orange', 'avocado', 'avocado', 'sweetPotato', 'mango', 'papaya', 'papaya', 'papaya', 'papaya', 'papaya',
  'eggplant', 'eggplant', 'eggplant', 'eggplant', 'pumpkin', 'pumpkin', 'pumpkin', 'pumpkin', 'honeydew', 'honeydew', 'honeydew',
  'honeydew', 'honeydew', 'watermelon', 'watermelon', 'watermelon', 'watermelon', 'watermelon',
] as const;

const enDescriptions = [
  'Fertilization takes place during the first week. The fertilized egg begins to divide and travels through the fallopian tube to the uterus.',
  'The fertilized egg has developed into a blastocyst and implants in the lining of the uterus.',
  'The cells begin to specialize. The placenta and the first blood vessels start to form.',
  'The heart begins to beat, and the foundations of the brain, spine, and nervous system are laid.',
  'The eyes, ears, and nose begin to form. The arms and legs develop as tiny buds.',
  'The heart now beats regularly. Fingers and toes begin to form.',
  'The arms and legs grow longer, and the fingers and toes become more distinct. Facial features continue to develop.',
  'All major organs have begun to form. The eyes are still closed, but the eyelids are developing.',
  'The baby begins to move, although you cannot feel it yet. The genitals begin to develop.',
  'The fingers and toes are no longer webbed. The nails begin to grow.',
  'The baby can now bend their head and open and close their fingers. The sex organs continue to develop.',
  'The kidneys produce urine, which is released into the amniotic fluid. Reflexes begin to develop.',
  'The baby can now move their fingers and make a fist. The vocal cords are forming.',
  'The baby can now make facial expressions and suck their thumb. Fine lanugo hair begins to grow.',
  'The bones become harder and the muscles stronger. The baby can now swallow amniotic fluid.',
  'The eyes can now move and respond to light. The ears have reached their final position.',
  'The immune system begins to develop. The placenta is now fully formed.',
  'The baby can now yawn and stretch. Their fingerprints are fully formed.',
  'Vernix caseosa, a white protective coating, begins to cover the baby’s skin. Movements become stronger.',
  'The baby develops a regular sleep-wake rhythm. Hair begins to grow on the head.',
  'The eyebrows and eyelashes are now visible. The baby can respond to sounds from outside.',
  'The eyes are fully formed, but the iris does not yet have its final color. The fingernails have reached the fingertips.',
  'The baby can now recognize their mother’s voice. The lungs begin to produce surfactant.',
  'The facial features are now clearly recognizable. The baby can blink and open their eyes.',
  'The baby now responds to touch and can perceive pain. The lungs continue to develop.',
  'The eyes open. The baby can now tell light from darkness.',
  'The brain develops rapidly. The baby may now have hiccups that you can feel as rhythmic movements.',
  'The baby can now open and close their eyes. REM sleep indicates that they may also dream.',
  'The baby builds up fat, which helps regulate body temperature. The bones are fully formed but still soft.',
  'The baby can now perceive light and turn toward a light source. The fingernails have reached the fingertips.',
  'The immune system continues to develop. The baby can now distinguish different tastes.',
  'The pupils can now constrict and dilate. The baby moves into a head-down position.',
  'The lungs are almost fully developed. The baby practices breathing by moving amniotic fluid in and out.',
  'The baby’s fingernails now reach the fingertips. Most body systems are fully developed.',
  'There is now less room for the baby to move, so movements may feel different. The kidneys are fully developed.',
  'The baby now has less lanugo and more hair on their head. The liver can process waste products.',
  'The baby is now considered full term. The lungs are ready for the outside world.',
  'The baby continues to build up fat. Brain development continues.',
  'The baby is fully developed and ready for birth. The nails may extend beyond the fingertips.',
  'The baby is fully developed and ready for birth. The placenta supplies antibodies that help protect the baby during the first months after birth.',
  'The baby is fully developed and ready for birth. The nails may extend beyond the fingertips.',
  'The baby is fully developed and ready for birth. The placenta begins to age.',
] as const;

const esDescriptions = [
  'Durante la primera semana tiene lugar la fecundación. El óvulo fecundado comienza a dividirse y viaja por la trompa de Falopio hasta el útero.',
  'El óvulo fecundado se ha convertido en un blastocisto y se implanta en el revestimiento del útero.',
  'Las células comienzan a especializarse. Empiezan a formarse la placenta y los primeros vasos sanguíneos.',
  'El corazón empieza a latir y se establecen las bases del cerebro, la columna vertebral y el sistema nervioso.',
  'Los ojos, los oídos y la nariz comienzan a formarse. Los brazos y las piernas aparecen como pequeños brotes.',
  'El corazón ya late de forma regular. Los dedos de las manos y de los pies comienzan a formarse.',
  'Los brazos y las piernas se alargan, y los dedos se distinguen mejor. Los rasgos faciales siguen desarrollándose.',
  'Todos los órganos principales han comenzado a formarse. Los ojos siguen cerrados, pero los párpados se están desarrollando.',
  'El bebé empieza a moverse, aunque todavía no puedes notarlo. Los genitales comienzan a desarrollarse.',
  'Los dedos ya no están unidos por membranas. Las uñas comienzan a crecer.',
  'El bebé ya puede inclinar la cabeza y abrir y cerrar los dedos. Los órganos sexuales siguen desarrollándose.',
  'Los riñones producen orina, que se libera en el líquido amniótico. Los reflejos comienzan a desarrollarse.',
  'El bebé ya puede mover los dedos y cerrar el puño. Se forman las cuerdas vocales.',
  'El bebé ya puede hacer gestos y chuparse el pulgar. Empieza a crecer el fino vello llamado lanugo.',
  'Los huesos se endurecen y los músculos se fortalecen. El bebé ya puede tragar líquido amniótico.',
  'Los ojos ya pueden moverse y reaccionar a la luz. Los oídos han alcanzado su posición definitiva.',
  'El sistema inmunitario comienza a desarrollarse. La placenta ya está completamente formada.',
  'El bebé ya puede bostezar y estirarse. Sus huellas dactilares están completamente formadas.',
  'La vérnix caseosa, una capa protectora blanquecina, empieza a cubrir la piel del bebé. Los movimientos se hacen más fuertes.',
  'El bebé desarrolla un ritmo regular de sueño y vigilia. Empieza a crecerle el pelo.',
  'Las cejas y las pestañas ya son visibles. El bebé puede reaccionar a los sonidos del exterior.',
  'Los ojos están completamente formados, aunque el iris aún no tiene su color definitivo. Las uñas llegan hasta la punta de los dedos.',
  'El bebé ya puede reconocer la voz de su madre. Los pulmones comienzan a producir surfactante.',
  'Los rasgos faciales ya se distinguen claramente. El bebé puede parpadear y abrir los ojos.',
  'El bebé reacciona al tacto y puede percibir el dolor. Los pulmones siguen desarrollándose.',
  'Los ojos se abren. El bebé ya puede distinguir entre la luz y la oscuridad.',
  'El cerebro se desarrolla rápidamente. El bebé puede tener hipo, que notarás como movimientos rítmicos.',
  'El bebé ya puede abrir y cerrar los ojos. El sueño REM indica que también puede soñar.',
  'El bebé acumula grasa, que le ayuda a regular la temperatura corporal. Los huesos están formados, pero siguen siendo blandos.',
  'El bebé ya percibe la luz y puede orientarse hacia ella. Las uñas llegan hasta la punta de los dedos.',
  'El sistema inmunitario sigue desarrollándose. El bebé ya puede distinguir diferentes sabores.',
  'Las pupilas ya pueden contraerse y dilatarse. El bebé adopta una posición con la cabeza hacia abajo.',
  'Los pulmones están casi completamente desarrollados. El bebé practica la respiración moviendo líquido amniótico hacia dentro y hacia fuera.',
  'Las uñas ya llegan hasta la punta de los dedos. La mayoría de los sistemas corporales están completamente desarrollados.',
  'El bebé tiene menos espacio para moverse, por lo que sus movimientos pueden sentirse diferentes. Los riñones están completamente desarrollados.',
  'El bebé tiene menos lanugo y más pelo en la cabeza. El hígado ya puede procesar productos de desecho.',
  'El bebé ya se considera a término. Los pulmones están preparados para el mundo exterior.',
  'El bebé sigue acumulando grasa. El cerebro continúa desarrollándose.',
  'El bebé está completamente desarrollado y preparado para nacer. Las uñas pueden sobresalir de las puntas de los dedos.',
  'El bebé está completamente desarrollado y preparado para nacer. La placenta aporta anticuerpos que le ayudarán durante los primeros meses después del parto.',
  'El bebé está completamente desarrollado y preparado para nacer. Las uñas pueden sobresalir de las puntas de los dedos.',
  'El bebé está completamente desarrollado y preparado para nacer. La placenta comienza a envejecer.',
] as const;

const localizeMeasurement = (locale: BabySizeLocale, value: string) => locale === 'en' ? value.replace(/,/g, '.') : value;

export const getLocalizedBabySizeData = (locale: BabySizeLocale): BabySizeData[] => babySizeData.map((entry, index) => ({
  ...entry,
  length: localizeMeasurement(locale, entry.length),
  weight: localizeMeasurement(locale, entry.weight),
  fruitComparison: comparisons[locale][comparisonIds[index]],
  description: locale === 'de' ? entry.description : locale === 'en' ? enDescriptions[index] : esDescriptions[index],
}));

export const getLocalizedBabySizeForWeek = (locale: BabySizeLocale, week: number) =>
  getLocalizedBabySizeData(locale).find((entry) => entry.week === week);

export const getBabySizeLocaleTag = (locale: BabySizeLocale) => ({ de: 'de-DE', en: 'en-US', es: 'es-ES' })[locale];
