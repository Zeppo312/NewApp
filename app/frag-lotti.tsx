import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as Haptics from "expo-haptics";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import { useBabyStatus } from "@/contexts/BabyStatusContext";
import { useLocale } from "@/contexts/LocaleContext";
import { useAdaptiveColors } from "@/hooks/useAdaptiveColors";
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
  createConversationId,
  createMessageId,
  deriveConversationTitle,
  loadConversations,
  removeConversation,
  saveConversations,
  upsertConversation,
  type AskLottiConversation,
  type StoredChatMessage,
} from "@/lib/askLotti/chatStore";
import {
  askLottiSuggestions,
  translateAskLotti,
} from "@/lib/askLotti/translations";
import type {
  AskLottiFollowUp,
  AskLottiHistoryItem,
} from "@/lib/askLotti/types";

type ChatMessage = StoredChatMessage;

export default function AskLottiScreen() {
  const { locale } = useLocale();
  const { activeBabyId } = useActiveBaby();
  // Vor der Geburt gibt es keine Baby-Einträge: Lotti antwortet dann aus der
  // Schwangerschaftsseite der App (SSW, Check-ins, Termine, Vorbereitung).
  const { isBabyBorn } = useBabyStatus();
  const isPregnancy = !isBabyBorn;
  const contextMode = isPregnancy ? ("pregnancy" as const) : ("baby" as const);
  const access = useAskLottiAccess();
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === "dark" || adaptiveColors.isDarkBackground;
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const palette = useMemo(
    () => ({
      accent: isDark ? "#C8B3FF" : "#6544B8",
      accentSoft: isDark ? "#B8A4F5" : "#7658BD",
      accentMuted: isDark ? "#9E8CD8" : "#8C75C4",
      spinner: isDark ? "#C8B3FF" : "#5E3DB3",
      placeholder: isDark ? "rgba(233,226,247,0.42)" : "#A08B82",
      destructive: isDark ? "#E29AB6" : "#B0879A",
    }),
    [isDark],
  );
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const requestInFlightRef = useRef(false);
  const t = (
    key: Parameters<typeof translateAskLotti>[1],
    params?: Record<string, string | number>,
  ) => translateAskLotti(locale, key, params);
  const suggestions = useMemo(
    () => askLottiSuggestions(locale, contextMode),
    [contextMode, locale],
  );
  const [question, setQuestion] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [remainingToday, setRemainingToday] = useState<number | null>(null);
  // The intro is rendered, never stored: it is locale-dependent and would
  // otherwise freeze the language a chat was started in.
  const introMessage = useMemo<ChatMessage>(
    () => ({
      id: "intro",
      role: "lotti",
      text: t(isPregnancy ? "introPregnancy" : "intro"),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, isPregnancy],
  );
  const [messages, setMessages] = useState<ChatMessage[]>([introMessage]);
  const [conversations, setConversations] = useState<AskLottiConversation[]>(
    [],
  );
  const [activeConversationId, setActiveConversationId] =
    useState(createConversationId);
  const [isChatListVisible, setChatListVisible] = useState(false);
  const conversationsRef = useRef<AskLottiConversation[]>([]);
  const isHydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadConversations().then((stored) => {
      if (cancelled) return;
      conversationsRef.current = stored;
      setConversations(stored);
      // Reopening the most recent chat matches how parents use this: a question
      // during the night is usually continued the next morning.
      const latest = stored[0];
      if (latest) {
        setActiveConversationId(latest.id);
        setMessages([introMessage, ...latest.messages]);
      }
      isHydratedRef.current = true;
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isHydratedRef.current) return;
    const stored = messages.filter((message) => message.id !== "intro");
    if (stored.length === 0) return;
    const now = new Date().toISOString();
    const existing = conversationsRef.current.find(
      (conversation) => conversation.id === activeConversationId,
    );
    const firstQuestion = stored.find((message) => message.role === "user");
    const next = upsertConversation(conversationsRef.current, {
      id: activeConversationId,
      title:
        existing?.title ??
        deriveConversationTitle(firstQuestion?.text ?? "", t("chats")),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      messages: stored,
    });
    conversationsRef.current = next;
    setConversations(next);
    void saveConversations(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, activeConversationId]);

  const startNewChat = useCallback(() => {
    setActiveConversationId(createConversationId());
    setMessages([introMessage]);
    setQuestion("");
    setChatListVisible(false);
  }, [introMessage]);

  const openConversation = useCallback(
    (conversation: AskLottiConversation) => {
      setActiveConversationId(conversation.id);
      setMessages([introMessage, ...conversation.messages]);
      setQuestion("");
      setChatListVisible(false);
    },
    [introMessage],
  );

  const deleteConversation = useCallback(
    (conversation: AskLottiConversation) => {
      const apply = () => {
        const next = removeConversation(
          conversationsRef.current,
          conversation.id,
        );
        conversationsRef.current = next;
        setConversations(next);
        void saveConversations(next);
        if (conversation.id === activeConversationId) {
          setActiveConversationId(createConversationId());
          setMessages([introMessage]);
        }
      };
      Alert.alert(t("deleteChat"), t("deleteChatConfirm"), [
        { text: t("cancel"), style: "cancel" },
        { text: t("delete"), style: "destructive", onPress: apply },
      ]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeConversationId, introMessage, locale],
  );
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
          id: createMessageId("error"),
          role: "lotti",
          text: t("tooLong"),
          isError: true,
        },
      ]);
      return;
    }

    const userMessage: ChatMessage = {
      id: createMessageId("user"),
      role: "user",
      text: value,
    };
    if (Platform.OS === "ios")
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const localReply = isAskLottiGreeting(value)
      ? t(isPregnancy ? "greetingPregnancy" : "greeting")
      : isAskLottiThanks(value)
        ? t("thanks")
        : null;
    if (localReply) {
      setMessages((current) => [
        ...current,
        userMessage,
        { id: createMessageId("lotti"), role: "lotti", text: localReply },
      ]);
      setQuestion("");
      return;
    }
    if (!isPregnancy && !activeBabyId) {
      setMessages((current) => [
        ...current,
        userMessage,
        {
          id: createMessageId("error"),
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
        babyId: isPregnancy ? null : activeBabyId,
        mode: contextMode,
        question: value,
        locale,
        history,
      });
      if (typeof response.remaining?.day === "number")
        setRemainingToday(response.remaining.day);
      setMessages((current) => [
        ...current,
        {
          id: createMessageId("lotti"),
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
          id: createMessageId("error"),
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
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <Header
          title={t("title")}
          subtitle={t(isPregnancy ? "subtitlePregnancy" : "subtitle")}
          showBackButton
          showBabySwitcher={!isPregnancy}
          rightContent={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("chatsTitle")}
              onPress={() => setChatListVisible(true)}
              hitSlop={8}
              style={styles.headerButton}
            >
              <IconSymbol
                name="bubble.left.and.bubble.right.fill"
                size={19}
                color={palette.accent}
              />
              {conversations.length > 1 ? (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>
                    {conversations.length}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          }
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
            {messages.length === 1 ? (
              <View style={styles.securityCard}>
                <View style={styles.securityIconWrap}>
                  <IconSymbol
                    name="lock.shield"
                    size={19}
                    color={palette.accent}
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
                        color={palette.accent}
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
                        color={palette.accent}
                        weight="semibold"
                      />
                      <Text style={styles.capabilityText}>
                        {t(isPregnancy ? "personalHelpPregnancy" : "personalHelp")}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ) : null}

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
                              : t(isPregnancy ? "assistantPregnancy" : "assistant")}
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
                    {message.id === "intro" ? introMessage.text : message.text}
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
                        color={palette.accent}
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
                            color={palette.accentSoft}
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
                          color={palette.accent}
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
                        color={palette.accent}
                        weight="semibold"
                      />
                    </View>
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                    <IconSymbol
                      name="chevron.right"
                      size={18}
                      color={palette.accentMuted}
                      weight="semibold"
                    />
                  </Pressable>
                ))}
              </View>
            ) : null}

            {isSending ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={palette.spinner} />
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
                placeholder={t(isPregnancy ? "placeholderPregnancy" : "placeholder")}
                placeholderTextColor={palette.placeholder}
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
        <Modal
          visible={isChatListVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setChatListVisible(false)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setChatListVisible(false)}
          />
          <View
            style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <Text style={styles.modalTitle}>{t("chatsTitle")}</Text>
                <Text style={styles.modalHint}>{t("chatsHint")}</Text>
              </View>
              <Pressable
                onPress={startNewChat}
                hitSlop={6}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.newChatButton,
                  pressed && styles.newChatPressed,
                ]}
              >
                <IconSymbol
                  name="plus"
                  size={15}
                  color="#FFFFFF"
                  weight="semibold"
                />
                <Text style={styles.newChatText}>{t("newChat")}</Text>
              </Pressable>
            </View>
            {conversations.length === 0 ? (
              <Text style={styles.modalEmpty}>{t("chatsEmpty")}</Text>
            ) : (
              <ScrollView
                style={styles.modalList}
                contentContainerStyle={styles.modalListContent}
                keyboardShouldPersistTaps="handled"
              >
                {conversations.map((conversation) => {
                  const isActive = conversation.id === activeConversationId;
                  return (
                    <Pressable
                      key={conversation.id}
                      onPress={() => openConversation(conversation)}
                      style={({ pressed }) => [
                        styles.chatRow,
                        isActive && styles.chatRowActive,
                        pressed && styles.chatRowPressed,
                      ]}
                    >
                      <View style={styles.chatRowCopy}>
                        <Text style={styles.chatRowTitle} numberOfLines={1}>
                          {conversation.title}
                        </Text>
                        <Text style={styles.chatRowMeta} numberOfLines={1}>
                          {formatChatDate(conversation.updatedAt, locale, t)} ·{" "}
                          {conversation.messages.length}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => deleteConversation(conversation)}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={t("deleteChat")}
                        style={styles.chatDelete}
                      >
                        <IconSymbol name="trash" size={16} color={palette.destructive} />
                      </Pressable>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </Modal>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const formatChatDate = (
  value: string,
  locale: string,
  t: (key: "today" | "yesterday") => string,
) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const startOfDay = (input: Date) =>
    new Date(input.getFullYear(), input.getMonth(), input.getDate()).getTime();
  const dayDiff = Math.round(
    (startOfDay(new Date()) - startOfDay(date)) / 86_400_000,
  );
  if (dayDiff <= 0) return t("today");
  if (dayDiff === 1) return t("yesterday");
  return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
};

const createStyles = (isDark: boolean) => StyleSheet.create({
  background: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.72)",
  },
  headerBadge: {
    position: "absolute",
    top: 1,
    right: 1,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: isDark ? "#8B6BE0" : "#6544B8",
  },
  headerBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: isDark ? "rgba(8,6,14,0.62)" : "rgba(24,18,40,0.45)",
  },
  modalSheet: {
    marginTop: "auto",
    maxHeight: "76%",
    backgroundColor: isDark ? "#191426" : "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  modalHandle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: isDark ? "rgba(255,255,255,0.20)" : "#E3DDF1",
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  modalTitleWrap: { flex: 1 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: isDark ? "#F6F2FF" : "#2E2645" },
  modalHint: { fontSize: 12, color: isDark ? "rgba(233,226,247,0.55)" : "#9A93AD", marginTop: 2 },
  newChatButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: isDark ? "#7B57D4" : "#6544B8",
  },
  newChatPressed: { opacity: 0.85 },
  newChatText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  modalEmpty: {
    fontSize: 14,
    lineHeight: 20,
    color: isDark ? "rgba(233,226,247,0.62)" : "#7C7590",
    paddingVertical: 22,
    paddingHorizontal: 4,
  },
  modalList: { flexGrow: 0 },
  modalListContent: { paddingBottom: 6, gap: 8 },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F6F3FD",
    borderWidth: 1,
    borderColor: "transparent",
  },
  chatRowActive: {
    borderColor: isDark ? "#C8B3FF" : "#6544B8",
    backgroundColor: isDark ? "rgba(200,179,255,0.14)" : "#EFE9FC",
  },
  chatRowPressed: { opacity: 0.8 },
  chatRowCopy: { flex: 1 },
  chatRowTitle: {
    fontSize: 14.5,
    fontWeight: "600",
    color: isDark ? "#F6F2FF" : "#2E2645",
  },
  chatRowMeta: {
    fontSize: 12,
    color: isDark ? "rgba(233,226,247,0.55)" : "#9A93AD",
    marginTop: 3,
  },
  chatDelete: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 18,
  },
  securityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: isDark ? "rgba(28,22,44,0.82)" : "rgba(246,241,255,0.88)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(104,72,184,0.14)",
    boxShadow: isDark
      ? "0 5px 18px rgba(0,0,0,0.35)"
      : "0 5px 18px rgba(75,48,124,0.07)",
  },
  securityIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: isDark ? "rgba(200,179,255,0.16)" : "rgba(104,72,184,0.11)",
  },
  securityCopy: { flex: 1, gap: 2 },
  securityTitle: {
    color: isDark ? "#F1ECFB" : "#584746",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  securityText: {
    color: isDark ? "rgba(233,226,247,0.68)" : "#75645D",
    fontSize: 12,
    lineHeight: 17,
  },
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
    backgroundColor: isDark ? "rgba(200,179,255,0.13)" : "rgba(104,72,184,0.08)",
  },
  capabilityText: {
    color: isDark ? "rgba(214,203,245,0.85)" : "#69557D",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "600",
  },
  messageRow: { flexDirection: "row", justifyContent: "flex-start" },
  userRow: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "96%",
    borderRadius: 24,
    borderCurve: "continuous",
    paddingHorizontal: 18,
    paddingVertical: 17,
  },
  lottiBubble: {
    backgroundColor: isDark ? "rgba(28,22,44,0.90)" : "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.13)" : "rgba(104,72,184,0.12)",
    borderTopLeftRadius: 9,
    boxShadow: isDark
      ? "0 8px 24px rgba(0,0,0,0.38)"
      : "0 8px 24px rgba(75,48,124,0.08)",
  },
  userBubble: {
    maxWidth: "88%",
    backgroundColor: isDark ? "#7B57D4" : "#6542BD",
    borderTopRightRadius: 9,
    boxShadow: isDark
      ? "0 8px 20px rgba(0,0,0,0.40)"
      : "0 8px 20px rgba(80,48,157,0.18)",
  },
  errorBubble: {
    borderColor: isDark ? "rgba(242,150,150,0.34)" : "rgba(190,75,75,0.28)",
    backgroundColor: isDark ? "rgba(58,26,30,0.88)" : "rgba(255,244,244,0.95)",
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
    backgroundColor: isDark ? "#7B57D4" : "#6D4CC4",
  },
  lottiLabel: {
    color: isDark ? "#C8B3FF" : "#5F3FAE",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 1,
  },
  lottiMeta: {
    color: isDark ? "rgba(233,226,247,0.50)" : "#9A8981",
    fontSize: 10,
    lineHeight: 13,
  },
  messageText: {
    color: isDark ? "#F1ECFB" : "#493A35",
    fontSize: 17,
    lineHeight: 26,
  },
  userText: { color: "#FFFFFF" },
  evidenceWrap: {
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(104,72,184,0.18)",
    gap: 8,
  },
  evidenceHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingBottom: 2,
  },
  evidenceHeading: {
    color: isDark ? "#C8B3FF" : "#6848B8",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  evidenceCard: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(104,72,184,0.055)",
    borderRadius: 15,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.09)" : "rgba(104,72,184,0.06)",
  },
  evidenceMarker: {
    width: 3,
    borderRadius: 2,
    backgroundColor: isDark ? "#A98BFA" : "#B9A5E9",
  },
  evidenceCopy: { flex: 1, gap: 3 },
  evidenceTitle: {
    color: isDark ? "#F1ECFB" : "#564641",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  evidenceDetail: {
    color: isDark ? "rgba(233,226,247,0.70)" : "#7A665E",
    fontSize: 13,
    lineHeight: 19,
  },
  disclaimer: {
    color: isDark ? "rgba(233,226,247,0.50)" : "#927D74",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 12,
  },
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
    backgroundColor: isDark ? "rgba(200,179,255,0.14)" : "rgba(101,66,189,0.09)",
  },
  retryPressed: { opacity: 0.65 },
  retryText: {
    color: isDark ? "#C8B3FF" : "#6542BD",
    fontSize: 13,
    fontWeight: "700",
  },
  quickReplies: { gap: 8, marginTop: 15 },
  quickReply: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(101,66,189,0.07)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(101,66,189,0.10)",
  },
  quickReplyPressed: { opacity: 0.62 },
  quickReplyText: {
    flex: 1,
    color: isDark ? "rgba(233,226,247,0.86)" : "#604B57",
    fontSize: 14,
    lineHeight: 19,
  },
  suggestions: { gap: 8, paddingTop: 2 },
  suggestionsTitle: {
    color: isDark ? "rgba(233,226,247,0.72)" : "#6A5850",
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 58,
    borderRadius: 18,
    borderCurve: "continuous",
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: isDark ? "rgba(28,22,44,0.82)" : "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(104,72,184,0.11)",
  },
  suggestionIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: isDark ? "rgba(200,179,255,0.15)" : "rgba(104,72,184,0.08)",
  },
  suggestionText: {
    flex: 1,
    color: isDark ? "#F1ECFB" : "#584841",
    fontSize: 14,
    lineHeight: 20,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 9,
    marginLeft: 8,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: isDark ? "rgba(28,22,44,0.82)" : "rgba(255,255,255,0.78)",
  },
  loadingText: {
    color: isDark ? "rgba(233,226,247,0.70)" : "#7D6A61",
    fontSize: 13,
  },
  composerWrap: {
    paddingHorizontal: 14,
    paddingTop: 9,
    backgroundColor: isDark ? "rgba(14,11,22,0.96)" : "rgba(255,252,250,0.97)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(104,72,184,0.10)",
    boxShadow: isDark
      ? "0 -10px 28px rgba(0,0,0,0.45)"
      : "0 -10px 28px rgba(78,52,117,0.08)",
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
    backgroundColor: isDark ? "#8ED6A4" : "#66A77A",
  },
  readyText: {
    color: isDark ? "rgba(233,226,247,0.62)" : "#7C6A62",
    fontSize: 11,
  },
  remaining: {
    color: isDark ? "rgba(214,203,245,0.72)" : "#75618F",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
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
    backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "#FFFFFF",
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.16)" : "rgba(104,72,184,0.17)",
    boxShadow: isDark
      ? "0 5px 18px rgba(0,0,0,0.32)"
      : "0 5px 18px rgba(77,51,112,0.07)",
  },
  composerActive: {
    borderColor: isDark ? "rgba(200,179,255,0.55)" : "rgba(104,72,184,0.38)",
    boxShadow: isDark
      ? "0 7px 22px rgba(0,0,0,0.38)"
      : "0 7px 22px rgba(91,61,159,0.12)",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 112,
    paddingVertical: 9,
    color: isDark ? "#F5F1FF" : "#493A35",
    fontSize: 16,
    lineHeight: 22,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: isDark ? "#7B57D4" : "#6542BD",
    boxShadow: isDark
      ? "0 5px 14px rgba(0,0,0,0.38)"
      : "0 5px 14px rgba(78,43,157,0.23)",
  },
  sendDisabled: {
    backgroundColor: isDark ? "rgba(255,255,255,0.14)" : "#CFC3E9",
    boxShadow: "none",
  },
  sendPressed: { transform: [{ scale: 0.95 }] },
  characterCount: {
    color: isDark ? "rgba(233,226,247,0.45)" : "#9E8D85",
    fontSize: 10,
    textAlign: "right",
    paddingTop: 3,
    paddingRight: 5,
    fontVariant: ["tabular-nums"],
  },
});
