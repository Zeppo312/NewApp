import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { IconSymbol } from './IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useNavigation } from '@/contexts/NavigationContext';

interface BackButtonProps {
  onPress?: () => void;
  color?: string;
  size?: number;
}

const BackButton: React.FC<BackButtonProps> = ({ 
  onPress, 
  color, 
  size = 24 
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
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
      style={styles.button} 
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <IconSymbol 
        name="chevron.left" 
        size={size} 
        color={color || theme.accent} 
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
});

export default BackButton;
