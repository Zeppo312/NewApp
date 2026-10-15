import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from "@/components/Header";
import { ThemedBackground } from "@/components/ThemedBackground";
import { ContentCard } from "@/components/ui/content-card";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { onboardingColors as brand } from "@/components/onboarding/theme";
import { CONTENT_LAYOUT, LAYOUT_PAD } from "@/constants/DesignGuide";
import { useAdaptiveColors } from "@/hooks/useAdaptiveColors";
import type { DataConsentScope } from "@/lib/dataConsentTypes";
import { activeDataConsentCopy, dataConsentCopy } from "@/lib/dataConsentCopy";
import type { AppLocale } from "@/lib/localization";
export type DataConsentPanelProps = {
  scope: DataConsentScope;
  locale: AppLocale;
  busy?: boolean;
  error?: boolean;
  active?: boolean;
  /** Position in the first-run sequence, e.g. 1 of 2. */
  step?: { index: number; total: number };
  onDecide: (granted: boolean) => void;
  onCancel?: () => void;
};
/** Text and tint colors that follow the app background like the Home cards. */
export function useConsentColors() {
  const adaptive = useAdaptiveColors();
  const dark = adaptive.effectiveScheme === "dark" || adaptive.isDarkBackground;
  return {
    dark,
    text: adaptive.textPrimary,
    secondary: adaptive.textSecondary,
    muted: adaptive.textTertiary,
    accent: dark ? "#CDB8FF" : brand.accentText,
    tint: dark ? "rgba(205,184,255,0.16)" : "rgba(94,61,179,0.10)",
    tintBorder: dark ? "rgba(205,184,255,0.34)" : "rgba(94,61,179,0.28)",
    inner: dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.34)",
    innerBorder: dark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.4)",
    divider: dark ? "rgba(255,255,255,0.14)" : "rgba(125,90,80,0.14)",
    neutral: dark ? "rgba(255,255,255,0.12)" : "rgba(125,90,80,0.09)",
    error: dark ? "#FFB4BC" : "#9b2531",
  };
}
export type ConsentColors = ReturnType<typeof useConsentColors>;
export const consentScopeIcon = { health: "heart.fill", ai: "sparkles" } as const;
export function ConsentScopeIcon({ scope }: { scope: DataConsentScope }) {
  const c = useConsentColors();
  return (
    <View
      accessible={false}
      style={[
        consentStyles.scopeIcon,
        { backgroundColor: scope === "health" ? "rgba(232,160,191,0.22)" : c.tint },
      ]}
    >
      <IconSymbol
        name={consentScopeIcon[scope]}
        size={20}
        color={scope === "health" ? "#D46A93" : c.accent}
      />
    </View>
  );
}
/** The app-wide glass surface (same as "Dein Tag im Überblick"). */
export function ConsentCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <ContentCard style={consentStyles.cardOuter}>
      <View style={[consentStyles.card, style]}>{children}</View>
    </ContentCard>
  );
}
export function DataConsentPanel({
  scope,
  locale,
  busy = false,
  error = false,
  active = false,
  step,
  onDecide,
  onCancel,
}: DataConsentPanelProps) {
  const [checked, setChecked] = useState(false);
  const c = useConsentColors();
  const copy = (active ? activeDataConsentCopy : dataConsentCopy)[locale];
  const extra = activeDataConsentCopy[locale];
  const health = scope === "health";
  const acceptDisabled = !checked || busy;
  return (
    <ConsentCard>
      <View style={consentStyles.headerRow}>
        <ConsentScopeIcon scope={scope} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[consentStyles.eyebrow, { color: c.accent }]}>
            {[
              step &&
                extra.step
                  .replace("{n}", String(step.index))
                  .replace("{total}", String(step.total)),
              health ? extra.healthBadge : extra.aiBadge,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          <Text accessibilityRole="header" style={[consentStyles.cardTitle, { color: c.text }]}>
            {health ? copy.healthTitle : copy.aiTitle}
          </Text>
        </View>
      </View>
      <Text style={[consentStyles.body, { color: c.text }]}>
        {health ? copy.healthBody : copy.aiBody}
      </Text>
      <View style={[consentStyles.notice, { backgroundColor: c.tint, borderColor: c.tintBorder }]}>
        <IconSymbol name="info.circle.fill" size={18} color={c.accent} />
        <Text style={[consentStyles.noticeText, { color: c.text }]}>
          {health ? copy.healthConsequence : copy.aiConsequence}
        </Text>
      </View>
      <Text style={[consentStyles.small, { color: c.secondary }]}>{copy.withdrawal}</Text>
      <Pressable
        accessibilityRole="link"
        onPress={() =>
          void Linking.openURL(
            `https://lottibaby.de/datenschutz?lang=${locale}`,
          )
        }
        style={consentStyles.inlineLink}
      >
        <Text style={[consentStyles.inlineLinkText, { color: c.accent }]}>{copy.privacy}</Text>
        <IconSymbol name="arrow.up.right" size={14} color={c.accent} />
      </Pressable>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled: busy }}
        disabled={busy}
        onPress={() => setChecked((value) => !value)}
        style={[
          consentStyles.check,
          checked
            ? { backgroundColor: c.tint, borderColor: brand.accent }
            : { backgroundColor: c.inner, borderColor: c.tintBorder },
        ]}
      >
        <View
          accessible={false}
          style={[
            consentStyles.box,
            checked ? consentStyles.boxChecked : { backgroundColor: c.dark ? "transparent" : brand.white },
          ]}
        >
          {checked && <IconSymbol name="checkmark" size={16} color={brand.white} />}
        </View>
        <Text style={[consentStyles.checkText, { color: c.text }]}>
          {health ? copy.healthChoice : copy.aiChoice}
        </Text>
      </Pressable>
      {error && (
        <Text accessibilityRole="alert" style={[consentStyles.error, { color: c.error }]}>
          {copy.error}
        </Text>
      )}
      <View style={{ gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: acceptDisabled }}
          disabled={acceptDisabled}
          style={[consentStyles.button, acceptDisabled && consentStyles.buttonDisabled]}
          onPress={() => onDecide(true)}
        >
          {busy && <ActivityIndicator color={brand.white} />}
          <Text style={consentStyles.buttonText}>
            {busy ? copy.saving : copy.accept}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          style={[consentStyles.secondary, { borderColor: c.tintBorder, backgroundColor: c.inner }]}
          onPress={() => onDecide(false)}
        >
          <Text style={[consentStyles.secondaryText, { color: c.accent }]}>
            {health ? copy.declineHealth : copy.declineAi}
          </Text>
        </Pressable>
        {onCancel && (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onCancel}
            style={consentStyles.link}
          >
            <Text style={[consentStyles.linkText, { color: c.accent }]}>{copy.cancel}</Text>
          </Pressable>
        )}
      </View>
    </ConsentCard>
  );
}
/** Page frame with the app background and shared Header like Settings. */
export function ConsentPage({ children, title, subtitle, onBack, backLabel }: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <ThemedBackground style={consentStyles.background}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        {title !== undefined && (
          <Header
            topSafeAreaHandled
            title={title}
            subtitle={subtitle}
            showBackButton={!!onBack}
            onBackPress={onBack}
            backAccessibilityLabel={backLabel}
            showBabySwitcher={false}
          />
        )}
        <ScrollView
          contentContainerStyle={consentStyles.page}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}
