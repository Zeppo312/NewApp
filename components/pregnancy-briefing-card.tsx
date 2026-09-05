import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { IconSymbol } from '@/components/ui/IconSymbol';
import type { AppLocale } from '@/lib/localization';
import type {
  PregnancyBriefing,
  PregnancyBriefingItem,
  PregnancyBriefingItemKind,
} from '@/lib/pregnancy-briefing';
import { translatePregnancyBriefingText } from '@/lib/pregnancy-briefing-translations';

type PregnancyBriefingCardProps = {
  locale: AppLocale;
  briefing: PregnancyBriefing;
  hasAccess: boolean | null;
  isLoading: boolean;
  isDark: boolean;
  variant?: 'compact' | 'full';
  onItemPress: (item: PregnancyBriefingItem) => void;
  onOpenBriefing?: () => void;
  onUnlock: () => void;
};

const ITEM_ICONS: Record<PregnancyBriefingItemKind, string> = {
  selfcare: 'heart.fill',
  appointment: 'calendar',
  questions: 'questionmark.circle',
  partner: 'person.2.fill',
  preparation: 'checklist',
};

export default function PregnancyBriefingCard({
  locale,
  briefing,
  hasAccess,
  isLoading,
  isDark,
  variant = 'full',
  onItemPress,
  onOpenBriefing,
  onUnlock,
}: PregnancyBriefingCardProps) {
  const fade = React.useState(() => new Animated.Value(0))[0];
  const t = (key: Parameters<typeof translatePregnancyBriefingText>[1]) =>
    translatePregnancyBriefingText(locale, key);

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [briefing.title, fade, hasAccess, isLoading]);

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.brandIcon}>
        <IconSymbol name="sparkles" size={18} color="#5E3DB3" />
      </View>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>{t('eyebrow')}</Text>
        <View style={styles.premiumBadge}>
          <Text style={styles.premiumBadgeText}>{t('badge.premium')}</Text>
        </View>
      </View>
    </View>
  );

  const isCompact = variant === 'compact';

  const renderLocked = () => (
    <>
      {renderHeader()}
      <Text style={styles.title}>{t('locked.title')}</Text>
      <Text
        numberOfLines={isCompact ? 2 : undefined}
        style={[styles.intro, isCompact && styles.compactLockedIntro]}
      >
        {t('locked.subtitle')}
      </Text>
      {!isCompact ? (
        <View style={styles.lockedBullets}>
          {[
            ['calendar', t('locked.bullet.week')],
            ['checklist', t('locked.bullet.organize')],
            ['person.2.fill', t('locked.bullet.partner')],
          ].map(([icon, label]) => (
            <View key={label} style={styles.lockedBulletRow}>
              <IconSymbol name={icon} size={16} color="#F3D89B" />
              <Text style={styles.lockedBulletText}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={onUnlock}
        style={({ pressed }) => [styles.unlockButton, pressed && styles.pressed]}
      >
        <Text style={styles.unlockButtonText}>{t('locked.cta')}</Text>
        <IconSymbol name="chevron.right" size={18} color="#4B2D75" />
      </Pressable>
    </>
  );

  const renderCompactBriefing = () => {
    const primaryItem = briefing.items.find((item) => item.kind === 'selfcare') ?? briefing.items[0];

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${briefing.title}. ${t('compact.open')}`}
        onPress={onOpenBriefing}
        style={({ pressed }) => pressed && styles.compactPressed}
      >
        {renderHeader()}
        <Text selectable style={[styles.title, styles.compactTitle]}>{briefing.title}</Text>
        {isLoading || !primaryItem ? (
          <View style={styles.compactLoadingRow}>
            <ActivityIndicator size="small" color="#F3D89B" />
            <Text style={styles.loadingText}>{t('state.loading')}</Text>
          </View>
        ) : (
          <View style={styles.compactHighlight}>
            <View style={styles.itemIcon}>
              <IconSymbol name={ITEM_ICONS[primaryItem.kind]} size={17} color="#F3D89B" />
            </View>
            <View style={styles.itemCopy}>
              <Text style={styles.compactEyebrow}>{t('compact.important')}</Text>
              <Text selectable numberOfLines={2} style={styles.compactBody}>
                {primaryItem.body}
              </Text>
            </View>
          </View>
        )}
        <View style={styles.compactFooter}>
          <Text style={styles.compactFooterText}>{t('compact.open')}</Text>
          <IconSymbol name="chevron.right" size={18} color="#F6DFAE" />
        </View>
      </Pressable>
    );
  };

  const renderBriefing = () => (
    <>
      {renderHeader()}
      <Text selectable style={styles.title}>{briefing.title}</Text>
      <Text selectable style={styles.intro}>{briefing.intro}</Text>
      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#F3D89B" />
          <Text style={styles.loadingText}>{t('state.loading')}</Text>
        </View>
      ) : (
        <View style={styles.items}>
          {briefing.items.map((item) => (
            <Pressable
              key={item.kind}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${item.body}`}
              onPress={() => onItemPress(item)}
              style={({ pressed }) => [styles.itemRow, pressed && styles.itemRowPressed]}
            >
              <View style={styles.itemIcon}>
                <IconSymbol name={ITEM_ICONS[item.kind]} size={17} color="#F3D89B" />
              </View>
              <View style={styles.itemCopy}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text selectable style={styles.itemBody}>{item.body}</Text>
                <Text style={styles.itemAction}>{item.actionLabel}</Text>
              </View>
              <IconSymbol name="chevron.right" size={17} color="rgba(255,255,255,0.72)" />
            </Pressable>
          ))}
        </View>
      )}
    </>
  );

  return (
    <Animated.View style={[styles.outer, { opacity: fade }]}>
      <BlurView
        intensity={isDark ? 34 : 46}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(52,31,91,0.94)', 'rgba(92,55,142,0.92)', 'rgba(126,78,174,0.88)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.glowOne} />
      <View pointerEvents="none" style={styles.glowTwo} />
      <View style={[styles.content, isCompact && styles.compactContent]}>
        {hasAccess === null ? (
          <View style={[styles.accessLoading, isCompact && styles.compactAccessLoading]}>
            {renderHeader()}
            <ActivityIndicator color="#F3D89B" />
          </View>
        ) : hasAccess
          ? isCompact ? renderCompactBriefing() : renderBriefing()
          : renderLocked()}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 28,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    marginBottom: 18,
    boxShadow: '0 12px 28px rgba(58, 33, 92, 0.24)',
  },
  content: {
    padding: 18,
  },
  compactContent: {
    padding: 16,
  },
  glowOne: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    right: -90,
    top: -100,
    backgroundColor: 'rgba(255,220,178,0.16)',
  },
  glowTwo: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    left: -90,
    bottom: -100,
    backgroundColor: 'rgba(205,175,255,0.16)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12,
  },
  brandIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5DEAA',
  },
  headerCopy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  eyebrow: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  premiumBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(245,222,170,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(245,222,170,0.42)',
  },
  premiumBadgeText: {
    color: '#F6DFAE',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.35,
  },
  compactTitle: {
    fontSize: 21,
    lineHeight: 25,
    paddingBottom: 12,
  },
  intro: {
    color: 'rgba(255,255,255,0.83)',
    fontSize: 14,
    lineHeight: 20,
    paddingTop: 7,
    paddingBottom: 15,
  },
  items: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 11,
    paddingVertical: 11,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.095)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  itemRowPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,222,170,0.12)',
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  itemBody: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
    lineHeight: 17,
    paddingTop: 2,
  },
  itemAction: {
    color: '#F6DFAE',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    paddingTop: 4,
  },
  compactHighlight: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 11,
    borderRadius: 17,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.095)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  compactEyebrow: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  compactBody: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    lineHeight: 17,
    paddingTop: 2,
  },
  compactFooter: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    paddingTop: 9,
  },
  compactFooterText: {
    color: '#F6DFAE',
    fontSize: 12,
    fontWeight: '800',
  },
  compactPressed: {
    opacity: 0.82,
  },
  compactLoadingRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  loadingRow: {
    minHeight: 90,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
  },
  accessLoading: {
    minHeight: 110,
    justifyContent: 'space-between',
  },
  compactAccessLoading: {
    minHeight: 92,
  },
  lockedBullets: {
    gap: 9,
    paddingBottom: 16,
  },
  lockedBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  lockedBulletText: {
    flex: 1,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 18,
  },
  compactLockedIntro: {
    paddingBottom: 12,
  },
  unlockButton: {
    minHeight: 48,
    borderRadius: 16,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#F5DEAA',
  },
  unlockButtonText: {
    color: '#4B2D75',
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.82,
  },
});
