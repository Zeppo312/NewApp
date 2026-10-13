export type AskLottiLocale = "de" | "en" | "es";

export const MAX_QUESTION_LENGTH = 500;

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above|system)\s+instructions?/i,
  /(ignoriere|vergiss)\s+(alle\s+)?(vorherigen|obigen|system)[\s-]*(anweisungen|regeln|prompts?)/i,
  /reveal|expose|print|repeat.{0,30}(system prompt|developer message|secret|api key)/i,
  /(zeige|nenne|wiederhole).{0,30}(system[\s-]*prompt|entwicklernachricht|geheimnis|api[\s-]*key)/i,
  /<\/?(system|assistant|developer|tool)>/i,
  /\b(select|insert|update|delete|drop)\b.{0,40}\b(from|into|table|database)\b/i,
  /\b(jailbreak|prompt injection|dan mode)\b/i,
];

const MEDICAL_PATTERNS = [
  /\b(diagnos|medikament|dosierung|dosis|fieber|atemnot|krampf|erbrechen|durchfall|ausschlag|krank)\w*/i,
  /\b(diagnos|medicine|medication|dosage|dose|fever|breathing|seizure|vomit|diarrhea|rash|sick)\w*/i,
  /\b(diagn[oó]stic|medicamento|dosis|fiebre|respirar|convulsi[oó]n|v[oó]mit|diarrea|erupci[oó]n|enferm)\w*/i,
];

export const normalizeQuestion = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length < 2 || normalized.length > MAX_QUESTION_LENGTH)
    return null;
  return normalized;
};

export const isLikelyPromptInjection = (question: string): boolean =>
  INJECTION_PATTERNS.some((pattern) => pattern.test(question));

export const isMedicalQuestion = (question: string): boolean =>
  MEDICAL_PATTERNS.some((pattern) => pattern.test(question));

// Spelled-out numbers cannot be checked against the evidence cards, so they stay
// forbidden. The alternations below only chain into other number parts ("drei" +
// "und" + "zwanzig"), never into arbitrary letters — an earlier `[\p{L}-]*`
// suffix made everyday words such as "einschlafen", "achte" or "tendency" look
// like numbers and silently discarded otherwise fine answers.
// Parts that may open a number word ("zwölf", "twenty") versus parts that only
// ever appear inside a compound ("ein" in "einundzwanzig", "teen" in
// "thirteen"). Keeping them apart matters because the prefix-only parts are
// also everyday words — German "ein" and Spanish "una" are articles.
const NUMBER_PARTS: Record<
  AskLottiLocale,
  { standalone: string; prefixOnly: string; joiner: string }
> = {
  de: {
    standalone:
      "null|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwanzig|dreißig|vierzig|fünfzig|sechzig|siebzig|achtzig|neunzig|hundert|tausend",
    prefixOnly: "ein|sech|sieb",
    joiner: "und",
  },
  en: {
    standalone:
      "zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand",
    prefixOnly: "thir|fif|eigh",
    joiner: "-|\\s?and\\s?",
  },
  es: {
    standalone:
      "cero|uno|dos|tr[eé]s|cuatro|cinco|s[eé]is|siete|ocho|nueve|diez|once|doce|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|mil",
    prefixOnly: "veinti|dieci|una",
    joiner: "\\s?y\\s?",
  },
};

const numberWordPattern = ({
  standalone,
  prefixOnly,
  joiner,
}: (typeof NUMBER_PARTS)[AskLottiLocale]) => {
  const any = `${standalone}|${prefixOnly}`;
  return new RegExp(
    `\\b(?:(?:${prefixOnly})(?:${joiner}|${any})+|(?:${standalone})(?:${joiner}|${any})*)\\b`,
    "iu",
  );
};

const NUMBER_WORDS: Record<AskLottiLocale, RegExp> = {
  de: numberWordPattern(NUMBER_PARTS.de),
  en: numberWordPattern(NUMBER_PARTS.en),
  es: numberWordPattern(NUMBER_PARTS.es),
};

// Causal claims stay blocked; plain hedging ("wahrscheinlich", "probably") does
// not assert a cause and is what makes an answer read carefully rather than
// vague, so it is allowed.
const CAUSAL_WORDS: Record<AskLottiLocale, RegExp> = {
  de: /\b(?:weil|daher|deshalb|deswegen|liegt\s+daran)\b/i,
  en: /\b(?:because|therefore|likely due|caused by)\b/i,
  es: /\b(?:porque|por eso|debido a)\b/i,
};

const NUMERIC_TOKEN_RE = /\d+(?:[.,]\d+)?/g;

const numericTokens = (value: string): string[] =>
  (value.match(NUMERIC_TOKEN_RE) ?? []).map((token) =>
    token.replace(",", ".").replace(/\.0+$/, ""),
  );

// Every figure in the prose must literally appear in the server-computed
// evidence cards. This lets Lotti answer concretely ("im Schnitt 13,5 Stunden")
// while still making an invented figure impossible.
export const ungroundedNumbers = (
  answer: string,
  evidenceText: string,
): string[] => {
  const grounded = new Set(numericTokens(evidenceText));
  return numericTokens(answer).filter((token) => !grounded.has(token));
};

export const isSafeDataAnswerText = (
  answer: unknown,
  locale: AskLottiLocale,
): answer is string => {
  if (typeof answer !== "string") return false;
  const value = answer.trim();
  if (value.length < 3 || value.length > 900) return false;
  if (NUMBER_WORDS[locale].test(value)) return false;
  if (/https?:\/\/|www\.|mailto:|tel:/i.test(value)) return false;
  if (/```|<\/?(?:script|system|assistant|developer|tool)\b/i.test(value))
    return false;
  if (
    /\b(diagnos|dosierung|dosage|medikament|medication|verschreib|prescrib)\w*/i.test(
      value,
    )
  ) {
    return false;
  }
  if (CAUSAL_WORDS[locale].test(value)) {
    return false;
  }
  return true;
};

// Backwards-compatible strict validator: no digits at all, in any language.
export const isSafeAnswerText = (answer: unknown): answer is string =>
  typeof answer === "string" &&
  !/\d/.test(answer) &&
  (["de", "en", "es"] as AskLottiLocale[]).every((locale) =>
    isSafeDataAnswerText(answer, locale),
  );

export const isSafeGeneralAnswerText = (answer: unknown): answer is string => {
  if (typeof answer !== "string") return false;
  const value = answer.trim();
  if (value.length < 3 || value.length > 1_200) return false;
  if (/https?:\/\/|www\.|mailto:|tel:/i.test(value)) return false;
  if (/```|<\/?(?:script|system|assistant|developer|tool)\b/i.test(value))
    return false;
  if (
    /\b(diagnos|dosierung|dosage|medikament|medication|verschreib|prescrib|behandl|treat(?:ment)?)\w*/i.test(
      value,
    )
  )
    return false;
  return true;
};

export const normalizeLocale = (value: unknown): AskLottiLocale =>
  value === "en" || value === "es" ? value : "de";
