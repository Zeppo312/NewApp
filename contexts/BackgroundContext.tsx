import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

const BACKGROUND_STORAGE_KEY = '@custom_background_uri';
const BACKGROUND_MODE_KEY = '@custom_background_is_dark';
const BACKGROUND_DIR = `${FileSystem.documentDirectory}backgrounds/`;
const BACKGROUND_FILENAME = 'custom_background.jpg';

type BackgroundContextType = {
  customUri: string | null;
  isLoading: boolean;
  hasCustomBackground: boolean;
  isDarkBackground: boolean;
  pickAndSaveBackground: () => Promise<{ success: boolean; needsModeSelection?: boolean; error?: string }>;
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
  const [isLoading, setIsLoading] = useState(true);
  const [isDarkBackground, setIsDarkBackground] = useState(false);

  const loadSavedBackground = useCallback(async () => {
    try {
      const [savedUri, savedMode] = await Promise.all([
        AsyncStorage.getItem(BACKGROUND_STORAGE_KEY),
        AsyncStorage.getItem(BACKGROUND_MODE_KEY),
      ]);

      // Lade den Hintergrund-Modus
      setIsDarkBackground(savedMode === 'true');

      if (savedUri) {
        const fileInfo = await FileSystem.getInfoAsync(savedUri);
        if (fileInfo.exists) {
          setCustomUri(savedUri);
          setIsLoading(false);
          return;
        } else {
          await AsyncStorage.removeItem(BACKGROUND_STORAGE_KEY);
          await AsyncStorage.removeItem(BACKGROUND_MODE_KEY);
        }
      }

      setCustomUri(null);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading custom background:', error);
      setCustomUri(null);
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
        allowsEditing: true,
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

      await AsyncStorage.setItem(BACKGROUND_STORAGE_KEY, destinationUri);

      // Cache-Busting: Timestamp anhängen für sofortiges Update
      setCustomUri(destinationUri + '?t=' + Date.now());
      return { success: true, needsModeSelection: true };
    } catch (error) {
      console.error('Error picking/saving background:', error);
      return { success: false, error: 'Hintergrundbild konnte nicht gespeichert werden' };
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

      await AsyncStorage.removeItem(BACKGROUND_STORAGE_KEY);
      await AsyncStorage.removeItem(BACKGROUND_MODE_KEY);
      setCustomUri(null);
      setIsDarkBackground(false);
      return { success: true };
    } catch (error) {
      console.error('Error resetting background:', error);
      return { success: false, error: 'Hintergrundbild konnte nicht zurückgesetzt werden' };
    }
  }, []);

  return (
    <BackgroundContext.Provider
      value={{
        customUri,
        isLoading,
        hasCustomBackground: customUri !== null,
        isDarkBackground,
        pickAndSaveBackground,
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
