import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Keyboard,
  LayoutAnimation,
  UIManager,
  StyleProp,
  ViewStyle,
  TextStyle,
  Alert,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { BlurView } from "expo-blur";

import { PRIMARY, GLASS_OVERLAY } from "@/constants/PlannerDesign";
import { Colors } from "@/constants/Colors";
import { PlannerAssignee, PlannerEvent, PlannerTodo } from "@/services/planner";
import TextInputOverlay from "@/components/modals/TextInputOverlay";
import { useAdaptiveColors } from "@/hooks/useAdaptiveColors";

export type PlannerCaptureType = "todo" | "event";
type FocusField = "title" | "location" | "notes";
type FocusConfig = {
  field: FocusField;
  label: string;
  placeholder?: string;
  multiline?: boolean;
};

export type PlannerCapturePayload = {
  id?: string;
  type: PlannerCaptureType;
  title: string;
  dueAt?: Date | null;
  start?: Date;
  end?: Date | null;
  location?: string;
  reminderMinutes?: number;
  notes?: string;
  assignee?: PlannerAssignee;
  babyId?: string;
  ownerId?: string;
  isAllDay?: boolean;
};

type OwnerOption = {
  id: string;
  label: string;
};

type BabyOption = {
  id: string;
  label: string;
};

type Props = {
  visible: boolean;
  type: PlannerCaptureType;
  baseDate: Date;
  editingItem?: {
    type: "todo" | "event";
    item: PlannerTodo | PlannerEvent;
  } | null;
  ownerOptions?: OwnerOption[];
  babyOptions?: BabyOption[];
  defaultOwnerId?: string;
  onClose: () => void;
  onSave: (payload: PlannerCapturePayload) => void;
  onDelete?: (id: string) => void;
};

const THEME = {
  text: "#6B4C3B",
  textSecondary: "#A8978E",
  background: "rgba(255,255,255,0.94)",
  accent: PRIMARY,
  field: "rgba(255,255,255,0.75)",
  divider: "rgba(0,0,0,0.08)",
};

const REMINDER_OPTIONS = [0, 5, 10, 15, 30, 60, 120, 1440] as const;

const formatReminderLabel = (minutes: number) => {
  if (minutes === 0) return "Zum Start";
  if (minutes === 60) return "1 Std vorher";
  if (minutes === 120) return "2 Std vorher";
  if (minutes === 1440) return "1 Tag vorher";
  return `${minutes} Min vorher`;
};

