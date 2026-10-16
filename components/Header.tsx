// src/components/Header/Header.tsx (oder dein Pfad)

import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PeriodNavigationButton } from '@/components/ui/period-navigation-button';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/ThemedText';
import { useNavigation } from '@/contexts/NavigationContext';
import { useLocale } from '@/contexts/LocaleContext';
import { translateNavigationText } from '@/lib/navigationTranslations';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import BabySwitcherButton from '@/components/BabySwitcherButton';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  backAccessibilityLabel?: string;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  showBabySwitcher?: boolean;
  /** Set when the parent already applies the Android top safe area (e.g. safe-area-context's SafeAreaView). */
  topSafeAreaHandled?: boolean;
}

// Original-Farben für hellen Modus
const HEADER_TITLE_COLOR_LIGHT = '#7D5A50';
const HEADER_SUBTITLE_COLOR_LIGHT = '#A8978E';
const HEADER_ACTION_SIZE = 44;
const HEADER_TEXT_GAP = 12;

const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBackButton = false,
  onBackPress,
  backAccessibilityLabel,
  leftContent,
  rightContent,
  showBabySwitcher = true,
  topSafeAreaHandled = false,
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const navigation = useNavigation();
  const { locale } = useLocale();
  const adaptiveColors = useAdaptiveColors();
  const insets = useSafeAreaInsets();
  const [leftWidth, setLeftWidth] = useState(HEADER_ACTION_SIZE);
  const [rightWidth, setRightWidth] = useState(HEADER_ACTION_SIZE);
  // Symmetrischer Platz hält den Titel auch neben mehreren Aktionen mittig.
  const titleInset = Math.max(HEADER_ACTION_SIZE, leftWidth, rightWidth) + HEADER_TEXT_GAP;
  // React Native's legacy SafeAreaView only protects iOS. Include Android's
  // camera/status-bar inset unless the screen already applies it.
  const topSpacing = styles.header.paddingTop
    + (Platform.OS === 'android' && !topSafeAreaHandled ? insets.top : 0);

  // Nur bei dunklem Hintergrundbild die adaptiven Farben verwenden
  const useDarkMode = adaptiveColors.hasCustomBackground && adaptiveColors.isDarkBackground;
  // Im Dark Mode helle Farben verwenden
  const titleColor = useDarkMode
    ? adaptiveColors.textPrimary
    : (colorScheme === 'dark' ? Colors.dark.textPrimary : HEADER_TITLE_COLOR_LIGHT);
  const subtitleColor = useDarkMode
    ? adaptiveColors.textTertiary
    : (colorScheme === 'dark' ? Colors.dark.textTertiary : HEADER_SUBTITLE_COLOR_LIGHT);
  const iconColor = useDarkMode ? adaptiveColors.text : theme.text;

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      // Use smart navigation that tracks history
      navigation.goBack();
    }
  };

  return (
    <View style={[styles.header, {
      paddingTop: topSpacing,
      minHeight: topSpacing + HEADER_ACTION_SIZE + styles.header.paddingBottom,
    }]}>
      {/* Linker Bereich - absolut positioniert */}
      <View
        style={[styles.sideContainer, styles.left, { top: topSpacing }]}
        onLayout={(event) => setLeftWidth(Math.ceil(event.nativeEvent.layout.width))}
      >
        <View style={styles.leftContentWrapper}>
          {showBackButton && (
            <PeriodNavigationButton
              direction="previous"
              accessibilityLabel={backAccessibilityLabel ?? translateNavigationText(locale, 'common.back')}
              isDark={useDarkMode || colorScheme === 'dark'}
              color={iconColor}
              onPress={handleBackPress}
            />
          )}
          {leftContent}
        </View>
      </View>
      
      {/* Mittlerer Bereich - immer bildschirmmittig */}
      <View style={[styles.titleContainer, { paddingHorizontal: titleInset }]} pointerEvents="none">
        <ThemedText type="pageTitle" style={[styles.title, { color: titleColor }]} numberOfLines={2} ellipsizeMode="tail">
          {title}
        </ThemedText>
        {subtitle && (
          <ThemedText type="bodySmall" style={[styles.subtitle, { color: subtitleColor }]}>{subtitle}</ThemedText>
        )}
      </View>
      
      {/* Rechter Bereich - absolut positioniert */}
      <View
        style={[styles.sideContainer, styles.right, { top: topSpacing }]}
        onLayout={(event) => setRightWidth(Math.ceil(event.nativeEvent.layout.width))}
      >
        <View style={styles.rightContentRow}>
          {rightContent}
          {showBabySwitcher && <BabySwitcherButton />}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 6,
    justifyContent: 'center', // Titel echte Bildschirmmitte
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    marginBottom: 0,
  },
  sideContainer: {
    position: 'absolute',
    top: 14, // gleiche Paddinghöhe wie oben
    bottom: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  left: {
    left: 16,
    minWidth: HEADER_ACTION_SIZE,
    height: HEADER_ACTION_SIZE,
  },
  leftContentWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  right: {
    right: 16,
    minWidth: HEADER_ACTION_SIZE,
    height: HEADER_ACTION_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  title: {
    textAlign: 'center',
    flexShrink: 1,
  },
  subtitle: {
    marginTop: 3,
    textAlign: 'center',
  },
  rightContent: {
    paddingHorizontal: 0,
  },
});

export default Header;
