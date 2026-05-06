import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, SafeAreaView, ScrollView, Image, TouchableOpacity, ImageSourcePropType } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import Header from '@/components/Header';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { babySizeData, BabySizeData } from '@/lib/baby-size-data';
import { useAuth } from '@/contexts/AuthContext';
import { getDueDateWithLinkedUsers } from '@/lib/supabase';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import {
  LiquidGlassCard,
  LAYOUT_PAD,
  TIMELINE_INSET,
  GLASS_BORDER,
  GLASS_BORDER_DARK,
  GLASS_OVERLAY,
  GLASS_OVERLAY_DARK,
} from '@/constants/DesignGuide';

const pastelPalette = {
  peach: 'rgba(255, 223, 209, 0.85)',
  rose: 'rgba(255, 210, 224, 0.75)',
  honey: 'rgba(255, 239, 214, 0.85)',
  sage: 'rgba(214, 236, 220, 0.78)',
  lavender: 'rgba(236, 224, 255, 0.78)',
  sky: 'rgba(222, 238, 255, 0.85)',
};

const DAYS_IN_PREGNANCY = 280;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const lightenHex = (hex: string, amount = 0.35) => {
  const cleanHex = hex.replace('#', '');
  const int = parseInt(cleanHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;

  const lightenChannel = (channel: number) =>
    Math.min(255, Math.round(channel + (255 - channel) * amount));
  const toHex = (channel: number) => channel.toString(16).padStart(2, '0');

  return `#${toHex(lightenChannel(r))}${toHex(lightenChannel(g))}${toHex(lightenChannel(b))}`;
};

const scaleRgbaAlpha = (rgba: string, multiplier: number) => {
  const match = rgba.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/);
  if (!match) return rgba;
  const [, r, g, b, a] = match;
  const baseAlpha = Number.parseFloat(a);
  const nextAlpha = Number.isFinite(baseAlpha) ? Math.min(1, Math.max(0, baseAlpha * multiplier)) : baseAlpha;
  return `rgba(${r}, ${g}, ${b}, ${nextAlpha})`;
};

const GlassLayer = ({
  tint = 'rgba(255,255,255,0.22)',
  sheenOpacity = 0.35,
}: {
  tint?: string;
  sheenOpacity?: number;
}) => (
  <>
    <LinearGradient
      colors={[tint, 'rgba(255,255,255,0.06)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.glassLayerGradient}
    />
    <View style={[styles.glassSheen, { opacity: sheenOpacity }]} />
  </>
);

const MAX_WEEK = babySizeData[babySizeData.length - 1]?.week ?? 40;

const clampWeek = (week: number) => Math.min(Math.max(week, 1), MAX_WEEK);

const deriveWeekFromDueDate = (dueDate: Date) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.round(diffMs / MS_PER_DAY));
  const daysPregnant = Math.min(DAYS_IN_PREGNANCY, Math.max(0, DAYS_IN_PREGNANCY - daysRemaining));
  const weeksPregnant = Math.floor(daysPregnant / 7);
  return clampWeek(weeksPregnant + 1);
};

export default function BabySizePage() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <BabySizeContent />
    </>
  );
}

