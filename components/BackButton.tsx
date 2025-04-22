import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { IconSymbol } from './ui/IconSymbol';
import { useRouter } from 'expo-router';

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
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Standard-Verhalten: Zurück zur vorherigen Seite
      router.back();
    }
  };

  return (
    <TouchableOpacity
      style={styles.backButton}
      onPress={handlePress}
    >
      <IconSymbol name="chevron.left" size={24} color="#E57373" />
      {showLabel && label && (
        <ThemedText style={styles.backButtonText}>
          {label}
        </ThemedText>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    alignSelf: 'flex-start',
    flexDirection: 'row',
  },
  backButtonText: {
    fontSize: 16,
    marginLeft: 4,
    color: '#E57373',
  },
});
