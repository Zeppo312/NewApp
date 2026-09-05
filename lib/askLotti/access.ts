import { useFeatureAccess } from "@/lib/entitlements";

export const useAskLottiAccess = (): boolean | null =>
  useFeatureAccess("fragLotti").hasAccess;
