/* eslint-disable react-hooks/globals -- module helpers share the single app-wide locale */
import { useLocale } from '@/contexts/LocaleContext';
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
} from 'expo-router/js-tabs';
import { ParamListBase, TabNavigationState } from 'expo-router/react-navigation';
import React, { useEffect, useMemo } from 'react';
import { Platform, View, ActivityIndicator } from 'react-native';
import type { ComponentProps } from 'react';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useOnboardingStatus } from '@/contexts/OnboardingStatusContext';
import {
  DEFAULT_NAVIGATION_LOCALE,
  NavigationTranslationKey,
  translateNavigationText,
} from '@/lib/navigationTranslations';

let ACTIVE_NAVIGATION_LOCALE = DEFAULT_NAVIGATION_LOCALE;
const t = (key: NavigationTranslationKey) =>
  translateNavigationText(ACTIVE_NAVIGATION_LOCALE, key);

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
  ACTIVE_NAVIGATION_LOCALE = useLocale().locale;
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const colorScheme = useColorScheme();
  const { session, loading: authLoading } = useAuth();
  const { isBabyBorn, isLoading, isResolved } = useBabyStatus();
  const {
    isComplete: isOnboardingComplete,
    isResolved: isOnboardingStatusResolved,
  } = useOnboardingStatus();
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
      '/period-tracker',
      '/more',
      '/community',
      '/shopping-list',
      '/debug',
    ]);

    return visibleTabPaths.has(pathname);
  }, [pathname]);

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
      'period-tracker',
    ]);

    if (isBabyBorn && currentRoute && pregnancyOnlyRoutes.has(currentRoute)) {
      router.replace('/(tabs)/home');
      return;
    }

    if (!isBabyBorn && currentRoute && babyOnlyRoutes.has(currentRoute)) {
      router.replace('/(tabs)/pregnancy-home');
    }
  }, [currentRoute, hasSession, isBabyBorn, isLoading, isOnboardingComplete, isResolved, isVisibleTabRoute, router]);

  if (
    authLoading ||
    (hasSession && !isOnboardingStatusResolved)
  ) {
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

  const getTabVisibilityOptions = (hidden: boolean) =>
    hidden
      ? {
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' as const },
        }
      : {};
  return (
    <Tabs
      initialRouteName={isBabyBorn ? 'home' : 'pregnancy-home'}
      screenOptions={{
        tabBarActiveTintColor: adaptiveColors.tabIconSelected,
        tabBarInactiveTintColor: adaptiveColors.tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
            backgroundColor: 'transparent',
          },
          default: {
            backgroundColor: adaptiveColors.tabBarBackground,
          },
        }),
      }}>
      {/* VERSTECKTE TABS - diese werden in keiner der Ansichten in der Tab-Leiste angezeigt */}
      <Tabs.Screen
        name="diary"
        options={{
          title: t('tab.development'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="book.fill" color={color} />,
          ...getTabVisibilityOptions(true),
        }}
      />
      <Tabs.Screen
        name="baby"
        options={{
          title: t('tab.baby'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
          ...getTabVisibilityOptions(true),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t('tab.checklist'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="checklist" color={color} />,
          ...getTabVisibilityOptions(true),
        }}
      />
      <Tabs.Screen
        name="geburtsplan"
        options={{
          title: t('tab.birthPlan'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="doc.text.fill" color={color} />,
          ...getTabVisibilityOptions(true),
        }}
      />
      <Tabs.Screen
        name="selfcare"
        options={{
          title: t('tab.selfcare'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="heart.fill" color={color} />,
          ...getTabVisibilityOptions(true),
        }}
      />
      <Tabs.Screen
        name="babyweather"
        options={{
          title: t('tab.babyWeather'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="cloud.sun.fill" color={color} />,
          ...getTabVisibilityOptions(true),
        }}
      />
      <Tabs.Screen
        name="weight-tracker"
        options={{
          title: t('tab.weight'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.line.uptrend.xyaxis" color={color} />,
          ...getTabVisibilityOptions(true),
        }}
      />
      <Tabs.Screen
        name="size-tracker"
        options={{
          title: t('tab.size'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="ruler" color={color} />,
          ...getTabVisibilityOptions(true),
        }}
      />
      <Tabs.Screen
        name="period-tracker"
        options={{
          title: t('tab.periodTracker'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="drop.fill" color={color} />,
          ...getTabVisibilityOptions(true),
        }}
      />

      {/* === SCHWANGERSCHAFTS-TABS === */}
      {/* Tab 1/5: Countdown */}
      <Tabs.Screen
        name="countdown"
        options={{
          title: t('tab.countdown'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
          ...getTabVisibilityOptions(isBabyBorn),
        }}
      />

      {/* Tab 2/5: Wehen */}
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab.contractions'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="timer" color={color} />,
          ...getTabVisibilityOptions(isBabyBorn),
        }}
      />

      {/* === BABY-TABS === */}
      {/* Tab 1/5: Schlaftracker */}
      <Tabs.Screen
        name="sleep-tracker"
        options={{
          title: t('tab.sleepTracker'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="bed.double.fill" color={color} />,
          ...getTabVisibilityOptions(!isBabyBorn),
        }}
      />
      {/* Tab 2/5: Unser Tag */}
      <Tabs.Screen
        name="daily_old"
        options={{
          title: t('tab.ourDay'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="list.bullet" color={color} />,
          ...getTabVisibilityOptions(!isBabyBorn),
        }}
      />

      {/* === GEMEINSAME TABS === */}
      {/* Tab 3/5: Home (Mitte) - Schwangerschaft */}
      <Tabs.Screen
        name="pregnancy-home"
        options={{
          title: t('tab.home'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          ...getTabVisibilityOptions(isBabyBorn),
        }}
      />

      {/* Tab 3/5: Home (Mitte) - Baby */}
      <Tabs.Screen
        name="home"
        options={{
          title: t('tab.home'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          ...getTabVisibilityOptions(!isBabyBorn),
        }}
      />

      {/* Blog bleibt als Route erhalten, ist aber nicht mehr direkt in der unteren Navigation sichtbar */}
      <Tabs.Screen
        name="blog"
        options={{
          title: t('tab.blog'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="doc.text.image.fill" color={color} />,
          ...getTabVisibilityOptions(true),
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          title: t('tab.notifications'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="bell.fill" color={color} />,
          ...getTabVisibilityOptions(true),
        }}
      />

      {/* Community-Route bleibt erhalten, ist aber nicht mehr in der Tab-Leiste sichtbar */}
      <Tabs.Screen
        name="community"
        options={{
          title: t('tab.community'),
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="bubble.left.and.bubble.right.fill" color={color} />
          ),
          ...getTabVisibilityOptions(true),
        }}
      />

      {/* Tab 4/5: Einkaufsliste (ersetzt den frueheren Community-Tab) */}
      <Tabs.Screen
        name="shopping-list"
        options={{
          title: t('tab.shoppingList'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="cart.fill" color={color} />,
          ...getTabVisibilityOptions(false),
        }}
      />

      {/* Versteckter Debug-Tab (nur im Debug-Modus) */}
      <Tabs.Screen
        name="debug"
        options={{
          title: t('tab.debug'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="wrench.fill" color={color} />,
          ...getTabVisibilityOptions(true),
        }}
      />

      <Tabs.Screen
        name="groups/index"
        options={{
          title: t('tab.groups'),
          ...getTabVisibilityOptions(true),
        }}
      />

      <Tabs.Screen
        name="groups/[groupId]"
        options={{
          title: t('tab.group'),
          ...getTabVisibilityOptions(true),
        }}
      />

      {/* Tab 5 von 5 in beiden Ansichten (Mehr-Tab ganz rechts) */}
      <Tabs.Screen
        name="more"
        options={{
          title: t('tab.more'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="ellipsis.circle.fill" color={color} />,
          ...getTabVisibilityOptions(false),
        }}
      />
    </Tabs>
  );
}
