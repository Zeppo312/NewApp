import React, { createContext, useContext, useState, useRef } from 'react';
import { useRouter, usePathname } from 'expo-router';

interface NavigationContextType {
  goBack: () => void;
  setFallbackRoute: (route: string) => void;
  getCurrentRoute: () => string;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [fallbackRoute, setFallbackRoute] = useState<string>('/(tabs)/home');
  const navigationHistory = useRef<string[]>([]);
  const lastRoute = useRef<string>('');

  // Track navigation history
  React.useEffect(() => {
    if (pathname && pathname !== lastRoute.current) {
      // Don't track the same route twice in a row
      if (navigationHistory.current[navigationHistory.current.length - 1] !== lastRoute.current && lastRoute.current) {
        navigationHistory.current.push(lastRoute.current);
      }
      
      // Keep only last 10 routes to prevent memory issues
      if (navigationHistory.current.length > 10) {
        navigationHistory.current = navigationHistory.current.slice(-10);
      }
      
      lastRoute.current = pathname;
    }
  }, [pathname]);

  const goBack = () => {
    try {
      // Try to use the navigation history first
      if (navigationHistory.current.length > 0) {
        const previousRoute = navigationHistory.current.pop();
        if (previousRoute && previousRoute !== pathname) {
          router.push(previousRoute as any);
          return;
        }
      }

      // Fallback to router.back()
      if (router.canGoBack?.()) {
        router.back();
        return;
      }

      // Last resort: go to fallback route
      router.push(fallbackRoute as any);
    } catch (error) {
      console.warn('Navigation error, going to fallback:', error);
      router.push(fallbackRoute as any);
    }
  };

  const getCurrentRoute = () => pathname || '';

  return (
    <NavigationContext.Provider value={{
      goBack,
      setFallbackRoute,
      getCurrentRoute,
    }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}

// Helper hook for smart back navigation with context-aware fallbacks
export function useSmartBack(contextualFallback?: string) {
  const { goBack, setFallbackRoute, getCurrentRoute } = useNavigation();
  
  React.useEffect(() => {
    if (contextualFallback) {
      setFallbackRoute(contextualFallback);
    }
  }, [contextualFallback, setFallbackRoute]);

  return goBack;
}
