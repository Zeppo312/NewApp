import React from 'react';
import { ImageBackground, ImageBackgroundProps, Dimensions } from 'react-native';
import { useBackground } from '@/contexts/BackgroundContext';

type ThemedBackgroundProps = Omit<ImageBackgroundProps, 'source'> & {
  children: React.ReactNode;
};

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
  const { backgroundSource, hasCustomBackground } = useBackground();

  // Bildschirmabmessungen für das Hintergrundbild
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  // Custom Hintergründe bildschirmfüllend anzeigen
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