const pill = {
  minHeight: 56,
  paddingHorizontal: 20,
  paddingVertical: 14,
  borderRadius: 28,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
} as const;
const column = { width: "100%", maxWidth: 560, alignSelf: "center" } as const;
export const consentStyles = StyleSheet.create({
  background: { flex: 1, width: "100%", height: "100%" },
  page: {
    flexGrow: 1,
    paddingHorizontal: LAYOUT_PAD,
    paddingTop: 12,
    paddingBottom: 48,
    gap: 16,
  },
  header: { ...column, gap: 10 },
  intro: { fontSize: 15, lineHeight: 23 },
  cardOuter: { ...column },
  card: { gap: 16, padding: CONTENT_LAYOUT.cardPadding },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  scopeIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  cardTitle: { fontSize: 20, fontWeight: "700", lineHeight: 26 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, lineHeight: 16, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 23 },
  small: { fontSize: 13, lineHeight: 20 },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: CONTENT_LAYOUT.innerRadius,
    borderCurve: "continuous",
    borderWidth: 1,
  },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 21 },
  inlineLink: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 4 },
  inlineLinkText: { fontSize: 15, lineHeight: 21, fontWeight: "600" },
  check: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 16,
    borderRadius: CONTENT_LAYOUT.innerRadius,
    borderCurve: "continuous",
    borderWidth: 1.5,
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: brand.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  boxChecked: { backgroundColor: brand.accent },
  checkText: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: "600" },
  button: {
    ...pill,
    backgroundColor: brand.accent,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.7)",
    boxShadow: "0 8px 22px rgba(94,61,179,0.24)",
  },
  buttonDisabled: { opacity: 0.45, boxShadow: "none" },
  buttonText: {
    flexShrink: 1,
    color: brand.white,
    fontSize: 17,
    lineHeight: 23,
    textAlign: "center",
    fontWeight: "700",
  },
  secondary: { ...pill, borderWidth: 1.5 },
  secondaryText: {
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    fontWeight: "600",
  },
  link: { paddingVertical: 12, alignItems: "center" },
  linkTight: { paddingVertical: 2, marginTop: -4 },
  linkText: { fontSize: 16, lineHeight: 23, textAlign: "center" },
  status: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  statusRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    minHeight: 54,
  },
  menuDivider: { height: StyleSheet.hairlineWidth, marginLeft: 50 },
  menuText: { flex: 1, fontSize: 16, lineHeight: 22 },
  error: { fontSize: 15, lineHeight: 22 },
});
