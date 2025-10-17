import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { GLASS_BORDER, GLASS_OVERLAY, PRIMARY } from '@/constants/PlannerDesign';

type Props = {
  onPress: () => void;
  bottomInset?: number;
  rightInset?: number;
};

export const FloatingAddButton: React.FC<Props> = ({ onPress, bottomInset = 16, rightInset = 16 }) => {
  return (
    <View style={[styles.wrap, { bottom: bottomInset, right: rightInset }] } pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Schnell hinzufügen"
        style={({ pressed }) => [styles.btn, pressed && { transform: [{ scale: 0.98 }] }]}
      >
        <BlurView intensity={22} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: GLASS_OVERLAY, borderRadius: 28, borderWidth: 1, borderColor: GLASS_BORDER }]} />
        <IconSymbol name="plus" color={PRIMARY as any} size={26} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute', zIndex: 10, alignItems: 'flex-end' },
  btn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
});

export default FloatingAddButton;
