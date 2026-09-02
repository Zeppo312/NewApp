import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { DailyEntry } from '@/lib/baby';
import { Swipeable } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useLocale } from '@/contexts/LocaleContext';
import { getDailyLocaleTag, translateDailyText } from '@/lib/dailyTranslations';

interface ActivityCardProps {
  entry: DailyEntry;
  onDelete: (id: string) => void;
  onEdit?: (entry: DailyEntry) => void;
  marginHorizontal?: number;
  auxiliaryBadgeLabel?: string | null;
}

const ActivityCard: React.FC<ActivityCardProps> = ({
  entry,
  onDelete,
  onEdit,
  marginHorizontal = 16,
  auxiliaryBadgeLabel = null,
}) => {
  const { locale } = useLocale();
  const t = (key: Parameters<typeof translateDailyText>[1]) => translateDailyText(locale, key);
  const localeTag = getDailyLocaleTag(locale);
  // Adaptive Farben für Dark Mode (basierend auf Hintergrundbild-Einstellung)
  const adaptiveColors = useAdaptiveColors();
  const colorScheme = adaptiveColors.effectiveScheme;
  const theme = Colors[colorScheme];
  const isDark = colorScheme === 'dark' || adaptiveColors.isDarkBackground;
  // Im Dark Mode alle Texte hell/weiß
  const textColor = isDark ? Colors.dark.textPrimary : '#7D5A50';
  const secondaryTextColor = isDark ? Colors.dark.textSecondary : '#333';
  const tertiaryTextColor = isDark ? Colors.dark.textTertiary : '#666666';
  const badgeTextColor = isDark ? Colors.dark.textPrimary : '#5E3DB3';
  const [expanded, setExpanded] = useState(false);
  const [pressed, setPressed] = useState(false);

  // Animationen
  const expandAnimation = React.useState(() => new Animated.Value(0))[0];
  const pressAnimation = React.useState(() => new Animated.Value(1))[0];

  // Effekt für die Expand-Animation
  useEffect(() => {
    Animated.timing(expandAnimation, {
      toValue: expanded ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [expanded]);

  // Effekt für die Press-Animation
  useEffect(() => {
    if (pressed) {
      Animated.timing(pressAnimation, {
        toValue: 0.98,
        duration: 100,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(pressAnimation, {
        toValue: 1,
        duration: 200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [pressed]);

  // Formatiere Zeit
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' });
  };

  // Berechne Dauer in Minuten
  const calculateDuration = (startTime: string, endTime?: string) => {
    if (!endTime) return 0;

    const start = new Date(startTime);
    const end = new Date(endTime);

    return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  };

  // Rendere Icon/Label basierend auf detailliertem Typ
  const getDetail = () => {
    // Falls Custom-Label/Emoji gesetzt sind (z. B. für Gewicht), verwende diese
    const customEmoji = entry.custom_emoji ?? (entry as any).emoji;
    const customLabel = entry.custom_name ?? (entry as any).label;
    if (customEmoji && customLabel) {
      return { emoji: customEmoji, label: customLabel };
    }
    if (entry.entry_type === 'feeding') {
      if (entry.feeding_type === 'BREAST') return { emoji: '🤱', label: t('feeding.breast') };
      if (entry.feeding_type === 'BOTTLE') return { emoji: '🍼', label: `${t('card.bottle')}${entry.feeding_volume_ml ? ` ${entry.feeding_volume_ml}ml` : ''}` };
      if (entry.feeding_type === 'PUMP') return { emoji: '🥛', label: `${t('feeding.pump')}${entry.feeding_volume_ml ? ` ${entry.feeding_volume_ml}ml` : ''}` };
      if (entry.feeding_type === 'WATER') return { emoji: '🚰', label: `${t('feeding.water')}${entry.feeding_volume_ml ? ` ${entry.feeding_volume_ml}ml` : ''}` };
      return { emoji: '🥄', label: t('feeding.solids') };
    }
    if (entry.entry_type === 'diaper') {
      if (entry.diaper_type === 'WET') return { emoji: '💧', label: t('diaper.wet') };
      if (entry.diaper_type === 'DIRTY') return { emoji: '💩', label: t('diaper.dirty') };
      return { emoji: '💧💩', label: t('diaper.both') };
    }
    if (entry.entry_type === 'sleep') {
      // Verwende die bereits berechneten Werte aus dem Sleep-Tracker
      if (customEmoji && customLabel) {
        return { emoji: customEmoji, label: customLabel };
      }
      // Fallback falls die Werte nicht gesetzt sind
      return { emoji: '💤', label: t('card.sleep') };
    }
    return { emoji: '⭐️', label: t('card.other') };
  };

  // Rendere Aktivitätstyp als Text
  const detail = getDetail();

  const translateFeedingType = (typeCode?: string | null) => {
    switch (typeCode) {
      case 'BREAST':
        return t('card.breast');
      case 'BOTTLE':
        return t('card.bottle');
      case 'SOLIDS':
        return t('feeding.solids');
      case 'PUMP':
        return t('feeding.pump');
      case 'WATER':
        return t('feeding.water');
      default:
        return '–';
    }
  };

  const translateFeedingSide = (s?: string | null) => {
    switch (s) {
      case 'LEFT':
        return t('input.left');
      case 'RIGHT':
        return t('input.right');
      case 'BOTH':
        return t('input.both');
      default:
        return '–';
    }
  };

  const translateDiaperType = (typeCode?: string | null) => {
    switch (typeCode) {
      case 'WET':
        return t('diaper.wet');
      case 'DIRTY':
        return t('diaper.dirty');
      case 'BOTH':
        return t('diaper.both');
      default:
        return '–';
    }
  };

  // Farb-Tint je nach Subtyp (wie Quick Buttons)
  const getTypeTint = () => {
    // Defaults (neutral)
    let color = '#5E3DB3';
    // Feeding
    if (entry.entry_type === 'feeding') {
      if (entry.feeding_type === 'BREAST') color = '#8E4EC6';
      else if (entry.feeding_type === 'BOTTLE') color = '#4A90E2';
      else if (entry.feeding_type === 'PUMP') color = '#35B6B4';
      else if (entry.feeding_type === 'WATER') color = '#4FC3F7';
      else if (entry.feeding_type === 'SOLIDS') color = '#F5A623'; // Beikost Orange
    }
    // Diaper
    if (entry.entry_type === 'diaper') {
      if (entry.diaper_type === 'WET') color = '#3498DB'; // Blau
      else if (entry.diaper_type === 'DIRTY') color = '#8E5A2B'; // Braun
      else if (entry.diaper_type === 'BOTH') color = '#38A169'; // Grün
    }
    if (entry.entry_type === 'custom' && entry.custom_color) {
      color = entry.custom_color;
    }
    // Sleep
    if (entry.entry_type === 'sleep') {
      // Bestimme Farbe basierend auf Sleep-Typ
      const sleepType = (entry as any).sleep_type;
      if (sleepType === 'nacht') color = '#5C6BC0'; // Lila für Nachtschlaf
      else if (sleepType === 'mittag') color = '#FF8C42'; // Orange für Mittagsschlaf
      else if (sleepType === 'tag') color = '#FFB74D'; // Helles Orange für Tagschlaf
      else if (sleepType === 'nickerchen') color = '#81C784'; // Grün für Nickerchen
      else color = '#5C6BC0'; // Standard Schlaf-Farbe
    }
    // Convert hex to rgba with given alpha
    const toRgba = (hex: string, a: number) => {
      const h = hex.replace('#','');
      const r = parseInt(h.substring(0,2),16);
      const g = parseInt(h.substring(2,4),16);
      const b = parseInt(h.substring(4,6),16);
      return `rgba(${r},${g},${b},${a})`;
    };
    return {
      bg: toRgba(color, 0.22),
      border: toRgba(color, 0.35),
      accent: color,
    };
  };

  // Rendere Akzentfarbe basierend auf Aktivitätstyp
  const getActivityAccentColor = (type: string) => {
    switch (type) {
      case 'diaper':
        return '#4CAF50';
      case 'sleep':
        return '#5C6BC0';
      case 'feeding':
        return '#FF9800';
      default:
        return '#9C27B0';
    }
  };

  // BLW-Rezept-Hinweis aus den Notizen ziehen (erste Zeile mit "BLW:")
  const recipeNote = (() => {
    if (!entry.notes) return null;
    const line = entry.notes
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.toLowerCase().startsWith('blw:'));
    if (!line) return null;
    return line.replace(/blw:/i, '').trim();
  })();

  const weightDateLabel = (entry as any).weightDateLabel as string | undefined;

  // Notizen ohne evtl. BLW-Rezept-Zeile (wird separat als Badge gezeigt)
  const notesWithoutRecipe = (() => {
    if (!entry.notes) return null;
    const lines = entry.notes
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !l.toLowerCase().startsWith('blw:'));
    if (lines.length === 0) return null;
    return lines.join('\n');
  })();

  const showNotesBadge = !!notesWithoutRecipe;
  const diaperFeverMeasured = (entry as any).diaper_fever_measured === true;
  const diaperSuppositoryGiven = (entry as any).diaper_suppository_given === true;
  const diaperTemperatureRaw = (entry as any).diaper_temperature_c;
  const diaperSuppositoryDoseRaw = (entry as any).diaper_suppository_dose_mg;
  const toFiniteNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const diaperTemperatureValue =
    toFiniteNumber(diaperTemperatureRaw);
  const diaperSuppositoryDoseValue =
    toFiniteNumber(diaperSuppositoryDoseRaw);
  const showFeverBadge = entry.entry_type === 'diaper' && (diaperFeverMeasured || diaperTemperatureValue !== null);
  const showSuppositoryBadge =
    entry.entry_type === 'diaper' && (diaperSuppositoryGiven || diaperSuppositoryDoseValue !== null);
  const feedingSideLabel =
    entry.entry_type === 'feeding' && (entry.feeding_type === 'BREAST' || entry.feeding_type === 'PUMP')
      ? translateFeedingSide(entry.feeding_side)
      : null;
  const showFeedingSideBadge = !!feedingSideLabel && feedingSideLabel !== '–';
  const customQuantityValue = entry.entry_type === 'custom' ? toFiniteNumber(entry.custom_quantity) : null;
  const customQuantityLabel =
    customQuantityValue !== null
      ? `${String(customQuantityValue).replace('.', ',')} ${entry.custom_unit ?? ''}`.trim()
      : null;
  const feverBadgeLabel =
    diaperTemperatureValue !== null
      ? `🌡️ ${String(diaperTemperatureValue).replace('.', ',')} °C`
      : `🌡️ ${t('card.fever')}`;
  const suppositoryBadgeLabel =
    diaperSuppositoryDoseValue !== null
      ? `💊 ${t('card.suppository')} ${Math.trunc(diaperSuppositoryDoseValue)} mg`
      : `💊 ${t('card.suppositoryGiven')}`;

  // Berechne Dauer
  const duration = entry.end_time
    ? calculateDuration(entry.start_time!, entry.end_time)
    : 0;
  const showTimePills = !!entry.start_time || (entry.entry_type !== 'diaper' && (!!entry.end_time || duration > 0));

  // Rendere Swipe-Aktionen
  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const trans = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [0, 100],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.rightActions}>
        <Animated.View
          style={[
            styles.deleteAction,
            {
              transform: [{ translateX: trans }],
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => entry.id && onDelete(entry.id)}
            style={styles.deleteButton}
          >
            <IconSymbol name="trash" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  return (
    <Swipeable renderRightActions={renderRightActions}>
      <Animated.View
        style={{
          transform: [{ scale: pressAnimation }],
          marginBottom: 12, // Mehr Abstand zwischen Karten
        }}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onEdit && onEdit(entry)}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          delayPressIn={0}
        >
          {(() => { const tint = getTypeTint(); return (
          <View style={[styles.card, expanded && styles.expandedCard, { borderColor: tint.border, marginHorizontal }] }>
            <BlurView intensity={25} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill as any, { backgroundColor: tint.bg }]} />
            <LinearGradient colors={[ 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.10)' ]} style={StyleSheet.absoluteFill} />
            <View style={styles.cardHeader}>
              <View style={[styles.iconContainer, { marginTop: 6 }]}><ThemedText style={{fontSize: 20}}>{detail.emoji}</ThemedText></View>

              <View style={styles.titleContainer}>
                <View style={styles.titleRow}>
                  <ThemedText style={[styles.title, { color: textColor }]}>{detail.label}</ThemedText>

                  <Animated.View
                    style={{
                      transform: [{
                        rotate: expandAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '180deg']
                        })
                      }]
                    }}
                  >
                    <IconSymbol
                      name="chevron.down"
                      size={14}
                      color={theme.tabIconDefault}
                    />
                  </Animated.View>
                </View>
                {(auxiliaryBadgeLabel || customQuantityLabel || recipeNote || weightDateLabel || showNotesBadge || showFeverBadge || showSuppositoryBadge || showFeedingSideBadge) ? (
                  <View style={styles.badgesWrap}>
                    {auxiliaryBadgeLabel ? (
                      <View style={styles.badgePill}>
                        <ThemedText style={[styles.badgeText, { color: badgeTextColor }]}>{auxiliaryBadgeLabel}</ThemedText>
                      </View>
                    ) : null}
                    {customQuantityLabel ? (
                      <View style={styles.badgePill}>
                        <ThemedText style={[styles.badgeText, { color: badgeTextColor }]}>🔢 {customQuantityLabel}</ThemedText>
                      </View>
                    ) : null}
                    {recipeNote ? (
                      <View style={styles.badgePill}>
                        <ThemedText style={[styles.badgeText, { color: badgeTextColor }]}>🥄 BLW: {recipeNote}</ThemedText>
                      </View>
                    ) : null}
                    {weightDateLabel ? (
                      <View style={styles.badgePill}>
                        <ThemedText style={[styles.badgeText, { color: badgeTextColor }]}>📅 {weightDateLabel}</ThemedText>
                      </View>
                    ) : null}
                    {showNotesBadge ? (
                      <View style={styles.badgePill}>
                        <ThemedText style={[styles.badgeText, { color: badgeTextColor }]}>📝 {notesWithoutRecipe}</ThemedText>
                      </View>
                    ) : null}
                    {showFeverBadge ? (
                      <View style={styles.badgePill}>
                        <ThemedText style={[styles.badgeText, { color: badgeTextColor }]}>{feverBadgeLabel}</ThemedText>
                      </View>
                    ) : null}
                    {showSuppositoryBadge ? (
                      <View style={styles.badgePill}>
                        <ThemedText style={[styles.badgeText, { color: badgeTextColor }]}>{suppositoryBadgeLabel}</ThemedText>
                      </View>
                    ) : null}
                    {showFeedingSideBadge ? (
                      <View style={styles.badgePill}>
                        <ThemedText style={[styles.badgeText, { color: badgeTextColor }]}>↔️ {feedingSideLabel}</ThemedText>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* Zeiten nur zeigen, wenn vorhanden */}
                {showTimePills && (
                <View style={styles.timeRowTop}>
                  {entry.start_time && (
                    <View style={styles.timePill}>
                      <ThemedText style={[styles.timePillText, { color: secondaryTextColor }]}>{t('input.start')} {formatTime(entry.start_time)}</ThemedText>
                    </View>
                  )}
                  {entry.entry_type !== 'diaper' && entry.end_time && (
                    <View style={[styles.timePill, { marginLeft: 6 }]}>
                      <ThemedText style={[styles.timePillText, { color: secondaryTextColor }]}>{t('input.end')} {formatTime(entry.end_time)}</ThemedText>
                    </View>
                  )}

                 {entry.entry_type !== 'diaper' && duration > 0 && (
                    <View style={[styles.timePill, { marginLeft: 6, backgroundColor: 'rgba(94,61,179,0.18)', borderColor: 'rgba(94,61,179,0.35)' }]}>
                      <ThemedText style={[styles.timePillText, { fontWeight: '700', color: secondaryTextColor }]}>{duration} {t('card.minutesShort')}</ThemedText>
                    </View>
                  )}
                </View>
                )}
              </View>
            </View>
            {/* Kein Expand mehr – Details werden im Modal bearbeitet */}

            {/* Farbiger Akzent am linken Rand */}
            <View
              style={[
                styles.colorAccent,
                { backgroundColor: getTypeTint().accent }
              ]}
            />

          </View>
          ); })()}
        </TouchableOpacity>
      </Animated.View>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)'
  },
  expandedCard: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    // color wird dynamisch gesetzt
    textShadowColor: 'rgba(0,0,0,0.06)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    fontVariant: ['tabular-nums'],
  },
  timeRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap'
  },
  badgesWrap: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  badgePill: {
    marginRight: 8,
    marginBottom: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(94,61,179,0.12)',
    borderColor: 'rgba(94,61,179,0.28)',
    borderWidth: 1,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5E3DB3',
  },
  time: {
    fontSize: 13,
    // color wird dynamisch gesetzt
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timePillText: {
    fontSize: 12,
    fontWeight: '700',
    // color wird dynamisch gesetzt
  },
  timeSeparator: {
    fontSize: 13,
    marginHorizontal: 4,
    // color wird dynamisch gesetzt
  },
  duration: {
    fontSize: 13,
    // color wird dynamisch gesetzt
  },
  notesContainer: {
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 12,
    // color wird dynamisch gesetzt
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    // color wird dynamisch gesetzt
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#5E3DB3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  notes: {
    fontSize: 14,
    lineHeight: 20,
    paddingBottom: 4,
  },
  rightActions: {
    width: 80,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  deleteAction: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#FF6B6B',
    width: 50,
    height: '80%',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  expandedIndicator: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 3,
    height: 20,
    borderBottomLeftRadius: 3,
  },
});

export default ActivityCard;
