import DateTimePicker from "@/components/ui/DateTimePicker";
import { FormField,FormSheet } from '@/components/ui/form-sheet';
import { FormColors } from '@/constants/Colors';
import { TYPOGRAPHY } from '@/constants/Typography';
import React,{ useCallback,useEffect,useMemo,useRef,useState } from "react";
import {
Alert,
Keyboard,
LayoutAnimation,
Platform,
StyleProp,
StyleSheet,
Text,
TextStyle,
TouchableOpacity,
TouchableWithoutFeedback,
View,
ViewStyle
} from "react-native";

import IOSBottomDatePicker from "@/components/modals/IOSBottomDatePicker";
import TextInputOverlay from "@/components/modals/TextInputOverlay";
import { ActionButton } from "@/components/ui/action-button";
import {
adaptPlannerColor,
isSamePlannerColor,
normalizePlannerColor,
PLANNER_ITEM_COLORS,
} from "@/constants/PlannerColors";
import { GLASS_OVERLAY,PRIMARY } from "@/constants/PlannerDesign";
import { useLocale } from "@/contexts/LocaleContext";
import { useAdaptiveColors } from "@/hooks/useAdaptiveColors";
import { getPlannerLocaleTag,PlannerTranslationKey,translatePlannerText } from "@/lib/plannerTranslations";
import { getSafePickerDate,parseSafeDate } from "@/lib/safeDate";
import { PlannerAssignee,PlannerEvent,PlannerTodo } from "@/services/planner";

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
  reminderMinutes?: number | null;
  notes?: string;
  assignee?: PlannerAssignee;
  babyId?: string;
  ownerId?: string;
  /** Eigene Farbe (#rrggbb) oder null für die Personenfarbe. */
  color?: string | null;
  isAllDay?: boolean;
  repeatEnabled?: boolean;
  repeatDays?: number[];
  editScope?: "occurrence" | "series";
  recurringSeriesId?: string;
  recurringOccurrenceDate?: string;
  recurringEndsOn?: Date | null;
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

const REMINDER_OPTIONS = [null, 0, 5, 10, 15, 30, 60, 120, 1440] as const;
const WEEKDAY_OPTIONS = [
  { value: 1, label: "Mo" },
  { value: 2, label: "Di" },
  { value: 3, label: "Mi" },
  { value: 4, label: "Do" },
  { value: 5, label: "Fr" },
  { value: 6, label: "Sa" },
  { value: 7, label: "So" },
] as const;

const formatReminderLabel = (minutes: number | null | undefined, t: (key: PlannerTranslationKey, params?: Record<string, string | number>) => string) => {
  if (minutes === null || minutes === undefined) return t("reminder.none");
  if (minutes === 0) return t("reminder.atStart");
  if (minutes === 60) return t("reminder.oneHour");
  if (minutes === 120) return t("reminder.twoHours");
  if (minutes === 1440) return t("reminder.oneDay");
  return t("reminder.minutes", { count: minutes });
};

