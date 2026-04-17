import {
  Redirect,
  usePathname,
  useRouter,
  useSegments,
  withLayoutContext,
} from 'expo-router';
import {
  BottomTabNavigationEventMap,
  BottomTabNavigationOptions,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { ParamListBase, TabNavigationState } from '@react-navigation/native';
import React, { useEffect, useMemo } from 'react';
import { Platform, View, ActivityIndicator, Text } from 'react-native';
import type { ComponentProps } from 'react';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useCommunityUnreadCounts } from '@/hooks/useCommunityUnreadCounts';
import { getOnboardingCompletionState } from '@/lib/onboarding';

const BottomTabNavigator = createBottomTabNavigator().Navigator;

const ExpoTabs = withLayoutContext<
  BottomTabNavigationOptions,
  typeof BottomTabNavigator,
  TabNavigationState<ParamListBase>,
  BottomTabNavigationEventMap
>(BottomTabNavigator);

type BottomTabRouter = NonNullable<
  ComponentProps<typeof BottomTabNavigator>['UNSTABLE_router']
>;

const createEmptyTabPartialState = () =>
  ({
    stale: true,
    routes: [],
    history: [],
    preloadedRouteKeys: [],
  } as const);

const stableTabRouter: BottomTabRouter = (original) => ({
  ...original,
  getRehydratedState(partialState, options) {
    return original.getRehydratedState(
      partialState ?? (createEmptyTabPartialState() as any),
      options
    );
  },
  getStateForAction(state, action, options) {
    if (action.target && action.target !== state.key) {
      return null;
    }

    if (action.type === 'REPLACE') {
      let nextState = original.getStateForAction(
        state,
        {
          ...action,
          type: 'JUMP_TO',
        },
        options
      );

      if (
        !nextState ||
        nextState.index === undefined ||
        !Array.isArray(nextState.history)
      ) {
        return null;
      }

      if (nextState.index !== 0) {
        const previousIndex = nextState.index - 1;
        nextState = {
          ...nextState,
          key: `${nextState.key}-replace`,
          history: [
            ...nextState.history.slice(0, previousIndex),
            ...nextState.history.slice(nextState.index),
          ],
        };
      }

      return nextState;
    }

    return original.getStateForAction(state, action, options);
  },
});

const Tabs = Object.assign(
  (props: ComponentProps<typeof ExpoTabs>) => (
    <ExpoTabs {...props} UNSTABLE_router={stableTabRouter} />
  ),
  {
    Screen: ExpoTabs.Screen,
    Protected: ExpoTabs.Protected,
  }
);

