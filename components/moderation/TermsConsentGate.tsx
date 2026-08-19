import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { DEFAULT_APP_LOCALE, type AppLocale } from '@/lib/localization';
import {
  translateModerationText,
  type ModerationTranslationKey,
} from '@/lib/moderationTranslations';
import { acceptTerms } from '@/lib/termsConsent';

type TermsConsentGateProps = {
  visible: boolean;
  locale?: AppLocale;
  onAccepted: () => void;
  onSignOut?: () => void;
};

/**
 * Blockierender Zustimmungsdialog für Bestandsnutzer, die die aktualisierten
 * Nutzungsbedingungen mit den Community-Regeln noch nicht bestätigt haben.
 */
export function TermsConsentGate({
  visible,
  locale = DEFAULT_APP_LOCALE,
  onAccepted,
  onSignOut,
}: TermsConsentGateProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const [checked, setChecked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const textPrimary = isDark ? Colors.dark.text : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const overlayColor = isDark ? 'rgba(12, 12, 16, 0.86)' : 'rgba(92, 64, 51, 0.5)';
  const sheetColor = isDark ? '#1E1B22' : '#FFF8F4';
  const sheetBorderColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(125, 90, 80, 0.12)';
  const cardColor = isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF';
  const cardBorderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(125, 90, 80, 0.08)';
  const accentColor = '#9DBEBB';

  const t = useCallback(
    (key: ModerationTranslationKey, params?: Record<string, string | number>) =>
      translateModerationText(locale, key, params),
    [locale],
  );

  const handleAccept = useCallback(async () => {
    if (!checked) {
      Alert.alert(t('consent.gateTitle'), t('consent.required'));
      return;
    }

    setIsSaving(true);
    const result = await acceptTerms();
    setIsSaving(false);

    if (!result.success) {
      Alert.alert(t('common.error'), t('consent.saveFailed'));
      return;
    }

    setChecked(false);
    onAccepted();
  }, [checked, onAccepted, t]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => undefined}>
      <View style={[styles.overlay, { backgroundColor: overlayColor }]}>
        <View style={[styles.sheet, { backgroundColor: sheetColor, borderColor: sheetBorderColor }]}>
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <ThemedText style={[styles.title, { color: textPrimary }]}>
              {t('consent.gateTitle')}
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: textSecondary }]}>
              {t('consent.gateIntro')}
            </ThemedText>

            <View style={[styles.rulesCard, { backgroundColor: cardColor, borderColor: cardBorderColor }]}>
              <ThemedText style={[styles.rulesText, { color: textSecondary }]}>
                {t('consent.rulesHint')}
              </ThemedText>
            </View>

            <View style={styles.linkRow}>
              <TouchableOpacity onPress={() => router.push('/nutzungsbedingungen')} activeOpacity={0.7}>
                <ThemedText style={[styles.link, { color: accentColor }]}>
                  {t('consent.terms')}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/datenschutz')} activeOpacity={0.7}>
                <ThemedText style={[styles.link, { color: accentColor }]}>
                  {t('consent.privacy')}
                </ThemedText>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.checkboxRow,
                { backgroundColor: cardColor, borderColor: checked ? accentColor : cardBorderColor },
              ]}
              onPress={() => setChecked((current) => !current)}
              activeOpacity={0.85}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              disabled={isSaving}
            >
              <IconSymbol
                name={checked ? 'checkmark.circle.fill' : 'circle'}
                size={24}
                color={checked ? accentColor : textSecondary}
              />
              <ThemedText style={[styles.checkboxLabel, { color: textPrimary }]}>
                {t('consent.checkbox')}
              </ThemedText>
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              { backgroundColor: accentColor },
              (!checked || isSaving) && styles.buttonDisabled,
            ]}
            onPress={() => void handleAccept()}
            activeOpacity={0.9}
            disabled={!checked || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>{t('consent.accept')}</ThemedText>
            )}
          </TouchableOpacity>

          {onSignOut ? (
            <TouchableOpacity style={styles.signOutButton} onPress={onSignOut} activeOpacity={0.7} disabled={isSaving}>
              <ThemedText style={[styles.signOutText, { color: textSecondary }]}>
                {t('consent.signOut')}
              </ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  sheet: {
    maxHeight: '86%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 12,
  },
  scrollArea: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 4,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
  },
  paragraph: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 21,
  },
  rulesCard: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  rulesText: {
    fontSize: 13,
    lineHeight: 19,
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 14,
  },
  link: {
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginTop: 16,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  primaryButton: {
    borderRadius: 16,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  signOutButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 6,
  },
  signOutText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
