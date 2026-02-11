import { Stack } from 'expo-router';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { ThemeOverrideProvider } from '@/contexts/ThemeContext';

export default function AuthLayout() {

  return (
    <ThemeOverrideProvider colorScheme="light">
      <StatusBar hidden={true} />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeOverrideProvider>
  );
}
