import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

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
  const missionText =
    summary.tasksTotal === 0
      ? 'Keine Aufgaben – genieße den Tag!'
      : `Du bist heute schon bei ${summary.tasksDone}/${summary.tasksTotal} Aufgaben – weiter so!`;
  return (
    <GlassCard style={styles.card} borderColor={GLASS_BORDER} overlayColor={GLASS_OVERLAY} intensity={30}>
      <LinearGradient
        colors={['rgba(142,78,198,0.16)', 'rgba(255,255,255,0.08)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.headerRow} accessibilityRole="summary" accessibilityLabel={`Heute: ${summary.tasksDone} von ${summary.tasksTotal} Aufgaben, ${summary.eventsCount} Termine${summary.babySleepHours ? `, Levi hat ${summary.babySleepHours} Stunden geschlafen` : ''}.`}>
        <View style={styles.avatar}>
          <Text style={styles.avatarEmoji}>🧸</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <ThemedText style={styles.title}>Tagesmission</ThemedText>
          <ThemedText style={styles.subtitle}>{missionText}</ThemedText>
        </View>
      </View>

      <View style={styles.progressWrap} accessibilityLabel={`Fortschritt ${progressPct} Prozent`} accessibilityRole="progressbar">
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
        <Text style={styles.progressText}>{progressPct}%</Text>
      </View>

      <View style={styles.statRow}>
        <StatChip label="Aufgaben" value={`${summary.tasksDone}/${summary.tasksTotal}`} />
        <StatChip label="Termine" value={`${summary.eventsCount}`} />
        {summary.babySleepHours !== undefined && <StatChip label="Levi" value={`${summary.babySleepHours}h`} />}
      </View>
    </GlassCard>
  );
};

const StatChip: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.statChip}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    padding: LAYOUT_PAD,
    borderRadius: 28,
    overflow: 'hidden',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  avatarEmoji: {
    fontSize: 28,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: TEXT_PRIMARY,
    opacity: 0.85,
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: PRIMARY,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    minWidth: 46,
    textAlign: 'right',
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statChip: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
  },
  statLabel: { fontSize: 11, color: TEXT_PRIMARY, opacity: 0.7 },
  statValue: { fontSize: 15, fontWeight: '800', color: TEXT_PRIMARY, marginTop: 2 },
});

export default TodayOverviewCard;
