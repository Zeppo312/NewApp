import React from 'react';
import { View, StyleProp, ViewStyle, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface TablerIconProps {
  name: 'diaper' | 'diaper-unicode' | 'baby-bottle' | 'bed' | 'tools-kitchen-2';
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

const TABLER_ICONS = {
  'diaper': 'M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v6a6 6 0 0 1 -6 6h-4a6 6 0 0 1 -6 -6v-6zm2 1v5a4 4 0 0 0 4 4h4a4 4 0 0 0 4 -4v-5h-12zm2 2h8m-8 2h8',
  'baby-bottle': 'M5 10v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-8a1 1 0 0 0 -1 -1h-12a1 1 0 0 0 -1 1zm2 -2h10v-3a1 1 0 0 0 -1 -1h-8a1 1 0 0 0 -1 1v3zm3 3h4m-4 3h4',
  'bed': 'M3 7v11m0 -4h18m0 4v-8a2 2 0 0 0 -2 -2h-8v6m-5 0h5m0 -6v6m0 -6h8a2 2 0 0 1 2 2v2',
  'tools-kitchen-2': 'M19 3v12h-5c-.023 -3.681 .184 -7.406 5 -12zm0 12v6h-1v-3m-10 -14v17m-3 -17v3a3 3 0 1 0 6 0v-3'
};

export function TablerIcon({ 
  name, 
  size = 24, 
  color = '#000000', 
  style 
}: TablerIconProps) {
  // Special case for Unicode diaper symbol
  if (name === 'diaper-unicode') {
    return (
      <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
        <Text style={{ fontSize: size * 0.8, color: color }}>
          {String.fromCharCode(0xffa2)}
        </Text>
      </View>
    );
  }

  const pathData = TABLER_ICONS[name as keyof typeof TABLER_ICONS];

  if (!pathData) {
    console.warn(`TablerIcon: Icon "${name}" not found`);
    return null;
  }

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d={pathData} />
      </Svg>
    </View>
  );
} 