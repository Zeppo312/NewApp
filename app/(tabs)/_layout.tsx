import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View, ActivityIndicator } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { isBabyBorn, isLoading } = useBabyStatus();
  const theme = Colors[colorScheme ?? 'light'];
  const adaptiveColors = useAdaptiveColors();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  // Nur bei dunklem Hintergrundbild die adaptiven Farben verwenden
  const useDarkMode = adaptiveColors.hasCustomBackground && adaptiveColors.isDarkBackground;

  return (
    <Tabs
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
        name="feeding-stats"
        options={{
          title: 'Mahlzeiten',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.pie.fill" color={color} />,
          href: null, // Nicht in der Navigationsleiste anzeigen
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: 'Entwicklungssprünge',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="book.fill" color={color} />,
          href: null, // Aus der Navigation ausblenden
        }}
      />
      <Tabs.Screen
        name="baby"
        options={{
          title: 'Mein Baby',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
          href: null, // Aus der Navigation ausblenden, aber für die Routing-Funktionalität beibehalten
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Checkliste',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="checklist" color={color} />,
          href: null, // Aus der Navigation ausblenden
        }}
      />
      <Tabs.Screen
        name="geburtsplan"
        options={{
          title: 'Geburtsplan',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="doc.text.fill" color={color} />,
          href: null, // Immer ausblenden
        }}
      />
      <Tabs.Screen
        name="selfcare"
        options={{
          title: 'Mama Selfcare',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="heart.fill" color={color} />,
          href: null, // Immer ausblenden
        }}
      />
      <Tabs.Screen
        name="babyweather"
        options={{
          title: 'Babywetter',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="cloud.sun.fill" color={color} />,
          href: null, // Nicht in der Navigationsleiste anzeigen
        }}
      />
      <Tabs.Screen
        name="weight-tracker"
        options={{
          title: 'Gewicht',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.line.uptrend.xyaxis" color={color} />,
          href: null, // Nicht in der Navigationsleiste anzeigen
        }}
      />

      {/* === SCHWANGERSCHAFTS-TABS === */}
      {/* Tab 1/5: Countdown */}
      <Tabs.Screen
        name="countdown"
        options={{
          title: 'Countdown',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
          href: isBabyBorn ? null : undefined,
        }}
      />

      {/* Tab 2/5: Wehen */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Wehen',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="timer" color={color} />,
          href: isBabyBorn ? null : undefined,
        }}
      />

      {/* === BABY-TABS === */}
      {/* Tab 1/5: Schlaftracker */}
      <Tabs.Screen
        name="sleep-tracker"
        options={{
          title: 'Schlaftracker',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="bed.double.fill" color={color} />,
          href: isBabyBorn ? undefined : null,
        }}
      />
      {/* Tab 2/5: Unser Tag */}
      <Tabs.Screen
        name="daily_old"
        options={{
          title: 'Unser Tag',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="list.bullet" color={color} />,
          href: isBabyBorn ? undefined : null, // Nur nach der Geburt anzeigen
        }}
      />

      {/* === GEMEINSAME TABS === */}
      {/* Tab 3/5: Home (Mitte) - Schwangerschaft */}
      <Tabs.Screen
        name="pregnancy-home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          href: isBabyBorn ? null : undefined,
        }}
      />

      {/* Tab 3/5: Home (Mitte) - Baby */}
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          href: isBabyBorn ? undefined : null,
        }}
      />

      {/* Tab 4/5: Community (in beiden Ansichten) */}
      <Tabs.Screen
        name="community"
        options={{
          title: 'Community',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="bubble.left.and.bubble.right.fill" color={color} />,
          href: undefined, // Immer anzeigen, unabhängig vom Baby-Status
        }}
      />

      {/* Versteckter Debug-Tab (nur im Debug-Modus) */}
      <Tabs.Screen
        name="debug"
        options={{
          title: 'Debug',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="wrench.fill" color={color} />,
          href: null, // Immer ausblenden
        }}
      />

      {/* Tab 5 von 5 in beiden Ansichten (Mehr-Tab ganz rechts) */}
      <Tabs.Screen
        name="more"
        options={{
          title: 'Mehr',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="ellipsis.circle.fill" color={color} />,
          href: undefined, // Immer anzeigen, unabhängig vom Baby-Status
        }}
      />
    </Tabs>
  );
}
