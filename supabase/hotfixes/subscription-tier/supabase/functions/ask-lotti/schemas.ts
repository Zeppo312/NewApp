export const ASK_LOTTI_ANSWER_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "source_ids"],
  properties: {
    answer: { type: "string" },
    source_ids: {
      type: "array",
      items: { type: "string" },
    },
  },
};
