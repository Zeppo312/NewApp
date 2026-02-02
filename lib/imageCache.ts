/**
 * 🖼️ IMAGE CACHE - Lokales Caching für Remote-Bilder
 *
 * Reduziert Netzwerk-Traffic durch:
 * - Lokales Speichern von Remote-Bildern
 * - Hash-basierte Dateinamen für Cache-Invalidierung
 * - Automatische Cache-Bereinigung bei Speichermangel
 * - Schneller Zugriff auf bereits geladene Bilder
 */

import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache-Verzeichnis
const IMAGE_CACHE_DIR = `${FileSystem.cacheDirectory}images/`;

// Cache-Metadaten für Invalidierung
const CACHE_METADATA_KEY = 'image_cache_metadata';
const MAX_CACHE_AGE_MS = 10 * 24 * 60 * 60 * 1000; // 10 Tage
const MAX_CACHE_SIZE_MB = 100; // 100 MB max

interface CacheMetadata {
  [hash: string]: {
    url: string;
    cachedAt: number;
    size: number;
    etag?: string;
  };
}

let metadataCache: CacheMetadata | null = null;

/**
 * Initialisiere das Cache-Verzeichnis
 */
const ensureCacheDir = async (): Promise<void> => {
  const dirInfo = await FileSystem.getInfoAsync(IMAGE_CACHE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(IMAGE_CACHE_DIR, { intermediates: true });
  }
};

/**
 * Erzeuge einen Hash aus der URL für den Dateinamen
 */
const getUrlHash = async (url: string): Promise<string> => {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.MD5,
    url
  );
  return hash;
};

/**
 * Extrahiere die Dateiendung aus der URL
 */
const getFileExtension = (url: string): string => {
  const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match ? `.${match[1]}` : '.jpg';
};

/**
 * Lade Metadaten aus AsyncStorage
 */
const loadMetadata = async (): Promise<CacheMetadata> => {
  if (metadataCache) return metadataCache;

  try {
    const stored = await AsyncStorage.getItem(CACHE_METADATA_KEY);
    metadataCache = stored ? JSON.parse(stored) : {};
    return metadataCache!;
  } catch {
    metadataCache = {};
    return metadataCache;
  }
};

/**
 * Speichere Metadaten
 */
const saveMetadata = async (metadata: CacheMetadata): Promise<void> => {
  metadataCache = metadata;
  try {
    await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));
  } catch (err) {
    console.warn('Failed to save image cache metadata:', err);
  }
};

/**
 * Prüfe ob ein gecachtes Bild noch gültig ist
 */
const isCacheValid = (entry: CacheMetadata[string]): boolean => {
  const age = Date.now() - entry.cachedAt;
  return age < MAX_CACHE_AGE_MS;
};

/**
 * Hauptfunktion: Hole ein gecachtes Bild oder lade es herunter
 *
 * @param url - Die Remote-URL des Bildes
 * @param forceRefresh - Optional: Cache ignorieren und neu laden
 * @returns Die lokale URI des Bildes
 */
export const getCachedImage = async (
  url: string,
  forceRefresh = false
): Promise<string> => {
  // Leere URLs ignorieren
  if (!url || url.trim() === '') {
    return url;
  }

  // Lokale Bilder nicht cachen
  if (url.startsWith('file://') || url.startsWith('asset://')) {
    return url;
  }

  try {
    await ensureCacheDir();
    const hash = await getUrlHash(url);
    const extension = getFileExtension(url);
    const localPath = `${IMAGE_CACHE_DIR}${hash}${extension}`;

    // Metadaten laden
    const metadata = await loadMetadata();
    const entry = metadata[hash];

    // Cache-Hit prüfen
    if (!forceRefresh && entry && isCacheValid(entry)) {
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (fileInfo.exists) {
        return localPath;
      }
    }

    // Bild herunterladen
    const downloadResult = await FileSystem.downloadAsync(url, localPath);

    if (downloadResult.status === 200) {
      // Metadaten aktualisieren
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      metadata[hash] = {
        url,
        cachedAt: Date.now(),
        size: (fileInfo as any).size || 0,
        etag: downloadResult.headers?.['etag'],
      };
      await saveMetadata(metadata);

      return localPath;
    }

    // Bei Fehler Original-URL zurückgeben
    return url;
  } catch (error) {
    console.warn('Image cache error:', error);
    return url;
  }
};

