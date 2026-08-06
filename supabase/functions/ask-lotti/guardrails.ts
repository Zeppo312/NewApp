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

const NUMBER_WORDS: Record<AskLottiLocale, RegExp> = {
  de: /\b(?:null|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwanzig|dreißig|vierzig|fünfzig|sechzig|siebzig|achtzig|neunzig|hundert|tausend|ein(?:s|und|hundert|tausend))[\p{L}-]*\b/iu,
  en: /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)[\p{L}-]*\b/iu,
  es: /\b(?:cero|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|mil)[\p{L}-]*\b/iu,
};

const CAUSAL_WORDS: Record<AskLottiLocale, RegExp> = {
  de: /\b(?:weil|daher|deshalb|wahrscheinlich|vermutlich)\b/i,
  en: /\b(?:because|therefore|likely due|probably)\b/i,
  es: /\b(?:porque|probablemente|por eso)\b/i,
};

export const isSafeDataAnswerText = (
  answer: unknown,
  locale: AskLottiLocale,
): answer is string => {
  if (typeof answer !== "string") return false;
  const value = answer.trim();
  if (value.length < 3 || value.length > 900) return false;
  if (/\d/.test(value)) return false;
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

// Backwards-compatible strict validator used by older tests and callers.
export const isSafeAnswerText = (answer: unknown): answer is string =>
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
