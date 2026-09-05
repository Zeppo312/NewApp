import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { IconSymbol } from './ui/IconSymbol';
import { useNavigation } from '@/contexts/NavigationContext';

interface BackButtonProps {
  onPress?: () => void;
  label?: string;
  showLabel?: boolean;
}

export const BackButton: React.FC<BackButtonProps> = ({
  onPress,
  label = 'Zurück',
  showLabel = false
}) => {
  const navigation = useNavigation();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      navigation.goBack();
    }
  };

  return (
    <TouchableOpacity
      style={styles.backButton}
      onPress={handlePress}
    >
      <ThemedView
        style={styles.backButtonInner}
        lightColor="rgba(255, 255, 255, 0.9)"
        darkColor="rgba(50, 50, 50, 0.9)"
      >
        <IconSymbol name="chevron.left" size={24} color="#E57373" />
        {showLabel && label && (
          <ThemedText style={styles.backButtonText}>
            {label}
          </ThemedText>
        )}
      </ThemedView>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
  },
  backButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    flexDirection: 'row',
  },
  backButtonText: {
    fontSize: 16,
    marginLeft: 4,
    color: '#E57373',
  },
});
