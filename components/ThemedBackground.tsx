import React from 'react';
import { ImageBackground, ImageBackgroundProps, Dimensions } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTheme } from '@/contexts/ThemeContext';

type ThemedBackgroundProps = Omit<ImageBackgroundProps, 'source'> & {
  children: React.ReactNode;
};

/**
 * Eine Komponente, die das richtige Hintergrundbild basierend auf dem aktuellen Farbschema (hell/dunkel) anzeigt.
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

  // Bildschirmabmessungen für das Hintergrundbild
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  // Wähle das richtige Hintergrundbild basierend auf dem Farbschema
  const backgroundImage = require('@/assets/images/Background_Hell.png');

  return (
    <ImageBackground
      source={backgroundImage}
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
      resizeMode={resizeMode}
      {...rest}
    >
      {children}
    </ImageBackground>
  );
}
