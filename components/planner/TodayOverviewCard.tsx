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
  LAYOUT_PAD,
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
  const missionText =
    summary.tasksTotal === 0
      ? "Keine Aufgaben – genieße den Tag!"
      : `Du bist heute schon bei ${summary.tasksDone}/${summary.tasksTotal} Aufgaben – weiter so!`;
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
        style={styles.headerRow}
        accessibilityRole="summary"
        accessibilityLabel={`Heute: ${summary.tasksDone} von ${summary.tasksTotal} Aufgaben, ${summary.eventsCount} Termine${summary.babySleepHours ? `, Levi hat ${summary.babySleepHours} Stunden geschlafen` : ""}.`}
      >
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.12)"
                : "rgba(255,255,255,0.85)",
              borderColor: isDark
                ? "rgba(255,255,255,0.2)"
                : "rgba(255,255,255,0.7)",
            },
          ]}
        >
          <Text style={styles.avatarEmoji}>🧸</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <ThemedText style={[styles.title, { color: textPrimary }]}>
            Tagesmission
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: textSecondary }]}>
            {missionText}
          </ThemedText>
        </View>
      </View>

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
        <Text style={[styles.progressText, { color: textPrimary }]}>
          {progressPct}%
        </Text>
      </View>

      <View style={styles.statRow}>
        <StatChip
          label="Aufgaben"
          value={`${summary.tasksDone}/${summary.tasksTotal}`}
          isDark={isDark}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
        />
        <StatChip
          label="Termine"
          value={`${summary.eventsCount}`}
          isDark={isDark}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
        />
        {summary.babySleepHours !== undefined && (
          <StatChip
            label="Levi"
            value={`${summary.babySleepHours}h`}
            isDark={isDark}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
          />
        )}
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
    padding: LAYOUT_PAD,
    borderRadius: 28,
    overflow: "hidden",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
  },
  avatarEmoji: {
    fontSize: 28,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: TEXT_PRIMARY,
    opacity: 0.85,
  },
  progressWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: PRIMARY,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    minWidth: 46,
    textAlign: "right",
  },
  statRow: {
    flexDirection: "row",
    gap: 10,
  },
  statChip: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
  },
  statLabel: { fontSize: 11, color: TEXT_PRIMARY, opacity: 0.7 },
  statValue: {
    fontSize: 15,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    marginTop: 2,
  },
});

export default TodayOverviewCard;
