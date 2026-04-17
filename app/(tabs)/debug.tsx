import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { useConvex } from '@/contexts/ConvexContext';
import { useBackend } from '@/contexts/BackendContext';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRouter } from 'expo-router';

export default function DebugScreen() {
  const { isBabyBorn, setIsBabyBorn, isLoading } = useBabyStatus();
  const { convexClient, isReady, syncUser, lastSyncError } = useConvex();
  const { activeBackend } = useBackend();
  const { user } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);

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

  const handleSyncToConvex = async () => {
    setIsSyncing(true);
    try {
      const success = await syncUser();

      if (success) {
        Alert.alert(
          'Sync erfolgreich',
          `User wurde erfolgreich zu Convex synchronisiert.\n\nUser ID: ${user?.id}\nEmail: ${user?.email || 'N/A'}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Sync fehlgeschlagen',
          lastSyncError
            ? `Fehler: ${lastSyncError.message}\n\nBitte prüfe die Console Logs für Details.`
            : 'Unbekannter Fehler. Prüfe die Console Logs.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert('Fehler', `Sync fehlgeschlagen: ${error}`);
    } finally {
      setIsSyncing(false);
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

      <ThemedView style={[styles.card, { marginTop: 20 }]} lightColor={theme.card} darkColor={theme.card}>
        <ThemedText style={styles.title}>Convex Backend</ThemedText>

        <View style={styles.infoRow}>
          <ThemedText style={styles.label}>User ID:</ThemedText>
          <ThemedText style={[styles.value, styles.smallText]} numberOfLines={1}>
            {user?.id || 'N/A'}
          </ThemedText>
        </View>

        <View style={styles.infoRow}>
          <ThemedText style={styles.label}>Email:</ThemedText>
          <ThemedText style={styles.value}>{user?.email || 'N/A'}</ThemedText>
        </View>

        <View style={styles.infoRow}>
          <ThemedText style={styles.label}>Convex Client:</ThemedText>
          <ThemedText style={styles.value}>{convexClient ? '✅ Bereit' : '❌ Nicht verfügbar'}</ThemedText>
        </View>

        <View style={styles.infoRow}>
          <ThemedText style={styles.label}>Aktives Backend:</ThemedText>
          <ThemedText style={styles.value}>{activeBackend === 'supabase' ? 'Supabase' : 'Convex'}</ThemedText>
        </View>

        {lastSyncError && (
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <ThemedText style={[styles.label, { color: '#FF6B6B' }]}>Letzter Fehler:</ThemedText>
            <ThemedText style={[styles.value, styles.smallText, { color: '#FF6B6B' }]} numberOfLines={2}>
              {lastSyncError.message}
            </ThemedText>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: convexClient ? '#FF8C00' : '#999' },
          ]}
          onPress={handleSyncToConvex}
          disabled={!convexClient || isSyncing}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <IconSymbol name="arrow.triangle.2.circlepath" size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>
                User zu Convex syncen
              </Text>
            </>
          )}
        </TouchableOpacity>

        <ThemedText style={styles.hint}>
          💡 Nutze diesen Button, um deinen Supabase-User manuell zu Convex zu synchronisieren.
        </ThemedText>
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
