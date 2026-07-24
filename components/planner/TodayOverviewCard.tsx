import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { GlassCard } from "@/constants/DesignGuide";
import { ThemedText } from "@/components/ThemedText";
import { PlannerDaySummary } from "@/services/planner";
import { Colors } from "@/constants/Colors";
import { useAdaptiveColors } from "@/hooks/useAdaptiveColors";
import {
  GLASS_BORDER,
  GLASS_OVERLAY,
  PRIMARY,
  TEXT_PRIMARY,
} from "@/constants/PlannerDesign";

type Props = {
  summary: PlannerDaySummary;
};

export const TodayOverviewCard: React.FC<Props> = ({ summary }) => {
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === "dark" ||
    adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : TEXT_PRIMARY;
  const textSecondary = isDark ? Colors.dark.textSecondary : TEXT_PRIMARY;
  const accentColor = isDark ? adaptiveColors.accent : PRIMARY;
  const glassOverlay = isDark ? "rgba(0,0,0,0.35)" : GLASS_OVERLAY;
  const glassBorder = isDark ? "rgba(255,255,255,0.24)" : GLASS_BORDER;

  const progress =
    summary.tasksTotal > 0 ? summary.tasksDone / summary.tasksTotal : 0;
  const progressPct = Math.round(progress * 100);
  const openTasks = Math.max(summary.tasksTotal - summary.tasksDone, 0);
  const progressText =
    summary.tasksTotal === 0
      ? "Keine Aufgaben"
      : `${summary.tasksDone}/${summary.tasksTotal} erledigt`;

  const stats = [
    {
      label: "Offen",
      value: `${openTasks}`,
    },
    {
      label: "Termine",
      value: `${summary.eventsCount}`,
    },
    ...(summary.babySleepHours !== undefined
      ? [
          {
            label: "Schlaf",
            value: `${summary.babySleepHours}h`,
          },
        ]
      : []),
  ];

  return (
    <GlassCard
      style={styles.card}
      borderColor={glassBorder}
      overlayColor={glassOverlay}
      intensity={30}
    >
      <LinearGradient
        colors={
          isDark
            ? ["rgba(233,201,182,0.22)", "rgba(255,255,255,0.04)"]
            : ["rgba(142,78,198,0.16)", "rgba(255,255,255,0.08)"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={styles.contentRow}
        accessibilityRole="summary"
        accessibilityLabel={`Heute: ${summary.tasksDone} von ${summary.tasksTotal} Aufgaben erledigt, ${openTasks} offen, ${summary.eventsCount} Termine${summary.babySleepHours ? `, ${summary.babySleepHours} Stunden Schlaf` : ""}.`}
      >
        <View style={styles.progressColumn}>
          <View style={styles.titleRow}>
            <ThemedText style={[styles.title, { color: textPrimary }]}>
              Tagesübersicht
            </ThemedText>
            <Text style={[styles.progressText, { color: textPrimary }]}>
              {progressPct}%
            </Text>
          </View>
          <Text style={[styles.subtitle, { color: textSecondary }]}>
            {progressText}
          </Text>
          <View
            style={styles.progressWrap}
            accessibilityLabel={`Fortschritt ${progressPct} Prozent`}
            accessibilityRole="progressbar"
          >
            <View
              style={[
                styles.progressBar,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.14)"
                    : "rgba(255,255,255,0.35)",
                },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  { width: `${progressPct}%`, backgroundColor: accentColor },
                ]}
              />
            </View>
          </View>
        </View>

        <View style={styles.statRow}>
          {stats.map((stat) => (
            <StatChip
              key={stat.label}
              label={stat.label}
              value={stat.value}
              isDark={isDark}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
            />
          ))}
        </View>
      </View>
    </GlassCard>
  );
};

const StatChip: React.FC<{
  label: string;
  value: string;
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
}> = ({ label, value, isDark, textPrimary, textSecondary }) => (
  <View
    style={[
      styles.statChip,
      {
        backgroundColor: isDark
          ? "rgba(255,255,255,0.1)"
          : "rgba(255,255,255,0.6)",
        borderColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.6)",
      },
    ]}
  >
    <Text style={[styles.statLabel, { color: textSecondary }]}>{label}</Text>
    <Text style={[styles.statValue, { color: textPrimary }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressColumn: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  subtitle: {
    fontSize: 12,
    color: TEXT_PRIMARY,
    opacity: 0.78,
  },
  progressWrap: {
    width: "100%",
  },
  progressBar: {
    height: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: PRIMARY,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    minWidth: 40,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  statRow: {
    flexDirection: "row",
    gap: 6,
    flexShrink: 0,
  },
  statChip: {
    minWidth: 54,
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 8,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
  },
  statLabel: { fontSize: 10, color: TEXT_PRIMARY, opacity: 0.7 },
  statValue: {
    fontSize: 14,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    marginTop: 1,
    fontVariant: ["tabular-nums"],
  },
});

export default TodayOverviewCard;