function BabySizeContent() {
  const router = useRouter();
  const params = useLocalSearchParams<{ week?: string | string[] }>();
  const weekParam = params.week;
  const { user } = useAuth();
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const glassOverlay = isDark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY;
  const glassBorder = isDark ? GLASS_BORDER_DARK : GLASS_BORDER;
  const glassSurfaceBackground = isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.15)';
  const glassSurfaceStyle = { borderColor: glassBorder, backgroundColor: glassSurfaceBackground };
  const pastelPaletteResolved = isDark
    ? {
        peach: scaleRgbaAlpha(pastelPalette.peach, 0.35),
        rose: scaleRgbaAlpha(pastelPalette.rose, 0.35),
        honey: scaleRgbaAlpha(pastelPalette.honey, 0.35),
        sage: scaleRgbaAlpha(pastelPalette.sage, 0.35),
        lavender: scaleRgbaAlpha(pastelPalette.lavender, 0.35),
        sky: scaleRgbaAlpha(pastelPalette.sky, 0.35),
      }
    : pastelPalette;
  const iconBlue = isDark ? lightenHex('#6C87C1') : '#6C87C1';
  const iconRose = isDark ? lightenHex('#C26D62') : '#C26D62';
  const quickStatIconBackground = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.85)';
  const heroSheen = isDark ? 0.12 : 0.22;
  const statSheen = isDark ? 0.1 : 0.2;
  const descriptionSheen = isDark ? 0.08 : 0.16;
  const chipSheenSelected = isDark ? 0.14 : 0.28;
  const chipSheen = isDark ? 0.08 : 0.12;
  const neutralChipTint = isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.12)';
  const weekChipSelectedStyle = {
    borderColor: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.85)',
    backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.2)',
  };
  const [dueWeek, setDueWeek] = useState<number | null>(null);
  const [imageError, setImageError] = useState(false);
  const splitFruit = (comparison: string) => {
    const parts = comparison.split(' ');
    if (parts.length <= 1) {
      return { article: '', fruit: comparison };
    }
    const [article, ...rest] = parts;
    return { article, fruit: rest.join(' ') };
  };

  useEffect(() => {
    let isMounted = true;

    const fetchDueWeek = async () => {
      if (!user?.id) {
        if (isMounted) {
          setDueWeek(null);
        }
        return;
      }

      try {
        const result = await getDueDateWithLinkedUsers(user.id);

        if (!isMounted) {
          return;
        }

        if (result?.success && result.dueDate) {
          const week = deriveWeekFromDueDate(new Date(result.dueDate));
          setDueWeek(week);
        } else {
          setDueWeek(null);
        }
      } catch (error) {
        console.error('Failed to load due date for baby size view:', error);
        if (isMounted) {
          setDueWeek(null);
        }
      }
    };

    fetchDueWeek();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const weekFromParams = useMemo(() => {
    if (typeof weekParam === 'undefined') {
      return null;
    }
    const rawWeek = Array.isArray(weekParam) ? weekParam[0] : weekParam;
    const parsedWeek = Number.parseInt(rawWeek ?? '', 10);
    if (Number.isNaN(parsedWeek)) {
      return null;
    }
    return clampWeek(parsedWeek);
  }, [weekParam]);

  const currentWeek = weekFromParams ?? dueWeek ?? 1;

  const babyData = useMemo<BabySizeData>(() => {
    return babySizeData.find((item) => item.week === currentWeek) ?? babySizeData[0];
  }, [currentWeek]);

  useEffect(() => {
    setImageError(false);
  }, [babyData.imageUrl, babyData.week]);

  const { article, fruit } = useMemo(() => splitFruit(babyData.fruitComparison), [babyData.fruitComparison]);

  const heroImageSource: ImageSourcePropType = useMemo(() => {
    if (!imageError && babyData.imageUrl) {
      return { uri: babyData.imageUrl };
    }
    return require('@/assets/images/Baby_Icon.png');
  }, [babyData.imageUrl, imageError]);

  const quickStats = [
    {
      key: 'length',
      label: 'Größe',
      value: babyData.length,
      icon: 'person.fill' as const,
      accent: pastelPaletteResolved.sky,
      iconColor: iconBlue,
    },
    {
      key: 'weight',
      label: 'Gewicht',
      value: babyData.weight,
      icon: 'chart.bar.fill' as const,
      accent: pastelPaletteResolved.rose,
      iconColor: iconRose,
    },
  ];

  return (
    <ThemedBackground style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Header
          title="Babygröße"
          subtitle={`Woche ${babyData.week}`}
          showBackButton
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <LiquidGlassCard
            style={[styles.glassCard, styles.heroCard]}
            overlayColor={glassOverlay}
            borderColor={glassBorder}
          >
            <View style={styles.glassInner}>
              <View style={[styles.heroHighlight, styles.glassSurface, glassSurfaceStyle]}>
                <GlassLayer tint={pastelPaletteResolved.honey} sheenOpacity={heroSheen} />
                <ThemedText
                  style={[styles.heroWeek, { color: textSecondary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  Schwangerschaftswoche
                </ThemedText>

                <View style={styles.heroContentRow}>
                  <View style={styles.heroTextBlock}>
                    <ThemedText style={[styles.heroSubline, { color: textSecondary }]}>
                      Diese Woche ist dein Baby so groß wie {article ? `${article}` : ''}
                    </ThemedText>
                    <ThemedText
                      style={[styles.heroFruit, { color: textPrimary }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >
                      {fruit}
                    </ThemedText>
                  </View>

                  <Image
                    source={heroImageSource}
                    style={styles.heroImage}
                    resizeMode="contain"
                    onError={() => setImageError(true)}
                  />
                </View>
              </View>

              <View style={styles.quickStatRow}>
                {quickStats.map((stat) => (
                  <View key={stat.key} style={[styles.quickStat, styles.glassSurface, glassSurfaceStyle]}>
                    <GlassLayer tint={stat.accent} sheenOpacity={statSheen} />
                    <View style={[styles.quickStatIcon, { backgroundColor: quickStatIconBackground }]}>
                      <IconSymbol name={stat.icon} size={18} color={stat.iconColor} />
                    </View>
                    <ThemedText style={[styles.quickStatValue, { color: textPrimary }]}>{stat.value}</ThemedText>
                    <ThemedText style={[styles.quickStatLabel, { color: textSecondary }]}>{stat.label}</ThemedText>
                  </View>
                ))}
              </View>

              <View style={[styles.descriptionBlock, styles.glassSurface, glassSurfaceStyle]}>
                <GlassLayer tint={pastelPaletteResolved.peach} sheenOpacity={descriptionSheen} />
                <ThemedText style={[styles.descriptionTitle, { color: textPrimary }]}>Entwicklung in dieser Woche</ThemedText>
                <ThemedText style={[styles.descriptionText, { color: textSecondary }]}>{babyData.description}</ThemedText>
              </View>
            </View>
          </LiquidGlassCard>

          <LiquidGlassCard style={styles.glassCard} overlayColor={glassOverlay} borderColor={glassBorder}>
            <View style={styles.glassInner}>
              <ThemedText style={[styles.sectionTitle, { color: textPrimary }]}>Andere Wochen entdecken</ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.weekChips}
              >
                {babySizeData.map((data) => {
                  const isSelected = data.week === babyData.week;
                  return (
                    <TouchableOpacity
                      key={data.week}
                      style={[
                        styles.weekChip,
                        styles.glassSurface,
                        glassSurfaceStyle,
                        isSelected && weekChipSelectedStyle,
                      ]}
                      activeOpacity={0.85}
                      onPress={() => router.setParams({ week: data.week.toString() })}
                    >
                      <GlassLayer
                        tint={isSelected ? pastelPaletteResolved.lavender : neutralChipTint}
                        sheenOpacity={isSelected ? chipSheenSelected : chipSheen}
                      />
                      <ThemedText
                        style={[
                          styles.weekChipLabel,
                          { color: textSecondary },
                          isSelected && styles.weekChipLabelSelected,
                        ]}
                      >
                        {data.week}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </LiquidGlassCard>
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 40,
    paddingTop: 8,
    alignItems: 'center',
  },
  glassCard: {
    marginHorizontal: TIMELINE_INSET,
    marginBottom: 20,
    borderRadius: 22,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  glassInner: {
    padding: 20,
  },
  heroCard: {
    marginTop: 12,
  },
  glassSurface: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  glassLayerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  glassSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  heroHighlight: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    gap: 10,
  },
  heroContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroTextBlock: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    marginRight: 12,
    paddingRight: 8,
  },
  heroWeek: {
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    opacity: 0.7,
    marginBottom: 4,
  },
  heroSubline: {
    fontSize: 14,
    marginTop: 8,
    lineHeight: 22,
  },
  heroArticle: {
    fontSize: 15,
    fontWeight: '600',
  },
  heroFruit: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    marginTop: 4,
  },
  heroImage: {
    width: 120,
    height: 120,
    marginLeft: 10,
    marginTop: 6,
    alignSelf: 'center',
    flexShrink: 0,
  },
  quickStatRow: {
    flexDirection: 'row',
    marginBottom: 14,
    marginTop: 4,
  },
  quickStat: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  quickStatIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  quickStatLabel: {
    fontSize: 12,
    opacity: 0.75,
    marginTop: 2,
  },
  descriptionBlock: {
    borderRadius: 20,
    padding: 18,
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 21,
    opacity: 0.9,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  weekChips: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  weekChip: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekChipLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  weekChipLabelSelected: {
    color: '#ffffff',
  },
});