export default function TabLayout() {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const colorScheme = useColorScheme();
  const { session, loading: authLoading } = useAuth();
  const { unreadCommunityTotal } = useCommunityUnreadCounts(session?.user?.id);
  const { isBabyBorn, isLoading, isResolved } = useBabyStatus();
  const [isCheckingOnboarding, setIsCheckingOnboarding] = React.useState(false);
  const [isOnboardingComplete, setIsOnboardingComplete] = React.useState(false);
  const theme = Colors[colorScheme ?? 'light'];
  const adaptiveColors = useAdaptiveColors();
  const hasSession = Boolean(session);
  const currentRoute = typeof segments[segments.length - 1] === 'string'
    ? segments[segments.length - 1]
    : null;
  const isVisibleTabRoute = useMemo(() => {
    const visibleTabPaths = new Set([
      '/',
      '/blog',
      '/notifications',
      '/home',
      '/pregnancy-home',
      '/countdown',
      '/sleep-tracker',
      '/daily_old',
      '/diary',
      '/index',
      '/baby',
      '/explore',
      '/geburtsplan',
      '/selfcare',
      '/babyweather',
      '/weight-tracker',
      '/size-tracker',
      '/more',
      '/community',
      '/debug',
    ]);

    return visibleTabPaths.has(pathname);
  }, [pathname]);

  useEffect(() => {
    if (authLoading || !session?.user || !isResolved) {
      setIsCheckingOnboarding(false);
      setIsOnboardingComplete(false);
      return;
    }

    let cancelled = false;
    setIsCheckingOnboarding(true);

    getOnboardingCompletionState()
      .then((complete) => {
        if (!cancelled) {
          setIsOnboardingComplete(complete);
        }
      })
      .catch((error) => {
        console.error('Failed to check onboarding completion on tabs layout:', error);
        if (!cancelled) {
          setIsOnboardingComplete(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsCheckingOnboarding(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, isResolved, session?.user]);

  useEffect(() => {
    if (!hasSession || !isOnboardingComplete || !currentRoute || !isResolved || isLoading || !isVisibleTabRoute) return;

    if (currentRoute === 'diary') {
      router.replace(isBabyBorn ? '/(tabs)/home' : '/(tabs)/pregnancy-home');
      return;
    }

    const pregnancyOnlyRoutes = new Set([
      'countdown',
      'index',
      'pregnancy-home',
    ]);
    const babyOnlyRoutes = new Set([
      'sleep-tracker',
      'daily_old',
      'home',
    ]);

    if (isBabyBorn && currentRoute && pregnancyOnlyRoutes.has(currentRoute)) {
      router.replace('/(tabs)/home');
      return;
    }

    if (!isBabyBorn && currentRoute && babyOnlyRoutes.has(currentRoute)) {
      router.replace('/(tabs)/pregnancy-home');
    }
  }, [currentRoute, hasSession, isBabyBorn, isLoading, isOnboardingComplete, isResolved, isVisibleTabRoute, router]);

  if (authLoading || (hasSession && (!isResolved || isCheckingOnboarding))) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  if (!hasSession) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!isOnboardingComplete) {
    return <Redirect href="/(auth)/getUserInfo" />;
  }

  // Nur bei dunklem Hintergrundbild die adaptiven Farben verwenden
  const useDarkMode = adaptiveColors.hasCustomBackground && adaptiveColors.isDarkBackground;
  const getTabVisibilityOptions = (hidden: boolean) =>
    hidden
      ? {
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' as const },
        }
      : {};
  const renderCommunityTabIcon = (color: string) => (
    <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
      <IconSymbol size={28} name="bubble.left.and.bubble.right.fill" color={color} />
      {unreadCommunityTotal > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -8,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: 9,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FF6B6B',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
            {unreadCommunityTotal > 99 ? '99+' : unreadCommunityTotal}
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <Tabs
      initialRouteName={isBabyBorn ? 'home' : 'pregnancy-home'}
      screenOptions={{
        tabBarActiveTintColor: useDarkMode ? adaptiveColors.tabIconSelected : theme.tint,
        tabBarInactiveTintColor: useDarkMode ? adaptiveColors.tabIconDefault : undefined,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
            backgroundColor: useDarkMode ? adaptiveColors.tabBarBackground : undefined,
          },
          default: {
            backgroundColor: useDarkMode ? adaptiveColors.tabBarBackground : theme.background,
          },
        }),
      }}>
      {/* VERSTECKTE TABS - diese werden in keiner der Ansichten in der Tab-Leiste angezeigt */}
      <Tabs.Screen
        name="diary"
        options={{
          title: 'Entwicklungssprünge',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="book.fill" color={color} />,
          ...getTabVisibilityOptions(true),
        }}
      />
      <Tabs.Screen
        name="baby"
        options={{
          title: 'Mein Baby',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
          ...getTabVisibilityOptions(true),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Checkliste',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="checklist" color={color} />,
          ...getTabVisibilityOptions(true),
        }}
      />
      <Tabs.Screen
        name="geburtsplan"
        options={{
          title: 'Geburtsplan',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="doc.text.fill" color={color} />,
          ...getTabVisibilityOptions(true),
        }}
      />
      <Tabs.Screen
        name="selfcare"
        options={{
          title: 'Mama Selfcare',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="heart.fill" color={color} />,
          ...getTabVisibilityOptions(true),
        }}
      />
      <Tabs.Screen
        name="babyweather"
        options={{
          title: 'Babywetter',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="cloud.sun.fill" color={color} />,
          ...getTabVisibilityOptions(true),
        }}
      />
      <Tabs.Screen
        name="weight-tracker"
        options={{
          title: 'Gewicht',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.line.uptrend.xyaxis" color={color} />,
          ...getTabVisibilityOptions(true),
        }}
      />
      <Tabs.Screen
        name="size-tracker"
        options={{
          title: 'Größe',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="ruler" color={color} />,
          ...getTabVisibilityOptions(true),
        }}
      />

      {/* === SCHWANGERSCHAFTS-TABS === */}
      {/* Tab 1/5: Countdown */}
      <Tabs.Screen
        name="countdown"
        options={{
          title: 'Countdown',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
          ...getTabVisibilityOptions(isBabyBorn),
        }}
      />

      {/* Tab 2/5: Wehen */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Wehen',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="timer" color={color} />,
          ...getTabVisibilityOptions(isBabyBorn),
        }}
      />

      {/* === BABY-TABS === */}
      {/* Tab 1/5: Schlaftracker */}
      <Tabs.Screen
        name="sleep-tracker"
        options={{
          title: 'Schlaftracker',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="bed.double.fill" color={color} />,
          ...getTabVisibilityOptions(!isBabyBorn),
        }}
      />
      {/* Tab 2/5: Unser Tag */}
      <Tabs.Screen
        name="daily_old"
        options={{
          title: 'Unser Tag',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="list.bullet" color={color} />,
          ...getTabVisibilityOptions(!isBabyBorn),
        }}
      />

      {/* === GEMEINSAME TABS === */}
      {/* Tab 3/5: Home (Mitte) - Schwangerschaft */}
      <Tabs.Screen
        name="pregnancy-home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          ...getTabVisibilityOptions(isBabyBorn),
        }}
      />

      {/* Tab 3/5: Home (Mitte) - Baby */}
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          ...getTabVisibilityOptions(!isBabyBorn),
        }}
      />

      {/* Blog bleibt als Route erhalten, ist aber nicht mehr direkt in der unteren Navigation sichtbar */}
      <Tabs.Screen
        name="blog"
        options={{
          title: 'Blog',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="doc.text.image.fill" color={color} />,
          ...getTabVisibilityOptions(true),
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Benachrichtigungen',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="bell.fill" color={color} />,
          ...getTabVisibilityOptions(true),
        }}
      />

      {/* Community-Tab fuer Fragen und Antworten */}
      <Tabs.Screen
        name="community"
        options={{
          title: 'Community',
          tabBarIcon: ({ color }) => renderCommunityTabIcon(color),
          ...getTabVisibilityOptions(false),
        }}
      />

      {/* Versteckter Debug-Tab (nur im Debug-Modus) */}
      <Tabs.Screen
        name="debug"
        options={{
          title: 'Debug',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="wrench.fill" color={color} />,
          ...getTabVisibilityOptions(true),
        }}
      />

      <Tabs.Screen
        name="groups/index"
        options={{
          title: 'Gruppen',
          ...getTabVisibilityOptions(true),
        }}
      />

      <Tabs.Screen
        name="groups/[groupId]"
        options={{
          title: 'Gruppe',
          ...getTabVisibilityOptions(true),
        }}
      />

      {/* Tab 5 von 5 in beiden Ansichten (Mehr-Tab ganz rechts) */}
      <Tabs.Screen
        name="more"
        options={{
          title: 'Mehr',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="ellipsis.circle.fill" color={color} />,
          ...getTabVisibilityOptions(false),
        }}
      />
    </Tabs>
  );
}
