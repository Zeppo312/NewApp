import React, { useCallback, useMemo, useState } from "react";
import {
  type LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { BlurView } from "expo-blur";

import { PlannerAssignee, PlannerEvent, PlannerTodo } from "@/services/planner";
import {
  LAYOUT_PAD,
  PRIMARY,
  GLASS_BORDER,
  GLASS_OVERLAY,
  TEXT_PRIMARY,
} from "@/constants/PlannerDesign";
import { ThemedText } from "@/components/ThemedText";
import { SwipeableListItem } from "./SwipeableListItem";
import { IconSymbol, type IconSymbolName } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import { useAdaptiveColors } from "@/hooks/useAdaptiveColors";
import { parseSafeDate } from "@/lib/safeDate";
import { useLocale } from '@/contexts/LocaleContext';

type Props = {
  date: Date;
  events: PlannerEvent[];
  todos: PlannerTodo[];
  getOwnerLabel?: (ownerId?: string) => string | undefined;
  getAssigneeLabel?: (
    assignee?: PlannerAssignee,
    babyId?: string,
    ownerId?: string,
  ) => string | undefined;
  getEventColor?: (
    assignee?: PlannerAssignee,
    babyId?: string,
    ownerId?: string,
    itemColor?: string | null,
  ) => string;
  readOnly?: boolean;
  onToggleTodo: (id: string) => void;
  onMoveTomorrow: (id: string) => void;
  onDelete?: (id: string) => void;
  onEditTodo?: (id: string) => void;
  onEditEvent?: (id: string) => void;
};

type TimelineEvent = {
  kind: "event";
  id: string;
  title: string;
  subtitle: string;
  eventColor: string;
  isRecurring?: boolean;
  minute: number;
  endMinute: number;
};

type TimelineTodo = {
  kind: "todo";
  id: string;
  title: string;
  completed: boolean;
  minute: number;
  endMinute: number;
  timeLabel: string;
  assignee: PlannerAssignee;
  /** Aufgelöste Farbe: eigene Farbe oder automatisch nach Person/Familie. */
  todoColor: string;
  isRecurring?: boolean;
};

type TimelineItem = TimelineEvent | TimelineTodo;

type TimelineRow = {
  id: string;
  startMinute: number;
  endMinute: number;
  /** Zeitlicher Abstand zur vorherigen Zeile in Minuten. */
  gapMinutes: number;
  items: TimelineItem[];
};

const LINE_X = LAYOUT_PAD + 36;
const CARD_LEFT = LINE_X + 28;
/** Mehr als zwei Karten nebeneinander werden auf dem Handy unlesbar. */
const MAX_COLUMNS = 2;
const ROW_GAP = 12;
/** Label sitzt auf Höhe der Kartenmitte der ersten Zeile. */
const ROW_LABEL_OFFSET = 26;

const formatMinute = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

/** Größere Zeitlücken bekommen etwas mehr Luft, aber keine leeren Stunden. */
const rowGapPx = (gapMinutes: number) =>
  ROW_GAP + Math.min(36, Math.round((gapMinutes / 60) * 10));

const toRgba = (hex: string, opacity = 1) => {
  const cleanHex = hex.replace("#", "");
  const int = parseInt(cleanHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

function minutesFromMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function parseISO(iso?: string) {
  return parseSafeDate(iso) ?? undefined;
}

function isRecurringId(id: string) {
  return id.startsWith("recurring:");
}

export const StructuredTimeline: React.FC<Props> = ({
  date,
  events,
  todos,
  getOwnerLabel,
  getAssigneeLabel,
  getEventColor,
  readOnly = false,
  onToggleTodo,
  onMoveTomorrow,
  onDelete,
  onEditTodo,
  onEditEvent,
}) => {
  const { locale, localeTag } = useLocale();
  const c = {
    de: { me: 'Ich', flexible: 'Flexibel', allDay: 'Ganztägig', allDayEvent: 'Ganztägiger Termin', event: 'Termin', recurring: 'wiederkehrend', empty: 'Noch nichts geplant', emptySub: 'Tippe auf +, um deinen Tag zu füllen.' },
    en: { me: 'Me', flexible: 'Flexible', allDay: 'All day', allDayEvent: 'All-day appointment', event: 'Appointment', recurring: 'recurring', empty: 'Nothing planned yet', emptySub: 'Tap + to fill your day.' },
    es: { me: 'Yo', flexible: 'Flexible', allDay: 'Todo el día', allDayEvent: 'Cita de todo el día', event: 'Cita', recurring: 'recurrente', empty: 'Aún no hay nada planeado', emptySub: 'Toca + para organizar tu día.' },
  }[locale];
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === "dark" ||
    adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : TEXT_PRIMARY;
  const textSecondary = isDark ? Colors.dark.textSecondary : TEXT_PRIMARY;
  const textMuted = isDark ? "rgba(248,240,229,0.72)" : "rgba(125,90,80,0.72)";
  const accentColor = isDark ? adaptiveColors.accent : PRIMARY;
  const glassOverlay = isDark ? "rgba(0,0,0,0.35)" : GLASS_OVERLAY;
  const glassBorder = isDark ? "rgba(255,255,255,0.22)" : GLASS_BORDER;
  const blurTint = isDark ? "dark" : "light";

  const { allDayEvents, timedEvents } = useMemo(() => {
    // Treat events as all-day if:
    // 1. They have isAllDay flag set, OR
    // 2. They span more than 10 hours (600 minutes) - likely a day trip or multi-day event
    const isEffectivelyAllDay = (e: PlannerEvent): boolean => {
      if (e.isAllDay) return true;
      const start = parseISO(e.start);
      const end = parseISO(e.end);
      if (!start || !end) return false;
      const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
      return durationMinutes >= 600; // 10 hours or more
    };

    const allDay = events.filter(isEffectivelyAllDay);
    const timed = events.filter((e) => !isEffectivelyAllDay(e));
    return { allDayEvents: allDay, timedEvents: timed };
  }, [events]);

  const timeline = useMemo(() => {
    const entries: TimelineItem[] = [];
    const fallbackBase = 13 * 60;
    let floatingIndex = 0;

    timedEvents.forEach((event) => {
      const start = parseISO(event.start);
      if (!start) return;
      const parsedEnd = parseISO(event.end);
      const end =
        parsedEnd && parsedEnd.getTime() > start.getTime()
          ? parsedEnd
          : new Date(start.getTime() + 30 * 60000);
      const startMinute = minutesFromMidnight(start);
      const endMinute = Math.max(startMinute + 30, minutesFromMidnight(end));
      const ownerLabel = getOwnerLabel?.(event.userId);
      const assigneeLabel = getAssigneeLabel?.(
        event.assignee,
        event.babyId,
        event.userId,
      );
      const metaLabel =
        assigneeLabel && assigneeLabel !== c.me
          ? assigneeLabel
          : ownerLabel && ownerLabel !== c.me
            ? ownerLabel
            : "";
      const metaSuffix = metaLabel ? ` · ${metaLabel}` : "";
      const locationSuffix = event.location ? ` · ${event.location}` : "";
      const recurring = isRecurringId(event.id);
      const eventColor =
        getEventColor?.(
          event.assignee,
          event.babyId,
          event.userId,
          event.color,
        ) ?? accentColor;
      entries.push({
        kind: "event",
        id: event.id,
        title: event.title,
        subtitle: `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}${locationSuffix}${metaSuffix}`,
        eventColor,
        isRecurring: recurring,
        minute: startMinute,
        endMinute: endMinute,
      });
    });

    todos.forEach((todo) => {
      const dueDate = parseISO(todo.dueAt);
      const dueMinute = dueDate
        ? minutesFromMidnight(dueDate)
        : fallbackBase + floatingIndex * 25;
      const endMinute = dueMinute + 30; // Todos take 30 minutes by default
      if (!dueDate) floatingIndex += 1;
      const ownerLabel = getOwnerLabel?.(todo.userId);
      const assigneeLabel = getAssigneeLabel?.(
        todo.assignee,
        todo.babyId,
        todo.userId,
      );
      const metaLabel =
        assigneeLabel && assigneeLabel !== c.me
          ? assigneeLabel
          : ownerLabel && ownerLabel !== c.me
            ? ownerLabel
            : "";
      const metaSuffix = metaLabel ? ` · ${metaLabel}` : "";
      const timeLabel = `${dueDate ? dueDate.toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" }) : c.flexible}${metaSuffix}`;
      const recurring = isRecurringId(todo.id);
      entries.push({
        kind: "todo",
        id: todo.id,
        title: todo.title,
        completed: todo.completed,
        minute: dueMinute,
        endMinute: endMinute,
        timeLabel,
        assignee: todo.assignee ?? "me",
        todoColor:
          getEventColor?.(
            todo.assignee,
            todo.babyId,
            todo.userId,
            todo.color,
          ) ?? accentColor,
        isRecurring: recurring,
      });
    });

    entries.sort((a, b) => a.minute - b.minute || a.endMinute - b.endMinute);

    if (entries.length === 0) {
      return { rows: [] as TimelineRow[] };
    }

    // Zeilen-Layout: Einträge stehen grundsätzlich untereinander.
    // Nur bei exakt gleicher Startzeit teilen sich zwei Einträge eine Zeile
    // (nebeneinander, max. MAX_COLUMNS). Nichts überlagert sich.
    const rows: TimelineRow[] = [];
    entries.forEach((item) => {
      const current = rows[rows.length - 1];
      if (
        current &&
        current.items.length < MAX_COLUMNS &&
        current.startMinute === item.minute
      ) {
        current.items.push(item);
        current.endMinute = Math.max(current.endMinute, item.endMinute);
        return;
      }
      rows.push({
        id: item.id,
        startMinute: item.minute,
        endMinute: item.endMinute,
        gapMinutes: current ? Math.max(0, item.minute - current.endMinute) : 0,
        items: [item],
      });
    });

    return { rows };
  }, [accentColor, c.flexible, c.me, getAssigneeLabel, getEventColor, getOwnerLabel, localeTag, timedEvents, todos]);

  const { rows } = timeline;

  // Gemessene Zeilenpositionen (relativ zum Timeline-Container) für
  // Stundenlabels und die Jetzt-Linie.
  const [rowTops, setRowTops] = useState<Record<string, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  const [timelineHeight, setTimelineHeight] = useState(0);
  const onRowLayout = useCallback(
    (rowId: string) => (e: LayoutChangeEvent) => {
      const { y, height } = e.nativeEvent.layout;
      setRowTops((prev) => (prev[rowId] === y ? prev : { ...prev, [rowId]: y }));
      setRowHeights((prev) =>
        prev[rowId] === height ? prev : { ...prev, [rowId]: height },
      );
    },
    [],
  );

  const { hourLabels, showNowLine, nowTop } = useMemo(() => {
    const labels: { key: string; label: string; top: number }[] = [];
    let lastLabel = "";
    rows.forEach((row) => {
      const top = rowTops[row.id];
      if (top === undefined) return;
      const label = formatMinute(row.startMinute);
      if (label === lastLabel) return;
      lastLabel = label;
      labels.push({ key: row.id, label, top: top + ROW_LABEL_OFFSET });
    });

    const isToday = new Date().toDateString() === date.toDateString();
    const nowMinute = minutesFromMidnight(new Date());
    let nowY: number | null = null;
    if (isToday && rows.length > 0) {
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const top = rowTops[row.id];
        const height = rowHeights[row.id];
        if (top === undefined || height === undefined) continue;
        const next = rows[i + 1];
        const nextTop = next ? rowTops[next.id] : undefined;
        if (nowMinute >= row.startMinute && nowMinute < row.endMinute) {
          const ratio =
            (nowMinute - row.startMinute) /
            Math.max(1, row.endMinute - row.startMinute);
          nowY = top + height * ratio;
          break;
        }
        if (
          next &&
          nextTop !== undefined &&
          nowMinute >= row.endMinute &&
          nowMinute < next.startMinute
        ) {
          const ratio =
            (nowMinute - row.endMinute) /
            Math.max(1, next.startMinute - row.endMinute);
          nowY = top + height + (nextTop - top - height) * ratio;
          break;
        }
      }
    }
    return {
      hourLabels: labels,
      showNowLine: nowY !== null,
      nowTop: nowY ?? 0,
    };
  }, [date, rowHeights, rowTops, rows]);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      {allDayEvents.length > 0 && (
        <View style={styles.allDaySection}>
          <View style={styles.allDayHeader}>
            <ThemedText style={[styles.allDayLabel, { color: textSecondary }]}>
              {c.allDay}
            </ThemedText>
          </View>
          <View style={styles.allDayEventsContainer}>
            {allDayEvents.map((event) => {
              const ownerLabel = getOwnerLabel?.(event.userId);
              const assigneeLabel = getAssigneeLabel?.(
                event.assignee,
                event.babyId,
                event.userId,
              );
              const eventColor =
                getEventColor?.(
                  event.assignee,
                  event.babyId,
                  event.userId,
                  event.color,
                ) ?? accentColor;
              const metaLabel =
                assigneeLabel && assigneeLabel !== c.me
                  ? assigneeLabel
                  : ownerLabel && ownerLabel !== c.me
                    ? ownerLabel
                    : "";
              const metaSuffix = metaLabel ? ` · ${metaLabel}` : "";
              const locationSuffix = event.location
                ? ` · ${event.location}`
                : "";
              const subtitle = `${locationSuffix}${metaSuffix}`
                .replace(/^·\s*/, "")
                .trim();

              return (
                <TouchableOpacity
                  key={event.id}
                  activeOpacity={0.9}
                  onPress={readOnly ? undefined : () => onEditEvent?.(event.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.allDayEvent} ${event.title}${event.isRecurring ? `, ${c.recurring}` : ""}`}
                  style={styles.allDayEventCard}
                >
                  <BlurView
                    intensity={22}
                    tint={blurTint}
                    style={StyleSheet.absoluteFill}
                  />
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      styles.cardOverlay,
                      {
                        backgroundColor: isDark
                          ? toRgba(eventColor, 0.22)
                          : toRgba(eventColor, 0.14),
                        borderColor: isDark
                          ? toRgba(eventColor, 0.5)
                          : toRgba(eventColor, 0.34),
                      },
                    ]}
                  />
                  <View style={styles.allDayEventContent}>
                    <View
                      style={[
                        styles.allDayEventIcon,
                        {
                          backgroundColor: isDark
                            ? toRgba(eventColor, 0.28)
                            : toRgba(eventColor, 0.18),
                          borderColor: isDark
                            ? toRgba(eventColor, 0.56)
                            : toRgba(eventColor, 0.4),
                        },
                      ]}
                    >
                      <IconSymbol
                        name="calendar"
                        size={14}
                        color={(isDark ? "#fff" : textPrimary) as any}
                      />
                    </View>
                    <View style={styles.allDayEventBody}>
                      <View style={styles.recurringTitleRow}>
                        <ThemedText
                          style={[
                            styles.allDayEventTitle,
                            styles.recurringTitleText,
                            { color: textPrimary },
                          ]}
                          numberOfLines={1}
                        >
                          {event.title}
                        </ThemedText>
                        {event.isRecurring && (
                          <View
                            accessible={false}
                            importantForAccessibility="no-hide-descendants"
                          >
                            <IconSymbol
                              name="arrow.triangle.2.circlepath"
                              size={10}
                              color={textMuted as any}
                              style={styles.recurringIcon}
                            />
                          </View>
                        )}
                      </View>
                      {subtitle && (
                        <ThemedText
                          style={[
                            styles.allDayEventSubtitle,
                            { color: textMuted },
                          ]}
                          numberOfLines={1}
                        >
                          {subtitle}
                        </ThemedText>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
      <View
        style={styles.timeline}
        onLayout={(e) => setTimelineHeight(e.nativeEvent.layout.height)}
      >
        {hourLabels.map((label) => (
          <View
            key={label.key}
            style={[styles.hourLabel, { top: label.top }]}
          >
            <ThemedText
              style={[
                styles.hourText,
                {
                  color: textSecondary,
                  textShadowColor: isDark
                    ? "rgba(0,0,0,0.45)"
                    : "rgba(255,255,255,0.65)",
                },
              ]}
            >
              {label.label}
            </ThemedText>
          </View>
        ))}

        {rows.length > 0 && (
          <View
            style={[
              styles.line,
              {
                left: LINE_X,
                height: Math.max(0, timelineHeight - 20),
                borderColor: isDark
                  ? toRgba(accentColor, 0.36)
                  : "rgba(94,61,179,0.2)",
              },
            ]}
          />
        )}

        {showNowLine && (
          <View
            style={[
              styles.nowIndicator,
              { top: nowTop, backgroundColor: accentColor },
            ]}
          />
        )}

        <View style={styles.rows}>
          {rows.map((row) => {
            const totalColumns = row.items.length;
            const compact = totalColumns > 1;
            return (
              <View
                key={row.id}
                onLayout={onRowLayout(row.id)}
                style={[styles.row, { marginTop: rowGapPx(row.gapMinutes) }]}
              >
                {row.items.map((item) => {
                  if (item.kind === "event") {
                    return (
                      <View key={item.id} style={styles.itemWrap}>
                        <TouchableOpacity
                          activeOpacity={0.9}
                          onPress={
                            readOnly ? undefined : () => onEditEvent?.(item.id)
                          }
                          accessibilityRole="button"
                          accessibilityLabel={`${c.event} ${item.title}${item.isRecurring ? `, ${c.recurring}` : ""}`}
                          style={[
                            styles.eventCard,
                            compact && { paddingHorizontal: 10 },
                          ]}
                        >
                          <BlurView
                            intensity={20}
                            tint={blurTint}
                            style={StyleSheet.absoluteFill}
                          />
                          <View
                            style={[
                              StyleSheet.absoluteFill,
                              styles.cardOverlay,
                              {
                                backgroundColor: isDark
                                  ? toRgba(item.eventColor, 0.22)
                                  : toRgba(item.eventColor, 0.14),
                                borderColor: isDark
                                  ? toRgba(item.eventColor, 0.5)
                                  : toRgba(item.eventColor, 0.34),
                              },
                            ]}
                          />
                          <View style={[styles.cardRow, compact && { gap: 8 }]}>
                            <View
                              style={[
                                styles.cardIcon,
                                styles.cardIconEvent,
                                compact && { width: 30, height: 30 },
                                {
                                  backgroundColor: isDark
                                    ? toRgba(item.eventColor, 0.22)
                                    : toRgba(item.eventColor, 0.14),
                                  borderColor: isDark
                                    ? toRgba(item.eventColor, 0.6)
                                    : toRgba(item.eventColor, 0.5),
                                },
                              ]}
                            >
                              <IconSymbol
                                name="calendar"
                                size={compact ? 12 : 14}
                                color={(isDark ? "#fff" : textPrimary) as any}
                              />
                            </View>
                            <View style={styles.cardBody}>
                              <View style={styles.recurringTitleRow}>
                                <ThemedText
                                  style={[
                                    styles.itemTitle,
                                    styles.recurringTitleText,
                                    { color: textPrimary },
                                    compact && { fontSize: 14 },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {item.title}
                                </ThemedText>
                                {item.isRecurring && (
                                  <View
                                    accessible={false}
                                    importantForAccessibility="no-hide-descendants"
                                  >
                                    <IconSymbol
                                      name="arrow.triangle.2.circlepath"
                                      size={10}
                                      color={textMuted as any}
                                      style={styles.recurringIcon}
                                    />
                                  </View>
                                )}
                              </View>
                              <ThemedText
                                style={[
                                  styles.eventTime,
                                  { color: textMuted },
                                  compact && { fontSize: 10 },
                                ]}
                                numberOfLines={1}
                              >
                                {item.subtitle}
                              </ThemedText>
                            </View>
                          </View>
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  const iconName: IconSymbolName = item.completed
                    ? "checklist"
                    : item.assignee === "partner"
                      ? "person.2.fill"
                      : item.assignee === "family"
                        ? "house.fill"
                        : item.assignee === "child"
                          ? "heart.fill"
                          : "person.fill";
                  const todoAccent = item.todoColor;
                  const iconColor =
                    item.completed || item.assignee === "partner"
                      ? "#fff"
                      : todoAccent;
                  const iconWrapperStyle = item.completed
                    ? styles.cardIconDone
                    : item.assignee === "partner"
                      ? styles.cardIconPartner
                      : styles.cardIconMe;
                  const iconWrapperDynamic = item.completed
                    ? { backgroundColor: todoAccent, borderColor: todoAccent }
                    : item.assignee === "partner"
                      ? {
                          backgroundColor: toRgba(todoAccent, isDark ? 0.24 : 0.2),
                          borderColor: toRgba(todoAccent, isDark ? 0.48 : 0.55),
                        }
                      : {
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.12)"
                            : "#fff",
                          borderColor: toRgba(todoAccent, isDark ? 0.4 : 0.45),
                        };

                  // Nebeneinander wird das Icon ausgeblendet, damit Platz bleibt.
                  const showIcon = !compact;

                  return (
                    <View key={item.id} style={styles.itemWrap}>
                      <View style={styles.todoCard}>
                        <BlurView
                          intensity={18}
                          tint={blurTint}
                          style={StyleSheet.absoluteFill}
                        />
                        <View
                          style={[
                            StyleSheet.absoluteFill,
                            styles.cardOverlay,
                            {
                              backgroundColor: toRgba(
                                item.todoColor,
                                isDark ? 0.22 : 0.14,
                              ),
                              borderColor: toRgba(
                                item.todoColor,
                                isDark ? 0.5 : 0.34,
                              ),
                            },
                          ]}
                        />
                        <View style={[styles.cardRow, !showIcon && { gap: 0 }]}>
                          {showIcon && (
                            <View
                              style={[
                                styles.cardIcon,
                                iconWrapperStyle,
                                iconWrapperDynamic,
                              ]}
                            >
                              <IconSymbol
                                name={iconName}
                                size={14}
                                color={iconColor as any}
                              />
                            </View>
                          )}
                          <View style={styles.cardBody}>
                            <SwipeableListItem
                              id={item.id}
                              title={item.title}
                              type="todo"
                              completed={item.completed}
                              isRecurring={isRecurringId(item.id)}
                              accentColor={item.todoColor}
                              onComplete={
                                readOnly ? undefined : () => onToggleTodo(item.id)
                              }
                              onMoveTomorrow={
                                readOnly
                                  ? undefined
                                  : () => onMoveTomorrow(item.id)
                              }
                              onDelete={readOnly ? undefined : onDelete}
                              onPress={
                                readOnly ? undefined : () => onEditTodo?.(item.id)
                              }
                              onLongPress={readOnly ? () => {} : undefined}
                              showLeadingCheckbox={false}
                              trailingCheckbox
                              style={[
                                styles.todoContent,
                                !showIcon && { paddingLeft: 4, paddingRight: 0 },
                              ]}
                              subtitle={item.timeLabel}
                              titleStyle={
                                !showIcon
                                  ? { fontSize: 13, color: textPrimary }
                                  : { color: textPrimary }
                              }
                              subtitleStyle={
                                !showIcon
                                  ? { fontSize: 10, color: textSecondary }
                                  : { color: textSecondary }
                              }
                            />
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
        {rows.length === 0 && (
          <View style={styles.emptyState}>
            <BlurView
              intensity={18}
              tint={blurTint}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                styles.cardOverlay,
                { backgroundColor: glassOverlay, borderColor: glassBorder },
              ]}
            />
            <ThemedText style={[styles.emptyTitle, { color: textPrimary }]}>
              {c.empty}
            </ThemedText>
            <ThemedText style={[styles.emptySub, { color: textSecondary }]}>
              {c.emptySub}
            </ThemedText>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  allDaySection: {
    paddingHorizontal: LAYOUT_PAD,
    paddingTop: 8,
    paddingBottom: 16,
  },
  allDayHeader: {
    paddingLeft: 6,
    paddingBottom: 8,
  },
  allDayLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    opacity: 0.8,
  },
  allDayEventsContainer: {
    gap: 8,
  },
  allDayEventCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "transparent",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  allDayEventContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  allDayEventIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(94,61,179,0.1)",
    borderWidth: 1,
    borderColor: "rgba(94,61,179,0.3)",
  },
  allDayEventBody: {
    flex: 1,
  },
  recurringTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  recurringTitleText: {
    flexShrink: 1,
  },
  allDayEventTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  allDayEventSubtitle: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
    color: TEXT_PRIMARY,
  },
  timeline: {
    position: "relative",
    paddingLeft: LAYOUT_PAD,
    paddingRight: LAYOUT_PAD,
  },
  hourLabel: {
    position: "absolute",
    left: LAYOUT_PAD - 6,
    zIndex: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "transparent",
  },
  hourText: {
    fontSize: 11,
    opacity: 0.9,
    fontVariant: ["tabular-nums"] as any,
    color: TEXT_PRIMARY,
    fontWeight: "700",
    textShadowColor: "rgba(255,255,255,0.65)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  line: {
    position: "absolute",
    top: 20,
    borderLeftWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(94,61,179,0.2)",
    borderRadius: 1,
    zIndex: 1,
  },
  nowIndicator: {
    position: "absolute",
    left: LINE_X - 10,
    right: LAYOUT_PAD,
    height: 2,
    backgroundColor: PRIMARY,
    opacity: 0.75,
    borderRadius: 1,
  },
  rows: {
    paddingTop: 16,
    marginLeft: CARD_LEFT - LAYOUT_PAD,
    zIndex: 3,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 6,
  },
  itemWrap: {
    flex: 1,
    minWidth: 0,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.75)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardIconEvent: {
    backgroundColor: "#fff",
    borderColor: "rgba(94,61,179,0.45)",
  },
  cardIconMe: {
    backgroundColor: "#fff",
    borderColor: "rgba(94,61,179,0.45)",
  },
  cardIconPartner: {
    backgroundColor: "rgba(94,61,179,0.2)",
    borderColor: "rgba(94,61,179,0.55)",
  },
  cardIconDone: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  eventCard: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "transparent",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  eventTime: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
    fontVariant: ["tabular-nums"] as any,
    color: TEXT_PRIMARY,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  recurringIcon: {
    opacity: 0.7,
    marginLeft: 4,
  },
  todoCard: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "transparent",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  todoContent: {
    paddingVertical: 8,
    paddingLeft: 0,
    paddingRight: 0,
    flex: 1,
  },
  cardOverlay: {
    borderRadius: 20,
    borderWidth: 1,
  },
  emptyState: {
    marginLeft: CARD_LEFT - LAYOUT_PAD,
    borderRadius: 20,
    overflow: "hidden",
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  emptySub: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.7,
    color: TEXT_PRIMARY,
  },
});

export default StructuredTimeline;