const toRgba = (hex: string, opacity = 1) => {
  const cleanHex = hex.replace("#", "");
  const int = parseInt(cleanHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const parseLocalDateOnly = (value?: string | null) => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  parsed.setHours(0, 0, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toDateOnlyKey = (value?: Date | null) => {
  const safeDate = parseSafeDate(value);
  if (!safeDate) return null;
  const copy = new Date(safeDate);
  copy.setHours(0, 0, 0, 0);
  return `${copy.getFullYear()}-${String(copy.getMonth() + 1).padStart(2, "0")}-${String(copy.getDate()).padStart(2, "0")}`;
};

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
  const { locale } = useLocale();
  const t = useCallback((key: PlannerTranslationKey, params?: Record<string, string | number>) => translatePlannerText(locale, key, params), [locale]);
  const localeTag = getPlannerLocaleTag(locale);
  const initialStart = useMemo(() => {
    const d = getSafePickerDate(baseDate, new Date());
    d.setHours(new Date().getHours(), new Date().getMinutes(), 0, 0);
    return d;
  }, [baseDate]);
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === "dark" ||
    adaptiveColors.isDarkBackground;
  const accentColor = isDark ? adaptiveColors.accent : PRIMARY;

  const theme = useMemo(
    () => ({
      text: FormColors[isDark ? "dark" : "light"].text,
      textSecondary: FormColors[isDark ? "dark" : "light"].secondary,
      overlay: isDark ? "rgba(0,0,0,0.58)" : "rgba(0,0,0,0.35)",
      pickerOverlay: isDark ? "rgba(0,0,0,0.62)" : "rgba(0,0,0,0.4)",
      sheetBackground: isDark ? "rgba(8,8,12,0.96)" : "rgba(255,255,255,0.96)",
      sheetBorder: isDark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.45)",
      field: FormColors[isDark ? "dark" : "light"].field,
      block: isDark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.85)",
      blockStrong: isDark ? "rgba(18,18,22,0.92)" : "rgba(255,255,255,0.95)",
      soft: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.6)",
      border: FormColors[isDark ? "dark" : "light"].border,
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
  const [startTime, setStartTime] = useState(() => getSafePickerDate(initialStart, new Date()));
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [showEnd, setShowEnd] = useState(type === "event");
  const [dueTime, setDueTime] = useState<Date | null>(null);
  const [hasDueTime, setHasDueTime] = useState<boolean>(false);
  const [location, setLocation] = useState("");
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showDuePicker, setShowDuePicker] = useState(false);
  const [showRecurrenceEndPicker, setShowRecurrenceEndPicker] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [currentType, setCurrentType] = useState<PlannerCaptureType>(type);
  const [assignee, setAssignee] = useState<PlannerAssignee>("me");
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(null);
  const [showTimeRangeModal, setShowTimeRangeModal] = useState(false);
  const periodBeforeEdit = useRef<{ start: Date; end: Date | null; showEnd: boolean; allDay: boolean } | null>(null);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [focusConfig, setFocusConfig] = useState<FocusConfig | null>(null);
  const [focusValue, setFocusValue] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(15);
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [recurrenceEndsOn, setRecurrenceEndsOn] = useState<Date | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const partnerLabel = useMemo(() => {
    if (!ownerOptions || ownerOptions.length === 0) return t("person.partner");
    const partnerOption = ownerOptions.find(
      (opt) => opt.id && opt.id !== defaultOwnerId,
    );
    return partnerOption?.label ?? t("person.partner");
  }, [ownerOptions, defaultOwnerId, t]);

  const assigneeOptions: {
    key: string;
    value: PlannerAssignee;
    label: string;
    babyId?: string | null;
  }[] = useMemo(() => {
    const base = [
      { key: "me", value: "me" as PlannerAssignee, label: t("person.me") },
      {
        key: "partner",
        value: "partner" as PlannerAssignee,
        label: partnerLabel,
      },
      { key: "family", value: "family" as PlannerAssignee, label: t("person.family") },
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
        label: t("person.child"),
        babyId: null,
      },
    ];
  }, [partnerLabel, babyOptions, t]);

  const selectedBabyLabel = useMemo(
    () => babyOptions?.find((b) => b.id === selectedBabyId)?.label,
    [babyOptions, selectedBabyId],
  );

  const selectedAssigneeLabel = useMemo(() => {
    if (assignee === "child") {
      if (selectedBabyLabel) return selectedBabyLabel;
      if (babyOptions && babyOptions.length === 1) return babyOptions[0].label;
      return t("person.child");
    }
    return assigneeOptions.find((opt) => opt.value === assignee)?.label ?? t("person.me");
  }, [assignee, assigneeOptions, selectedBabyLabel, babyOptions, t]);

  const selectedColorLabel = useMemo(() => {
    const option = PLANNER_ITEM_COLORS.find((entry) =>
      isSamePlannerColor(color, entry.hex),
    );
    if (!option) return t("capture.colorAutoHint");
    return t(`color.${option.key}` as PlannerTranslationKey);
  }, [color, t]);

  const selectedReminderLabel = useMemo(
    () => formatReminderLabel(reminderMinutes, t),
    [reminderMinutes, t],
  );
  const sanitizedRepeatDays = useMemo(
    () =>
      Array.from(
        new Set(
          repeatDays
            .map((day) => Math.round(day))
            .filter((day) => day >= 1 && day <= 7),
        ),
      ).sort((a, b) => a - b),
    [repeatDays],
  );
  const weekdaysShortcutActive =
    sanitizedRepeatDays.join(",") === "1,2,3,4,5";
  const everyDayShortcutActive =
    sanitizedRepeatDays.join(",") === "1,2,3,4,5,6,7";

  const timeRangeSummary = useMemo(() => {
    const dayKey = (date: Date) =>
      `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const timeLabel = (date: Date) =>
      date.toLocaleTimeString(localeTag, {
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

      if (dayKey(date) === dayKey(today)) return t("common.today");
      if (dayKey(date) === dayKey(tomorrow)) return t("common.tomorrow");
      if (dayKey(date) === dayKey(yesterday)) return t("common.yesterday");
      return new Intl.DateTimeFormat(localeTag, {
        day: "2-digit",
        month: "2-digit",
        ...(withYear ? { year: "2-digit" } : {}),
      }).format(date);
    };

    if (isAllDay) {
      const startLabel = dayLabel(startTime);
      const endLabel = dayLabel(endTime ?? startTime);
      if (startLabel === endLabel) return `${startLabel} · ${t("common.allDay")}`;
      return `${startLabel}–${endLabel} · ${t("common.allDay")}`;
    }

    if (showEnd && endTime) {
      const isSameDay = dayKey(startTime) === dayKey(endTime);
      const startLabel = dayLabel(startTime);
      if (isSameDay) {
        return `${startLabel} · ${timeLabel(startTime)}–${timeLabel(endTime)}`;
      }
      return `${dayLabel(startTime, true)} ${timeLabel(startTime)} – ${dayLabel(endTime, true)} ${timeLabel(endTime)}`;
    }

    return `${dayLabel(startTime)} · ${t("capture.fromTime", { time: timeLabel(startTime) })}`;
  }, [isAllDay, startTime, endTime, showEnd, localeTag, t]);

  const openPeriod = () => {
    periodBeforeEdit.current = { start: new Date(startTime), end: endTime ? new Date(endTime) : null,
      showEnd, allDay: isAllDay };
    setShowTimeRangeModal(true);
  };

  const closePeriod = (apply = false) => {
    const previous = periodBeforeEdit.current;
    if (!apply && previous) {
      setStartTime(previous.start);
      setEndTime(previous.end);
      setShowEnd(previous.showEnd);
      setIsAllDay(previous.allDay);
    }
    periodBeforeEdit.current = null;
    setShowTimeRangeModal(false);
    setShowStartPicker(false);
    setShowEndPicker(false);
  };

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

  const deriveAssigneeForOwner = useCallback(
    (targetOwnerId?: string | null) => {
      if (!defaultOwnerId || !targetOwnerId) return "me" as PlannerAssignee;
      return targetOwnerId === defaultOwnerId ? "me" : "partner";
    },
    [defaultOwnerId],
  );

  const toggleRepeatEnabled = () => {
    setRepeatEnabled((prev) => {
      const next = !prev;
      if (next && sanitizedRepeatDays.length === 0) {
        setRepeatDays([1, 2, 3, 4, 5]);
      }
      if (next && currentType === "todo" && !hasDueTime) {
        setHasDueTime(true);
        setDueTime(dueTime ?? startTime);
      }
      return next;
    });
  };

  const toggleRepeatDay = (day: number) => {
    setRepeatDays((prev) => {
      const next = prev.includes(day)
        ? prev.filter((value) => value !== day)
        : [...prev, day];
      return next.sort((a, b) => a - b);
    });
  };

  useEffect(() => {
    if (!visible) return;
    setShowStartPicker(false);
    setShowEndPicker(false);
    setShowDuePicker(false);
    setShowRecurrenceEndPicker(false);
    setShowTimeRangeModal(false);
    setShowAssigneePicker(false);
    setShowReminderPicker(false);

    if (editingItem) {
      const { type: editingType, item } = editingItem;
      setShowAdvancedOptions(true);
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
        const fallbackStart = getSafePickerDate(initialStart, new Date());
        const start = parseSafeDate(eventItem.start) ?? fallbackStart;
        const fallbackEnd = new Date(start.getTime() + 30 * 60000);
        const parsedEnd = parseSafeDate(eventItem.end) ?? fallbackEnd;
        const end =
          parsedEnd.getTime() <= start.getTime() && !(eventItem.isAllDay ?? false)
            ? fallbackEnd
            : parsedEnd;
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
            : null;
        setReminderMinutes(nextReminder);
      } else {
        const todoItem = item as PlannerTodo;
        const due = parseSafeDate(todoItem.dueAt);
        setStartTime(due ?? getSafePickerDate(initialStart, new Date()));
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
      setColor(
        "color" in item ? normalizePlannerColor(item.color) : null,
      );
      if (item.isRecurring) {
        setRepeatEnabled(true);
        setRepeatDays(item.repeatDays?.length ? item.repeatDays : [1, 2, 3, 4, 5]);
        setRecurrenceEndsOn(parseLocalDateOnly(item.recurringEndsOn));
      } else {
        setRepeatEnabled(false);
        setRepeatDays([]);
        setRecurrenceEndsOn(null);
      }
    } else {
      const reset = getSafePickerDate(baseDate, new Date());
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
      setColor(null);
      setIsAllDay(false);
      setReminderMinutes(15);
      setRepeatEnabled(false);
      setRepeatDays([]);
      setRecurrenceEndsOn(null);
      setShowAdvancedOptions(false);
    }
  }, [visible, type, baseDate, editingItem, defaultOwnerId, initialStart, deriveAssigneeForOwner]);

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
      if (repeatEnabled && !hasDueTime) {
        setHasDueTime(true);
        setDueTime((prev) => prev ?? startTime);
      } else {
        setDueTime((prev) => prev);
      }
    }
  }, [currentType, visible, repeatEnabled, hasDueTime, startTime, endTime]);

  const toggleNotes = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setNotesExpanded((prev) => !prev);
  };

  const renderDateSelector = (
    label: string,
    value: Date,
    visible: boolean,
    setVisible: (visible: boolean) => void,
    onChange: (date: Date) => void,
    dateOnly: boolean = false,
  ) => (
    <View
      style={styles.pickerBlock}
    >
      <FormField isDark={isDark} onPress={() => setVisible(true)}
    label={label} value={dateOnly ? formatDate(value) : formatDateTime(value)}
       />
      {Platform.OS === "ios" ? (
        <IOSBottomDatePicker
          visible={visible}
          title={dateOnly ? t("capture.choose", { label }) : label}
          value={getSafePickerDate(value, new Date())}
          mode={dateOnly ? "date" : "datetime"}
          onClose={() => setVisible(false)}
          onConfirm={(date) => {
            onChange(date);
            setVisible(false);
          }}
        />
      ) : (
        visible && (
          <DateTimePicker
            value={getSafePickerDate(value, new Date())}
            mode={dateOnly ? "date" : "datetime"}
            display="default"
            onChange={(event, date) => {
              setVisible(false);
              if (event?.type === "dismissed" || !date) return;
              onChange(date);
            }}
            themeVariant={isDark ? "dark" : "light"}
          />
        )
      )}
    </View>
  );

  const handleSave = () => {
    const trimmedTitle = title.trim();
    const trimmedNotes = notes.trim();
    const isRecurringEdit = Boolean(editingItem?.item.isRecurring);
    const recurringSeriesId = editingItem?.item.isRecurring
      ? editingItem.item.seriesId
      : undefined;
    const recurringOccurrenceDate = editingItem?.item.isRecurring
      ? editingItem.item.occurrenceDate
      : undefined;

    if (trimmedTitle.length === 0) {
      return;
    }

    if (repeatEnabled && sanitizedRepeatDays.length === 0) {
      Alert.alert(t("capture.weekdaysMissingTitle"), t("capture.weekdaysMissingBody"));
      return;
    }

    const safeStart = parseSafeDate(startTime);
    const safeEnd = endTime ? parseSafeDate(endTime) : null;
    const safeDue = dueTime ? parseSafeDate(dueTime) : null;
    const recurringEndDate = parseSafeDate(recurrenceEndsOn);
    const normalizedRecurringEnd = recurringEndDate
      ? new Date(
          recurringEndDate.getFullYear(),
          recurringEndDate.getMonth(),
          recurringEndDate.getDate(),
        )
      : null;
    const recurrenceStartReference = parseLocalDateOnly(recurringOccurrenceDate) ?? (() => {
      const nextBaseDate = new Date(baseDate);
      nextBaseDate.setHours(0, 0, 0, 0);
      return nextBaseDate;
    })();

    if (currentType === "event" && !safeStart) {
      Alert.alert(t("validation.timeTitle"), t("capture.invalidStart"));
      return;
    }

    if (currentType === "event" && showEnd && !isAllDay && endTime && !safeEnd) {
      Alert.alert(t("validation.timeTitle"), t("capture.invalidEnd"));
      return;
    }

    if (currentType === "todo" && hasDueTime && !safeDue && !safeStart) {
      Alert.alert(t("validation.timeTitle"), t("capture.invalidTime"));
      return;
    }

    if (repeatEnabled && currentType === "todo" && !hasDueTime) {
      Alert.alert(
        t("capture.timeMissingTitle"),
        t("capture.timeMissingBody"),
      );
      return;
    }

    if (
      repeatEnabled &&
      currentType === "event" &&
      safeStart &&
      safeEnd &&
      safeStart.toDateString() !== safeEnd.toDateString()
    ) {
      Alert.alert(
        t("validation.unsupportedTitle"),
        t("capture.recurringMultiDay"),
      );
      return;
    }

    if (
      repeatEnabled &&
      normalizedRecurringEnd &&
      normalizedRecurringEnd.getTime() < recurrenceStartReference.getTime()
    ) {
      Alert.alert(
        t("capture.invalidEndDateTitle"),
        t("capture.invalidEndDateBody"),
      );
      return;
    }

    const payload: PlannerCapturePayload = {
      type: currentType,
      title: trimmedTitle,
      notes: trimmedNotes || undefined,
      ownerId: defaultOwnerId ?? undefined,
      color: normalizePlannerColor(color),
    };

    if (currentType === "todo") {
      payload.dueAt = hasDueTime ? (safeDue ?? safeStart) : null;
      payload.assignee = assignee ?? deriveAssigneeForOwner(defaultOwnerId);
      payload.babyId =
        assignee === "child" ? (selectedBabyId ?? undefined) : undefined;
    }

    if (currentType === "event") {
      if (isAllDay) {
        // Ensure all-day events have proper start/end times
        const allDayStart = new Date(safeStart!);
        allDayStart.setHours(0, 0, 0, 0);

        // Use the selected end date for multi-day events
        const allDayEnd = new Date(safeEnd ?? safeStart!);
        allDayEnd.setHours(23, 59, 59, 999);
        if (allDayEnd.getTime() < allDayStart.getTime()) {
          allDayEnd.setTime(allDayStart.getTime());
          allDayEnd.setHours(23, 59, 59, 999);
        }

        payload.start = allDayStart;
        payload.end = allDayEnd;
      } else {
        const eventStart = new Date(safeStart!);
        let eventEnd: Date | null = null;
        if (showEnd) {
          eventEnd =
            safeEnd && safeEnd.getTime() > eventStart.getTime()
              ? new Date(safeEnd)
              : new Date(eventStart.getTime() + 30 * 60000);
        }
        payload.start = eventStart;
        payload.end = eventEnd;
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

    if (repeatEnabled && sanitizedRepeatDays.length > 0) {
      payload.repeatEnabled = true;
      payload.repeatDays = sanitizedRepeatDays;
      payload.recurringEndsOn = normalizedRecurringEnd;
    }
    if (isRecurringEdit && recurringSeriesId && recurringOccurrenceDate) {
      payload.recurringSeriesId = recurringSeriesId;
      payload.recurringOccurrenceDate = recurringOccurrenceDate;
    }

    const submitPayload = (nextPayload: PlannerCapturePayload) => {
      onSave(nextPayload);
      onClose();
    };

    if (isRecurringEdit && !payload.repeatEnabled) {
      submitPayload({
        ...payload,
        repeatEnabled: false,
        editScope: "series",
      });
      return;
    }

    if (isRecurringEdit && payload.repeatEnabled) {
      const originalRecurringEndsOn = editingItem?.item.recurringEndsOn ?? null;
      const nextRecurringEndsOn = toDateOnlyKey(payload.recurringEndsOn);
      if (originalRecurringEndsOn !== nextRecurringEndsOn) {
        Alert.alert(
          t("capture.changeEndTitle"),
          t("capture.changeEndBody"),
          [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("capture.entireSeries"),
              onPress: () =>
                submitPayload({
                  ...payload,
                  editScope: "series",
                }),
            },
          ],
        );
        return;
      }
      Alert.alert(
        t("capture.saveChangesTitle"),
        t("capture.saveChangesBody"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("capture.onlyDay"),
            onPress: () =>
              submitPayload({
                ...payload,
                editScope: "occurrence",
              }),
          },
          {
            text: t("capture.entireSeries"),
            onPress: () =>
              submitPayload({
                ...payload,
                editScope: "series",
              }),
          },
        ],
      );
      return;
    }

    submitPayload(payload);
  };

  const handleDelete = () => {
    if (!editingItem?.item.id || !onDelete) return;

    if (
      editingItem.item.isRecurring &&
      editingItem.item.seriesId &&
      editingItem.item.occurrenceDate
    ) {
      Alert.alert(
        t("delete.recurringTitle"),
        t("capture.deleteRecurringBody"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("delete.onlyDay"),
            style: "destructive",
            onPress: () => {
              onDelete(
                `exclude:${editingItem.item.seriesId}:${editingItem.item.occurrenceDate}`,
              );
              onClose();
            },
          },
          {
            text: t("delete.series"),
            style: "destructive",
            onPress: () => {
              onDelete(`delete-series:${editingItem.item.seriesId}`);
              onClose();
            },
          },
        ],
      );
      return;
    }

    if (editingItem.item.isRecurring) {
      Alert.alert(
        t("capture.deleteTitle"),
        t("capture.deleteMetadataBody"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: () => {
              onDelete(editingItem.item.id);
              onClose();
            },
          },
        ],
      );
      return;
    }

    Alert.alert(
      t("capture.deleteTitle"),
      t("capture.deleteBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
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
    const safeDate = parseSafeDate(date);
    if (!safeDate) return t("common.open");
    return safeDate.toLocaleString(localeTag, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (date: Date | null) => {
    const safeDate = parseSafeDate(date);
    if (!safeDate) return t("common.open");
    return safeDate.toLocaleDateString(localeTag, {
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

  const renderInlineField = (value: string, placeholder: string, onPress: () => void,
   _style: StyleProp<ViewStyle>, multiline = false, _textStyle?: StyleProp<TextStyle>) =>
   <FormField isDark={isDark} value={value} placeholder={placeholder} onPress={onPress} multiline={multiline} />;

  return (
    <FormSheet
        visible={visible}
        isDark={isDark}
        title={
          editingItem
            ? currentType === 'todo'
              ? t('capture.editTodo')
              : t('capture.editEvent')
            : currentType === 'todo'
              ? t('capture.newTodo')
              : t('capture.newEvent')
        }
        subtitle={showAdvancedOptions ? t('capture.details') : t('capture.quick')}
        onClose={onClose}
        onCancel={onClose}
        confirmDisabled={!title.trim()}
        onConfirm={handleSave}
        overlays={
          <>
            {showAssigneePicker && (
              <FormSheet
                visible={showAssigneePicker}
                isDark={isDark}
                title={t('capture.forWhom')}
                onClose={() => setShowAssigneePicker(false)}
              >
                {assigneeOptions.map((opt) => {
                  const isChild = opt.value === 'child';
                  const isSelected = isChild
                    ? assignee === 'child' && (opt.babyId ?? null) === (selectedBabyId ?? null)
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
              </FormSheet>
            )}
            {showTimeRangeModal && (
              <FormSheet
                visible={showTimeRangeModal}
                isDark={isDark}
                title={t('capture.period')}
                onClose={() => closePeriod()}
                onCancel={() => closePeriod()}
                confirmLabel={t('capture.applyPeriod')}
                onConfirm={() => closePeriod(true)}
              >
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                    {t('capture.clock')}
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
                        {t('common.allDay')}
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
                        {t('capture.withTime')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {isAllDay ? (
                  <>
                    {renderDateSelector(
                      t('capture.from'),
                      startTime,
                      showStartPicker,
                      setShowStartPicker,
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
                      t('capture.to'),
                      endTime ?? startTime,
                      showEndPicker,
                      setShowEndPicker,
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
                      t('capture.start'),
                      startTime,
                      showStartPicker,
                      setShowStartPicker,
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
                          t('capture.end'),
                          endTime,
                          showEndPicker,
                          setShowEndPicker,
                          setEndTime,
                        )}
                        {endTime.getTime() !== startTime.getTime() && (
                          <ActionButton
                            variant="secondary"
                            size="compact"
                            isDark={isDark}
                            label={t('capture.removeEnd')}
                            style={styles.removeEndButton}
                            onPress={() => {
                              setShowEnd(false);
                              setEndTime(null);
                              setShowEndPicker(false);
                            }}
                          />
                        )}
                      </>
                    ) : (
                      <ActionButton
                        variant="secondary"
                        isDark={isDark}
                        label={t('capture.addEnd')}
                        onPress={() => {
                          const defaultEnd = new Date(startTime.getTime() + 30 * 60000);
                          setEndTime(defaultEnd);
                          setShowEnd(true);
                          setShowEndPicker(true);
                        }}
                      />
                    )}
                  </>
                )}
              </FormSheet>
            )}
            {showReminderPicker && (
              <FormSheet
                visible={showReminderPicker}
                isDark={isDark}
                title={t('capture.reminder')}
                onClose={() => setShowReminderPicker(false)}
              >
                {REMINDER_OPTIONS.map((minutes) => (
                  <TouchableOpacity
                    key={minutes === null ? 'none' : minutes}
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
                        reminderMinutes === minutes && styles.pickerOptionTextActive,
                        reminderMinutes === minutes && {
                          color: accentColor,
                        },
                      ]}
                    >
                      {formatReminderLabel(minutes, t)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </FormSheet>
            )}
            <TextInputOverlay
              visible={!!focusConfig}
              label={focusConfig?.label ?? ''}
              value={focusValue}
              placeholder={focusConfig?.placeholder}
              multiline={!!focusConfig?.multiline}
              onClose={closeFocusEditor}
              onSubmit={(next) => saveFocusEditor(next)}
            />
          </>
        }
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.contentWrapper}>
            <View style={styles.typeSwitchRow}>
              {(['todo', 'event'] as PlannerCaptureType[]).map((btnType) => (
                <TouchableOpacity
                  key={btnType}
                  style={[
                    styles.typeSwitchButton,
                    {
                      backgroundColor: theme.soft,
                      borderColor: theme.border,
                    },
                    currentType === btnType && styles.typeSwitchButtonActive,
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
                      currentType === btnType && styles.typeSwitchLabelActive,
                    ]}
                  >
                    {btnType === 'todo' ? t('capture.todo') : t('capture.event')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {renderInlineField(
              title,
              t('capture.title'),
              () =>
                openFocusEditor({
                  field: 'title',
                  label: t('capture.title'),
                  placeholder: t('capture.title'),
                }),
              [styles.titleInput, { backgroundColor: theme.field }],
              false,
              styles.titleFieldText,
            )}

            <TouchableOpacity
              style={[
                styles.advancedToggleButton,
                {
                  backgroundColor: showAdvancedOptions ? theme.accentSoft : theme.field,
                  borderColor: showAdvancedOptions ? accentColor : theme.border,
                },
              ]}
              onPress={() => setShowAdvancedOptions((prev) => !prev)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={showAdvancedOptions ? t('capture.lessA11y') : t('capture.moreA11y')}
            >
              <Text
                style={[
                  styles.advancedToggleText,
                  { color: showAdvancedOptions ? accentColor : theme.text },
                ]}
              >
                {showAdvancedOptions ? t('capture.less') : t('capture.more')}
              </Text>
              <Text
                style={[
                  styles.advancedToggleIcon,
                  {
                    color: showAdvancedOptions ? accentColor : theme.textSecondary,
                  },
                ]}
              >
                {showAdvancedOptions ? '˄' : '˅'}
              </Text>
            </TouchableOpacity>

            {showAdvancedOptions && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: theme.text }]}>{t('capture.for')}</Text>
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
                  <Text style={[styles.dropdownChevron, { color: theme.textSecondary }]}>▾</Text>
                </TouchableOpacity>
              </View>
            )}

            {showAdvancedOptions && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: theme.text }]}>{t('capture.color')}</Text>
                <View style={styles.colorSelector}>
                  <TouchableOpacity
                    style={[
                      styles.colorSwatch,
                      {
                        backgroundColor: theme.field,
                        borderColor: color ? theme.border : accentColor,
                        borderWidth: color ? 1 : 3,
                      },
                    ]}
                    activeOpacity={0.85}
                    onPress={() => setColor(null)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: !color }}
                    accessibilityLabel={t('capture.colorAuto')}
                  >
                    <Text
                      style={[
                        styles.colorSwatchAutoLabel,
                        { color: color ? theme.textSecondary : accentColor },
                      ]}
                    >
                      A
                    </Text>
                  </TouchableOpacity>
                  {PLANNER_ITEM_COLORS.map((option) => {
                    const selected = isSamePlannerColor(color, option.hex);
                    return (
                      <TouchableOpacity
                        key={option.key}
                        style={[
                          styles.colorSwatch,
                          {
                            backgroundColor: adaptPlannerColor(option.hex, isDark),
                            borderColor: selected ? theme.text : 'transparent',
                            borderWidth: selected ? 3 : 1,
                          },
                        ]}
                        activeOpacity={0.85}
                        onPress={() => setColor(option.hex)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={t(`color.${option.key}` as PlannerTranslationKey)}
                      >
                        {selected ? <Text style={styles.colorSwatchCheck}>✓</Text> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={[styles.colorHint, { color: theme.textSecondary }]}>
                  {selectedColorLabel}
                </Text>
              </View>
            )}

            {showAdvancedOptions && (
              <View style={styles.section}>
                <View style={styles.recurrenceToggleRow}>
                  <Text style={[styles.sectionLabel, { color: theme.text }]}>
                    {t('capture.repeat')}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.recurrenceToggle,
                      {
                        backgroundColor: repeatEnabled ? accentColor : theme.field,
                        borderColor: repeatEnabled ? accentColor : theme.border,
                      },
                    ]}
                    activeOpacity={0.85}
                    onPress={toggleRepeatEnabled}
                  >
                    <Text
                      style={[
                        styles.recurrenceToggleText,
                        { color: repeatEnabled ? '#fff' : theme.text },
                      ]}
                    >
                      {repeatEnabled ? t('capture.on') : t('capture.off')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {repeatEnabled && (
                  <View style={styles.recurrenceContent}>
                    <View style={styles.recurrenceShortcuts}>
                      <TouchableOpacity
                        style={[
                          styles.recurrenceShortcut,
                          {
                            backgroundColor: everyDayShortcutActive ? accentColor : theme.soft,
                            borderColor: everyDayShortcutActive ? accentColor : theme.border,
                          },
                        ]}
                        activeOpacity={0.85}
                        onPress={() => setRepeatDays([1, 2, 3, 4, 5, 6, 7])}
                      >
                        <Text
                          style={[
                            styles.recurrenceShortcutText,
                            {
                              color: everyDayShortcutActive ? '#fff' : theme.text,
                            },
                          ]}
                        >
                          {t('capture.daily')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.recurrenceShortcut,
                          {
                            backgroundColor: weekdaysShortcutActive ? accentColor : theme.soft,
                            borderColor: weekdaysShortcutActive ? accentColor : theme.border,
                          },
                        ]}
                        activeOpacity={0.85}
                        onPress={() => setRepeatDays([1, 2, 3, 4, 5])}
                      >
                        <Text
                          style={[
                            styles.recurrenceShortcutText,
                            {
                              color: weekdaysShortcutActive ? '#fff' : theme.text,
                            },
                          ]}
                        >
                          {t('capture.weekdays')}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.weekdaySelector}>
                      {WEEKDAY_OPTIONS.map((day) => {
                        const selected = sanitizedRepeatDays.includes(day.value);
                        return (
                          <TouchableOpacity
                            key={day.value}
                            style={[
                              styles.weekdayButton,
                              {
                                backgroundColor: selected ? accentColor : theme.field,
                                borderColor: selected ? accentColor : theme.border,
                              },
                            ]}
                            activeOpacity={0.85}
                            onPress={() => toggleRepeatDay(day.value)}
                          >
                            <Text
                              style={[styles.weekdayLabel, { color: selected ? '#fff' : theme.text }]}
                            >
                              {t(
                                (
                                  [
                                    'weekday.mon',
                                    'weekday.tue',
                                    'weekday.wed',
                                    'weekday.thu',
                                    'weekday.fri',
                                    'weekday.sat',
                                    'weekday.sun',
                                  ] as PlannerTranslationKey[]
                                )[day.value - 1],
                              )}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <Text
                      style={[
                        styles.sectionLabelSecondary,
                        styles.recurrenceMetaLabel,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {t('capture.seriesEnd')}
                    </Text>
                    {recurrenceEndsOn ? (
                      <>
                        {renderDateSelector(
                          t('capture.endsOn'),
                          recurrenceEndsOn,
                          showRecurrenceEndPicker,
                          setShowRecurrenceEndPicker,
                          (date) => {
                            const normalized = new Date(date);
                            normalized.setHours(0, 0, 0, 0);
                            setRecurrenceEndsOn(normalized);
                          },
                          true,
                        )}
                        <ActionButton
                          variant="secondary"
                          isDark={isDark}
                          label={t('capture.noEnd')}
                          onPress={() => {
                            setRecurrenceEndsOn(null);
                            setShowRecurrenceEndPicker(false);
                          }}
                        />
                      </>
                    ) : (
                      <ActionButton
                        variant="secondary"
                        isDark={isDark}
                        label={t('capture.addEndDate')}
                        onPress={() => {
                          const initialRecurrenceEnd = new Date(baseDate);
                          initialRecurrenceEnd.setHours(0, 0, 0, 0);
                          setRecurrenceEndsOn(initialRecurrenceEnd);
                          setShowRecurrenceEndPicker(true);
                        }}
                      />
                    )}
                  </View>
                )}
              </View>
            )}

            {currentType === 'event' && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: theme.text }]}>{t('capture.period')}</Text>
                <TouchableOpacity
                  style={[
                    styles.dropdownField,
                    {
                      backgroundColor: theme.field,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={openPeriod}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.dropdownValue, { color: theme.text }]}>{timeRangeSummary}</Text>
                  <Text style={[styles.dropdownChevron, { color: theme.textSecondary }]}>▾</Text>
                </TouchableOpacity>
                {showAdvancedOptions &&
                  renderInlineField(
                    location,
                    t('capture.locationOptional'),
                    () =>
                      openFocusEditor({
                        field: 'location',
                        label: t('capture.location'),
                        placeholder: t('capture.locationOptional'),
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
                {showAdvancedOptions && !repeatEnabled && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionLabelSecondary, { color: theme.textSecondary }]}>
                      {t('capture.reminder')}
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
                      <Text style={[styles.dropdownChevron, { color: theme.textSecondary }]}>▾</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {currentType !== 'event' && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: theme.text }]}>{t('capture.time')}</Text>
                {hasDueTime ? (
                  <>
                    {renderDateSelector(
                      t('capture.due'),
                      dueTime ?? startTime,
                      showDuePicker,
                      setShowDuePicker,
                      (date) => setDueTime(date),
                    )}
                    <ActionButton
                      variant="secondary"
                      isDark={isDark}
                      disabled={repeatEnabled}
                      label={repeatEnabled ? t('capture.timeRequired') : t('capture.noDate')}
                      onPress={() => {
                        if (repeatEnabled) {
                          return;
                        }
                        setHasDueTime(false);
                        setDueTime(null);
                        setShowDuePicker(false);
                      }}
                    />
                  </>
                ) : (
                  <ActionButton
                    variant="secondary"
                    isDark={isDark}
                    label={t('capture.addDate')}
                    onPress={() => {
                      setHasDueTime(true);
                      setDueTime(dueTime ?? startTime);
                      setShowDuePicker(true);
                    }}
                  />
                )}
              </View>
            )}

            {showAdvancedOptions && (
              <View style={styles.section}>
                <TouchableOpacity style={styles.notesHeader} onPress={toggleNotes}>
                  <Text style={[styles.sectionLabel, { marginBottom: 0, color: theme.text }]}>
                    {t('capture.notes')}
                  </Text>
                  <Text
                    style={[
                      styles.notesToggle,
                      {
                        color: theme.textSecondary,
                        transform: [{ rotate: notesExpanded ? '-90deg' : '90deg' }],
                      },
                    ]}
                  >
                    ›
                  </Text>
                </TouchableOpacity>
                {notesExpanded &&
                  renderInlineField(
                    notes,
                    t('capture.detailsPlaceholder'),
                    () =>
                      openFocusEditor({
                        field: 'notes',
                        label: t('capture.notesPlain'),
                        placeholder: t('capture.detailsPlaceholder'),
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
            )}

            {/* Löschen-Button nur beim Bearbeiten anzeigen */}
            {editingItem?.item.id && onDelete && (
              <ActionButton
                style={styles.deleteButton}
                variant="destructive"
                isDark={isDark}
                label={t('common.delete')}
                accessibilityLabel={t('capture.deleteEntry')}
                onPress={handleDelete}
              />
            )}
          </View>
        </TouchableWithoutFeedback>
      </FormSheet>
  );
};

const styles = StyleSheet.create({

  contentWrapper: { gap: 20 },
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
  advancedToggleButton: {
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  advancedToggleText: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.text,
  },
  advancedToggleIcon: {
    fontSize: 16,
    fontWeight: "900",
    color: THEME.textSecondary,
  },

  section: { gap: 8 },
  sectionLabel: { ...TYPOGRAPHY.label, alignSelf: 'flex-start' },
  sectionLabelSecondary: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.textSecondary,
  },
  recurrenceMetaLabel: {
    marginTop: 2,
  },
  recurrenceToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  recurrenceToggle: {
    minWidth: 72,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  recurrenceToggleText: {
    fontSize: 13,
    fontWeight: "700",
  },
  recurrenceContent: {
    gap: 12,
  },
  recurrenceShortcuts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  recurrenceShortcut: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  recurrenceShortcutText: {
    fontSize: 13,
    fontWeight: "600",
  },
  weekdaySelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  colorSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  colorSwatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  colorSwatchAutoLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  colorSwatchCheck: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  colorHint: {
    fontSize: 12,
    marginTop: -4,
  },
  weekdayButton: {
    minWidth: 42,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  weekdayLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  pickerBlock: { gap: 8 },

  pickerInner: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingVertical: Platform.OS === "ios" ? 0 : 8,
  },
  dateTimePicker: {
    alignSelf: "stretch",
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
