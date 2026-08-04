import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';

import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { exportUserData } from '@/lib/dataExport';
import {
  deleteUserAccount,
  getAccountDeletionRequirements,
} from '@/lib/profile';
import { openSubscriptionManagement } from '@/lib/subscriptionManagement';

const COPY = {
  de: { error: 'Fehler', exportFailed: 'Datenexport fehlgeschlagen.', exportDone: 'Export abgeschlossen', exported: 'Deine Daten wurden exportiert{{records}}.', records: ' ({{count}} Einträge)', deleteTitle: 'Konto löschen', deleteWarning: 'Das Löschen deines Kontos beendet dein Store-Abo nicht automatisch. Falls du ein aktives Store-Abo hast, kann die Abrechnung weiterlaufen. Bitte prüfe oder kündige dein Abo vorher über „Abo verwalten“.{{apple}}', appleWarning: '\n\nDa dein Konto mit „Mit Apple anmelden“ verknüpft ist, ist im nächsten Schritt eine Apple-Bestätigung nötig.', cancel: 'Abbrechen', manage: 'Abo verwalten', delete: 'Konto löschen', deleteFailed: 'Konto konnte nicht gelöscht werden.', deletedTitle: 'Konto gelöscht', deleted: 'Dein Konto und alle zugehörigen Daten wurden gelöscht. Du wirst jetzt abgemeldet.', ok: 'OK', signOut: 'Ausloggen', signOutQuestion: 'Möchtest du dich wirklich ausloggen?', signOutFailed: 'Ausloggen fehlgeschlagen.', title: 'Konto & Daten verwalten', body: 'Auch ohne aktives Abo kannst du hier deine Daten exportieren oder dein Konto dauerhaft löschen.', exporting: 'Export läuft …', export: 'Daten exportieren', waiting: 'Bitte warten …', deleteData: 'Konto & Daten löschen', signingOut: 'Wird ausgeloggt …', back: 'Zurück zur Paywall' },
  en: { error: 'Error', exportFailed: 'Data export failed.', exportDone: 'Export complete', exported: 'Your data was exported{{records}}.', records: ' ({{count}} records)', deleteTitle: 'Delete account', deleteWarning: 'Deleting your account does not automatically end your store subscription. If you have an active subscription, billing may continue. Review or cancel it first using “Manage subscription”.{{apple}}', appleWarning: '\n\nBecause your account is linked to Sign in with Apple, Apple confirmation is required in the next step.', cancel: 'Cancel', manage: 'Manage subscription', delete: 'Delete account', deleteFailed: 'The account could not be deleted.', deletedTitle: 'Account deleted', deleted: 'Your account and all associated data were deleted. You will now be signed out.', ok: 'OK', signOut: 'Sign out', signOutQuestion: 'Do you really want to sign out?', signOutFailed: 'Sign-out failed.', title: 'Manage account & data', body: 'Even without an active subscription, you can export your data or permanently delete your account here.', exporting: 'Exporting …', export: 'Export data', waiting: 'Please wait …', deleteData: 'Delete account & data', signingOut: 'Signing out …', back: 'Back to paywall' },
  es: { error: 'Error', exportFailed: 'No se pudieron exportar los datos.', exportDone: 'Exportación completada', exported: 'Tus datos se han exportado{{records}}.', records: ' ({{count}} registros)', deleteTitle: 'Eliminar cuenta', deleteWarning: 'Eliminar tu cuenta no cancela automáticamente la suscripción de la tienda. Si tienes una suscripción activa, el cobro puede continuar. Revísala o cancélala primero mediante «Gestionar suscripción».{{apple}}', appleWarning: '\n\nComo tu cuenta está vinculada a Iniciar sesión con Apple, se necesitará una confirmación de Apple en el siguiente paso.', cancel: 'Cancelar', manage: 'Gestionar suscripción', delete: 'Eliminar cuenta', deleteFailed: 'No se pudo eliminar la cuenta.', deletedTitle: 'Cuenta eliminada', deleted: 'Tu cuenta y todos los datos asociados se han eliminado. Ahora se cerrará la sesión.', ok: 'Aceptar', signOut: 'Cerrar sesión', signOutQuestion: '¿Seguro que quieres cerrar la sesión?', signOutFailed: 'No se pudo cerrar la sesión.', title: 'Gestionar cuenta y datos', body: 'Aunque no tengas una suscripción activa, puedes exportar tus datos o eliminar tu cuenta de forma permanente.', exporting: 'Exportando …', export: 'Exportar datos', waiting: 'Espera …', deleteData: 'Eliminar cuenta y datos', signingOut: 'Cerrando sesión …', back: 'Volver a la pantalla de pago' },
} as const;

