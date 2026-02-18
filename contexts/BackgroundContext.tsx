import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { ImageSourcePropType } from 'react-native';

const BACKGROUND_STORAGE_KEY = '@custom_background_uri';
const BACKGROUND_MODE_KEY = '@custom_background_is_dark';
const BACKGROUND_SELECTION_KEY = '@background_selection';
const BACKGROUND_DIR = `${FileSystem.documentDirectory}backgrounds/`;
const BACKGROUND_FILENAME = 'custom_background.jpg';

const defaultBackground = require('@/assets/images/Background_Hell.png');
const presetBackgrounds = {
  default: defaultBackground,
  heller: require('@/assets/images/heller-background.png'),
  dunkler: require('@/assets/images/dunkler-background.png'),
  nightmode: require('@/assets/images/nightmode.png'),
  shadow: require('@/assets/images/Shadow.png'),
  wave: require('@/assets/images/Wave.png'),
  stone: require('@/assets/images/stone.png'),
} as const;

export type BackgroundSelection = keyof typeof presetBackgrounds | 'custom';
export type BackgroundPreset = keyof typeof presetBackgrounds;

const isBackgroundSelection = (value: string | null): value is BackgroundSelection => {
  return (
    value === 'default' ||
    value === 'heller' ||
    value === 'dunkler' ||
    value === 'nightmode' ||
    value === 'shadow' ||
    value === 'wave' ||
    value === 'stone' ||
    value === 'custom'
  );
};

type BackgroundContextType = {
  customUri: string | null;
  selectedBackground: BackgroundSelection;
  backgroundSource: ImageSourcePropType;
  isLoading: boolean;
  hasCustomBackground: boolean;
  isDarkBackground: boolean;
  pickAndSaveBackground: () => Promise<{ success: boolean; needsModeSelection?: boolean; error?: string }>;
  setPresetBackground: (preset: BackgroundPreset) => Promise<void>;
  setBackgroundMode: (isDark: boolean) => Promise<void>;
  resetToDefault: () => Promise<{ success: boolean; error?: string }>;
  refresh: () => Promise<void>;
};

const BackgroundContext = createContext<BackgroundContextType | undefined>(undefined);

type BackgroundProviderProps = {
  children: ReactNode;
};

