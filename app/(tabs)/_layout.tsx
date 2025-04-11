import { Tabs } from 'expo-router';
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
      {/* Vor-der-Geburt-Tabs */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Start',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          href: isBabyBorn ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="countdown"
        options={{
          title: 'Countdown',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
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
      <Tabs.Screen
        name="geburtsplan"
        options={{
          title: 'Geburtsplan',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="ellipsis.circle.fill" color={color} />,
          href: isBabyBorn ? null : undefined,
        }}
      />

      {/* Nach-der-Geburt-Tabs */}
      <Tabs.Screen
        name="baby"
        options={{
          title: 'Mein Baby',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
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
      />
      <Tabs.Screen
        name="daily"
        options={{
          title: 'Alltag',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          href: isBabyBorn ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Mehr',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="ellipsis.circle.fill" color={color} />,
          href: isBabyBorn ? undefined : null,
        }}
      />
    </Tabs>
  );
}
