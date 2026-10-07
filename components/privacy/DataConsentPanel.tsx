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
import type { DataConsentScope } from "@/lib/dataConsentTypes";
import { activeDataConsentCopy, dataConsentCopy } from "@/lib/dataConsentCopy";
import type { AppLocale } from "@/lib/localization";
export type DataConsentPanelProps = {
  scope: DataConsentScope;
  locale: AppLocale;
  busy?: boolean;
  error?: boolean;
  active?: boolean;
  onDecide: (granted: boolean) => void;
  onCancel?: () => void;
};
export function DataConsentPanel({
  scope,
  locale,
  busy = false,
  error = false,
  active = false,
  onDecide,
  onCancel,
}: DataConsentPanelProps) {
  const [checked, setChecked] = useState(false);
  const copy = (active ? activeDataConsentCopy : dataConsentCopy)[locale];
  const health = scope === "health";
  return (
    <View style={consentStyles.card}>
      <Text accessibilityRole="header" style={consentStyles.title}>
        {health ? copy.healthTitle : copy.aiTitle}
      </Text>
      <Text style={consentStyles.body}>
        {health ? copy.healthBody : copy.aiBody}
      </Text>
      <Text style={consentStyles.body}>
        {health ? copy.healthConsequence : copy.aiConsequence}
      </Text>
      <Text style={consentStyles.body}>{copy.withdrawal}</Text>
      <Pressable
        accessibilityRole="link"
        onPress={() =>
          void Linking.openURL(
            `https://lottibaby.de/datenschutz?lang=${locale}`,
          )
        }
        style={consentStyles.link}
      >
        <Text style={consentStyles.linkText}>{copy.privacy}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled: busy }}
        disabled={busy}
        onPress={() => setChecked((value) => !value)}
        style={consentStyles.check}
      >
        <Text accessible={false} style={consentStyles.box}>
          {checked ? "☑" : "☐"}
        </Text>
        <Text style={[consentStyles.body, { flex: 1 }]}>
          {health ? copy.healthChoice : copy.aiChoice}
        </Text>
      </Pressable>
      {error && (
        <Text accessibilityRole="alert" style={consentStyles.error}>
          {copy.error}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !checked || busy }}
        disabled={!checked || busy}
        style={[consentStyles.button, (!checked || busy) && { opacity: 0.5 }]}
        onPress={() => onDecide(true)}
      >
        <Text style={consentStyles.buttonText}>
          {busy ? copy.saving : copy.accept}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        style={consentStyles.secondary}
        onPress={() => onDecide(false)}
      >
        <Text style={consentStyles.linkText}>
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
          <Text style={consentStyles.linkText}>{copy.cancel}</Text>
        </Pressable>
      )}
      {busy && <ActivityIndicator />}
    </View>
  );
}
export function ConsentPage({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      contentContainerStyle={consentStyles.page}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
export const consentStyles = StyleSheet.create({
  page: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 64,
    paddingBottom: 48,
    backgroundColor: "#fffaf5",
    gap: 18,
  },
  card: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    gap: 16,
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#fff",
  },
  title: { color: "#30282b", fontSize: 25, fontWeight: "700", lineHeight: 32 },
  body: { color: "#30282b", fontSize: 16, lineHeight: 24 },
  check: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
  },
  box: { fontSize: 28, color: "#665086" },
  button: { padding: 16, borderRadius: 12, backgroundColor: "#665086" },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    fontWeight: "700",
  },
  secondary: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#665086",
  },
  link: { paddingVertical: 12 },
  linkText: {
    color: "#665086",
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
  },
  error: { color: "#9b2531", fontSize: 16, lineHeight: 23 },
});
