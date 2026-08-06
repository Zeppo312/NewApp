import * as Crypto from "expo-crypto";

import { supabase } from "@/lib/supabase";
import {
  MAX_ASK_LOTTI_QUESTION_LENGTH,
  MIN_ASK_LOTTI_QUESTION_LENGTH,
  normalizeAskLottiQuestion,
} from "./input";
import type { AskLottiRequest, AskLottiResponse } from "./types";

export class AskLottiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number | null = null,
    public readonly retryAt: string | null = null,
  ) {
    super(message);
    this.name = "AskLottiError";
  }
}

const isResponse = (value: unknown): value is AskLottiResponse => {
  const body = value as Partial<AskLottiResponse> | null;
  return Boolean(
    body &&
    typeof body.answer === "string" &&
    Array.isArray(body.evidence) &&
    body.evidence.every(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.detail === "string",
    ) &&
    typeof body.disclaimer === "string" &&
    typeof body.intent === "string" &&
    typeof body.mode === "string" &&
    Array.isArray(body.followUps) &&
    body.followUps.every(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.label === "string" &&
        typeof item.question === "string",
    ),
  );
};

export const askLotti = async (
  request: AskLottiRequest,
): Promise<AskLottiResponse> => {
  const question = normalizeAskLottiQuestion(request.question);
  if (
    question.length < MIN_ASK_LOTTI_QUESTION_LENGTH ||
    question.length > MAX_ASK_LOTTI_QUESTION_LENGTH
  ) {
    throw new AskLottiError("invalid_question", "invalid_question", 400);
  }

  // A cryptographically random id makes one tap one billable request. The
  // database rejects accidental or malicious replays atomically.
  const requestId = Crypto.randomUUID();
  const { data, error } = await supabase.functions.invoke<AskLottiResponse>(
    "ask-lotti",
    {
      body: {
        babyId: request.babyId,
        question,
        locale: request.locale,
        history: (request.history ?? []).slice(-4).map((item) => ({
          role: item.role,
          text: normalizeAskLottiQuestion(item.text).slice(0, 200),
        })),
        requestId,
        timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      },
    },
  );
  if (error) {
    const response = (error as { context?: Response }).context;
    let errorBody: { error?: string; retryAt?: string } | null = null;
    if (response && typeof response.json === "function") {
      try {
        errorBody = (await response.json()) as {
          error?: string;
          retryAt?: string;
        };
      } catch {
        // Use the stable fallback below when the gateway body is not JSON.
      }
    }
    throw new AskLottiError(
      errorBody?.error ?? "request_failed",
      errorBody?.error ?? "request_failed",
      response?.status ?? null,
      errorBody?.retryAt ?? null,
    );
  }
  if (!isResponse(data))
    throw new AskLottiError("invalid_response", "invalid_response");
  return data;
};
