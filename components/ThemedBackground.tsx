import React from 'react';
import { ImageBackground, ImageBackgroundProps, Dimensions } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTheme } from '@/contexts/ThemeContext';
import { useBackground } from '@/contexts/BackgroundContext';

type ThemedBackgroundProps = Omit<ImageBackgroundProps, 'source'> & {
  children: React.ReactNode;
};

// Default Hintergrundbild
const defaultBackground = require('@/assets/images/Background_Hell.png');

/**
 * Eine Komponente, die das richtige Hintergrundbild basierend auf dem aktuellen Farbschema (hell/dunkel) anzeigt.
 * Unterstützt auch benutzerdefinierte Hintergrundbilder.
 *
 * Verwendung:
 * ```jsx
 * <ThemedBackground>
 *   <YourContent />
 * </ThemedBackground>
 * ```
 */
export function ThemedBackground({ children, style, resizeMode = "repeat", ...rest }: ThemedBackgroundProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const { customUri, hasCustomBackground } = useBackground();

  // Bildschirmabmessungen für das Hintergrundbild
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  // Custom Bild oder Default verwenden
  const backgroundSource = hasCustomBackground && customUri
    ? { uri: customUri }
    : defaultBackground;

  // Bei custom Bildern "cover" statt "repeat" verwenden
  const effectiveResizeMode = hasCustomBackground ? "cover" : resizeMode;

  return (
    <ImageBackground
      source={backgroundSource}
      style={[
        {
          width: screenWidth,
          height: screenHeight,
          flex: 1,
          justifyContent: 'flex-start',
          alignItems: 'stretch'
        },
        style
      ]}
      resizeMode={effectiveResizeMode}
      {...rest}
    >
      {children}
    </ImageBackground>
  );
}
