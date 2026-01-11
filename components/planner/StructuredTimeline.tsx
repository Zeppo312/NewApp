import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';

import { PlannerAssignee, PlannerEvent, PlannerTodo } from '@/services/planner';
import { LAYOUT_PAD, PRIMARY, GLASS_BORDER, GLASS_OVERLAY, TEXT_PRIMARY } from '@/constants/PlannerDesign';
import { ThemedText } from '@/components/ThemedText';
import { SwipeableListItem } from './SwipeableListItem';
import { IconSymbol, type IconSymbolName } from '@/components/ui/IconSymbol';

type Props = {
  date: Date;
  events: PlannerEvent[];
  todos: PlannerTodo[];
  getOwnerLabel?: (ownerId?: string) => string | undefined;
  getAssigneeLabel?: (assignee?: PlannerAssignee, babyId?: string, ownerId?: string) => string | undefined;
  readOnly?: boolean;
  onToggleTodo: (id: string) => void;
  onMoveTomorrow: (id: string) => void;
  onDelete?: (id: string) => void;
  onEditTodo?: (id: string) => void;
  onEditEvent?: (id: string) => void;
};

type TimelineEvent = {
  kind: 'event';
  id: string;
  title: string;
  subtitle: string;
  minute: number;
};

type TimelineTodo = {
  kind: 'todo';
  id: string;
  title: string;
  completed: boolean;
  minute: number;
  timeLabel: string;
  assignee: PlannerAssignee;
};

type TimelineItem = TimelineEvent | TimelineTodo;

const LINE_X = LAYOUT_PAD + 36;
const CARD_LEFT = LINE_X + 28;
const PX_PER_MIN = 1.35;
const MIN_GAP_PX = 60;
const MAX_GAP_PX = 160;
const CARD_VERTICAL_OFFSET = 30;

function minutesFromMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function parseISO(iso?: string) {
  if (!iso) return undefined;
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}