export default function DsgvoScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { locale } = useLocale();
  const t = (key: keyof typeof COPY.de, params?: Record<string, string | number>) => {
    let value: string = COPY[locale][key];
    for (const [name, replacement] of Object.entries(params ?? {})) value = value.replaceAll(`{{${name}}}`, String(replacement));
    return value.replaceAll(/\{\{\w+\}\}/g, '');
  };
  const [isExporting, setIsExporting] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleExportData = async () => {
    if (!user || isExporting) {
      return;
    }

    try {
      setIsExporting(true);
      const result = await exportUserData('pdf');

      if (!result.success) {
        Alert.alert(t('error'), t('exportFailed'));
        return;
      }

      const totalRecords = result.summary
        ? Object.values(result.summary).reduce((sum, value) => sum + (typeof value === 'number' ? value : 0), 0)
        : undefined;

      Alert.alert(
        t('exportDone'),
        t('exported', { records: typeof totalRecords === 'number' ? t('records', { count: totalRecords }) : '' }),
      );
    } catch (error: any) {
      console.error('DSGVO export failed:', error);
      Alert.alert(t('error'), t('exportFailed'));
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
        t('deleteTitle'),
        t('deleteWarning', { apple: requirements?.hasAppleSignIn ? t('appleWarning') : '' }),
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('manage'), onPress: () => void openSubscriptionManagement() },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: () => {
              void confirmDeleteAccount();
            },
          },
        ],
      );
    } catch (error: any) {
      console.error('Failed to load DSGVO deletion requirements:', error);
      Alert.alert(t('error'), t('deleteFailed'));
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
        t('deletedTitle'),
        t('deleted'),
        [
          {
            text: t('ok'),
            onPress: async () => {
              await signOut();
            },
          },
        ],
      );
    } catch (error: any) {
      console.error('DSGVO account deletion failed:', error);
      Alert.alert(t('error'), t('deleteFailed'));
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const confirmSignOut = () => {
    if (isSigningOut) {
      return;
    }

    Alert.alert(
      t('signOut'),
      t('signOutQuestion'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('signOut'),
          style: 'destructive',
          onPress: () => {
            void handleSignOut();
          },
        },
      ],
      { cancelable: true },
    );
  };

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    try {
      setIsSigningOut(true);
      const { error } = await signOut();
      if (error) {
        throw error;
      }
      router.replace('/(auth)/login');
    } catch (error: any) {
      console.error('DSGVO sign out failed:', error);
      Alert.alert(t('error'), t('signOutFailed'));
      router.replace('/(auth)/login');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <ThemedBackground style={styles.background}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <ThemedText style={styles.title}>{t('title')}</ThemedText>
            <ThemedText style={styles.body}>
              {t('body')}
            </ThemedText>

            <Pressable style={styles.primaryButton} onPress={() => void handleExportData()} disabled={isExporting}>
              <ThemedText style={styles.primaryButtonText}>
                {isExporting ? t('exporting') : t('export')}
              </ThemedText>
            </Pressable>

            <Pressable style={styles.destructiveButton} onPress={() => void handleDeleteAccount()} disabled={isDeletingAccount}>
              <ThemedText style={styles.destructiveButtonText}>
                {isDeletingAccount ? t('waiting') : t('deleteData')}
              </ThemedText>
            </Pressable>

            <Pressable style={styles.logoutButton} onPress={confirmSignOut} disabled={isSigningOut}>
              <ThemedText style={styles.logoutButtonText}>
                {isSigningOut ? t('signingOut') : t('signOut')}
              </ThemedText>
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
              <ThemedText style={styles.secondaryButtonText}>{t('back')}</ThemedText>
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
  logoutButton: {
    backgroundColor: '#FDFBF6',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(94,61,179,0.24)',
  },
  logoutButtonText: {
    color: '#5E3DB3',
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
