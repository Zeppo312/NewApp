import type { AppLocale } from "@/lib/localization";

export type AskLottiIntent =
  | "sleep_comparison"
  | "sleep_overview"
  | "sleep_support"
  | "feeding_trend"
  | "diaper_summary"
  | "routine_summary"
  | "longest_sleep"
  | "doctor_summary"
  | "caregiver_handoff"
  | "tomorrow_planning"
  | "general_parenting"
  | "pregnancy_overview"
  | "pregnancy_guidance"
  | "unsupported"
  | "medical_escalation";

export type AskLottiEvidence = {
  id: string;
  title: string;
  detail: string;
};

export type AskLottiMode =
  | "data"
  | "general"
  | "mixed"
  | "clarify"
  | "medical"
  | "refuse";

/** 'baby' = born baby with tracking records; 'pregnancy' = due date only. */
export type AskLottiContextMode = "baby" | "pregnancy";

export type AskLottiFollowUp = {
  id:
    | "sleep"
    | "feeding"
    | "today"
    | "growth"
    | "week"
    | "selfcare"
    | "weight"
    | "preparation";
  label: string;
  question: string;
};

export type AskLottiHistoryItem = {
  role: "user" | "assistant";
  text: string;
};

export type AskLottiResponse = {
  answer: string;
  evidence: AskLottiEvidence[];
  disclaimer: string;
  intent: AskLottiIntent;
  mode: AskLottiMode;
  followUps: AskLottiFollowUp[];
  remaining: { minute?: number; day?: number; month?: number } | null;
};

export type AskLottiRequest = {
  /** Required in baby mode; null while the baby is not born yet. */
  babyId: string | null;
  mode?: AskLottiContextMode;
  question: string;
  locale: AppLocale;
  history?: AskLottiHistoryItem[];
};
