import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LiquidGlassCard } from '@/constants/DesignGuide';
import { PlannerBlock, PlannerEvent, PlannerTodo } from '@/services/planner';
import { ThemedText } from '@/components/ThemedText';
import SwipeableListItem from './SwipeableListItem';
import { GLASS_BORDER, GLASS_OVERLAY, LAYOUT_PAD, PRIMARY, TEXT_PRIMARY } from '@/constants/PlannerDesign';
import { parseSafeDate } from '@/lib/safeDate';
import { useLocale } from '@/contexts/LocaleContext';

type Props = {
  block: PlannerBlock;
  initiallyCollapsed?: boolean;
  onToggleTodo: (id: string) => void;
  onMoveTomorrow: (id: string) => void;
};

export const TimeBlockCard: React.FC<Props> = ({ block, initiallyCollapsed = true, onToggleTodo, onMoveTomorrow }) => {
  const { locale, localeTag } = useLocale();
  const c = {
    de: { block: 'Zeitblock', collapse: 'Einklappen', expand: 'Aufklappen', hint: 'Tippen zum Auf- oder Zuklappen', done: 'erledigt', events: 'Termine', empty: 'Noch nichts geplant. Tippe auf +, um etwas hinzuzufügen.', timeOpen: 'Zeit offen' },
    en: { block: 'Time block', collapse: 'Collapse', expand: 'Expand', hint: 'Tap to expand or collapse', done: 'completed', events: 'appointments', empty: 'Nothing planned yet. Tap + to add something.', timeOpen: 'Time open' },
    es: { block: 'Bloque horario', collapse: 'Contraer', expand: 'Desplegar', hint: 'Toca para desplegar o contraer', done: 'completadas', events: 'citas', empty: 'Aún no hay nada planeado. Toca + para añadir algo.', timeOpen: 'Hora abierta' },
  }[locale];
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
      <View style={styles.header} accessible accessibilityRole="button" accessibilityLabel={`${c.block} ${block.label}. ${open ? c.collapse : c.expand}.`} accessibilityHint={c.hint}>
        <ThemedText style={styles.title}>{block.label}</ThemedText>
        <ThemedText style={styles.meta} lightColor={TEXT_PRIMARY} darkColor={TEXT_PRIMARY}>
          {todos.length > 0 ? `${todos.filter(t => t.completed).length}/${todos.length} ${c.done}` : `${events.length} ${c.events}`}
        </ThemedText>
      </View>
      {open ? (
        <View style={styles.content}>
          {block.items.length === 0 ? (
            <ThemedText style={styles.empty} lightColor={TEXT_PRIMARY} darkColor={TEXT_PRIMARY}>{c.empty}</ThemedText>
          ) : (
            <View>
              {block.items.map((item) => {
                const isTodo = 'completed' in item;
                const eventStart = !isTodo ? parseSafeDate((item as PlannerEvent).start) : null;
                const eventEnd = !isTodo ? parseSafeDate((item as PlannerEvent).end) : null;
                const eventTimeLabel =
                  eventStart && eventEnd
                    ? `${eventStart.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' })} – ${eventEnd.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' })}`
                    : c.timeOpen;
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
            <ThemedText style={styles.collapsedText}>+{completedCount} {c.done}</ThemedText>
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
