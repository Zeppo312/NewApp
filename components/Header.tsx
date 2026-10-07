// src/components/Header/Header.tsx (oder dein Pfad)

import React from 'react';
import { Platform, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/ThemedText';
import { useNavigation } from '@/contexts/NavigationContext';
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

const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBackButton = false,
  onBackPress,
  backAccessibilityLabel = 'Zurück',
  leftContent,
  rightContent,
  showBabySwitcher = true,
  topSafeAreaHandled = false,
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const navigation = useNavigation();
  const adaptiveColors = useAdaptiveColors();
  const insets = useSafeAreaInsets();
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
    <View style={[styles.header, { paddingTop: topSpacing }]}>
      {/* Linker Bereich - absolut positioniert */}
      <View style={[styles.sideContainer, styles.left, { top: topSpacing }]}>
        <View style={styles.leftContentWrapper}>
          {showBackButton && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={backAccessibilityLabel}
              style={styles.backButton}
              onPress={handleBackPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <IconSymbol name="chevron.left" size={20} color={iconColor} />
            </TouchableOpacity>
          )}
          {leftContent}
        </View>
      </View>
      
      {/* Mittlerer Bereich - immer bildschirmmittig */}
      <View style={styles.titleContainer} pointerEvents="none">
        <ThemedText style={[styles.title, { color: titleColor }]} numberOfLines={2} ellipsizeMode="tail">
          {title}
        </ThemedText>
        {subtitle && (
          <ThemedText style={[styles.subtitle, { color: subtitleColor }]}>{subtitle}</ThemedText>
        )}
      </View>
      
      {/* Rechter Bereich - absolut positioniert */}
      <View style={[styles.sideContainer, styles.right, { top: topSpacing }]}>
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
    minWidth: 44,
    height: 44, // gutes Tap-Target
  },
  leftContentWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  right: {
    right: 16,
    minWidth: 44,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  titleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: 64,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 3,
    textAlign: 'center',
  },
  rightContent: {
    paddingHorizontal: 0,
  },
});

export default Header;
