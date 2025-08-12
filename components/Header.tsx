// src/components/Header/Header.tsx (oder dein Pfad)

import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/ThemedText';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightContent?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({ 
  title, 
  subtitle, 
  showBackButton = false, 
  onBackPress,
  rightContent
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  return (
    <View style={[styles.header, { paddingTop: 14 }]}>
      {/* Linker Bereich */}
      <View style={styles.sideContainer}>
        {showBackButton && (
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBackPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <IconSymbol name="chevron.left" size={20} color={theme.text} />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Mittlerer Bereich - immer zentriert */}
      <View style={styles.titleContainer}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        {subtitle && (
          <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
        )}
      </View>
      
      {/* Rechter Bereich */}
      <View style={styles.sideContainer}>
        {rightContent && rightContent}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    marginBottom: 0,
  },
  sideContainer: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  backButton: {
    padding: 0,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#7D5A50',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#A8978E',
    marginTop: 3,
    textAlign: 'center',
  },
  rightContent: {
    paddingHorizontal: 0,
  },
});

export default Header;