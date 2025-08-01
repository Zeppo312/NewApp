import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    // Swap the detected color scheme so light mode users see the dark theme and
    // vice versa.
    if (colorScheme === 'light') {
      return 'dark';
    }
    if (colorScheme === 'dark') {
      return 'light';
    }
    return 'light';
  }

  // Default to the inverted light theme before hydration.
  return 'dark';
}
