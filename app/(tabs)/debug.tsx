import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRouter } from 'expo-router';

export default function DebugScreen() {
  const { isBabyBorn, setIsBabyBorn, isLoading } = useBabyStatus();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();

  const toggleBabyBornStatus = async () => {
    try {
      await setIsBabyBorn(!isBabyBorn);
      Alert.alert(
        'Status geändert',
        `Baby-Status wurde auf "${!isBabyBorn ? 'geboren' : 'nicht geboren'}" gesetzt.`,
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
      Alert.alert('Fehler', 'Beim Ändern des Baby-Status ist ein Fehler aufgetreten.');
    }
  };

  return (
    <View style={styles.container}>
      <ThemedView style={styles.card} lightColor={theme.card} darkColor={theme.card}>
        <ThemedText style={styles.title}>Debug-Informationen</ThemedText>
        
        <View style={styles.infoRow}>
          <ThemedText style={styles.label}>Baby geboren:</ThemedText>
          <ThemedText style={styles.value}>{isBabyBorn ? 'Ja' : 'Nein'}</ThemedText>
        </View>
        
        <View style={styles.infoRow}>
          <ThemedText style={styles.label}>Lade-Status:</ThemedText>
          <ThemedText style={styles.value}>{isLoading ? 'Lädt...' : 'Bereit'}</ThemedText>
        </View>
        
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.accent }]}
          onPress={toggleBabyBornStatus}
        >
          <IconSymbol name="arrow.triangle.2.circlepath" size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>
            Baby-Status umschalten
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
});