const toRgba = (hex: string, opacity = 1) => {
  const cleanHex = hex.replace("#", "");
  const int = parseInt(cleanHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const PlannerCaptureModal: React.FC<Props> = ({
  visible,
  type,
  baseDate,
  editingItem,
  ownerOptions,
  babyOptions,
  defaultOwnerId,
  onClose,
  onSave,
  onDelete,
}) => {
  const initialStart = useMemo(() => {
    const d = new Date(baseDate);
    d.setHours(new Date().getHours(), new Date().getMinutes(), 0, 0);
    return d;
  }, [baseDate]);
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === "dark" ||
    adaptiveColors.isDarkBackground;
  const accentColor = isDark ? adaptiveColors.accent : PRIMARY;
  const blurTint = isDark ? "dark" : "extraLight";
  const theme = useMemo(
    () => ({
      text: isDark ? Colors.dark.textPrimary : THEME.text,
      textSecondary: isDark ? Colors.dark.textSecondary : THEME.textSecondary,
      overlay: isDark ? "rgba(0,0,0,0.58)" : "rgba(0,0,0,0.35)",
      pickerOverlay: isDark ? "rgba(0,0,0,0.62)" : "rgba(0,0,0,0.4)",
      sheetBackground: isDark ? "rgba(8,8,12,0.82)" : "rgba(255,255,255,0.12)",
      sheetBorder: isDark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.45)",
      field: isDark ? "rgba(255,255,255,0.08)" : THEME.field,
      block: isDark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.85)",
      blockStrong: isDark ? "rgba(18,18,22,0.92)" : "rgba(255,255,255,0.95)",
      soft: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.6)",
      border: isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.05)",
      divider: isDark ? "rgba(255,255,255,0.12)" : THEME.divider,
      iconButton: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
      accentSoft: isDark ? toRgba(accentColor, 0.22) : "rgba(94,61,179,0.08)",
      deleteBg: isDark ? "rgba(255,107,107,0.20)" : "rgba(255, 107, 107, 0.15)",
      deleteBorder: isDark
        ? "rgba(255,107,107,0.45)"
        : "rgba(255, 107, 107, 0.35)",
      deleteText: isDark ? "#FFB3B3" : "#D63031",
    }),
    [accentColor, isDark],
  );

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [showEnd, setShowEnd] = useState(type === "event");
  const [dueTime, setDueTime] = useState<Date | null>(null);
  const [hasDueTime, setHasDueTime] = useState<boolean>(false);
  const [location, setLocation] = useState("");
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showDuePicker, setShowDuePicker] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [currentType, setCurrentType] = useState<PlannerCaptureType>(type);
  const [assignee, setAssignee] = useState<PlannerAssignee>("me");
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(null);
  const [showTimeRangeModal, setShowTimeRangeModal] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [focusConfig, setFocusConfig] = useState<FocusConfig | null>(null);
  const [focusValue, setFocusValue] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState<number>(15);

  const partnerLabel = useMemo(() => {
    if (!ownerOptions || ownerOptions.length === 0) return "Partner";
    const partnerOption = ownerOptions.find(
      (opt) => opt.id && opt.id !== defaultOwnerId,
    );
    return partnerOption?.label ?? "Partner";
  }, [ownerOptions, defaultOwnerId]);

  const assigneeOptions: {
    key: string;
    value: PlannerAssignee;
    label: string;
    babyId?: string | null;
  }[] = useMemo(() => {
    const base = [
      { key: "me", value: "me" as PlannerAssignee, label: "Ich" },
      {
        key: "partner",
        value: "partner" as PlannerAssignee,
        label: partnerLabel,
      },
      { key: "family", value: "family" as PlannerAssignee, label: "Familie" },
    ];

    if (babyOptions && babyOptions.length > 0) {
      const childOptions = babyOptions.map((baby) => ({
        key: `child:${baby.id}`,
        value: "child" as PlannerAssignee,
        label: baby.label,
        babyId: baby.id,
      }));
      return [...base, ...childOptions];
    }

    return [
      ...base,
      {
        key: "child:none",
        value: "child" as PlannerAssignee,
        label: "Kind",
        babyId: null,
      },
    ];
  }, [partnerLabel, babyOptions]);

  const selectedBabyLabel = useMemo(
    () => babyOptions?.find((b) => b.id === selectedBabyId)?.label,
    [babyOptions, selectedBabyId],
  );

  const selectedAssigneeLabel = useMemo(() => {
    if (assignee === "child") {
      if (selectedBabyLabel) return selectedBabyLabel;
      if (babyOptions && babyOptions.length === 1) return babyOptions[0].label;
      return "Kind";
    }
    return assigneeOptions.find((opt) => opt.value === assignee)?.label ?? "Ich";
  }, [assignee, assigneeOptions, selectedBabyLabel, babyOptions]);

  const selectedReminderLabel = useMemo(
    () => formatReminderLabel(reminderMinutes),
    [reminderMinutes],
  );

  const timeRangeSummary = useMemo(() => {
    const dayKey = (date: Date) =>
      `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const timeLabel = (date: Date) =>
      date.toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      });

    const dayLabel = (date: Date, withYear = false) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (dayKey(date) === dayKey(today)) return "Heute";
      if (dayKey(date) === dayKey(tomorrow)) return "Morgen";
      if (dayKey(date) === dayKey(yesterday)) return "Gestern";
      return new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        ...(withYear ? { year: "2-digit" } : {}),
      }).format(date);
    };

    if (isAllDay) {
      const startLabel = dayLabel(startTime);
      const endLabel = dayLabel(endTime ?? startTime);
      if (startLabel === endLabel) return `${startLabel} · Ganztägig`;
      return `${startLabel}–${endLabel} · Ganztägig`;
    }

    if (showEnd && endTime) {
      const isSameDay = dayKey(startTime) === dayKey(endTime);
      const startLabel = dayLabel(startTime);
      if (isSameDay) {
        return `${startLabel} · ${timeLabel(startTime)}–${timeLabel(endTime)}`;
      }
      return `${dayLabel(startTime, true)} ${timeLabel(startTime)} – ${dayLabel(endTime, true)} ${timeLabel(endTime)}`;
    }

    return `${dayLabel(startTime)} · ab ${timeLabel(startTime)}`;
  }, [isAllDay, startTime, endTime, showEnd]);

  const setEventMode = (nextIsAllDay: boolean) => {
    if (nextIsAllDay === isAllDay) return;
    setIsAllDay(nextIsAllDay);

    if (nextIsAllDay) {
      const allDayStart = new Date(startTime);
      allDayStart.setHours(0, 0, 0, 0);
      setStartTime(allDayStart);

      const allDayEnd = new Date(endTime ?? startTime);
      allDayEnd.setHours(23, 59, 59, 999);
      setEndTime(allDayEnd);

      setShowStartPicker(false);
      setShowEndPicker(false);
      return;
    }

    const now = new Date();
    const timedStart = new Date(startTime);
    timedStart.setHours(now.getHours(), now.getMinutes(), 0, 0);
    setStartTime(timedStart);

    const timedEnd = new Date(timedStart.getTime() + 30 * 60000);
    setEndTime(timedEnd);
    setShowEnd(true);
  };

  const deriveAssigneeForOwner = (targetOwnerId?: string | null) => {
    if (!defaultOwnerId || !targetOwnerId) return "me" as PlannerAssignee;
    return targetOwnerId === defaultOwnerId ? "me" : "partner";
  };

  useEffect(() => {
    if (!visible) return;
    setShowStartPicker(false);
    setShowEndPicker(false);
    setShowDuePicker(false);
    setShowTimeRangeModal(false);
    setShowAssigneePicker(false);
    setShowReminderPicker(false);

    if (editingItem) {
      const { type: editingType, item } = editingItem;
      setCurrentType(editingType);
      setTitle(item.title);
      if ("notes" in item && item.notes) {
        setNotes(item.notes);
        setNotesExpanded(true);
      } else {
        setNotes("");
        setNotesExpanded(false);
      }
      if (editingType === "event") {
        const eventItem = item as PlannerEvent;
        const start = new Date(eventItem.start);
        const end = new Date(eventItem.end);
        const allDay = eventItem.isAllDay ?? false;
        setStartTime(start);
        setEndTime(end);
        setShowEnd(true);
        setDueTime(null);
        setLocation(eventItem.location ?? "");
        setIsAllDay(allDay);
        const nextReminder =
          typeof eventItem.reminderMinutes === "number"
            ? Math.max(0, Math.round(eventItem.reminderMinutes))
            : 15;
        setReminderMinutes(nextReminder);
      } else {
        const todoItem = item as PlannerTodo;
        const due = todoItem.dueAt ? new Date(todoItem.dueAt) : null;
        setStartTime(due ?? new Date(initialStart));
        setEndTime(null);
        setShowEnd(false);
        setDueTime(due);
        setHasDueTime(!!due);
        setLocation("");
        setReminderMinutes(15);
      }
      if ("assignee" in item && item.assignee) {
        setAssignee(item.assignee);
      } else {
        setAssignee(
          deriveAssigneeForOwner(item.userId ?? defaultOwnerId ?? null),
        );
      }
      if ("babyId" in item && item.babyId) {
        setSelectedBabyId(item.babyId);
      } else {
        setSelectedBabyId(null);
      }
    } else {
      const reset = new Date(baseDate);
      reset.setHours(new Date().getHours(), new Date().getMinutes(), 0, 0);
      setCurrentType(type);
      setTitle("");
      setNotes("");
      setStartTime(reset);
      setEndTime(
        type === "event" ? new Date(reset.getTime() + 30 * 60000) : null,
      );
      setShowEnd(type === "event");
      setDueTime(null);
      setHasDueTime(false);
      setLocation("");
      setNotesExpanded(false);
      setAssignee("me");
      setSelectedBabyId(null);
      setIsAllDay(false);
      setReminderMinutes(15);
    }
  }, [visible, type, baseDate, editingItem, defaultOwnerId]);

  useEffect(() => {
    if (!visible || assignee !== "child") return;
    if (selectedBabyId) return;
    if (!babyOptions || babyOptions.length !== 1) return;
    setSelectedBabyId(babyOptions[0].id);
  }, [visible, assignee, selectedBabyId, babyOptions]);

  useEffect(() => {
    if (!visible) return;
    if (currentType === "event") {
      if (!endTime) {
        setEndTime(new Date(startTime.getTime() + 30 * 60000));
      }
      setShowEnd(true);
    } else {
      setShowEnd(false);
      setDueTime((prev) => prev);
    }
  }, [currentType, visible]);

  const toggleNotes = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setNotesExpanded((prev) => !prev);
  };

  const renderDateSelector = (
    label: string,
    value: Date,
    visible: boolean,
    toggle: () => void,
    onChange: (date: Date) => void,
    dateOnly: boolean = false,
  ) => (
    <View
      style={[
        styles.pickerBlock,
        { backgroundColor: theme.block, borderColor: theme.border },
      ]}
    >
      <TouchableOpacity
        style={styles.selectorHeader}
        onPress={toggle}
        activeOpacity={0.8}
      >
        <Text style={[styles.pickerLabel, { color: theme.textSecondary }]}>
          {label}
        </Text>
        <Text style={[styles.selectorValue, { color: theme.text }]}>
          {dateOnly ? formatDate(value) : formatDateTime(value)}
        </Text>
      </TouchableOpacity>
      {visible && (
        <View
          style={[styles.pickerInner, { backgroundColor: theme.blockStrong }]}
        >
          <DateTimePicker
            value={value}
            mode={dateOnly ? "date" : "datetime"}
            display={Platform.OS === "ios" ? "inline" : "spinner"}
            onChange={(event, date) => {
              if (event?.type === "dismissed") {
                toggle();
                return;
              }
              if (date) {
                onChange(date);
              }
            }}
            style={styles.dateTimePicker}
          />
          <View style={styles.pickerActions}>
            <TouchableOpacity
              style={[
                styles.pickerActionButton,
                { backgroundColor: theme.accentSoft },
              ]}
              onPress={toggle}
            >
              <Text style={[styles.pickerActionLabel, { color: accentColor }]}>
                Fertig
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const handleSave = () => {
    const trimmedTitle = title.trim();
    const trimmedNotes = notes.trim();

    if (trimmedTitle.length === 0) {
      return;
    }

    if (
      currentType === "event" &&
      (!startTime || (!endTime && showEnd && !isAllDay))
    ) {
      return;
    }

    const payload: PlannerCapturePayload = {
      type: currentType,
      title: trimmedTitle,
      notes: trimmedNotes || undefined,
      ownerId: defaultOwnerId ?? undefined,
    };

    if (currentType === "todo") {
      payload.dueAt = hasDueTime ? dueTime || startTime : null;
      payload.assignee = assignee ?? deriveAssigneeForOwner(defaultOwnerId);
      payload.babyId =
        assignee === "child" ? (selectedBabyId ?? undefined) : undefined;
    }

    if (currentType === "event") {
      if (isAllDay) {
        // Ensure all-day events have proper start/end times
        const allDayStart = new Date(startTime);
        allDayStart.setHours(0, 0, 0, 0);

        // Use the selected end date for multi-day events
        const allDayEnd = new Date(endTime ?? startTime);
        allDayEnd.setHours(23, 59, 59, 999);

        payload.start = allDayStart;
        payload.end = allDayEnd;
      } else {
        payload.start = startTime;
        payload.end = showEnd ? endTime : null;
      }

      payload.location = location.trim() || undefined;
      payload.reminderMinutes = reminderMinutes;
      payload.assignee = assignee ?? deriveAssigneeForOwner(defaultOwnerId);
      payload.babyId =
        assignee === "child" ? (selectedBabyId ?? undefined) : undefined;
      payload.isAllDay = isAllDay;
    }

    if (editingItem) {
      payload.id = editingItem.item.id;
    }

    onSave(payload);
    onClose();
  };

  const handleDelete = () => {
    if (!editingItem?.item.id || !onDelete) return;

    Alert.alert(
      "Eintrag löschen",
      "Möchtest du diesen Eintrag wirklich löschen?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: () => {
            onDelete(editingItem.item.id);
            onClose();
          },
        },
      ],
    );
  };

  const formatDateTime = (date: Date | null) => {
    if (!date) return "Offen";
    return date.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Offen";
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const openFocusEditor = (config: FocusConfig) => {
    if (config.field === "title") {
      setFocusValue(title);
    } else if (config.field === "location") {
      setFocusValue(location);
    } else {
      setFocusValue(notes);
    }
    setFocusConfig(config);
  };

  const closeFocusEditor = () => {
    setFocusConfig(null);
    setFocusValue("");
  };

  const saveFocusEditor = (nextVal?: string) => {
    if (!focusConfig) return;
    const next = typeof nextVal === "string" ? nextVal : focusValue;
    if (focusConfig.field === "title") {
      setTitle(next);
    } else if (focusConfig.field === "location") {
      setLocation(next);
    } else {
      setNotes(next);
    }
    closeFocusEditor();
  };

  useEffect(() => {
    if (!visible) {
      setFocusConfig(null);
      setFocusValue("");
    }
  }, [visible]);

  const renderInlineField = (
    value: string,
    placeholder: string,
    onPress: () => void,
    style: StyleProp<ViewStyle>,
    multiline = false,
    textStyle?: StyleProp<TextStyle>,
  ) => {
    const mergedStyle = Array.isArray(style)
      ? [
          styles.inlineFieldBase,
          ...style,
          multiline && styles.inlineFieldMultiline,
        ]
      : [
          styles.inlineFieldBase,
          style,
          multiline && styles.inlineFieldMultiline,
        ];

    return (
      <TouchableOpacity
        style={mergedStyle}
        activeOpacity={0.9}
        onPress={onPress}
      >
        <Text
          style={
            value
              ? [styles.inputValue, { color: theme.text }, textStyle]
              : [styles.inputPlaceholder, { color: theme.textSecondary }, textStyle]
          }
          numberOfLines={multiline ? 3 : 1}
        >
          {value || placeholder}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <BlurView
          intensity={80}
          tint={blurTint}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.sheetBackground,
              borderTopColor: theme.sheetBorder,
              borderTopWidth: 1,
            },
          ]}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={[
                styles.roundButton,
                { backgroundColor: theme.iconButton },
              ]}
              onPress={onClose}
            >
              <Text style={[styles.roundButtonLabel, { color: theme.text }]}>
                ✕
              </Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={[styles.title, { color: theme.text }]}>
                {currentType === "todo" ? "Neue Aufgabe" : "Neuer Termin"}
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Details hinzufügen
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.roundButton, { backgroundColor: accentColor }]}
              onPress={handleSave}
              accessibilityLabel="Speichern"
            >
              <Text style={[styles.roundButtonLabel, { color: "#fff" }]}>
                ✓
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.contentWrapper}>
                <View style={styles.typeSwitchRow}>
                  {(["todo", "event"] as PlannerCaptureType[]).map(
                    (btnType) => (
                      <TouchableOpacity
                        key={btnType}
                        style={[
                          styles.typeSwitchButton,
                          {
                            backgroundColor: theme.soft,
                            borderColor: theme.border,
                          },
                          currentType === btnType &&
                            styles.typeSwitchButtonActive,
                          currentType === btnType && {
                            backgroundColor: accentColor,
                            borderColor: accentColor,
                          },
                        ]}
                        onPress={() => setCurrentType(btnType)}
                      >
                        <Text
                          style={[
                            styles.typeSwitchLabel,
                            { color: theme.text },
                            currentType === btnType &&
                              styles.typeSwitchLabelActive,
                          ]}
                        >
                          {btnType === "todo" ? "Aufgabe" : "Termin"}
                        </Text>
                      </TouchableOpacity>
                    ),
                  )}
                </View>
                {renderInlineField(
                  title,
                  "Titel",
                  () =>
                    openFocusEditor({
                      field: "title",
                      label: "Titel",
                      placeholder: "Titel",
                    }),
                  [styles.titleInput, { backgroundColor: theme.field }],
                  false,
                  styles.titleFieldText,
                )}

                {(currentType === "todo" || currentType === "event") && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: theme.text }]}>
                      👤 Für
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.dropdownField,
                        {
                          backgroundColor: theme.field,
                          borderColor: theme.border,
                        },
                      ]}
                      onPress={() => setShowAssigneePicker(true)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.dropdownValue, { color: theme.text }]}>
                        {selectedAssigneeLabel}
                      </Text>
                      <Text
                        style={[styles.dropdownChevron, { color: theme.textSecondary }]}
                      >
                        ▾
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {currentType === "event" && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: theme.text }]}>
                      Zeitraum
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.dropdownField,
                        {
                          backgroundColor: theme.field,
                          borderColor: theme.border,
                        },
                      ]}
                      onPress={() => setShowTimeRangeModal(true)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.dropdownValue, { color: theme.text }]}>
                        {timeRangeSummary}
                      </Text>
                      <Text
                        style={[styles.dropdownChevron, { color: theme.textSecondary }]}
                      >
                        ▾
                      </Text>
                    </TouchableOpacity>
                    {renderInlineField(
                      location,
                      "Ort (optional)",
                      () =>
                        openFocusEditor({
                          field: "location",
                          label: "Ort",
                          placeholder: "Ort (optional)",
                        }),
                      [
                        styles.locationField,
                        styles.locationInput,
                        {
                          backgroundColor: theme.field,
                          borderColor: theme.border,
                        },
                      ],
                    )}
                    <View style={styles.section}>
                      <Text
                        style={[
                          styles.sectionLabelSecondary,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Erinnerung
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.dropdownField,
                          styles.dropdownFieldCompact,
                          {
                            backgroundColor: theme.field,
                            borderColor: theme.border,
                          },
                        ]}
                        onPress={() => setShowReminderPicker(true)}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.dropdownValue, { color: theme.text }]}>
                          {selectedReminderLabel}
                        </Text>
                        <Text
                          style={[styles.dropdownChevron, { color: theme.textSecondary }]}
                        >
                          ▾
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {currentType !== "event" && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: theme.text }]}>
                      🕒 Zeitpunkt
                    </Text>
                    {hasDueTime ? (
                      <>
                        {renderDateSelector(
                          "Fällig",
                          dueTime ?? startTime,
                          showDuePicker,
                          () => setShowDuePicker((prev) => !prev),
                          (date) => setDueTime(date),
                        )}
                        <TouchableOpacity
                          style={[
                            styles.timeButton,
                            { backgroundColor: theme.field },
                          ]}
                          onPress={() => {
                            setHasDueTime(false);
                            setDueTime(null);
                            setShowDuePicker(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.timeButtonLabel,
                              { color: theme.text },
                            ]}
                          >
                            Kein Datum setzen
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.timeButton,
                          { backgroundColor: theme.field },
                        ]}
                        onPress={() => {
                          setHasDueTime(true);
                          setDueTime(dueTime ?? startTime);
                          setShowDuePicker(true);
                        }}
                      >
                        <Text
                          style={[
                            styles.timeButtonLabel,
                            { color: theme.text },
                          ]}
                        >
                          Datum hinzufügen
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <View style={styles.section}>
                  <TouchableOpacity
                    style={styles.notesHeader}
                    onPress={toggleNotes}
                  >
                    <Text
                      style={[
                        styles.sectionLabel,
                        { marginBottom: 0, color: theme.text },
                      ]}
                    >
                      📝 Notizen
                    </Text>
                    <Text
                      style={[
                        styles.notesToggle,
                        {
                          color: theme.textSecondary,
                          transform: [
                            { rotate: notesExpanded ? "-90deg" : "90deg" },
                          ],
                        },
                      ]}
                    >
                      ›
                    </Text>
                  </TouchableOpacity>
                  {notesExpanded &&
                    renderInlineField(
                      notes,
                      "Details hinzufügen...",
                      () =>
                        openFocusEditor({
                          field: "notes",
                          label: "Notizen",
                          placeholder: "Details hinzufügen...",
                          multiline: true,
                        }),
                      [
                        styles.notesInput,
                        {
                          backgroundColor: theme.field,
                          borderColor: theme.border,
                        },
                      ],
                      true,
                    )}
                </View>

                {/* Löschen-Button nur beim Bearbeiten anzeigen */}
                {editingItem?.item.id && onDelete && (
                  <TouchableOpacity
                    style={[
                      styles.deleteButton,
                      {
                        backgroundColor: theme.deleteBg,
                        borderColor: theme.deleteBorder,
                      },
                    ]}
                    onPress={handleDelete}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.deleteButtonText,
                        { color: theme.deleteText },
                      ]}
                    >
                      🗑️ Eintrag löschen
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
        </BlurView>

        {showAssigneePicker && (
          <Modal
            visible={showAssigneePicker}
            animationType="fade"
            transparent
            onRequestClose={() => setShowAssigneePicker(false)}
          >
            <View
              style={[
                styles.pickerOverlay,
                { backgroundColor: theme.pickerOverlay },
              ]}
            >
              <TouchableWithoutFeedback
                onPress={() => setShowAssigneePicker(false)}
              >
                <View style={StyleSheet.absoluteFill} />
              </TouchableWithoutFeedback>
              <BlurView
                intensity={80}
                tint={blurTint}
                style={[
                  styles.pickerSheet,
                  {
                    backgroundColor: theme.sheetBackground,
                    borderColor: theme.sheetBorder,
                    borderWidth: 1,
                  },
                ]}
              >
                <View style={styles.pickerHeader}>
                  <Text style={[styles.pickerTitle, { color: theme.text }]}>
                    Für wen?
                  </Text>
                  <TouchableOpacity onPress={() => setShowAssigneePicker(false)}>
                    <Text
                      style={[styles.pickerCloseButton, { color: theme.text }]}
                    >
                      ✕
                    </Text>
                  </TouchableOpacity>
                </View>
                <ScrollView>
                  {assigneeOptions.map((opt) => {
                    const isChild = opt.value === "child";
                    const isSelected = isChild
                      ? assignee === "child" &&
                        (opt.babyId ?? null) === (selectedBabyId ?? null)
                      : assignee === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[
                          styles.pickerOption,
                          { borderBottomColor: theme.divider },
                          isSelected && styles.pickerOptionActive,
                          isSelected && {
                            backgroundColor: theme.accentSoft,
                          },
                        ]}
                        onPress={() => {
                          setAssignee(opt.value);
                          setSelectedBabyId(isChild ? (opt.babyId ?? null) : null);
                          setShowAssigneePicker(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            { color: theme.text },
                            isSelected && styles.pickerOptionTextActive,
                            isSelected && { color: accentColor },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </BlurView>
            </View>
          </Modal>
        )}

        {showTimeRangeModal && (
          <Modal
            visible={showTimeRangeModal}
            animationType="slide"
            transparent
            onRequestClose={() => {
              setShowTimeRangeModal(false);
              setShowStartPicker(false);
              setShowEndPicker(false);
            }}
          >
            <View
              style={[
                styles.timeRangeModalOverlay,
                { backgroundColor: theme.pickerOverlay },
              ]}
            >
              <TouchableWithoutFeedback
                onPress={() => {
                  setShowTimeRangeModal(false);
                  setShowStartPicker(false);
                  setShowEndPicker(false);
                }}
              >
                <View style={StyleSheet.absoluteFill} />
              </TouchableWithoutFeedback>
              <BlurView
                intensity={80}
                tint={blurTint}
                style={[
                  styles.timeRangeModalSheet,
                  {
                    backgroundColor: theme.sheetBackground,
                    borderColor: theme.sheetBorder,
                    borderWidth: 1,
                  },
                ]}
              >
                <View style={styles.pickerHeader}>
                  <Text style={[styles.pickerTitle, { color: theme.text }]}>
                    Zeitraum
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowTimeRangeModal(false);
                      setShowStartPicker(false);
                      setShowEndPicker(false);
                    }}
                    style={[
                      styles.modalDoneButton,
                      { backgroundColor: accentColor },
                    ]}
                    accessibilityLabel="Zeitraum übernehmen"
                  >
                    <Text
                      style={[styles.modalDoneLabel, { color: "#fff" }]}
                    >
                      ✓
                    </Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.timeRangeModalContent}
                >
                  <View style={styles.section}>
                    <Text
                      style={[styles.sectionLabel, { color: theme.textSecondary }]}
                    >
                      🕒 Uhrzeit
                    </Text>
                    <View style={styles.timeModeRow}>
                      <TouchableOpacity
                        style={[
                          styles.timeModeOption,
                          {
                            backgroundColor: theme.soft,
                            borderColor: theme.border,
                          },
                          isAllDay && styles.timeModeOptionActive,
                          isAllDay && {
                            backgroundColor: accentColor,
                            borderColor: accentColor,
                          },
                        ]}
                        onPress={() => setEventMode(true)}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.timeModeOptionLabel,
                            { color: theme.text },
                            isAllDay && styles.timeModeOptionLabelActive,
                          ]}
                        >
                          Ganztägig
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.timeModeOption,
                          {
                            backgroundColor: theme.soft,
                            borderColor: theme.border,
                          },
                          !isAllDay && styles.timeModeOptionActive,
                          !isAllDay && {
                            backgroundColor: accentColor,
                            borderColor: accentColor,
                          },
                        ]}
                        onPress={() => setEventMode(false)}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.timeModeOptionLabel,
                            { color: theme.text },
                            !isAllDay && styles.timeModeOptionLabelActive,
                          ]}
                        >
                          Mit Uhrzeit
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {isAllDay ? (
                    <>
                      {renderDateSelector(
                        "Von",
                        startTime,
                        showStartPicker,
                        () => setShowStartPicker((prev) => !prev),
                        (date) => {
                          const allDayStart = new Date(date);
                          allDayStart.setHours(0, 0, 0, 0);
                          setStartTime(allDayStart);

                          if (endTime && endTime < allDayStart) {
                            const allDayEnd = new Date(allDayStart);
                            allDayEnd.setHours(23, 59, 59, 999);
                            setEndTime(allDayEnd);
                          }
                        },
                        true,
                      )}
                      {renderDateSelector(
                        "Bis",
                        endTime ?? startTime,
                        showEndPicker,
                        () => setShowEndPicker((prev) => !prev),
                        (date) => {
                          const allDayEnd = new Date(date);
                          allDayEnd.setHours(23, 59, 59, 999);

                          if (allDayEnd < startTime) {
                            setEndTime(new Date(startTime.getTime()));
                            (endTime ?? startTime).setHours(23, 59, 59, 999);
                          } else {
                            setEndTime(allDayEnd);
                          }
                        },
                        true,
                      )}
                    </>
                  ) : (
                    <>
                      {renderDateSelector(
                        "Start",
                        startTime,
                        showStartPicker,
                        () => setShowStartPicker((prev) => !prev),
                        (date) => {
                          setStartTime(date);
                          if (showEnd && endTime && endTime < date) {
                            setEndTime(new Date(date.getTime() + 30 * 60000));
                          }
                        },
                        false,
                      )}
                      {showEnd && endTime ? (
                        <>
                          {renderDateSelector(
                            "Ende",
                            endTime,
                            showEndPicker,
                            () => setShowEndPicker((prev) => !prev),
                            setEndTime,
                          )}
                          {endTime.getTime() !== startTime.getTime() && (
                            <TouchableOpacity
                              style={styles.removeEndButton}
                              onPress={() => {
                                setShowEnd(false);
                                setEndTime(null);
                                setShowEndPicker(false);
                              }}
                            >
                              <Text
                                style={[
                                  styles.removeEndLabel,
                                  { color: theme.textSecondary },
                                ]}
                              >
                                Endzeit entfernen
                              </Text>
                            </TouchableOpacity>
                          )}
                        </>
                      ) : (
                        <TouchableOpacity
                          style={[
                            styles.timeButton,
                            { backgroundColor: theme.field },
                          ]}
                          onPress={() => {
                            const defaultEnd = new Date(
                              startTime.getTime() + 30 * 60000,
                            );
                            setEndTime(defaultEnd);
                            setShowEnd(true);
                            setShowEndPicker(true);
                          }}
                        >
                          <Text
                            style={[styles.timeButtonLabel, { color: theme.text }]}
                          >
                            Endzeit hinzufügen
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </ScrollView>
              </BlurView>
            </View>
          </Modal>
        )}

        {showReminderPicker && (
          <Modal
            visible={showReminderPicker}
            animationType="fade"
            transparent
            onRequestClose={() => setShowReminderPicker(false)}
          >
            <View
              style={[
                styles.pickerOverlay,
                { backgroundColor: theme.pickerOverlay },
              ]}
            >
              <TouchableWithoutFeedback
                onPress={() => setShowReminderPicker(false)}
              >
                <View style={StyleSheet.absoluteFill} />
              </TouchableWithoutFeedback>
              <BlurView
                intensity={80}
                tint={blurTint}
                style={[
                  styles.pickerSheet,
                  {
                    backgroundColor: theme.sheetBackground,
                    borderColor: theme.sheetBorder,
                    borderWidth: 1,
                  },
                ]}
              >
                <View style={styles.pickerHeader}>
                  <Text style={[styles.pickerTitle, { color: theme.text }]}>
                    Erinnerung
                  </Text>
                  <TouchableOpacity onPress={() => setShowReminderPicker(false)}>
                    <Text
                      style={[styles.pickerCloseButton, { color: theme.text }]}
                    >
                      ✕
                    </Text>
                  </TouchableOpacity>
                </View>
                <ScrollView>
                  {REMINDER_OPTIONS.map((minutes) => (
                    <TouchableOpacity
                      key={minutes}
                      style={[
                        styles.pickerOption,
                        { borderBottomColor: theme.divider },
                        reminderMinutes === minutes && styles.pickerOptionActive,
                        reminderMinutes === minutes && {
                          backgroundColor: theme.accentSoft,
                        },
                      ]}
                      onPress={() => {
                        setReminderMinutes(minutes);
                        setShowReminderPicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          { color: theme.text },
                          reminderMinutes === minutes &&
                            styles.pickerOptionTextActive,
                          reminderMinutes === minutes && {
                            color: accentColor,
                          },
                        ]}
                      >
                        {formatReminderLabel(minutes)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </BlurView>
            </View>
          </Modal>
        )}

        <TextInputOverlay
          visible={!!focusConfig}
          label={focusConfig?.label ?? ""}
          value={focusValue}
          placeholder={focusConfig?.placeholder}
          multiline={!!focusConfig?.multiline}
          accentColor={accentColor}
          onClose={closeFocusEditor}
          onSubmit={(next) => saveFocusEditor(next)}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    backgroundColor: "transparent",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  headerCenter: {
    alignItems: "center",
    flex: 1,
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  roundButtonLabel: {
    fontSize: 20,
    color: THEME.text,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: THEME.text,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    color: THEME.textSecondary,
  },
  contentWrapper: {
    paddingBottom: 32,
    gap: 24,
  },
  typeSwitchRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  typeSwitchButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  typeSwitchButtonActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  typeSwitchLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.text,
  },
  typeSwitchLabelActive: {
    color: "#fff",
  },
  titleInput: {
    width: "100%",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: THEME.field,
    fontSize: 16,
    color: THEME.text,
  },
  titleFieldText: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
  },
  inlineFieldBase: {
    alignItems: "flex-start",
    justifyContent: "center",
  },
  inlineFieldMultiline: {
    justifyContent: "flex-start",
  },
  inputValue: {
    color: THEME.text,
    fontSize: 16,
  },
  inputPlaceholder: {
    color: THEME.textSecondary,
    fontSize: 16,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: THEME.text,
  },
  sectionLabelSecondary: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.textSecondary,
  },
  pickerBlock: {
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    padding: 12,
    gap: 8,
  },
  selectorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: THEME.textSecondary,
  },
  selectorValue: {
    fontSize: 16,
    fontWeight: "600",
    color: THEME.text,
  },
  pickerInner: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingVertical: Platform.OS === "ios" ? 0 : 8,
  },
  dateTimePicker: {
    alignSelf: "stretch",
  },
  pickerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  pickerActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(94,61,179,0.08)",
  },
  pickerActionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: PRIMARY,
  },
  timeButton: {
    borderRadius: 16,
    backgroundColor: THEME.field,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  timeButtonLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: THEME.text,
  },
  dropdownField: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  dropdownValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: THEME.text,
  },
  dropdownChevron: {
    fontSize: 16,
    fontWeight: "700",
    color: THEME.textSecondary,
  },
  dropdownFieldCompact: {
    paddingVertical: 10,
  },
  timeModeRow: {
    flexDirection: "row",
    gap: 10,
  },
  timeModeOption: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  timeModeOptionActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  timeModeOptionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.text,
  },
  timeModeOptionLabelActive: {
    color: "#fff",
  },
  removeEndButton: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  removeEndLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: THEME.textSecondary,
  },
  locationField: {
    borderRadius: 16,
    backgroundColor: THEME.field,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  locationInput: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: THEME.text,
  },
  notesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notesToggle: {
    fontSize: 20,
    color: THEME.textSecondary,
  },
  notesInput: {
    marginTop: 8,
    borderRadius: 16,
    padding: 16,
    minHeight: 100,
    textAlignVertical: "top",
    backgroundColor: THEME.field,
    color: THEME.text,
    borderWidth: 1,
    borderColor: GLASS_OVERLAY,
  },
  deleteButton: {
    width: "100%",
    marginTop: 30,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: "rgba(255, 107, 107, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 107, 107, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF6B6B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#D63031",
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  timeRangeModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  timeRangeModalSheet: {
    width: "100%",
    maxHeight: "82%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    paddingTop: 20,
    paddingBottom: 12,
  },
  timeRangeModalContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 14,
  },
  pickerSheet: {
    width: "80%",
    maxHeight: "60%",
    borderRadius: 20,
    overflow: "hidden",
    paddingVertical: 20,
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: THEME.text,
  },
  pickerCloseButton: {
    fontSize: 24,
    color: THEME.text,
    fontWeight: "600",
  },
  modalDoneButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  modalDoneLabel: {
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 24,
  },
  pickerOption: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
  },
  pickerOptionActive: {
    backgroundColor: "rgba(94,61,179,0.1)",
  },
  pickerOptionText: {
    fontSize: 16,
    color: THEME.text,
  },
  pickerOptionTextActive: {
    color: PRIMARY,
    fontWeight: "600",
  },
  pickerEmpty: {
    paddingVertical: 40,
    alignItems: "center",
  },
  pickerEmptyText: {
    fontSize: 14,
    color: THEME.textSecondary,
  },
  allDayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  allDayToggle: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  allDayToggleActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  allDayToggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.text,
  },
  allDayToggleTextActive: {
    color: "#fff",
  },
});

export default PlannerCaptureModal;
