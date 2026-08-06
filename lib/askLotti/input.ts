export const MIN_ASK_LOTTI_QUESTION_LENGTH = 2;
export const MAX_ASK_LOTTI_QUESTION_LENGTH = 500;

export const normalizeAskLottiQuestion = (value: string) =>
  value.normalize("NFKC").replace(/\s+/g, " ").trim();

// Greetings are answered on-device. They do not reach the classifier, consume
// quota, or expose any family data to an external service.
export const isAskLottiGreeting = (value: string) =>
  /^(?:h+i+|hall+[oö]+(?:chen)?|he+y+|moin+|guten\s+(?:morgen|tag|abend)|hell+o+|hiya+|hola+|buenas+)[!,.?\s]*$/iu.test(
    normalizeAskLottiQuestion(value),
  );

export const isAskLottiThanks = (value: string) =>
  /^(?:danke(?:\s+(?:dir|schön|sehr))?|vielen\s+dank|thanks?|thank\s+you|gracias)[!,.?\s]*$/iu.test(
    normalizeAskLottiQuestion(value),
  );
