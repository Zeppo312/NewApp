import { Link, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useLocale } from '@/contexts/LocaleContext';

export default function NotFoundScreen() {
  const { locale } = useLocale();
  const copy = {
    de: { title: 'Ups!', body: 'Diese Seite gibt es nicht.', home: 'Zur Startseite' },
    en: { title: 'Oops!', body: "This screen doesn't exist.", home: 'Go to home screen' },
    es: { title: '¡Vaya!', body: 'Esta pantalla no existe.', home: 'Ir a la pantalla de inicio' },
  }[locale];
  return (
    <>
      <Stack.Screen options={{ title: copy.title }} />
      <ThemedView style={styles.container}>
        <ThemedText type="title">{copy.body}</ThemedText>
        <Link href="/" style={styles.link}>
          <ThemedText type="link">{copy.home}</ThemedText>
        </Link>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
