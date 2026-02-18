import React from 'react';
import { ImageBackground, ImageBackgroundProps, Dimensions } from 'react-native';
import { useBackground } from '@/contexts/BackgroundContext';
import { useTheme } from '@/contexts/ThemeContext';

type ThemedBackgroundProps = Omit<ImageBackgroundProps, 'source'> & {
  children: React.ReactNode;
};

const nightModeBackground = require('@/assets/images/nightmode.png');

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
  const { backgroundSource, hasCustomBackground, selectedBackground } = useBackground();
  const { autoDarkModeEnabled, colorScheme } = useTheme();

  // Bildschirmabmessungen für das Hintergrundbild
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  const useAutoNightBackground =
    autoDarkModeEnabled &&
    colorScheme === 'dark' &&
    selectedBackground !== 'custom';

  // Custom Hintergründe und der Auto-Nacht-Hintergrund sollen bildschirmfüllend angezeigt werden.
  const effectiveResizeMode = hasCustomBackground || useAutoNightBackground ? "cover" : resizeMode;
  const effectiveBackgroundSource = useAutoNightBackground ? nightModeBackground : backgroundSource;

  return (
    <ImageBackground
      source={effectiveBackgroundSource}
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