export function BackgroundProvider({ children }: BackgroundProviderProps) {
  const [customUri, setCustomUri] = useState<string | null>(null);
  const [selectedBackground, setSelectedBackground] = useState<BackgroundSelection>('default');
  const [isLoading, setIsLoading] = useState(true);
  const [isDarkBackground, setIsDarkBackground] = useState(false);

  const loadSavedBackground = useCallback(async () => {
    try {
      const [savedUri, savedMode, savedSelection] = await Promise.all([
        AsyncStorage.getItem(BACKGROUND_STORAGE_KEY),
        AsyncStorage.getItem(BACKGROUND_MODE_KEY),
        AsyncStorage.getItem(BACKGROUND_SELECTION_KEY),
      ]);

      // Lade den Hintergrund-Modus
      setIsDarkBackground(savedMode === 'true');

      let persistedCustomUri: string | null = savedUri;
      if (persistedCustomUri) {
        const fileInfo = await FileSystem.getInfoAsync(persistedCustomUri);
        if (fileInfo.exists) {
        } else {
          persistedCustomUri = null;
          await AsyncStorage.removeItem(BACKGROUND_STORAGE_KEY);
        }
      }

      const normalizedSelection = isBackgroundSelection(savedSelection)
        ? savedSelection
        : (persistedCustomUri ? 'custom' : 'default');
      const effectiveSelection = normalizedSelection === 'custom' && !persistedCustomUri
        ? 'default'
        : normalizedSelection;

      setCustomUri(persistedCustomUri);
      setSelectedBackground(effectiveSelection);

      if (savedSelection !== effectiveSelection) {
        await AsyncStorage.setItem(BACKGROUND_SELECTION_KEY, effectiveSelection);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error loading custom background:', error);
      setCustomUri(null);
      setSelectedBackground('default');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSavedBackground();
  }, [loadSavedBackground]);

  const pickAndSaveBackground = useCallback(async (): Promise<{ success: boolean; needsModeSelection?: boolean; error?: string }> => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        return { success: false, error: 'Zugriff auf Fotos wurde verweigert' };
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        // Kein erzwungener Zuschnitt: vollständiges Bild als Hintergrund verwenden
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) {
        return { success: false };
      }

      const selectedUri = result.assets[0].uri;

      const dirInfo = await FileSystem.getInfoAsync(BACKGROUND_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(BACKGROUND_DIR, { intermediates: true });
      }

      const destinationUri = BACKGROUND_DIR + BACKGROUND_FILENAME;

      const existingFile = await FileSystem.getInfoAsync(destinationUri);
      if (existingFile.exists) {
        await FileSystem.deleteAsync(destinationUri);
      }

      await FileSystem.copyAsync({
        from: selectedUri,
        to: destinationUri,
      });

      await Promise.all([
        AsyncStorage.setItem(BACKGROUND_STORAGE_KEY, destinationUri),
        AsyncStorage.setItem(BACKGROUND_SELECTION_KEY, 'custom'),
      ]);

      // Cache-Busting: Timestamp anhängen für sofortiges Update
      setSelectedBackground('custom');
      setCustomUri(destinationUri + '?t=' + Date.now());
      return { success: true, needsModeSelection: true };
    } catch (error) {
      console.error('Error picking/saving background:', error);
      return { success: false, error: 'Hintergrundbild konnte nicht gespeichert werden' };
    }
  }, []);

  const setPresetBackground = useCallback(async (preset: BackgroundPreset): Promise<void> => {
    try {
      await AsyncStorage.setItem(BACKGROUND_SELECTION_KEY, preset);
      setSelectedBackground(preset);
    } catch (error) {
      console.error('Error saving background preset:', error);
    }
  }, []);

  const setBackgroundMode = useCallback(async (isDark: boolean): Promise<void> => {
    try {
      await AsyncStorage.setItem(BACKGROUND_MODE_KEY, isDark ? 'true' : 'false');
      setIsDarkBackground(isDark);
    } catch (error) {
      console.error('Error saving background mode:', error);
    }
  }, []);

  const resetToDefault = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const savedUri = await AsyncStorage.getItem(BACKGROUND_STORAGE_KEY);
      if (savedUri) {
        // URI ohne Query-Parameter für Datei-Check
        const cleanUri = savedUri.split('?')[0];
        const fileInfo = await FileSystem.getInfoAsync(cleanUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(cleanUri);
        }
      }

      await AsyncStorage.multiRemove([
        BACKGROUND_STORAGE_KEY,
        BACKGROUND_MODE_KEY,
        BACKGROUND_SELECTION_KEY,
      ]);
      setCustomUri(null);
      setSelectedBackground('default');
      setIsDarkBackground(false);
      return { success: true };
    } catch (error) {
      console.error('Error resetting background:', error);
      return { success: false, error: 'Hintergrundbild konnte nicht zurückgesetzt werden' };
    }
  }, []);

  const backgroundSource: ImageSourcePropType = selectedBackground === 'custom'
    ? (customUri ? { uri: customUri } : defaultBackground)
    : presetBackgrounds[selectedBackground];

  return (
    <BackgroundContext.Provider
      value={{
        customUri,
        selectedBackground,
        backgroundSource,
        isLoading,
        hasCustomBackground: selectedBackground !== 'default',
        isDarkBackground,
        pickAndSaveBackground,
        setPresetBackground,
        setBackgroundMode,
        resetToDefault,
        refresh: loadSavedBackground,
      }}
    >
      {children}
    </BackgroundContext.Provider>
  );
}

export function useBackground() {
  const context = useContext(BackgroundContext);
  if (context === undefined) {
    throw new Error('useBackground must be used within a BackgroundProvider');
  }
  return context;
}
