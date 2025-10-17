import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GlassCard } from '@/constants/DesignGuide';
import { ThemedText } from '@/components/ThemedText';
import { PlannerDaySummary } from '@/services/planner';
import { GLASS_BORDER, GLASS_OVERLAY, LAYOUT_PAD, PRIMARY, TEXT_PRIMARY } from '@/constants/PlannerDesign';

type Props = {
  summary: PlannerDaySummary;
};

export const TodayOverviewCard: React.FC<Props> = ({ summary }) => {
  const progress = summary.tasksTotal > 0 ? summary.tasksDone / summary.tasksTotal : 0;
  const progressPct = Math.round(progress * 100);
  return (
    <GlassCard style={styles.card} borderColor={GLASS_BORDER} overlayColor={GLASS_OVERLAY} intensity={26}>
      <View style={styles.row} accessible accessibilityRole="summary" accessibilityLabel={`Heute: ${summary.tasksDone} von ${summary.tasksTotal} Aufgaben, ${summary.eventsCount} Termine${summary.babySleepHours ? `, Levi hat ${summary.babySleepHours} Stunden geschlafen` : ''}.`}>
        <View style={styles.item}>
          <ThemedText style={styles.label} lightColor={TEXT_PRIMARY} darkColor={TEXT_PRIMARY}>Tasks</ThemedText>
          <ThemedText style={styles.value}>{summary.tasksDone}<ThemedText style={styles.slash}>/</ThemedText>{summary.tasksTotal}</ThemedText>
        </View>
        <View style={styles.item}>
          <ThemedText style={styles.label} lightColor={TEXT_PRIMARY} darkColor={TEXT_PRIMARY}>Termine</ThemedText>
          <ThemedText style={styles.value}>{summary.eventsCount}</ThemedText>
        </View>
        {summary.babySleepHours !== undefined && (
          <View style={styles.item}>
            <ThemedText style={styles.label} lightColor={TEXT_PRIMARY} darkColor={TEXT_PRIMARY}>Levi</ThemedText>
            <ThemedText style={styles.value}>{summary.babySleepHours} h</ThemedText>
          </View>
        )}
      </View>
      <View style={styles.progressBar} accessibilityLabel={`Fortschritt ${progressPct} Prozent`} accessibilityRole="progressbar">
        <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
      </View>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: LAYOUT_PAD,
    borderRadius: 26,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  item: { minWidth: 90 },
  label: { fontSize: 12, opacity: 0.7, color: TEXT_PRIMARY },
  value: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] as any, color: TEXT_PRIMARY },
  slash: { opacity: 0.6 },
  progressBar: {
    height: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.45)',
    overflow: 'hidden',
    marginTop: 14,
  },
  progressFill: {
    height: '100%',
    backgroundColor: PRIMARY,
  },
});

export default TodayOverviewCard;
