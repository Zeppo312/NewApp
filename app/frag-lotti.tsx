import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import Header from "@/components/Header";
import { LockedFeatureScreen } from "@/components/LockedFeatureScreen";
import { ThemedBackground } from "@/components/ThemedBackground";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { useActiveBaby } from "@/contexts/ActiveBabyContext";
import { useLocale } from "@/contexts/LocaleContext";
import { useAskLottiAccess } from "@/lib/askLotti/access";
import { askLotti, AskLottiError } from "@/lib/askLotti/api";
import {
  isAskLottiGreeting,
  isAskLottiThanks,
  MAX_ASK_LOTTI_QUESTION_LENGTH,
  MIN_ASK_LOTTI_QUESTION_LENGTH,
  normalizeAskLottiQuestion,
} from "@/lib/askLotti/input";
import {
  askLottiSuggestions,
  translateAskLotti,
} from "@/lib/askLotti/translations";
import type {
  AskLottiEvidence,
  AskLottiFollowUp,
  AskLottiHistoryItem,
} from "@/lib/askLotti/types";

type ChatMessage = {
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

export default function AskLottiScreen() {
  const { locale } = useLocale();
  const { activeBabyId } = useActiveBaby();
  const access = useAskLottiAccess();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const requestInFlightRef = useRef(false);
  const t = (
    key: Parameters<typeof translateAskLotti>[1],
    params?: Record<string, string | number>,
  ) => translateAskLotti(locale, key, params);
  const suggestions = useMemo(() => askLottiSuggestions(locale), [locale]);
  const [question, setQuestion] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [remainingToday, setRemainingToday] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "intro", role: "lotti", text: t("intro") },
  ]);
  const normalizedQuestion = normalizeAskLottiQuestion(question);
  const canSend =
    access === true &&
    !isSending &&
    normalizedQuestion.length >= MIN_ASK_LOTTI_QUESTION_LENGTH &&
    normalizedQuestion.length <= MAX_ASK_LOTTI_QUESTION_LENGTH;

  useEffect(() => {
    const timer = setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      80,
    );
    return () => clearTimeout(timer);
  }, [isSending, messages]);

  if (access === false) {
    return (
      <LockedFeatureScreen
        feature="fragLotti"
        headerTitle={t("title")}
        headerSubtitle={t("premium")}
      />
    );
  }

  const send = async (preset?: string) => {
    if (requestInFlightRef.current) return;
    const value = normalizeAskLottiQuestion(preset ?? question);
    if (value.length < MIN_ASK_LOTTI_QUESTION_LENGTH) return;
    if (value.length > MAX_ASK_LOTTI_QUESTION_LENGTH) {
      setMessages((current) => [
        ...current,
        {
          id: `error-${current.length}`,
          role: "lotti",
          text: t("tooLong"),
          isError: true,
        },
      ]);
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${messages.length}`,
      role: "user",
      text: value,
    };
    if (Platform.OS === "ios")
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const localReply = isAskLottiGreeting(value)
      ? t("greeting")
      : isAskLottiThanks(value)
        ? t("thanks")
        : null;
    if (localReply) {
      setMessages((current) => [
        ...current,
        userMessage,
        { id: `local-${current.length}`, role: "lotti", text: localReply },
      ]);
      setQuestion("");
      return;
    }
    if (!activeBabyId) {
      setMessages((current) => [
        ...current,
        userMessage,
        {
          id: `error-${current.length}`,
          role: "lotti",
          text: t("noBaby"),
          isError: true,
        },
      ]);
      setQuestion("");
      return;
    }
    requestInFlightRef.current = true;
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setIsSending(true);
    try {
      const history: AskLottiHistoryItem[] = messages
        .filter((message) => message.id !== "intro")
        .slice(-4)
        .map((message) => ({
          role: message.role === "user" ? "user" : "assistant",
          text: message.text.slice(0, 200),
        }));
      const response = await askLotti({
        babyId: activeBabyId,
        question: value,
        locale,
        history,
      });
      if (typeof response.remaining?.day === "number")
        setRemainingToday(response.remaining.day);
      setMessages((current) => [
        ...current,
        {
          id: `lotti-${current.length}`,
          role: "lotti",
          text: response.answer,
          evidence: response.evidence,
          disclaimer: response.disclaimer,
          isGeneral:
            response.mode === "general" ||
            (response.mode === "mixed" && response.evidence.length === 0),
          quickReplies:
            response.followUps.length > 0
              ? response.followUps
              : response.mode === "refuse"
                ? suggestions.slice(0, 3).map((reply, index) => ({
                    id: ["sleep", "feeding", "today"][
                      index
                    ] as AskLottiFollowUp["id"],
                    label: reply,
                    question: reply,
                  }))
                : undefined,
        },
      ]);
    } catch (error) {
      const askLottiError = error instanceof AskLottiError ? error : null;
      const errorText =
        askLottiError?.status === 429
          ? t("rateLimit")
          : askLottiError?.status === 401
            ? t("sessionExpired")
            : askLottiError?.status === 403
              ? t("premium")
              : askLottiError?.status === 400
                ? t("invalidQuestion")
                : askLottiError?.status === 503
                  ? t("serviceUnavailable")
                  : t("genericError");
      setMessages((current) => [
        ...current,
        {
          id: `error-${current.length}`,
          role: "lotti",
          text: errorText,
          isError: true,
          retryQuestion: value,
        },
      ]);
    } finally {
      requestInFlightRef.current = false;
      setIsSending(false);
    }
  };

  return (
    <ThemedBackground style={styles.background}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <StatusBar barStyle="dark-content" />
        <Header
          title={t("title")}
          subtitle={t("subtitle")}
          showBackButton
          showBabySwitcher
        />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={8}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.content}
            contentInsetAdjustmentBehavior="automatic"
            keyboardDismissMode={
              Platform.OS === "ios" ? "interactive" : "on-drag"
            }
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.securityCard}>
              <View style={styles.securityIconWrap}>
                <IconSymbol
                  name="lock.shield"
                  size={19}
                  color="#6544B8"
                  weight="semibold"
                />
              </View>
              <View style={styles.securityCopy}>
                <Text style={styles.securityTitle}>{t("safetyTitle")}</Text>
                <Text style={styles.securityText}>{t("safety")}</Text>
                <View style={styles.capabilityRow}>
                  <View style={styles.capabilityChip}>
                    <IconSymbol
                      name="lightbulb"
                      size={11}
                      color="#6544B8"
                      weight="semibold"
                    />
                    <Text style={styles.capabilityText}>
                      {t("generalHelp")}
                    </Text>
                  </View>
                  <View style={styles.capabilityChip}>
                    <IconSymbol
                      name="chart.bar"
                      size={11}
                      color="#6544B8"
                      weight="semibold"
                    />
                    <Text style={styles.capabilityText}>
                      {t("personalHelp")}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageRow,
                  message.role === "user" && styles.userRow,
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    message.role === "user"
                      ? styles.userBubble
                      : styles.lottiBubble,
                    message.isError && styles.errorBubble,
                  ]}
                >
                  {message.role === "lotti" ? (
                    <View style={styles.lottiIdentity}>
                      <View style={styles.lottiAvatar}>
                        <IconSymbol
                          name="sparkles"
                          size={14}
                          color="#FFFFFF"
                          weight="semibold"
                        />
                      </View>
                      <View>
                        <Text style={styles.lottiLabel}>LOTTI</Text>
                        <Text style={styles.lottiMeta}>
                          {message.evidence?.length
                            ? t("grounded")
                            : message.isGeneral
                              ? t("general")
                              : t("assistant")}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  <Text
                    selectable
                    style={[
                      styles.messageText,
                      message.role === "user" && styles.userText,
                    ]}
                  >
                    {message.id === "intro" ? t("intro") : message.text}
                  </Text>
                  {message.retryQuestion ? (
                    <Pressable
                      onPress={() => void send(message.retryQuestion)}
                      disabled={isSending}
                      style={({ pressed }) => [
                        styles.retryButton,
                        pressed && styles.retryPressed,
                      ]}
                    >
                      <IconSymbol
                        name="arrow.clockwise"
                        size={14}
                        color="#6542BD"
                        weight="semibold"
                      />
                      <Text style={styles.retryText}>{t("retry")}</Text>
                    </Pressable>
                  ) : null}
                  {message.quickReplies?.length ? (
                    <View style={styles.quickReplies}>
                      {message.quickReplies.map((reply) => (
                        <Pressable
                          key={`${reply.id}-${reply.question}`}
                          onPress={() => void send(reply.question)}
                          disabled={isSending}
                          style={({ pressed }) => [
                            styles.quickReply,
                            pressed && styles.quickReplyPressed,
                          ]}
                        >
                          <Text style={styles.quickReplyText}>
                            {reply.label}
                          </Text>
                          <IconSymbol
                            name="chevron.right"
                            size={14}
                            color="#7658BD"
                            weight="semibold"
                          />
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  {message.evidence?.length ? (
                    <View style={styles.evidenceWrap}>
                      <View style={styles.evidenceHeadingRow}>
                        <IconSymbol
                          name="doc.text.magnifyingglass"
                          size={15}
                          color="#6848B8"
                          weight="semibold"
                        />
                        <Text style={styles.evidenceHeading}>
                          {t("source")}
                        </Text>
                      </View>
                      {message.evidence.map((item) => (
                        <View key={item.id} style={styles.evidenceCard}>
                          <View style={styles.evidenceMarker} />
                          <View style={styles.evidenceCopy}>
                            <Text selectable style={styles.evidenceTitle}>
                              {item.title}
                            </Text>
                            <Text selectable style={styles.evidenceDetail}>
                              {item.detail}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {message.disclaimer ? (
                    <Text selectable style={styles.disclaimer}>
                      {message.disclaimer}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}

            {messages.length === 1 ? (
              <View style={styles.suggestions}>
                <Text style={styles.suggestionsTitle}>
                  {t("suggestionsTitle")}
                </Text>
                {suggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    onPress={() => void send(suggestion)}
                    style={styles.suggestion}
                    disabled={isSending || access !== true}
                  >
                    <View style={styles.suggestionIcon}>
                      <IconSymbol
                        name="sparkles"
                        size={13}
                        color="#6848B8"
                        weight="semibold"
                      />
                    </View>
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                    <IconSymbol
                      name="chevron.right"
                      size={18}
                      color="#8C75C4"
                      weight="semibold"
                    />
                  </Pressable>
                ))}
              </View>
            ) : null}

            {isSending ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#5E3DB3" />
                <Text style={styles.loadingText}>{t("loading")}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View
            style={[
              styles.composerWrap,
              { paddingBottom: Math.max(insets.bottom, 8) },
            ]}
          >
            <View style={styles.composerMeta}>
              <View style={styles.readyStatus}>
                <View style={styles.readyDot} />
                <Text style={styles.readyText}>{t("ready")}</Text>
              </View>
              {remainingToday !== null ? (
                <Text style={styles.remaining}>
                  {t("remaining", { count: remainingToday })}
                </Text>
              ) : null}
            </View>
            <View style={[styles.composer, canSend && styles.composerActive]}>
              <TextInput
                value={question}
                onChangeText={setQuestion}
                placeholder={t("placeholder")}
                placeholderTextColor="#A08B82"
                style={styles.input}
                multiline
                maxLength={MAX_ASK_LOTTI_QUESTION_LENGTH}
                editable={!isSending && access === true}
                returnKeyType="send"
                blurOnSubmit
                onSubmitEditing={() => void send()}
              />
              <Pressable
                onPress={() => void send()}
                disabled={!canSend}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.sendButton,
                  !canSend && styles.sendDisabled,
                  pressed && canSend && styles.sendPressed,
                ]}
                accessibilityLabel={t("send")}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSend }}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <IconSymbol
                    name="paperplane.fill"
                    size={19}
                    color="#FFFFFF"
                    weight="semibold"
                  />
                )}
              </Pressable>
            </View>
            {question.length >= 400 ? (
              <Text style={styles.characterCount}>
                {question.length}/{MAX_ASK_LOTTI_QUESTION_LENGTH}
              </Text>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 14,
  },
  securityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "rgba(246,241,255,0.88)",
    borderWidth: 1,
    borderColor: "rgba(104,72,184,0.14)",
    boxShadow: "0 5px 18px rgba(75,48,124,0.07)",
  },
  securityIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(104,72,184,0.11)",
  },
  securityCopy: { flex: 1, gap: 2 },
  securityTitle: {
    color: "#584746",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  securityText: { color: "#75645D", fontSize: 11, lineHeight: 16 },
  capabilityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingTop: 7,
  },
  capabilityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(104,72,184,0.08)",
  },
  capabilityText: {
    color: "#69557D",
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "600",
  },
  messageRow: { flexDirection: "row", justifyContent: "flex-start" },
  userRow: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "92%",
    borderRadius: 24,
    borderCurve: "continuous",
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  lottiBubble: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(104,72,184,0.12)",
    borderTopLeftRadius: 9,
    boxShadow: "0 8px 24px rgba(75,48,124,0.08)",
  },
  userBubble: {
    maxWidth: "86%",
    backgroundColor: "#6542BD",
    borderTopRightRadius: 9,
    boxShadow: "0 8px 20px rgba(80,48,157,0.18)",
  },
  errorBubble: {
    borderColor: "rgba(190,75,75,0.28)",
    backgroundColor: "rgba(255,244,244,0.95)",
  },
  lottiIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingBottom: 11,
  },
  lottiAvatar: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6D4CC4",
  },
  lottiLabel: {
    color: "#5F3FAE",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 1,
  },
  lottiMeta: { color: "#9A8981", fontSize: 9, lineHeight: 12 },
  messageText: { color: "#493A35", fontSize: 15, lineHeight: 22 },
  userText: { color: "#FFFFFF" },
  evidenceWrap: {
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(104,72,184,0.18)",
    gap: 8,
  },
  evidenceHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingBottom: 2,
  },
  evidenceHeading: {
    color: "#6848B8",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  evidenceCard: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    backgroundColor: "rgba(104,72,184,0.055)",
    borderRadius: 15,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "rgba(104,72,184,0.06)",
  },
  evidenceMarker: { width: 3, borderRadius: 2, backgroundColor: "#B9A5E9" },
  evidenceCopy: { flex: 1, gap: 3 },
  evidenceTitle: {
    color: "#564641",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  evidenceDetail: { color: "#7A665E", fontSize: 12, lineHeight: 17 },
  disclaimer: { color: "#927D74", fontSize: 10, lineHeight: 15, marginTop: 11 },
  retryButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: "rgba(101,66,189,0.09)",
  },
  retryPressed: { opacity: 0.65 },
  retryText: { color: "#6542BD", fontSize: 11, fontWeight: "700" },
  quickReplies: { gap: 7, marginTop: 13 },
  quickReply: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: "rgba(101,66,189,0.07)",
    borderWidth: 1,
    borderColor: "rgba(101,66,189,0.10)",
  },
  quickReplyPressed: { opacity: 0.62 },
  quickReplyText: { flex: 1, color: "#604B57", fontSize: 10, lineHeight: 14 },
  suggestions: { gap: 8, paddingTop: 2 },
  suggestionsTitle: {
    color: "#6A5850",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    borderRadius: 18,
    borderCurve: "continuous",
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: "rgba(104,72,184,0.11)",
  },
  suggestionIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(104,72,184,0.08)",
  },
  suggestionText: { flex: 1, color: "#584841", fontSize: 12, lineHeight: 17 },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 9,
    marginLeft: 8,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.78)",
  },
  loadingText: { color: "#7D6A61", fontSize: 11 },
  composerWrap: {
    paddingHorizontal: 14,
    paddingTop: 9,
    backgroundColor: "rgba(255,252,250,0.97)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(104,72,184,0.10)",
    boxShadow: "0 -10px 28px rgba(78,52,117,0.08)",
  },
  composerMeta: {
    minHeight: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 5,
    paddingBottom: 6,
  },
  readyStatus: { flexDirection: "row", alignItems: "center", gap: 5 },
  readyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#66A77A",
  },
  readyText: { color: "#7C6A62", fontSize: 10 },
  remaining: { color: "#75618F", fontSize: 10, fontVariant: ["tabular-nums"] },
  composer: {
    minHeight: 54,
    maxHeight: 132,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderRadius: 24,
    borderCurve: "continuous",
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(104,72,184,0.17)",
    boxShadow: "0 5px 18px rgba(77,51,112,0.07)",
  },
  composerActive: {
    borderColor: "rgba(104,72,184,0.38)",
    boxShadow: "0 7px 22px rgba(91,61,159,0.12)",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 112,
    paddingVertical: 9,
    color: "#493A35",
    fontSize: 15,
    lineHeight: 21,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6542BD",
    boxShadow: "0 5px 14px rgba(78,43,157,0.23)",
  },
  sendDisabled: { backgroundColor: "#CFC3E9", boxShadow: "none" },
  sendPressed: { transform: [{ scale: 0.95 }] },
  characterCount: {
    color: "#9E8D85",
    fontSize: 9,
    textAlign: "right",
    paddingTop: 3,
    paddingRight: 5,
    fontVariant: ["tabular-nums"],
  },
});
