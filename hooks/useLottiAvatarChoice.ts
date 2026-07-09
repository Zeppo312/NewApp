/**
 * useLottiAvatarChoice
 *
 * Persistiert, welches freigeschaltete Lotti-Bild (Stufe 1–30) als Avatar
 * angezeigt wird — pro Baby in AsyncStorage. null = keine Wahl getroffen,
 * dann entscheidet die aufrufende Komponente (z. B. Zufallsbild).
 *
 * Mehrere gemountete Oberflächen (Sammlung, Home-Karte, Reise) teilen sich
 * zusaetzlich einen kleinen In-Memory-Store, damit die Auswahl sofort sichtbar
 * wird und nicht erst nach einem Remount oder Tab-Wechsel.
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useActiveBaby } from '@/contexts/ActiveBabyContext';

const AVATAR_KEY = (babyId: string | null | undefined) =>
  `lotti_avatar_choice:${babyId ?? 'default'}`;

type AvatarChoiceSnapshot = {
  chosenLevel: number | null;
  isLoaded: boolean;
};
type AvatarChoiceListener = () => void;

const DEFAULT_AVATAR_CHOICE_SNAPSHOT: AvatarChoiceSnapshot = {
  chosenLevel: null,
  isLoaded: false,
};

const avatarChoiceSnapshots = new Map<string, AvatarChoiceSnapshot>();
const avatarChoiceVersions = new Map<string, number>();
const avatarChoiceListeners = new Map<string, Set<AvatarChoiceListener>>();

function parseStoredLevel(stored: string | null): number | null {
  const parsed = stored === null ? NaN : parseInt(stored, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : null;
}

function publishAvatarChoice(storageKey: string, level: number | null) {
  const previous =
    avatarChoiceSnapshots.get(storageKey) ?? DEFAULT_AVATAR_CHOICE_SNAPSHOT;

  if (previous.chosenLevel === level && previous.isLoaded) {
    return;
  }

  avatarChoiceSnapshots.set(storageKey, {
    chosenLevel: level,
    isLoaded: true,
  });
  avatarChoiceVersions.set(
    storageKey,
    (avatarChoiceVersions.get(storageKey) ?? 0) + 1,
  );
  avatarChoiceListeners.get(storageKey)?.forEach((listener) => listener());
}

function getAvatarChoiceSnapshot(storageKey: string): AvatarChoiceSnapshot {
  return (
    avatarChoiceSnapshots.get(storageKey) ?? DEFAULT_AVATAR_CHOICE_SNAPSHOT
  );
}

function subscribeAvatarChoice(
  storageKey: string,
  listener: AvatarChoiceListener,
) {
  const listeners = avatarChoiceListeners.get(storageKey) ?? new Set();
  listeners.add(listener);
  avatarChoiceListeners.set(storageKey, listeners);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      avatarChoiceListeners.delete(storageKey);
    }
  };
}

export function useLottiAvatarChoice() {
  const { activeBabyId } = useActiveBaby();
  const storageKey = AVATAR_KEY(activeBabyId);
  const subscribe = useCallback(
    (listener: AvatarChoiceListener) =>
      subscribeAvatarChoice(storageKey, listener),
    [storageKey],
  );
  const getSnapshot = useCallback(
    () => getAvatarChoiceSnapshot(storageKey),
    [storageKey],
  );
  const { chosenLevel, isLoaded } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  );

  useEffect(() => {
    let cancelled = false;
    const readVersion = avatarChoiceVersions.get(storageKey) ?? 0;

    AsyncStorage.getItem(storageKey)
      .then((stored) => {
        if (cancelled) return;
        if ((avatarChoiceVersions.get(storageKey) ?? 0) !== readVersion) {
          return;
        }
        publishAvatarChoice(storageKey, parseStoredLevel(stored));
      })
      .catch(() => {
        if (cancelled) return;
        if ((avatarChoiceVersions.get(storageKey) ?? 0) === readVersion) {
          publishAvatarChoice(storageKey, null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const chooseLevel = useCallback(
    async (level: number) => {
      const safeLevel = Number.isFinite(level) && level >= 1
        ? Math.floor(level)
        : null;
      publishAvatarChoice(storageKey, safeLevel);

      try {
        if (safeLevel === null) {
          await AsyncStorage.removeItem(storageKey);
        } else {
          await AsyncStorage.setItem(storageKey, String(safeLevel));
        }
      } catch {
        // Persistenz ist optional — Wahl gilt für die Session.
      }
    },
    [storageKey],
  );

  return { chosenLevel, chooseLevel, isLoaded };
}