export const StructuredTimeline: React.FC<Props> = ({
  date,
  events,
  todos,
  getOwnerLabel,
  getAssigneeLabel,
  readOnly = false,
  onToggleTodo,
  onMoveTomorrow,
  onDelete,
  onEditTodo,
  onEditEvent,
}) => {
  const timeline = useMemo(() => {
    const entries: TimelineItem[] = [];
    const minutesSet = new Set<number>();
    const fallbackBase = 13 * 60;
    let floatingIndex = 0;

    events.forEach((event) => {
      const start = new Date(event.start);
      const end = new Date(event.end);
      const startMinute = minutesFromMidnight(start);
      const endMinute = Math.max(startMinute + 30, minutesFromMidnight(end));
      const ownerLabel = getOwnerLabel?.(event.userId);
      const assigneeLabel = getAssigneeLabel?.(event.assignee, event.babyId, event.userId);
      const metaLabel =
        assigneeLabel && assigneeLabel !== 'Ich'
          ? assigneeLabel
          : ownerLabel && ownerLabel !== 'Ich'
          ? ownerLabel
          : '';
      const metaSuffix = metaLabel ? ` · ${metaLabel}` : '';
      const locationSuffix = event.location ? ` · ${event.location}` : '';
      entries.push({
        kind: 'event',
        id: event.id,
        title: event.title,
        subtitle: `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${locationSuffix}${metaSuffix}`,
        minute: startMinute,
      });
      minutesSet.add(startMinute);
      minutesSet.add(endMinute);
    });

    todos.forEach((todo) => {
      const dueDate = parseISO(todo.dueAt);
      const dueMinute = dueDate ? minutesFromMidnight(dueDate) : fallbackBase + floatingIndex * 25;
      if (!dueDate) floatingIndex += 1;
      const ownerLabel = getOwnerLabel?.(todo.userId);
      const assigneeLabel = getAssigneeLabel?.(todo.assignee, todo.babyId, todo.userId);
      const metaLabel =
        assigneeLabel && assigneeLabel !== 'Ich'
          ? assigneeLabel
          : ownerLabel && ownerLabel !== 'Ich'
          ? ownerLabel
          : '';
      const metaSuffix = metaLabel ? ` · ${metaLabel}` : '';
      const timeLabel = `${dueDate ? dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Flexibel'}${metaSuffix}`;
      entries.push({
        kind: 'todo',
        id: todo.id,
        title: todo.title,
        completed: todo.completed,
        minute: dueMinute,
        timeLabel,
        assignee: todo.assignee ?? 'me',
      });
      minutesSet.add(dueMinute);
    });

    entries.sort((a, b) => a.minute - b.minute);

    if (entries.length === 0) {
      return {
        items: [] as TimelineItem[],
        positionFor: (minute: number) => minute * PX_PER_MIN,
        contentHeight: 200,
        hourLabels: [] as { label: string; top: number }[],
        showNowLine: false,
        nowTop: 0,
      };
    }

    const minutes = Array.from(minutesSet).sort((a, b) => a - b);
    const positions = new Map<number, number>();
    let currentY = 0;
    let previousMinute = minutes[0];
    positions.set(previousMinute, currentY);

    minutes.slice(1).forEach((minute) => {
      const deltaMinutes = minute - previousMinute;
      const deltaPx = Math.min(Math.max(deltaMinutes * PX_PER_MIN, MIN_GAP_PX), MAX_GAP_PX);
      currentY += deltaPx;
      positions.set(minute, currentY);
      previousMinute = minute;
    });

    const positionFor = (minute: number) => {
      if (positions.has(minute)) return positions.get(minute)!;
      const sorted = minutes;
      if (minute <= sorted[0]) return positions.get(sorted[0])! - (sorted[0] - minute) * PX_PER_MIN;
      if (minute >= sorted[sorted.length - 1])
        return positions.get(sorted[sorted.length - 1])! + (minute - sorted[sorted.length - 1]) * PX_PER_MIN;

      let lowerIndex = 0;
      while (lowerIndex + 1 < sorted.length && sorted[lowerIndex + 1] < minute) lowerIndex += 1;
      const lowerMinute = sorted[lowerIndex];
      const upperMinute = sorted[lowerIndex + 1];
      const lowerPos = positions.get(lowerMinute)!;
      const upperPos = positions.get(upperMinute)!;
      const ratio = (minute - lowerMinute) / (upperMinute - lowerMinute || 1);
      return lowerPos + (upperPos - lowerPos) * ratio;
    };

    const contentHeight = positionFor(minutes[minutes.length - 1]) + CARD_VERTICAL_OFFSET + 80;

    const hourLabels: { label: string; top: number }[] = [];
    const startHour = Math.floor(minutes[0] / 60);
    const endHour = Math.ceil(minutes[minutes.length - 1] / 60);
    for (let hour = startHour; hour <= endHour; hour += 1) {
      const minute = hour * 60;
      const top = positionFor(minute) - 10;
      hourLabels.push({ label: `${String(hour).padStart(2, '0')}:00`, top });
    }

    const isToday = new Date().toDateString() === date.toDateString();
    const nowMinute = minutesFromMidnight(new Date());
    const showNowLine = isToday && nowMinute >= minutes[0] && nowMinute <= minutes[minutes.length - 1];
    const nowTop = positionFor(nowMinute);

    return {
      items: entries,
      positionFor,
      contentHeight,
      hourLabels,
      showNowLine,
      nowTop,
    };
  }, [date, events, todos, getOwnerLabel, getAssigneeLabel]);

  const { items, positionFor, contentHeight, hourLabels, showNowLine, nowTop } = timeline;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      <View style={[styles.timeline, { minHeight: contentHeight }]}> 
        {hourLabels.map((label) => (
          <View key={label.label} style={[styles.hourLabel, { top: label.top }]}> 
            <ThemedText style={styles.hourText}>{label.label}</ThemedText>
          </View>
        ))}

        <View style={[styles.line, { left: LINE_X, height: contentHeight }]} />

        {showNowLine && <View style={[styles.nowIndicator, { top: nowTop }]} />}

        {items.map((item) => {
          if (item.kind === 'event') {
            const top = Math.max(0, positionFor(item.minute) - CARD_VERTICAL_OFFSET);
            return (
              <View key={item.id} style={[styles.itemWrap, { top }]}> 
                <View style={styles.node} />
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={readOnly ? undefined : () => onEditEvent?.(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Termin ${item.title}`}
                  style={styles.eventCard}
                >
                  <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                  <View
                    style={[StyleSheet.absoluteFill, styles.cardOverlay, { backgroundColor: GLASS_OVERLAY, borderColor: GLASS_BORDER }]}
                  />
                  <View style={styles.cardRow}>
                    <View style={[styles.cardIcon, styles.cardIconEvent]}>
                      <IconSymbol name="calendar" size={14} color={PRIMARY as any} />
                    </View>
                    <View style={styles.cardBody}>
                      <ThemedText style={styles.eventTime}>{item.subtitle}</ThemedText>
                      <ThemedText style={styles.itemTitle}>{item.title}</ThemedText>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            );
          }

          const top = Math.max(0, positionFor(item.minute) - CARD_VERTICAL_OFFSET);
          const iconName: IconSymbolName = item.completed
            ? 'checklist'
            : item.assignee === 'partner'
            ? 'person.2.fill'
            : item.assignee === 'family'
            ? 'house.fill'
            : item.assignee === 'child'
            ? 'heart.fill'
            : 'person.fill';
          const iconColor = item.completed || item.assignee === 'partner' ? '#fff' : PRIMARY;
          const iconWrapperStyle = item.completed
            ? styles.cardIconDone
            : item.assignee === 'partner'
            ? styles.cardIconPartner
            : styles.cardIconMe;

          return (
            <View key={item.id} style={[styles.itemWrap, { top }]}> 
              <View style={styles.node} />
              <View style={styles.todoCard}>
                <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
                <View
                  style={[StyleSheet.absoluteFill, styles.cardOverlay, { backgroundColor: GLASS_OVERLAY, borderColor: GLASS_BORDER }]}
                />
                <View style={styles.cardRow}>
                  <View style={[styles.cardIcon, iconWrapperStyle]}>
                    <IconSymbol name={iconName} size={14} color={iconColor as any} />
                  </View>
                  <View style={styles.cardBody}>
                    <SwipeableListItem
                      id={item.id}
                      title={item.title}
                      type="todo"
                      completed={item.completed}
                      onComplete={readOnly ? undefined : () => onToggleTodo(item.id)}
                      onMoveTomorrow={readOnly ? undefined : () => onMoveTomorrow(item.id)}
                      onDelete={readOnly ? undefined : onDelete}
                      onPress={readOnly ? undefined : () => onEditTodo?.(item.id)}
                      onLongPress={readOnly ? () => {} : undefined}
                      showLeadingCheckbox={false}
                      trailingCheckbox
                      style={styles.todoContent}
                      subtitle={item.timeLabel}
                    />
                  </View>
                </View>
              </View>
            </View>
          );
        })}

        {items.length === 0 && (
          <View style={[styles.emptyState, { top: 0 }] }>
            <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
            <View
              style={[StyleSheet.absoluteFill, styles.cardOverlay, { backgroundColor: GLASS_OVERLAY, borderColor: GLASS_BORDER }]}
            />
            <ThemedText style={styles.emptyTitle}>Noch nichts geplant</ThemedText>
            <ThemedText style={styles.emptySub}>Tippe auf +, um deinen Tag zu füllen.</ThemedText>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  timeline: {
    position: 'relative',
    paddingLeft: LAYOUT_PAD,
    paddingRight: LAYOUT_PAD,
    paddingTop: 16,
  },
  hourLabel: {
    position: 'absolute',
    left: LAYOUT_PAD - 6,
    zIndex: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'transparent',
  },
  hourText: {
    fontSize: 11,
    opacity: 0.9,
    fontVariant: ['tabular-nums'] as any,
    color: TEXT_PRIMARY,
    fontWeight: '700',
    textShadowColor: 'rgba(255,255,255,0.65)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  line: {
    position: 'absolute',
    top: 20,
    borderLeftWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(94,61,179,0.2)',
    borderRadius: 1,
    zIndex: 1,
  },
  nowIndicator: {
    position: 'absolute',
    left: LINE_X - 10,
    right: LAYOUT_PAD,
    height: 2,
    backgroundColor: PRIMARY,
    opacity: 0.75,
    borderRadius: 1,
  },
  itemWrap: {
    position: 'absolute',
    left: CARD_LEFT,
    right: LAYOUT_PAD,
    zIndex: 3,
  },
  node: {
    position: 'absolute',
    left: LINE_X - 1,
    top: CARD_VERTICAL_OFFSET - 1,
    width: 2,
    height: 2,
    backgroundColor: 'transparent',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardIconEvent: {
    backgroundColor: '#fff',
    borderColor: 'rgba(94,61,179,0.45)',
  },
  cardIconMe: {
    backgroundColor: '#fff',
    borderColor: 'rgba(94,61,179,0.45)',
  },
  cardIconPartner: {
    backgroundColor: 'rgba(94,61,179,0.2)',
    borderColor: 'rgba(94,61,179,0.55)',
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
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  eventTime: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
    fontVariant: ['tabular-nums'] as any,
    color: TEXT_PRIMARY,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  todoCard: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    shadowColor: '#000',
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
    position: 'absolute',
    left: CARD_LEFT,
    right: LAYOUT_PAD,
    borderRadius: 20,
    overflow: 'hidden',
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
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
