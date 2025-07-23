import React, { Suspense, ComponentType } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { ThemedText } from './ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface LazyLoadWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loadingText?: string;
}

// Allgemeine Lazy-Loading Wrapper-Komponente
export function LazyLoadWrapper({ 
  children, 
  fallback, 
  loadingText = "Lade..." 
}: LazyLoadWrapperProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const defaultFallback = (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center',
      padding: 20
    }}>
      <ActivityIndicator size="large" color={theme.accent} />
      <ThemedText style={{ marginTop: 10 }}>{loadingText}</ThemedText>
    </View>
  );

  return (
    <Suspense fallback={fallback || defaultFallback}>
      {children}
    </Suspense>
  );
}

// Höhere Ordnung Komponente für Lazy Loading
export function withLazyLoading<T extends object>(
  Component: ComponentType<T>,
  loadingText?: string
) {
  return function LazyComponent(props: T) {
    return (
      <LazyLoadWrapper loadingText={loadingText}>
        <Component {...props} />
      </LazyLoadWrapper>
    );
  };
}

// Spezifische Lazy-Loading Komponenten für große Module
export const LazySleepTracker = React.lazy(() => 
  import('../app/(tabs)/sleep-tracker').then(module => ({
    default: module.default
  }))
);

export const LazyCommunity = React.lazy(() => 
  import('../app/community').then(module => ({
    default: module.default
  }))
);

export const LazyBabyWeather = React.lazy(() => 
  import('../app/(tabs)/babyweather').then(module => ({
    default: module.default
  }))
);

// Optimierte Komponenten-Exports
export const OptimizedSleepTracker = withLazyLoading(LazySleepTracker, "Schlaf-Tracker wird geladen...");
export const OptimizedCommunity = withLazyLoading(LazyCommunity, "Community wird geladen...");
export const OptimizedBabyWeather = withLazyLoading(LazyBabyWeather, "Babywetter wird geladen...");

export default LazyLoadWrapper;