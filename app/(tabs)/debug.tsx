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
import { useLocale } from '@/contexts/LocaleContext';

export default function DebugScreen() {
  const { locale } = useLocale();
  const c = {
    de: { changed: 'Status geändert', status: (born: boolean) => `Baby-Status wurde auf „${born ? 'geboren' : 'nicht geboren'}“ gesetzt.`, error: 'Fehler', changeError: 'Beim Ändern des Baby-Status ist ein Fehler aufgetreten.', syncSuccess: 'Sync erfolgreich', syncSuccessBody: 'Nutzer wurde erfolgreich mit Convex synchronisiert.', syncFailed: 'Sync fehlgeschlagen', checkLogs: 'Bitte prüfe die Konsolenprotokolle.', unknown: 'Unbekannter Fehler.', title: 'Debug-Informationen', born: 'Baby geboren:', yes: 'Ja', no: 'Nein', loading: 'Lade-Status:', loadingValue: 'Lädt…', ready: 'Bereit', toggle: 'Baby-Status umschalten', userId: 'Nutzer-ID:', client: 'Convex-Client:', unavailable: 'Nicht verfügbar', backend: 'Aktives Backend:', lastError: 'Letzter Fehler:', sync: 'Nutzer mit Convex synchronisieren', hint: '💡 Mit diesem Button kannst du deinen Supabase-Nutzer manuell mit Convex synchronisieren.' },
    en: { changed: 'Status changed', status: (born: boolean) => `Baby status was set to “${born ? 'born' : 'not born'}”.`, error: 'Error', changeError: 'An error occurred while changing the baby status.', syncSuccess: 'Sync successful', syncSuccessBody: 'The user was synced to Convex successfully.', syncFailed: 'Sync failed', checkLogs: 'Check the console logs for details.', unknown: 'Unknown error.', title: 'Debug information', born: 'Baby born:', yes: 'Yes', no: 'No', loading: 'Loading status:', loadingValue: 'Loading…', ready: 'Ready', toggle: 'Toggle baby status', userId: 'User ID:', client: 'Convex client:', unavailable: 'Unavailable', backend: 'Active backend:', lastError: 'Last error:', sync: 'Sync user to Convex', hint: '💡 Use this button to manually sync your Supabase user to Convex.' },
    es: { changed: 'Estado cambiado', status: (born: boolean) => `El estado del bebé se ha cambiado a «${born ? 'nacido' : 'no nacido'}».`, error: 'Error', changeError: 'Se produjo un error al cambiar el estado del bebé.', syncSuccess: 'Sincronización correcta', syncSuccessBody: 'El usuario se ha sincronizado con Convex.', syncFailed: 'Falló la sincronización', checkLogs: 'Consulta los registros de la consola para ver los detalles.', unknown: 'Error desconocido.', title: 'Información de depuración', born: 'Bebé nacido:', yes: 'Sí', no: 'No', loading: 'Estado de carga:', loadingValue: 'Cargando…', ready: 'Listo', toggle: 'Cambiar estado del bebé', userId: 'ID de usuario:', client: 'Cliente Convex:', unavailable: 'No disponible', backend: 'Backend activo:', lastError: 'Último error:', sync: 'Sincronizar usuario con Convex', hint: '💡 Usa este botón para sincronizar manualmente tu usuario de Supabase con Convex.' },
  }[locale];
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

  const handleSyncToConvex = async () => {
    setIsSyncing(true);
    try {
      const success = await syncUser();

      if (success) {
        Alert.alert(
          c.syncSuccess,
          `${c.syncSuccessBody}\n\n${c.userId} ${user?.id}\nEmail: ${user?.email || 'N/A'}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          c.syncFailed,
          lastSyncError
            ? `${c.error}: ${lastSyncError.message}\n\n${c.checkLogs}`
            : `${c.unknown} ${c.checkLogs}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(c.error, `${c.syncFailed}: ${error}`);
    } finally {
      setIsSyncing(false);
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

      <ThemedView style={[styles.card, { marginTop: 20 }]} lightColor={theme.card} darkColor={theme.card}>
        <ThemedText style={styles.title}>Convex Backend</ThemedText>

        <View style={styles.infoRow}>
          <ThemedText style={styles.label}>{c.userId}</ThemedText>
          <ThemedText style={[styles.value, styles.smallText]} numberOfLines={1}>
            {user?.id || 'N/A'}
          </ThemedText>
        </View>

        <View style={styles.infoRow}>
          <ThemedText style={styles.label}>Email:</ThemedText>
          <ThemedText style={styles.value}>{user?.email || 'N/A'}</ThemedText>
        </View>

        <View style={styles.infoRow}>
          <ThemedText style={styles.label}>{c.client}</ThemedText>
          <ThemedText style={styles.value}>{convexClient ? `✅ ${c.ready}` : `❌ ${c.unavailable}`}</ThemedText>
        </View>

        <View style={styles.infoRow}>
          <ThemedText style={styles.label}>{c.backend}</ThemedText>
          <ThemedText style={styles.value}>{activeBackend === 'supabase' ? 'Supabase' : 'Convex'}</ThemedText>
        </View>

        {lastSyncError && (
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <ThemedText style={[styles.label, { color: '#FF6B6B' }]}>{c.lastError}</ThemedText>
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
                {c.sync}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <ThemedText style={styles.hint}>
          {c.hint}
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
