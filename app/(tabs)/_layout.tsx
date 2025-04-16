import { Tabs, router } from 'expo-router';
import React from 'react';
import { Platform, View, ActivityIndicator } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useBabyStatus } from '@/contexts/BabyStatusContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { isBabyBorn, isLoading } = useBabyStatus();
  const theme = Colors[colorScheme ?? 'light'];

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
          },
          default: {},
        }),
      }}>
      {/* Nach-der-Geburt-Tabs - Home zuerst, dann Tagebuch, dann Mehr */}
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          href: isBabyBorn ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: 'Tagebuch',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="book.fill" color={color} />,
          href: isBabyBorn ? undefined : null,
        }}
        listeners={{
          tabPress: (e) => {
            // Verhindern der Standard-Navigation
            e.preventDefault();
            // Stattdessen zur diary-entries.tsx navigieren
            router.push('/diary-entries');
          },
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

      {/* Vor-der-Geburt-Tabs */}
      <Tabs.Screen
        name="countdown"
        options={{
          title: 'Countdown',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
          href: isBabyBorn ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Wehen',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="timer" color={color} />,
          href: isBabyBorn ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Checkliste',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="checklist" color={color} />,
          href: isBabyBorn ? null : undefined,
        }}
      />

      {/* Mehr-Tab für beide Ansichten (jetzt ganz rechts) */}
      <Tabs.Screen
        name="more"
        options={{
          title: 'Mehr',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="ellipsis.circle.fill" color={color} />,
          // Immer anzeigen, unabhängig vom Baby-Status
          href: undefined,
        }}
      />

      {/* Geburtsplan-Tab - immer ausgeblendet, aber für die Navigation verfügbar */}
      <Tabs.Screen
        name="geburtsplan"
        options={{
          title: 'Geburtsplan',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="doc.text.fill" color={color} />,
          href: null, // Immer ausblenden
        }}
      />

      {/* Daily_old-Tab - immer ausgeblendet, aber für die Navigation verfügbar */}
      <Tabs.Screen
        name="daily_old"
        options={{
          title: 'Alltag',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="list.bullet" color={color} />,
          href: null, // Immer ausblenden
        }}
      />

      {/* Selfcare-Tab - immer ausgeblendet, aber für die Navigation verfügbar */}
      <Tabs.Screen
        name="selfcare"
        options={{
          title: 'Mama Selfcare',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="heart.fill" color={color} />,
          href: null, // Immer ausblenden
        }}
      />
    </Tabs>
  );
}
