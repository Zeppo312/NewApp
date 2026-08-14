import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AskLottiEvidence, AskLottiFollowUp } from "./types";

// Conversations stay on the device on purpose: the Frag Lotti backend never
// stores questions or answers (OpenAI runs with store:false, lotti_ai_requests
// keeps metadata only), so persisting them locally keeps that property intact.
const STORAGE_KEY = "ask_lotti_conversations_v1";

export const MAX_CONVERSATIONS = 30;
export const MAX_MESSAGES_PER_CONVERSATION = 60;
export const MAX_TITLE_LENGTH = 48;

export type StoredChatMessage = {
  id: string;
  role: "user" | "lotti";
  text: string;
  evidence?: AskLottiEvidence[];
  disclaimer?: string;
  isGeneral?: boolean;
  isError?: boolean;
  retryQuestion?: string;
  quickReplies?: AskLottiFollowUp[];
};

export type AskLottiConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredChatMessage[];
};

export const createConversationId = () =>
  `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const createMessageId = (role: StoredChatMessage["role"] | "error") =>
  `${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// The first thing the parent asked is the most recognizable label for a chat,
// so no extra model call is needed to name it.
export const deriveConversationTitle = (
  text: string,
  fallback: string,
): string => {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  if (normalized.length <= MAX_TITLE_LENGTH) return normalized;
  const cut = normalized.slice(0, MAX_TITLE_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > MAX_TITLE_LENGTH / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
};

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const normalizeEvidence = (value: unknown): AskLottiEvidence[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const items = value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Record<string, unknown>;
    const id = asString(candidate.id);
    const title = asString(candidate.title);
    const detail = asString(candidate.detail);
    return id && title && detail ? [{ id, title, detail }] : [];
  });
  return items.length > 0 ? items : undefined;
};

const normalizeQuickReplies = (
  value: unknown,
): AskLottiFollowUp[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const items = value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Record<string, unknown>;
    const id = candidate.id;
    const label = asString(candidate.label);
    const question = asString(candidate.question);
    const isTopic =
      id === "sleep" || id === "feeding" || id === "today" || id === "growth";
    return isTopic && label && question
      ? [{ id: id as AskLottiFollowUp["id"], label, question }]
      : [];
  });
  return items.length > 0 ? items : undefined;
};

const normalizeMessage = (value: unknown): StoredChatMessage | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const id = asString(candidate.id);
  const text = typeof candidate.text === "string" ? candidate.text : null;
  if (!id || text === null) return null;
  if (candidate.role !== "user" && candidate.role !== "lotti") return null;
  return {
    id,
    role: candidate.role,
    text,
    evidence: normalizeEvidence(candidate.evidence),
    disclaimer: asString(candidate.disclaimer),
    isGeneral: candidate.isGeneral === true || undefined,
    isError: candidate.isError === true || undefined,
    retryQuestion: asString(candidate.retryQuestion),
    quickReplies: normalizeQuickReplies(candidate.quickReplies),
  };
};

const normalizeConversation = (value: unknown): AskLottiConversation | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const id = asString(candidate.id);
  const title = asString(candidate.title);
  if (!id || !title) return null;
  const messages = Array.isArray(candidate.messages)
    ? candidate.messages.flatMap((entry) => {
        const message = normalizeMessage(entry);
        return message ? [message] : [];
      })
    : [];
  if (messages.length === 0) return null;
  const createdAt = asString(candidate.createdAt) ?? new Date(0).toISOString();
  return {
    id,
    title,
    createdAt,
    updatedAt: asString(candidate.updatedAt) ?? createdAt,
    messages: messages.slice(-MAX_MESSAGES_PER_CONVERSATION),
  };
};

// Newest first, bounded in both directions so a heavy user cannot grow the
// stored payload without limit.
export const normalizeConversations = (
  value: unknown,
): AskLottiConversation[] => {
  if (!Array.isArray(value)) return [];
  const conversations = value.flatMap((entry) => {
    const conversation = normalizeConversation(entry);
    return conversation ? [conversation] : [];
  });
  const seen = new Set<string>();
  return conversations
    .filter((conversation) => {
      if (seen.has(conversation.id)) return false;
      seen.add(conversation.id);
      return true;
    })
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, MAX_CONVERSATIONS);
};

export const upsertConversation = (
  conversations: AskLottiConversation[],
  conversation: AskLottiConversation,
): AskLottiConversation[] =>
  normalizeConversations([
    conversation,
    ...conversations.filter((entry) => entry.id !== conversation.id),
  ]);

export const removeConversation = (
  conversations: AskLottiConversation[],
  id: string,
): AskLottiConversation[] =>
  conversations.filter((conversation) => conversation.id !== id);

export const loadConversations = async (): Promise<AskLottiConversation[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return normalizeConversations(JSON.parse(raw));
  } catch (error) {
    console.error("Failed to load Frag Lotti conversations:", error);
    return [];
  }
};

export const saveConversations = async (
  conversations: AskLottiConversation[],
): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(normalizeConversations(conversations)),
    );
  } catch (error) {
    console.error("Failed to save Frag Lotti conversations:", error);
  }
};

export const clearConversations = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear Frag Lotti conversations:", error);
  }
};
