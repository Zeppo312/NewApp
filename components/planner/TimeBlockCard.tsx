import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LiquidGlassCard } from '@/constants/DesignGuide';
import { PlannerBlock, PlannerEvent, PlannerTodo } from '@/services/planner';
import { ThemedText } from '@/components/ThemedText';
import SwipeableListItem from './SwipeableListItem';
import { GLASS_BORDER, GLASS_OVERLAY, LAYOUT_PAD, PRIMARY, TEXT_PRIMARY } from '@/constants/PlannerDesign';
import { parseSafeDate } from '@/lib/safeDate';

type Props = {
  block: PlannerBlock;
  initiallyCollapsed?: boolean;
  onToggleTodo: (id: string) => void;
  onMoveTomorrow: (id: string) => void;
};

export const TimeBlockCard: React.FC<Props> = ({ block, initiallyCollapsed = true, onToggleTodo, onMoveTomorrow }) => {
  const [open, setOpen] = useState(!initiallyCollapsed);

  const { todos, events, completedCount } = useMemo(() => {
    const todos = block.items.filter((x): x is PlannerTodo => 'completed' in x);
    const events = block.items.filter((x): x is PlannerEvent => 'start' in x && 'end' in x);
    const completedCount = todos.filter((t) => t.completed).length;
    return { todos, events, completedCount };
  }, [block.items]);

  return (
    <LiquidGlassCard
      style={styles.card}
      overlayColor={GLASS_OVERLAY}
      borderColor={GLASS_BORDER}
      intensity={22}
      onPress={() => setOpen((v) => !v)}
      activeOpacity={0.95}
    >
      <View style={styles.header} accessible accessibilityRole="button" accessibilityLabel={`Zeitblock ${block.label}. ${open ? 'Einklappen' : 'Aufklappen'}.`} accessibilityHint="Tippen zum Auf- oder Zuklappen">
        <ThemedText style={styles.title}>{block.label}</ThemedText>
        <ThemedText style={styles.meta} lightColor={TEXT_PRIMARY} darkColor={TEXT_PRIMARY}>
          {todos.length > 0 ? `${todos.filter(t => t.completed).length}/${todos.length} erledigt` : `${events.length} Termine`}
        </ThemedText>
      </View>
      {open ? (
        <View style={styles.content}>
          {block.items.length === 0 ? (
            <ThemedText style={styles.empty} lightColor={TEXT_PRIMARY} darkColor={TEXT_PRIMARY}>Noch nichts geplant. Tippe auf +, um etwas hinzuzufügen.</ThemedText>
          ) : (
            <View>
              {block.items.map((item) => {
                const isTodo = 'completed' in item;
                const eventStart = !isTodo ? parseSafeDate((item as PlannerEvent).start) : null;
                const eventEnd = !isTodo ? parseSafeDate((item as PlannerEvent).end) : null;
                const eventTimeLabel =
                  eventStart && eventEnd
                    ? `${eventStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${eventEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Zeit offen';
                return (
                  <SwipeableListItem
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    type={isTodo ? 'todo' : 'event'}
                    subtitle={!isTodo ? `${eventTimeLabel}${(item as PlannerEvent).location ? ` · ${(item as PlannerEvent).location}` : ''}` : undefined}
                    completed={isTodo ? (item as PlannerTodo).completed : undefined}
                    onComplete={(id) => onToggleTodo(id)}
                    onMoveTomorrow={(id) => onMoveTomorrow(id)}
                  />
                );
              })}
            </View>
          )}
        </View>
      ) : (
        completedCount > 0 ? (
          <View style={styles.collapsedInfo}>
            <ThemedText style={styles.collapsedText}>+{completedCount} erledigt</ThemedText>
          </View>
        ) : null
      )}
    </LiquidGlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 12,
  },
  header: {
    paddingHorizontal: LAYOUT_PAD,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  title: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 12, opacity: 0.8 },
  content: { paddingHorizontal: LAYOUT_PAD, paddingBottom: 12 },
  collapsedInfo: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 12,
  },
  collapsedText: { fontSize: 12, color: PRIMARY, fontWeight: '600' },
  empty: { fontSize: 14, opacity: 0.8, paddingVertical: 6 },
});

export default TimeBlockCard;
