// src/components/Header/Header.tsx (oder dein Pfad)

import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
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
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  showBabySwitcher?: boolean;
}

// Original-Farben für hellen Modus
const HEADER_TITLE_COLOR = '#7D5A50';
const HEADER_SUBTITLE_COLOR = '#A8978E';

const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBackButton = false,
  onBackPress,
  leftContent,
  rightContent,
  showBabySwitcher = true
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const navigation = useNavigation();
  const adaptiveColors = useAdaptiveColors();

  // Nur bei dunklem Hintergrundbild die adaptiven Farben verwenden
  const useDarkMode = adaptiveColors.hasCustomBackground && adaptiveColors.isDarkBackground;
  const titleColor = useDarkMode ? adaptiveColors.textPrimary : HEADER_TITLE_COLOR;
  const subtitleColor = useDarkMode ? adaptiveColors.textTertiary : HEADER_SUBTITLE_COLOR;
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
    <View style={styles.header}>
      {/* Linker Bereich - absolut positioniert */}
      <View style={[styles.sideContainer, styles.left]}>
        <View style={styles.leftContentWrapper}>
          {showBackButton && (
            <TouchableOpacity
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
      <View style={[styles.sideContainer, styles.right]}>
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
