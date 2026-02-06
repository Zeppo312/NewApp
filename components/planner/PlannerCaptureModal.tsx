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
  const [showBabyPicker, setShowBabyPicker] = useState(false);
  const [focusConfig, setFocusConfig] = useState<FocusConfig | null>(null);
  const [focusValue, setFocusValue] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);

  const partnerLabel = useMemo(() => {
    if (!ownerOptions || ownerOptions.length === 0) return "Partner";
    const partnerOption = ownerOptions.find(
      (opt) => opt.id && opt.id !== defaultOwnerId,
    );
    return partnerOption?.label ?? "Partner";
  }, [ownerOptions, defaultOwnerId]);

  const assigneeOptions: { value: PlannerAssignee; label: string }[] = useMemo(
    () => [
      { value: "me", label: "Ich" },
      { value: "partner", label: partnerLabel },
      { value: "family", label: "Familie" },
      { value: "child", label: "Kind" },
    ],
    [partnerLabel],
  );

  const deriveAssigneeForOwner = (targetOwnerId?: string | null) => {
    if (!defaultOwnerId || !targetOwnerId) return "me" as PlannerAssignee;
    return targetOwnerId === defaultOwnerId ? "me" : "partner";
  };

  useEffect(() => {
    if (!visible) return;
    setShowStartPicker(false);
    setShowEndPicker(false);
    setShowDuePicker(false);

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
        const start = new Date(item.start);
        const end = new Date(item.end);
        const allDay = "isAllDay" in item ? (item.isAllDay ?? false) : false;
        setStartTime(start);
        setEndTime(end);
        setShowEnd(true);
        setDueTime(null);
        setLocation(item.location ?? "");
        setIsAllDay(allDay);
      } else {
        const due = item.dueAt ? new Date(item.dueAt) : null;
        setStartTime(due ?? new Date(initialStart));
        setEndTime(null);
        setShowEnd(false);
        setDueTime(due);
        setHasDueTime(!!due);
        setLocation("");
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
    }
  }, [visible, type, baseDate, editingItem, defaultOwnerId]);

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
              ? [styles.inputValue, { color: theme.text }]
              : [styles.inputPlaceholder, { color: theme.textSecondary }]
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
                )}

                {(currentType === "todo" || currentType === "event") && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: theme.text }]}>
                      👤 Für
                    </Text>
                    <View style={styles.assignRowWrap}>
                      {assigneeOptions.map((opt) => {
                        const selected = assignee === opt.value;
                        const displayLabel =
                          opt.value === "child" && selectedBabyId
                            ? (babyOptions?.find((b) => b.id === selectedBabyId)
                                ?.label ?? opt.label)
                            : opt.label;
                        return (
                          <TouchableOpacity
                            key={opt.value}
                            style={[
                              styles.assignButton,
                              styles.assignButtonHalf,
                              {
                                backgroundColor: theme.soft,
                                borderColor: theme.border,
                              },
                              selected && styles.assignButtonActive,
                              selected && {
                                backgroundColor: accentColor,
                                borderColor: accentColor,
                              },
                            ]}
                            onPress={() => {
                              if (opt.value === "child") {
                                setShowBabyPicker(true);
                              } else {
                                setAssignee(opt.value);
                                if (opt.value !== "child") {
                                  setSelectedBabyId(null);
                                }
                              }
                            }}
                          >
                            <Text
                              style={[
                                styles.assignLabel,
                                { color: theme.text },
                                selected && styles.assignLabelActive,
                              ]}
                            >
                              {displayLabel}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {currentType === "event" && (
                  <View style={styles.section}>
                    <View style={styles.allDayRow}>
                      <Text
                        style={[styles.sectionLabel, { color: theme.text }]}
                      >
                        ⏰ Zeitraum
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.allDayToggle,
                          {
                            backgroundColor: theme.soft,
                            borderColor: theme.border,
                          },
                          isAllDay && styles.allDayToggleActive,
                          isAllDay && {
                            backgroundColor: accentColor,
                            borderColor: accentColor,
                          },
                        ]}
                        onPress={() => {
                          const newIsAllDay = !isAllDay;
                          setIsAllDay(newIsAllDay);

                          if (newIsAllDay) {
                            // Set to all-day: 00:00 - 23:59:59
                            const allDayStart = new Date(startTime);
                            allDayStart.setHours(0, 0, 0, 0);
                            setStartTime(allDayStart);

                            // Keep end date if already set, otherwise same day
                            const allDayEnd = new Date(endTime ?? startTime);
                            allDayEnd.setHours(23, 59, 59, 999);
                            setEndTime(allDayEnd);

                            setShowStartPicker(false);
                            setShowEndPicker(false);
                          } else {
                            // Back to timed event
                            const now = new Date();
                            const timedStart = new Date(startTime);
                            timedStart.setHours(
                              now.getHours(),
                              now.getMinutes(),
                              0,
                              0,
                            );
                            setStartTime(timedStart);

                            const timedEnd = new Date(
                              timedStart.getTime() + 30 * 60000,
                            );
                            setEndTime(timedEnd);
                            setShowEnd(true);
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.allDayToggleText,
                            { color: theme.text },
                            isAllDay && styles.allDayToggleTextActive,
                          ]}
                        >
                          Ganztägig
                        </Text>
                      </TouchableOpacity>
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

                            // If end date is before start date, adjust it
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

                            // Don't allow end date before start date
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
                            <TouchableOpacity
                              style={[
                                styles.removeEndButton,
                                { backgroundColor: theme.accentSoft },
                              ]}
                              onPress={() => {
                                setShowEnd(false);
                                setEndTime(null);
                                setShowEndPicker(false);
                              }}
                            >
                              <Text
                                style={[
                                  styles.removeEndLabel,
                                  { color: accentColor },
                                ]}
                              >
                                Ende entfernen
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
                              const defaultEnd = new Date(
                                startTime.getTime() + 30 * 60000,
                              );
                              setEndTime(defaultEnd);
                              setShowEnd(true);
                              setShowEndPicker(true);
                            }}
                          >
                            <Text
                              style={[
                                styles.timeButtonLabel,
                                { color: theme.text },
                              ]}
                            >
                              Ende hinzufügen
                            </Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
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

        {showBabyPicker && (
          <Modal
            visible={showBabyPicker}
            animationType="fade"
            transparent
            onRequestClose={() => setShowBabyPicker(false)}
          >
            <View
              style={[
                styles.pickerOverlay,
                { backgroundColor: theme.pickerOverlay },
              ]}
            >
              <TouchableWithoutFeedback
                onPress={() => setShowBabyPicker(false)}
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
                    Wähle ein Kind
                  </Text>
                  <TouchableOpacity onPress={() => setShowBabyPicker(false)}>
                    <Text
                      style={[styles.pickerCloseButton, { color: theme.text }]}
                    >
                      ✕
                    </Text>
                  </TouchableOpacity>
                </View>
                <ScrollView>
                  {babyOptions && babyOptions.length > 0 ? (
                    babyOptions.map((baby) => (
                      <TouchableOpacity
                        key={baby.id}
                        style={[
                          styles.pickerOption,
                          { borderBottomColor: theme.divider },
                          selectedBabyId === baby.id &&
                            styles.pickerOptionActive,
                          selectedBabyId === baby.id && {
                            backgroundColor: theme.accentSoft,
                          },
                        ]}
                        onPress={() => {
                          setSelectedBabyId(baby.id);
                          setAssignee("child");
                          setShowBabyPicker(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            { color: theme.text },
                            selectedBabyId === baby.id &&
                              styles.pickerOptionTextActive,
                            selectedBabyId === baby.id && {
                              color: accentColor,
                            },
                          ]}
                        >
                          {baby.label}
                        </Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.pickerEmpty}>
                      <Text
                        style={[
                          styles.pickerEmptyText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Keine Kinder gefunden
                      </Text>
                    </View>
                  )}
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
  removeEndButton: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(94,61,179,0.08)",
  },
  removeEndLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: PRIMARY,
  },
  assignRowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  assignButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  assignButtonHalf: {
    flexBasis: "48%",
    flexGrow: 1,
  },
  assignButtonActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  assignLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.text,
  },
  assignLabelActive: {
    color: "#fff",
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
