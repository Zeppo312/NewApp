// Schwebender Sprach-Button (Premium) — Einstellung, gespeicherte Position
// und ein kleiner Event-Bus, damit Screens (z. B. Home) nach einem globalen
// Sprach-Eintrag ihre Daten neu laden können.

import { useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ENABLED_KEY = 'voice_floating_button_enabled_v1';
const POSITION_KEY = 'voice_floating_button_position_v1';
const COLOR_KEY = 'voice_floating_button_color_v1';
const ENABLED_EVENT = 'voice-floating-button-enabled-changed';
const COLOR_EVENT = 'voice-floating-button-color-changed';
const SAVED_EVENT = 'voice-log-saved';

export const FLOATING_VOICE_BUTTON_COLORS = [
  { id: 'purple', color: '#9C27B0', darkColor: '#CE93D8', shadowColor: '#4A148C' },
  { id: 'rose', color: '#D85B78', darkColor: '#F19AB0', shadowColor: '#8E2944' },
  { id: 'coral', color: '#E46F51', darkColor: '#F4A28D', shadowColor: '#943B28' },
  { id: 'amber', color: '#D18B20', darkColor: '#F2BD61', shadowColor: '#85540E' },
  { id: 'teal', color: '#2B8F87', darkColor: '#70C8C0', shadowColor: '#155D58' },
  { id: 'blue', color: '#3979C6', darkColor: '#82AFE5', shadowColor: '#204D83' },
] as const;

export type FloatingVoiceButtonColor = (typeof FLOATING_VOICE_BUTTON_COLORS)[number]['id'];
export const DEFAULT_FLOATING_VOICE_BUTTON_COLOR: FloatingVoiceButtonColor = 'purple';

const isFloatingVoiceButtonColor = (value: string | null): value is FloatingVoiceButtonColor =>
  FLOATING_VOICE_BUTTON_COLORS.some((option) => option.id === value);

/** Standard: aus — der Button ist ein Opt-in in den App-Einstellungen. */
export const readFloatingVoiceButtonEnabled = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(ENABLED_KEY)) === '1';
  } catch {
    return false;
  }
};

export const writeFloatingVoiceButtonEnabled = async (enabled: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
  } catch (error) {
    console.warn('Failed to persist floating voice button setting:', error);
  }
  DeviceEventEmitter.emit(ENABLED_EVENT, { enabled });
};

/** Liest die Einstellung und bleibt bei Änderungen (Settings-Screen) aktuell. */
export const useFloatingVoiceButtonEnabled = (): boolean => {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    readFloatingVoiceButtonEnabled().then((value) => {
      if (active) setEnabled(value);
    });
    const subscription = DeviceEventEmitter.addListener(
      ENABLED_EVENT,
      (event: { enabled: boolean }) => setEnabled(event.enabled),
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return enabled;
};

export const readFloatingVoiceButtonColor = async (): Promise<FloatingVoiceButtonColor> => {
  try {
    const stored = await AsyncStorage.getItem(COLOR_KEY);
    return isFloatingVoiceButtonColor(stored) ? stored : DEFAULT_FLOATING_VOICE_BUTTON_COLOR;
  } catch {
    return DEFAULT_FLOATING_VOICE_BUTTON_COLOR;
  }
};

export const writeFloatingVoiceButtonColor = async (color: FloatingVoiceButtonColor): Promise<void> => {
  try {
    await AsyncStorage.setItem(COLOR_KEY, color);
  } catch (error) {
    console.warn('Failed to persist floating voice button color:', error);
  }
  DeviceEventEmitter.emit(COLOR_EVENT, { color });
};

/** Liest die lokal gespeicherte Farbe und aktualisiert den Button sofort. */
export const useFloatingVoiceButtonColor = (): FloatingVoiceButtonColor => {
  const [color, setColor] = useState<FloatingVoiceButtonColor>(DEFAULT_FLOATING_VOICE_BUTTON_COLOR);
  useEffect(() => {
    let active = true;
    readFloatingVoiceButtonColor().then((value) => {
      if (active) setColor(value);
    });
    const subscription = DeviceEventEmitter.addListener(
      COLOR_EVENT,
      (event: { color: FloatingVoiceButtonColor }) => setColor(event.color),
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return color;
};

export type FloatingButtonPosition = { x: number; y: number };

export const readFloatingVoiceButtonPosition = async (): Promise<FloatingButtonPosition | null> => {
  try {
    const raw = await AsyncStorage.getItem(POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FloatingButtonPosition>;
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return null;
    return { x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
};

export const writeFloatingVoiceButtonPosition = (position: FloatingButtonPosition): void => {
  AsyncStorage.setItem(POSITION_KEY, JSON.stringify(position)).catch(() => {});
};

/** Nach erfolgreichem Speichern über den globalen Button. */
export const emitVoiceLogSaved = (): void => {
  DeviceEventEmitter.emit(SAVED_EVENT);
};

export const useVoiceLogSavedListener = (listener: () => void): void => {
  const listenerRef = useRef(listener);
  listenerRef.current = listener;
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(SAVED_EVENT, () => listenerRef.current());
    return () => subscription.remove();
  }, []);
};
