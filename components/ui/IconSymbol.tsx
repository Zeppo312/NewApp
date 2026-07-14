// This file is a fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight } from 'expo-symbols';
import React from 'react';
import { OpaqueColorValue, StyleProp, ViewStyle } from 'react-native';

// Add your SFSymbol to MaterialIcons mappings here.
const MAPPING = {
  // See MaterialIcons here: https://icons.expo.fyi
  // See SF Symbols in the SF Symbols app on Mac.
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'book.fill': 'book',
  'magnifyingglass': 'search',
  'xmark.circle.fill': 'cancel',
  'doc.text.fill': 'description',
  'drop.fill': 'opacity',
  'moon.stars.fill': 'nightlight',
  'heart.fill': 'favorite',
  'chart.bar.fill': 'bar_chart',
  'person.2.fill': 'people',
  'star.fill': 'star',
  'star': 'star_border',
  'clock': 'access_time',
  'doc.text.magnifyingglass': 'find_in_page',
  'person.fill': 'person',
  'calendar': 'calendar_today',
  'timer': 'timer',
  'checklist': 'checklist',
  'questionmark.circle.fill': 'help',
  'info.circle.fill': 'info',
  'gear': 'settings',
  'person.crop.circle': 'account_circle',
  'arrow.uturn.backward': 'arrow_back',
  'exclamationmark.triangle.fill': 'warning',
  'ellipsis.circle.fill': 'more_horiz',
  'calendar.badge.exclamationmark': 'event_busy',
  'trash': 'delete',
  'location': 'location_on',
  'wind': 'air',
  'humidity': 'water_drop',
  'plus': 'add',
  'photo': 'image',
  'fork.knife.circle.fill': 'restaurant',
} as Partial<
  Record<
    import('expo-symbols').SymbolViewProps['name'],
    React.ComponentProps<typeof MaterialIcons>['name']
  >
>;

export type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses native SFSymbols on iOS, and MaterialIcons on Android and web. This ensures a consistent look across platforms, and optimal resource usage.
 *
 * Icon `name`s are based on SFSymbols and require manual mapping to MaterialIcons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
