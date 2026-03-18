import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';

import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { exportUserData } from '@/lib/dataExport';
import {
  buildAccountDeletionWarningMessage,
  deleteUserAccount,
  getAccountDeletionRequirements,
} from '@/lib/profile';
import { openSubscriptionManagement } from '@/lib/subscriptionManagement';

export default function DsgvoScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleExportData = async () => {
    if (!user || isExporting) {
      return;
    }

    try {
      setIsExporting(true);
      const result = await exportUserData('pdf');

      if (!result.success) {
        Alert.alert('Fehler', result.error ?? 'Datenexport fehlgeschlagen.');
        return;
      }

      const totalRecords = result.summary
        ? Object.values(result.summary).reduce((sum, value) => sum + (typeof value === 'number' ? value : 0), 0)
        : undefined;

      Alert.alert(
        'Export abgeschlossen',
        `Deine Daten wurden exportiert${typeof totalRecords === 'number' ? ` (${totalRecords} Einträge)` : ''}.`,
      );
    } catch (error: any) {
      console.error('DSGVO export failed:', error);
      Alert.alert('Fehler', error?.message || 'Datenexport fehlgeschlagen.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || isDeletingAccount) {
      return;
    }

    try {
      const { data: requirements, error } = await getAccountDeletionRequirements();
      if (error) {
        throw error;
      }

      Alert.alert(
        'Konto löschen',
        buildAccountDeletionWarningMessage(requirements),
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Abo verwalten', onPress: () => void openSubscriptionManagement() },
          {
            text: 'Konto löschen',
            style: 'destructive',
            onPress: () => {
              void confirmDeleteAccount();
            },
          },
        ],
      );
    } catch (error: any) {
      console.error('Failed to load DSGVO deletion requirements:', error);
      Alert.alert('Fehler', error?.message || 'Konto konnte nicht gelöscht werden.');
    }
  };

  const confirmDeleteAccount = async () => {
    if (!user || isDeletingAccount) {
      return;
    }

    try {
      setIsDeletingAccount(true);
      const { error } = await deleteUserAccount();
      if (error) {
        throw error;
      }

      Alert.alert(
        'Konto gelöscht',
        'Dein Konto und alle zugehörigen Daten wurden gelöscht. Du wirst jetzt abgemeldet.',
        [
          {
            text: 'OK',
            onPress: async () => {
              await signOut();
            },
          },
        ],
      );
    } catch (error: any) {
      console.error('DSGVO account deletion failed:', error);
      Alert.alert('Fehler', error?.message || 'Konto konnte nicht gelöscht werden.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <ThemedBackground style={styles.background}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <ThemedText style={styles.title}>Konto & Daten verwalten</ThemedText>
            <ThemedText style={styles.body}>
              Auch nach Ablauf der Testphase kannst du hier deine Daten exportieren oder dein Konto dauerhaft löschen.
            </ThemedText>

            <Pressable style={styles.primaryButton} onPress={() => void handleExportData()} disabled={isExporting}>
              <ThemedText style={styles.primaryButtonText}>
                {isExporting ? 'Export läuft…' : 'Daten exportieren'}
              </ThemedText>
            </Pressable>

            <Pressable style={styles.destructiveButton} onPress={() => void handleDeleteAccount()} disabled={isDeletingAccount}>
              <ThemedText style={styles.destructiveButtonText}>
                {isDeletingAccount ? 'Bitte warten…' : 'Konto & Daten löschen'}
              </ThemedText>
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
              <ThemedText style={styles.secondaryButtonText}>Zurück zur Paywall</ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(94,61,179,0.1)',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2F1F1B',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6A5952',
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#5E3DB3',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FDFBF6',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  destructiveButton: {
    backgroundColor: '#FFF1F0',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0C5C1',
  },
  destructiveButtonText: {
    color: '#B53A2D',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  secondaryButton: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(94,61,179,0.08)',
  },
  secondaryButtonText: {
    color: '#5E3DB3',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});
