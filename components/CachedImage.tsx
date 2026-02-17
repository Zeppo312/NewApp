/**
 * 🖼️ CachedImage - Automatisch gecachte Bilder
 *
 * Verwendet das imageCache-System für automatisches Caching von Remote-Bildern.
 * Drop-in Ersatz für React Native's Image-Komponente.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Image,
  ImageProps,
  ImageSourcePropType,
  ActivityIndicator,
  View,
  StyleSheet,
} from 'react-native';
import { getCachedImage, isImageCached } from '@/lib/imageCache';

interface CachedImageProps extends Omit<ImageProps, 'source'> {
  /**
   * Die Bild-URL (Remote oder lokal)
   */
  uri: string;

  /**
   * Fallback-Bild bei Ladefehler
   */
  fallbackSource?: ImageSourcePropType;

  /**
   * Zeige Ladeindikator während des Ladens
   */
  showLoader?: boolean;

  /**
   * Farbe des Ladeindikators
   */
  loaderColor?: string;

  /**
   * Cache ignorieren und neu laden
   */
  forceRefresh?: boolean;

  /**
   * Callback wenn das Bild geladen wurde
   */
  onCached?: (localUri: string) => void;
}

export const CachedImage: React.FC<CachedImageProps> = ({
  uri,
  fallbackSource,
  showLoader = true,
  loaderColor = '#E9C9B6',
  forceRefresh = false,
  onCached,
  style,
  ...imageProps
}) => {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const loadImage = useCallback(async () => {
    if (!uri) {
      setIsLoading(false);
      setHasError(true);
      return;
    }

    // Lokale Bilder direkt verwenden
    if (
      uri.startsWith('file://') ||
      uri.startsWith('asset://') ||
      uri.startsWith('data:image/')
    ) {
      setLocalUri(uri);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setHasError(false);

      // Prüfe ob bereits gecacht
      const cached = await isImageCached(uri);
      if (cached && !forceRefresh) {
        const cachedUri = await getCachedImage(uri, false);
        setLocalUri(cachedUri);
        setIsLoading(false);
        onCached?.(cachedUri);
        return;
      }

      // Lade und cache das Bild
      const cachedUri = await getCachedImage(uri, forceRefresh);
      setLocalUri(cachedUri);
      onCached?.(cachedUri);
    } catch (error) {
      console.warn('CachedImage load error:', error);
      setHasError(true);
      // Fallback auf Original-URL
      setLocalUri(uri);
    } finally {
      setIsLoading(false);
    }
  }, [uri, forceRefresh, onCached]);

  useEffect(() => {
    loadImage();
  }, [loadImage]);

  // Ladeindikator anzeigen
  if (isLoading && showLoader) {
    return (
      <View style={[styles.loaderContainer, style]}>
        <ActivityIndicator size="small" color={loaderColor} />
      </View>
    );
  }

  // Fehler mit Fallback-Bild
  if (hasError && fallbackSource) {
    return <Image source={fallbackSource} style={style} {...imageProps} />;
  }

  // Kein Bild verfügbar
  if (!localUri) {
    if (fallbackSource) {
      return <Image source={fallbackSource} style={style} {...imageProps} />;
    }
    return <View style={[styles.placeholder, style]} />;
  }

  return (
    <Image
      source={{ uri: localUri }}
      style={style}
      onError={() => {
        if (fallbackSource) {
          setHasError(true);
        }
      }}
      {...imageProps}
    />
  );
};

/**
 * Hook für manuelles Caching von Bildern
 */
export const useCachedImage = (uri: string, forceRefresh = false) => {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!uri) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const cached = await getCachedImage(uri, forceRefresh);
        if (mounted) {
          setLocalUri(cached);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
          setLocalUri(uri); // Fallback auf Original
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [uri, forceRefresh]);

  return { localUri, isLoading, error };
};

const styles = StyleSheet.create({
  loaderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  placeholder: {
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
});

export default CachedImage;
