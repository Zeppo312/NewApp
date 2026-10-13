export type DataConsentScope = "health" | "ai";
export type DataConsentDecision = "granted" | "declined" | "revoked";
export const DATA_CONSENT_VERSION = "2026-10-01.1";
export type DataConsentRecord = {
  decision: DataConsentDecision;
  documentVersion: string;
  decidedAt: string;
};
export type DataConsentSnapshot = {
  enabled: boolean;
  userId: string;
  revision: number;
  documentVersion: string;
  health: DataConsentRecord | null;
  ai: DataConsentRecord | null;
  healthAllowed: boolean;
  aiAllowed: boolean;
};
export function hasDataConsent(snapshot: DataConsentSnapshot | null, scope: DataConsentScope): boolean {
  if (!snapshot || snapshot.documentVersion !== DATA_CONSENT_VERSION) return false;
  const current = (key: DataConsentScope) => snapshot[key]?.decision === "granted" && snapshot[key]?.documentVersion === DATA_CONSENT_VERSION;
  return current("health") && snapshot.healthAllowed && (scope === "health" || (current("ai") && snapshot.aiAllowed));
}
