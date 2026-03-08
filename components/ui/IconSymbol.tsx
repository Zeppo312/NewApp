// This file is a fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight } from 'expo-symbols';
import React from 'react';
import { OpaqueColorValue, StyleProp, TextStyle } from 'react-native';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

// Add your SFSymbol to MaterialIcons mappings here.
const MAPPING: Record<string, MaterialIconName> = {
  // See MaterialIcons here: https://icons.expo.fyi
  // See SF Symbols in the SF Symbols app on Mac.
  'arrow.clockwise': 'refresh',
  'arrow.counterclockwise': 'undo',
  'arrow.down.doc': 'download',
  'arrow.left.and.right': 'swap-horiz',
  'arrow.left.arrow.right': 'compare-arrows',
  'arrow.right.circle.fill': 'arrow-right-alt',
  'arrow.triangle.2.circlepath': 'sync',
  'arrow.up.right': 'open-in-new',
  'arrowshape.turn.up.left': 'reply',
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'chevron.down': 'keyboard-arrow-down',
  'book.fill': 'book',
  'bag.fill': 'shopping-bag',
  'bell': 'notifications-none',
  'bell.slash': 'notifications-off',
  'bubble.right': 'chat-bubble-outline',
  'building.2.fill': 'business',
  'calendar.badge.plus': 'event-available',
  'camera': 'camera-alt',
  'chart.xyaxis.line': 'insights',
  'checkmark': 'check',
  'checkmark.circle.fill': 'check-circle',
  'checkmark.seal.fill': 'verified',
  'circle.fill': 'circle',
  'clock.badge': 'alarm',
  'clock.fill': 'schedule',
  'magnifyingglass': 'search',
  'xmark.circle.fill': 'cancel',
  'xmark.circle': 'cancel',
  'doc.text.fill': 'description',
  'doc.text': 'description',
  'doc.on.doc': 'content-copy',
  'drop.fill': 'opacity',
  'envelope': 'email',
  'moon.stars.fill': 'nightlight',
  'moon.stars': 'bedtime',
  'moon.zzz': 'hotel',
  'moon': 'dark-mode',
  'heart.fill': 'favorite',
  'chart.bar.fill': 'bar-chart',
  'person.2.fill': 'people',
  'person.2': 'groups',
  'person.badge.plus': 'person-add',
  'person.circle': 'account-circle',
  'person.text.rectangle': 'badge',
  'star.fill': 'star',
  'star': 'star-border',
  'clock': 'access-time',
  'doc.text.magnifyingglass': 'find-in-page',
  'person.fill': 'person',
  'calendar': 'calendar-today',
  'timer': 'timer',
  'checklist': 'checklist',
  'questionmark.circle.fill': 'help',
  'questionmark.circle': 'help-outline',
  'info.circle.fill': 'info',
  'info.circle': 'info',
  'gear': 'settings',
  'person.crop.circle': 'account-circle',
  'arrow.uturn.backward': 'arrow-back',
  'exclamationmark.triangle.fill': 'warning',
  'exclamationmark.triangle': 'warning-amber',
  'ellipsis.circle.fill': 'more-horiz',
  'calendar.badge.exclamationmark': 'event-busy',
  'trash': 'delete',
  'trash.fill': 'delete',
  'trash.circle.fill': 'delete-forever',
  'location': 'location-on',
  'location.fill': 'place',
  'ruler': 'straighten',
  'ruler.fill': 'straighten',
  'wind': 'air',
  'humidity': 'water-drop',
  'plus': 'add',
  'plus.circle': 'add-circle',
  'plus.circle.fill': 'add-circle',
  'minus': 'remove',
  'minus.circle.fill': 'remove-circle',
  'photo': 'image',
  'figure.child': 'child-care',
  'figure.walk': 'directions-walk',
  'flag.fill': 'flag',
  'fork.knife': 'restaurant',
  'fork.knife.circle.fill': 'restaurant',
  'bed.double.fill': 'bed',
  'bubble.left.and.bubble.right.fill': 'forum',
  'text.bubble': 'chat',
  'chart.line.uptrend.xyaxis': 'show-chart',
  'cloud.sun.fill': 'wb-sunny',
  'sun.max.fill': 'wb-sunny',
  'sun.max': 'wb-sunny',
  'close': 'close',
  'envelope.fill': 'email',
  'lightbulb.fill': 'lightbulb',
  'list.bullet': 'format-list-bulleted',
  'line.3.horizontal.decrease': 'filter-list',
  'link': 'link',
  'moon.fill': 'dark-mode',
  'mouth.fill': 'sentiment-satisfied',
  'number': 'looks-one',
  'pause.fill': 'pause',
  'pencil': 'edit',
  'pencil.circle.fill': 'edit',
  'play.fill': 'play-arrow',
  'scalemass': 'monitor-weight',
  'sparkles': 'auto-awesome',
  'share': 'share',
  'square.and.arrow.up': 'ios-share',
  'stop.circle.fill': 'stop-circle',
  'stop.fill': 'stop',
  'tag': 'sell',
  'tray': 'inbox',
  'tray.and.arrow.down.fill': 'download-for-offline',
  'tray.full.fill': 'inventory-2',
  'waveform.path.ecg': 'monitor-heart',
  'wrench.fill': 'build',
  'xmark': 'close',
  'zzz': 'snooze',
};

export type IconSymbolName = string;
const FALLBACK_ICON: MaterialIconName = 'help-outline';

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
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name] ?? FALLBACK_ICON} style={style} />;
}
