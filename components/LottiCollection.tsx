/**
 * LottiCollection — die Lotti-Bilder als echte Sammlung.
 *
 * 30 Slots im Grid: freigeschaltete Stufen zeigen ihr Bild, kommende einen
 * sanften „?"-Platzhalter. Tap auf ein freigeschaltetes Bild öffnet ein
 * Detail-Sheet mit „Als Avatar wählen" — die Wahl landet in
 * useLottiAvatarChoice und wird u. a. von Home-Karte und Reise genutzt.
 *
 * Ton bleibt soft: gesperrte Slots sind Vorfreude, kein Mangel.
 */

import React, { useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { ThemedText } from '@/components/ThemedText';
import { LOTTI_LEVELS } from '@/lib/lottiPoints';
import { babyImageForLevel } from '@/lib/lottiBabyImages';
import { useLottiAvatarChoice } from '@/hooks/useLottiAvatarChoice';
import { IconSymbol } from '@/components/ui/IconSymbol';

const ACCENT_PURPLE = '#5E3DB3';
const COLUMNS = 5;

type Props = {
  currentLevel: number;
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
};

export function LottiCollection({
  currentLevel,
  isDark,
  textPrimary,
  textSecondary,
  textTertiary,
}: Props) {
  const { chosenLevel, chooseLevel } = useLottiAvatarChoice();
  const [selected, setSelected] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const normalizedCurrentLevel = Number.isFinite(currentLevel)
    ? Math.floor(currentLevel)
    : 0;
  const safeCurrentLevel = Math.min(
    LOTTI_LEVELS.length,
    Math.max(0, normalizedCurrentLevel),
  );

  const unlockedCount = Math.min(
    LOTTI_LEVELS.length,
    safeCurrentLevel,
  );
  const visibleLevels = isExpanded
    ? LOTTI_LEVELS
    : getCollapsedCollectionLevels(safeCurrentLevel);

  const tileBorder = isDark
    ? 'rgba(255,255,255,0.18)'
    : 'rgba(255,255,255,0.75)';
  const lockedBg = isDark
    ? 'rgba(255,255,255,0.05)'
    : 'rgba(94,61,179,0.06)';
  const lockedBorder = isDark
    ? 'rgba(255,255,255,0.12)'
    : 'rgba(94,61,179,0.14)';
  const pillBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(94,61,179,0.08)';
  const pillBorder = isDark
    ? 'rgba(255,255,255,0.14)'
    : 'rgba(94,61,179,0.14)';

  return (
    <View style={styles.root}>
      <Pressable
        onPress={() => setIsExpanded((value) => !value)}
        style={({ pressed }) => [
          styles.headingButton,
          pressed ? { opacity: 0.82 } : null,
        ]}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        accessibilityLabel={
          isExpanded ? 'Lotti-Sammlung einklappen' : 'Lotti-Sammlung ausklappen'
        }
      >
        <View style={styles.headingText}>
          <ThemedText adaptive={false} style={[styles.title, { color: textPrimary }]}>
            Eure Lotti-Sammlung
          </ThemedText>
          <ThemedText
            adaptive={false}
            style={[styles.subtitle, { color: textSecondary }]}
          >
            {unlockedCount} von {LOTTI_LEVELS.length} Bildern freigeschaltet
          </ThemedText>
        </View>

        <View
          style={[
            styles.expandPill,
            { backgroundColor: pillBg, borderColor: pillBorder },
          ]}
        >
          <ThemedText adaptive={false} style={styles.expandPillText}>
            {isExpanded ? 'Weniger' : 'Alle'}
          </ThemedText>
          <IconSymbol
            name={isExpanded ? 'chevron.up' : 'chevron.down'}
            size={16}
            color={ACCENT_PURPLE}
          />
        </View>
      </Pressable>

      <View style={styles.grid}>
        {visibleLevels.map((level) => {
          const isUnlocked = level.level <= safeCurrentLevel;
          const isChosen = chosenLevel === level.level;
          return (
            <Pressable
              key={level.level}
              onPress={() => setSelected(level.level)}
              style={({ pressed }) => [
                styles.tileWrap,
                !isExpanded ? styles.previewTileWrap : null,
                pressed ? { opacity: 0.75, transform: [{ scale: 0.95 }] } : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                isUnlocked
                  ? `Stufe ${level.level} — ${level.name}`
                  : `Stufe ${level.level} — noch nicht freigeschaltet`
              }
            >
              {isUnlocked ? (
                <View
                  style={[
                    styles.tile,
                    { borderColor: isChosen ? ACCENT_PURPLE : tileBorder },
                    isChosen ? styles.tileChosen : null,
                  ]}
                >
                  <Image
                    source={babyImageForLevel(level.level)}
                    style={styles.tileImage}
                    resizeMode="cover"
                  />
                  {isChosen ? (
                    <View style={styles.chosenBadge}>
                      <ThemedText adaptive={false} style={styles.chosenBadgeText}>
                        ✓
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              ) : (
                <View
                  style={[
                    styles.tile,
                    styles.tileLocked,
                    { backgroundColor: lockedBg, borderColor: lockedBorder },
                  ]}
                >
                  <ThemedText
                    adaptive={false}
                    style={[styles.lockedMark, { color: textTertiary }]}
                  >
                    ?
                  </ThemedText>
                  <ThemedText
                    adaptive={false}
                    style={[styles.lockedLevel, { color: textTertiary }]}
                  >
                    {level.level}
                  </ThemedText>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <CollectionDetailSheet
        level={selected}
        currentLevel={safeCurrentLevel}
        chosenLevel={chosenLevel}
        onChoose={(lvl) => {
          void chooseLevel(lvl);
          setSelected(null);
        }}
        onClose={() => setSelected(null)}
        isDark={isDark}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
        textTertiary={textTertiary}
      />
    </View>
  );
}

function getCollapsedCollectionLevels(currentLevel: number) {
  const latestUnlocked = LOTTI_LEVELS
    .filter((level) => level.level <= currentLevel)
    .slice(-2);
  const nextLocked = LOTTI_LEVELS
    .filter((level) => level.level > currentLevel)
    .slice(0, Math.max(1, 3 - latestUnlocked.length));

  return [...latestUnlocked, ...nextLocked].slice(0, 3);
}

function CollectionDetailSheet({
  level,
  currentLevel,
  chosenLevel,
  onChoose,
  onClose,
  isDark,
  textPrimary,
  textSecondary,
  textTertiary,
}: {
  level: number | null;
  currentLevel: number;
  chosenLevel: number | null;
  onChoose: (level: number) => void;
  onClose: () => void;
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
}) {
  if (level === null) {
    return (
      <Modal visible={false} transparent animationType="slide">
        <View />
      </Modal>
    );
  }

  const levelData = LOTTI_LEVELS.find((l) => l.level === level);
  const isUnlocked = level <= currentLevel;
  const isChosen = chosenLevel === level;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={styles.sheetWrapper}
        >
          <BlurView
            {...(Platform.OS === 'android'
              ? { blurMethod: 'dimezisBlurView' as const, blurReductionFactor: 1 }
              : {})}
            intensity={30}
            tint={isDark ? 'dark' : 'light'}
            style={styles.sheetBlur}
          >
            <View
              style={[
                styles.sheetCard,
                {
                  backgroundColor: isDark
                    ? 'rgba(24,20,30,0.88)'
                    : 'rgba(255,255,255,0.94)',
                  borderColor: isDark
                    ? 'rgba(255,255,255,0.16)'
                    : 'rgba(255,255,255,0.82)',
                },
              ]}
            >
              <View style={styles.sheetHandle} />

              <View style={styles.sheetHero}>
                {isUnlocked ? (
                  <Image
                    source={babyImageForLevel(level)}
                    style={styles.sheetImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.sheetImage,
                      styles.sheetImageLocked,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(94,61,179,0.07)',
                      },
                    ]}
                  >
                    <ThemedText
                      adaptive={false}
                      style={[styles.sheetLockedMark, { color: textTertiary }]}
                    >
                      ?
                    </ThemedText>
                  </View>
                )}
              </View>

              <View style={styles.sheetHeaderText}>
                <ThemedText adaptive={false} style={styles.sheetKicker}>
                  Stufe {level}
                  {isUnlocked ? ' · Freigeschaltet' : ' · Noch verborgen'}
                </ThemedText>
                <ThemedText
                  adaptive={false}
                  style={[styles.sheetTitle, { color: textPrimary }]}
                >
                  {isUnlocked ? (levelData?.name ?? `Stufe ${level}`) : 'Ein neues Lotti-Bild wartet'}
                </ThemedText>
                <ThemedText
                  adaptive={false}
                  style={[styles.sheetSub, { color: textSecondary }]}
                >
                  {isUnlocked
                    ? (levelData?.description ?? '')
                    : `Erreicht Stufe ${level}, um dieses Bild zu enthüllen.`}
                </ThemedText>
                {isUnlocked ? (
                  <View
                    style={[
                      styles.avatarHint,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(94,61,179,0.07)',
                        borderColor: isDark
                          ? 'rgba(255,255,255,0.12)'
                          : 'rgba(94,61,179,0.14)',
                      },
                    ]}
                  >
                    <IconSymbol
                      name="person.crop.circle"
                      size={16}
                      color={ACCENT_PURPLE}
                    />
                    <ThemedText
                      adaptive={false}
                      style={[styles.avatarHintText, { color: textSecondary }]}
                    >
                      {isChosen
                        ? 'Dieses Bild ist euer Avatar auf der Wochenkarte und in der Lotti-Reise.'
                        : 'Als Avatar erscheint dieses Bild auf der Wochenkarte und in der Lotti-Reise.'}
                    </ThemedText>
                  </View>
                ) : null}
              </View>

              <View style={styles.sheetActions}>
                {isUnlocked ? (
                  isChosen ? (
                    <View style={[styles.chooseButton, styles.chooseButtonActive]}>
                      <ThemedText
                        adaptive={false}
                        style={styles.chooseButtonActiveText}
                      >
                        Euer Avatar ✓
                      </ThemedText>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => onChoose(level)}
                      style={({ pressed }) => [
                        styles.chooseButton,
                        { opacity: pressed ? 0.82 : 1 },
                      ]}
                    >
                      <ThemedText adaptive={false} style={styles.chooseButtonText}>
                        Als Avatar wählen
                      </ThemedText>
                    </Pressable>
                  )
                ) : null}
                <Pressable onPress={onClose} style={styles.sheetCloseButton}>
                  <ThemedText adaptive={false} style={styles.sheetCloseText}>
                    Schließen
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </BlurView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    marginBottom: 20,
    gap: 12,
  },
  headingButton: {
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headingText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '500',
  },
  expandPill: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expandPillText: {
    color: ACCENT_PURPLE,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginRight: -8,
  },
  tileWrap: {
    // 5 Spalten — Abstand über Innen-Padding, damit die Basis exakt 20% bleibt
    flexBasis: `${100 / COLUMNS}%`,
    maxWidth: `${100 / COLUMNS}%`,
    flexGrow: 0,
    paddingRight: 8,
    paddingBottom: 8,
  },
  previewTileWrap: {
    flexBasis: '33.333%',
    maxWidth: '33.333%',
  },
  tile: {
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#5E3DB3',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 5,
    elevation: 2,
  },
  tileChosen: {
    borderWidth: 2.5,
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  tileLocked: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0,
    elevation: 0,
  },
  lockedMark: {
    fontSize: 18,
    fontWeight: '800',
    opacity: 0.7,
  },
  lockedLevel: {
    fontSize: 9.5,
    fontWeight: '700',
    opacity: 0.6,
    marginTop: 1,
  },
  chosenBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT_PURPLE,
    borderWidth: 1.2,
    borderColor: '#FFFFFF',
  },
  chosenBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    lineHeight: 11,
    fontWeight: '900',
    includeFontPadding: false,
  },

  // Sheet
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.34)',
  },
  sheetWrapper: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  sheetBlur: {
    borderRadius: 26,
    overflow: 'hidden',
  },
  sheetCard: {
    borderRadius: 26,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 14,
    alignItems: 'center',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(94,61,179,0.24)',
  },
  sheetHero: {
    marginTop: 4,
  },
  sheetImage: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  sheetImageLocked: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'rgba(94,61,179,0.18)',
  },
  sheetLockedMark: {
    fontSize: 44,
    fontWeight: '800',
    opacity: 0.55,
  },
  sheetHeaderText: {
    alignItems: 'center',
    gap: 3,
  },
  sheetKicker: {
    color: ACCENT_PURPLE,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sheetTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  sheetSub: {
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '500',
    textAlign: 'center',
  },
  avatarHint: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarHintText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
  },
  sheetActions: {
    alignSelf: 'stretch',
    gap: 10,
    alignItems: 'center',
  },
  chooseButton: {
    alignSelf: 'stretch',
    minHeight: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT_PURPLE,
  },
  chooseButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  chooseButtonActive: {
    backgroundColor: 'rgba(94,61,179,0.10)',
    borderWidth: 1.2,
    borderColor: 'rgba(94,61,179,0.28)',
  },
  chooseButtonActiveText: {
    color: ACCENT_PURPLE,
    fontSize: 14,
    fontWeight: '800',
  },
  sheetCloseButton: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(94,61,179,0.10)',
  },
  sheetCloseText: {
    color: ACCENT_PURPLE,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
});
