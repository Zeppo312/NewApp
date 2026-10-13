import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRouter } from 'expo-router';
import { useLocale } from '@/contexts/LocaleContext';

export default function DebugScreen() {
  const { locale } = useLocale();
  const c = {
    de: { changed: 'Status geändert', status: (born: boolean) => `Baby-Status wurde auf „${born ? 'geboren' : 'nicht geboren'}“ gesetzt.`, error: 'Fehler', changeError: 'Beim Ändern des Baby-Status ist ein Fehler aufgetreten.', title: 'Debug-Informationen', born: 'Baby geboren:', yes: 'Ja', no: 'Nein', loading: 'Lade-Status:', loadingValue: 'Lädt…', ready: 'Bereit', toggle: 'Baby-Status umschalten' },
    en: { changed: 'Status changed', status: (born: boolean) => `Baby status was set to “${born ? 'born' : 'not born'}”.`, error: 'Error', changeError: 'An error occurred while changing the baby status.', title: 'Debug information', born: 'Baby born:', yes: 'Yes', no: 'No', loading: 'Loading status:', loadingValue: 'Loading…', ready: 'Ready', toggle: 'Toggle baby status' },
    es: { changed: 'Estado cambiado', status: (born: boolean) => `El estado del bebé se ha cambiado a «${born ? 'nacido' : 'no nacido'}».`, error: 'Error', changeError: 'Se produjo un error al cambiar el estado del bebé.', title: 'Información de depuración', born: 'Bebé nacido:', yes: 'Sí', no: 'No', loading: 'Estado de carga:', loadingValue: 'Cargando…', ready: 'Listo', toggle: 'Cambiar estado del bebé' },
  }[locale];
  const { isBabyBorn, setIsBabyBorn, isLoading } = useBabyStatus();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();

  const toggleBabyBornStatus = async () => {
    try {
      await setIsBabyBorn(!isBabyBorn);
      Alert.alert(
        c.changed,
        c.status(!isBabyBorn),
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigiere zur Home-Seite, um die Änderungen zu sehen
              if (!isBabyBorn) {
                router.push('/(tabs)/home');
              } else {
                router.push('/(tabs)/pregnancy-home');
              }
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert(c.error, c.changeError);
    }
  };

  return (
    <View style={styles.container}>
      <ThemedView style={styles.card} lightColor={theme.card} darkColor={theme.card}>
        <ThemedText style={styles.title}>{c.title}</ThemedText>
        
        <View style={styles.infoRow}>
          <ThemedText style={styles.label}>{c.born}</ThemedText>
          <ThemedText style={styles.value}>{isBabyBorn ? c.yes : c.no}</ThemedText>
        </View>
        
        <View style={styles.infoRow}>
          <ThemedText style={styles.label}>{c.loading}</ThemedText>
          <ThemedText style={styles.value}>{isLoading ? c.loadingValue : c.ready}</ThemedText>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.accent }]}
          onPress={toggleBabyBornStatus}
        >
          <IconSymbol name="arrow.triangle.2.circlepath" size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>
            {c.toggle}
          </Text>
        </TouchableOpacity>
      </ThemedView>


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  value: {
    fontSize: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  smallText: {
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
  },
  hint: {
    fontSize: 12,
    marginTop: 12,
    opacity: 0.7,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
