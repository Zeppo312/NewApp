import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createConversationId,
  createMessageId,
  deriveConversationTitle,
  loadConversations,
  MAX_CONVERSATIONS,
  MAX_MESSAGES_PER_CONVERSATION,
  normalizeConversations,
  removeConversation,
  saveConversations,
  upsertConversation,
  type AskLottiConversation,
} from "../askLotti/chatStore";

const message = (id: string, role: "user" | "lotti" = "user") => ({
  id,
  role,
  text: `text ${id}`,
});

const conversation = (
  id: string,
  updatedAt: string,
  messageCount = 1,
): AskLottiConversation => ({
  id,
  title: `Chat ${id}`,
  createdAt: updatedAt,
  updatedAt,
  messages: Array.from({ length: messageCount }, (_, index) =>
    message(`${id}-${index}`),
  ),
});

describe("Frag Lotti chat store", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("derives a readable title from the first question", () => {
    expect(deriveConversationTitle("  Wie viel   Schlaf?  ", "Chats")).toBe(
      "Wie viel Schlaf?",
    );
    expect(deriveConversationTitle("", "Chats")).toBe("Chats");
    const long = deriveConversationTitle(
      "Wie hat sich die Trinkmenge in den letzten zwei Wochen entwickelt?",
      "Chats",
    );
    expect(long.endsWith("…")).toBe(true);
    expect(long.length).toBeLessThanOrEqual(49);
    expect(long).not.toMatch(/\s…$/);
  });

  it("generates unique ids so restored messages never collide", () => {
    const ids = new Set(
      Array.from({ length: 200 }, () => createMessageId("user")),
    );
    expect(ids.size).toBe(200);
    expect(new Set([createConversationId(), createConversationId()]).size).toBe(
      2,
    );
  });

  it("sorts newest first, drops duplicates and bounds the stored size", () => {
    const list = normalizeConversations([
      conversation("a", "2026-08-01T10:00:00.000Z"),
      conversation("b", "2026-08-14T10:00:00.000Z"),
      conversation("a", "2026-08-02T10:00:00.000Z"),
      ...Array.from({ length: MAX_CONVERSATIONS + 5 }, (_, index) =>
        conversation(`x${index}`, "2026-07-01T10:00:00.000Z"),
      ),
    ]);
    expect(list).toHaveLength(MAX_CONVERSATIONS);
    expect(list[0].id).toBe("b");
    expect(list.filter((entry) => entry.id === "a")).toHaveLength(1);
  });

  it("keeps only the most recent messages of a long conversation", () => {
    const [stored] = normalizeConversations([
      conversation("a", "2026-08-14T10:00:00.000Z", 90),
    ]);
    expect(stored.messages).toHaveLength(MAX_MESSAGES_PER_CONVERSATION);
    expect(stored.messages[stored.messages.length - 1].id).toBe("a-89");
  });

  it("discards malformed entries instead of throwing", () => {
    expect(normalizeConversations("nope")).toEqual([]);
    expect(
      normalizeConversations([
        null,
        { id: "no-title", messages: [message("m1")] },
        { id: "no-messages", title: "T", messages: [] },
        { id: "bad-role", title: "T", messages: [{ id: "m", role: "system" }] },
        {
          id: "ok",
          title: "T",
          createdAt: "2026-08-14T10:00:00.000Z",
          updatedAt: "2026-08-14T10:00:00.000Z",
          messages: [message("m1"), { id: "m2", role: "lotti" }],
        },
      ]).map((entry) => entry.id),
    ).toEqual(["ok"]);
  });

  it("moves an updated conversation back to the top", () => {
    const list = [
      conversation("a", "2026-08-14T10:00:00.000Z"),
      conversation("b", "2026-08-13T10:00:00.000Z"),
    ];
    const next = upsertConversation(list, {
      ...conversation("b", "2026-08-15T10:00:00.000Z"),
      title: "Chat b",
    });
    expect(next.map((entry) => entry.id)).toEqual(["b", "a"]);
    expect(next).toHaveLength(2);
  });

  it("removes a conversation by id", () => {
    const list = [
      conversation("a", "2026-08-14T10:00:00.000Z"),
      conversation("b", "2026-08-13T10:00:00.000Z"),
    ];
    expect(removeConversation(list, "a").map((entry) => entry.id)).toEqual([
      "b",
    ]);
    expect(removeConversation(list, "missing")).toHaveLength(2);
  });

  it("round-trips through AsyncStorage and survives corrupted data", async () => {
    await saveConversations([conversation("a", "2026-08-14T10:00:00.000Z")]);
    const loaded = await loadConversations();
    expect(loaded.map((entry) => entry.id)).toEqual(["a"]);
    expect(loaded[0].messages[0].text).toBe("text a-0");

    await AsyncStorage.setItem("ask_lotti_conversations_v1", "{not json");
    expect(await loadConversations()).toEqual([]);
  });

  it("preserves the evidence cards of a stored answer", async () => {
    await saveConversations([
      {
        ...conversation("a", "2026-08-14T10:00:00.000Z"),
        messages: [
          {
            id: "m1",
            role: "lotti",
            text: "Antwort",
            disclaimer: "Aus euren Einträgen",
            evidence: [
              { id: "sleep_avg", title: "Ø Schlaf", detail: "13,5 h" },
            ],
            quickReplies: [
              { id: "sleep", label: "Schlaf", question: "Wie war der Schlaf?" },
            ],
          },
        ],
      },
    ]);
    const [loaded] = await loadConversations();
    expect(loaded.messages[0].evidence).toEqual([
      { id: "sleep_avg", title: "Ø Schlaf", detail: "13,5 h" },
    ]);
    expect(loaded.messages[0].quickReplies?.[0].id).toBe("sleep");
    expect(loaded.messages[0].disclaimer).toBe("Aus euren Einträgen");
  });
});