/**
 * Prüfe ob ein Bild im Cache ist (ohne zu laden)
 */
export const isImageCached = async (url: string): Promise<boolean> => {
  if (!url) return false;

  try {
    const hash = await getUrlHash(url);
    const metadata = await loadMetadata();
    const entry = metadata[hash];

    if (!entry || !isCacheValid(entry)) return false;

    const extension = getFileExtension(url);
    const localPath = `${IMAGE_CACHE_DIR}${hash}${extension}`;
    const fileInfo = await FileSystem.getInfoAsync(localPath);

    return fileInfo.exists;
  } catch {
    return false;
  }
};

/**
 * Prefetch: Lade mehrere Bilder im Voraus
 */
export const prefetchImages = async (urls: string[]): Promise<void> => {
  const validUrls = urls.filter(url => url && !url.startsWith('file://'));

  await Promise.allSettled(
    validUrls.map(url => getCachedImage(url))
  );
};

/**
 * Cache für eine bestimmte URL invalidieren
 */
export const invalidateImageCache = async (url: string): Promise<void> => {
  if (!url) return;

  try {
    const hash = await getUrlHash(url);
    const extension = getFileExtension(url);
    const localPath = `${IMAGE_CACHE_DIR}${hash}${extension}`;

    const metadata = await loadMetadata();
    delete metadata[hash];
    await saveMetadata(metadata);

    await FileSystem.deleteAsync(localPath, { idempotent: true });
  } catch (err) {
    console.warn('Failed to invalidate image cache:', err);
  }
};

/**
 * Berechne die Cache-Größe in MB
 */
export const getCacheSize = async (): Promise<number> => {
  try {
    const metadata = await loadMetadata();
    let totalSize = 0;

    for (const entry of Object.values(metadata)) {
      totalSize += entry.size || 0;
    }

    return totalSize / (1024 * 1024); // In MB
  } catch {
    return 0;
  }
};

/**
 * Bereinige alte Cache-Einträge
 */
export const cleanupCache = async (): Promise<{ removed: number; freedMB: number }> => {
  try {
    await ensureCacheDir();
    const metadata = await loadMetadata();
    let removed = 0;
    let freedBytes = 0;

    const now = Date.now();
    const toDelete: string[] = [];

    // Finde abgelaufene Einträge
    for (const [hash, entry] of Object.entries(metadata)) {
      if (now - entry.cachedAt > MAX_CACHE_AGE_MS) {
        toDelete.push(hash);
        freedBytes += entry.size || 0;
      }
    }

    // Lösche Dateien und Metadaten
    for (const hash of toDelete) {
      const entry = metadata[hash];
      const extension = getFileExtension(entry.url);
      const localPath = `${IMAGE_CACHE_DIR}${hash}${extension}`;

      await FileSystem.deleteAsync(localPath, { idempotent: true });
      delete metadata[hash];
      removed++;
    }

    await saveMetadata(metadata);

    return {
      removed,
      freedMB: freedBytes / (1024 * 1024),
    };
  } catch (err) {
    console.warn('Cache cleanup error:', err);
    return { removed: 0, freedMB: 0 };
  }
};

/**
 * Lösche den gesamten Bild-Cache
 */
export const clearImageCache = async (): Promise<void> => {
  try {
    await FileSystem.deleteAsync(IMAGE_CACHE_DIR, { idempotent: true });
    metadataCache = {};
    await AsyncStorage.removeItem(CACHE_METADATA_KEY);
    await ensureCacheDir();
  } catch (err) {
    console.warn('Failed to clear image cache:', err);
  }
};

/**
 * Cache-Statistiken für Debugging
 */
export const getCacheStats = async (): Promise<{
  entries: number;
  sizeMB: number;
  oldestEntry: Date | null;
}> => {
  try {
    const metadata = await loadMetadata();
    const entries = Object.keys(metadata).length;
    let totalSize = 0;
    let oldest = Date.now();

    for (const entry of Object.values(metadata)) {
      totalSize += entry.size || 0;
      if (entry.cachedAt < oldest) {
        oldest = entry.cachedAt;
      }
    }

    return {
      entries,
      sizeMB: totalSize / (1024 * 1024),
      oldestEntry: entries > 0 ? new Date(oldest) : null,
    };
  } catch {
    return { entries: 0, sizeMB: 0, oldestEntry: null };
  }
};
