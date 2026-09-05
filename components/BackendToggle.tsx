import React from 'react';
import { TouchableOpacity, StyleSheet, View, ActivityIndicator } from 'react-native';
import { ThemedText } from './ThemedText';
import { useBackend } from '@/contexts/BackendContext';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

/**
 * BackendToggle Component
 *
 * Displays the current backend (SB/CX) and allows admins to toggle between them.
 * Only visible when isAdmin is true.
 *
 * Usage:
 * <BackendToggle />
 */

export const BackendToggle: React.FC = () => {
  const { activeBackend, setActiveBackend, isAdmin, isLoading } = useBackend();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  // Don't render if not admin
  if (!isAdmin) {
    return null;
  }

  const handleToggle = async () => {
    const newBackend = activeBackend === 'supabase' ? 'convex' : 'supabase';
    await setActiveBackend(newBackend);
  };

  const displayText = activeBackend === 'supabase' ? 'SB' : 'CX';
  const isConvex = activeBackend === 'convex';

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isConvex ? styles.containerConvex : styles.containerSupabase,
      ]}
      onPress={handleToggle}
      activeOpacity={0.7}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <>
          <View
            style={[
              styles.indicator,
              isConvex ? styles.indicatorConvex : styles.indicatorSupabase,
            ]}
          />
          <ThemedText style={styles.text}>{displayText}</ThemedText>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    minWidth: 56,
    justifyContent: 'center',
  },
  containerSupabase: {
    backgroundColor: 'rgba(142, 78, 198, 0.85)', // Purple for Supabase
  },
  containerConvex: {
    backgroundColor: 'rgba(255, 140, 0, 0.85)', // Orange for Convex
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  indicatorSupabase: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  indicatorConvex: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
