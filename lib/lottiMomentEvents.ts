/**
 * Lotti-Moment Events
 *
 * Sehr kleiner Event-Bus, damit nach einem Eintrag (Essen / Pflege / Schlafen)
 * ein dezenter Mini-Banner erscheinen kann, ohne dass jede Save-Stelle den
 * Toast-Code direkt importieren muss.
 *
 * Bewusst keine externe Lib — wir nutzen Reacts NativeEventEmitter über RN.
 */

import { DeviceEventEmitter } from 'react-native';

export type LottiMomentCategory = 'feeding' | 'care' | 'sleep';

const EVENT_NAME = 'lotti-moment-added';

export function emitLottiMoment(category: LottiMomentCategory) {
  try {
    DeviceEventEmitter.emit(EVENT_NAME, { category });
  } catch {
    // Stillschweigend ignorieren — der Toast ist optional.
  }
}

export function addLottiMomentListener(
  listener: (event: { category: LottiMomentCategory }) => void,
) {
  return DeviceEventEmitter.addListener(EVENT_NAME, listener);
}
