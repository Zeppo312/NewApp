import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';

interface EmptyStateProps {
  type?: 'day' | 'timeline' | 'week' | 'month';
  message?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'day',
  message = 'Noch nichts eingetragen für heute – los geht\'s!'
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const iconColor = colorScheme === 'dark' ? Colors.dark.text : '#7D5A50';

  // Wähle das passende Icon basierend auf dem Typ
  const getIcon = () => {
    switch (type) {
      case 'day':
        return <IconSymbol name="moon.stars.fill" size={40} color={iconColor} />;
      case 'timeline':
        return <IconSymbol name="clock.fill" size={40} color={iconColor} />;
      case 'week':
        return <IconSymbol name="calendar" size={40} color={iconColor} />;
      case 'month':
        return <IconSymbol name="calendar.badge.plus" size={40} color={iconColor} />;
      default:
        return <IconSymbol name="moon.stars.fill" size={40} color={iconColor} />;
    }
  };
  
  return (
    <ThemedView 
      style={styles.container}
      lightColor="rgba(255, 255, 255, 0.8)"
      darkColor="rgba(30, 30, 30, 0.8)"
    >
      <View style={styles.iconContainer}>
        {getIcon()}
      </View>
      
      <ThemedText style={styles.message}>
        {message}
      </ThemedText>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 40,
    backgroundColor: 'rgba(125, 90, 80, 0.1)',
  },
  message: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(125, 90, 80, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  hint: {
    fontSize: 14,
    marginLeft: 6,
    // color wird dynamisch gesetzt
  },
});

export default EmptyState;
