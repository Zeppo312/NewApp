/* eslint-disable react-hooks/globals -- module helpers share the single app-wide locale */
import { useLocale } from '@/contexts/LocaleContext';
import React, { useCallback, useState } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Alert, SafeAreaView, StatusBar } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Redirect, useRouter , useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import { LiquidGlassCard, GLASS_OVERLAY, LAYOUT_PAD } from '@/constants/DesignGuide';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { fetchPaywallState } from '@/lib/paywall';
import {
  getPaywallAccessReasonLabel,
  type PaywallAccessReason,
} from '@/lib/paywallAccess';
import {
  DEFAULT_MORE_LOCALE,
  MoreTranslationKey,
  translateMoreText,
} from '@/lib/moreTranslations';

let ACTIVE_MORE_LOCALE = DEFAULT_MORE_LOCALE;
const t = (key: MoreTranslationKey, params?: Record<string, string | number>) =>
  translateMoreText(ACTIVE_MORE_LOCALE, key, params);

export default function MoreScreen() {
  ACTIVE_MORE_LOCALE = useLocale().locale;
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const adaptiveColors = useAdaptiveColors();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [accessReason, setAccessReason] = useState<PaywallAccessReason>('none');

  // Nur bei dunklem Hintergrundbild die adaptiven Farben verwenden
  const useDarkMode = adaptiveColors.hasCustomBackground && adaptiveColors.isDarkBackground;
  const useLightIcons = colorScheme === 'dark' || useDarkMode;
  const iconAccentColor = useLightIcons ? '#FFFFFF' : theme.accent;
  const iconSecondaryColor = useLightIcons ? 'rgba(255,255,255,0.9)' : theme.tabIconDefault;

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadAccessState = async () => {
        try {
          const state = await fetchPaywallState();
          if (active) {
            setAccessReason(state.accessReason);
          }
        } catch (error) {
          console.error('Failed to refresh paywall access state:', error);
          if (active) {
            setAccessReason('none');
          }
        }
      };

      void loadAccessState();

      return () => {
        active = false;
      };
    }, [])
  );

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  const handlePremiumPress = async () => {
    router.push('/subscription');
  };

  const hasActiveAccess = accessReason !== 'none';
  const hasSubscription = accessReason === 'subscription';
  const subscriptionTitle = hasSubscription
    ? t('subscription.manage')
    : hasActiveAccess
      ? t('subscription.access')
      : t('subscription.view');
  const subscriptionDescription = hasSubscription
    ? t('subscription.manageDescription')
    : hasActiveAccess
      ? t('subscription.activeDescription', { reason: getPaywallAccessReasonLabel(accessReason) })
      : t('subscription.viewDescription');

  // Abmelden-Funktion
  const handleLogout = async () => {
    Alert.alert(
      t('logout.action'),
      t('logout.question'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('logout.action'),
          style: 'destructive',
          onPress: async () => {
            try {
              // Abmelden mit Supabase
              const { error } = await signOut();
              if (error) throw error;
            } catch (error) {
              console.error('Logout error:', error);
              const message = error instanceof Error
                ? error.message
                : (typeof error === 'object' && error !== null && 'message' in error)
                  ? String((error as { message?: unknown }).message ?? t('common.unknownError'))
                  : t('common.unknownError');
              Alert.alert(t('common.error'), t('logout.failed', { message }));
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <ThemedBackground style={styles.backgroundImage}>
      <SafeAreaView style={styles.container}>
       <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
        
        <Header 
          title={t('screen.title')}
          subtitle={t('screen.subtitle')}
          showBackButton
          onBackPress={() => router.push('/(tabs)/home')}
        />
        
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
          <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
            <ThemedText style={styles.sectionTitle}>
              {t('subscription.section')}
            </ThemedText>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handlePremiumPress}
            >
              <View style={styles.menuItemIcon}>
                <IconSymbol name="star.fill" size={24} color={iconAccentColor} />
              </View>
              <View style={styles.menuItemContent}>
                <ThemedText style={styles.menuItemTitle}>
                  {subscriptionTitle}
                </ThemedText>
                <ThemedText style={styles.menuItemDescription}>
                  {subscriptionDescription}
                </ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={20} color={iconSecondaryColor} />
            </TouchableOpacity>

          </LiquidGlassCard>

          <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
            <ThemedText style={styles.sectionTitle}>
              {t('shop.section')}
            </ThemedText>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/prints-shop' as any)}
            >
              <View style={styles.menuItemIcon}>
                <IconSymbol name="bag.fill" size={24} color={iconAccentColor} />
              </View>
              <View style={styles.menuItemContent}>
                <ThemedText style={styles.menuItemTitle}>
                  {t('shop.title')}
                </ThemedText>
                <ThemedText style={styles.menuItemDescription}>
                  {t('shop.description')}
                </ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={20} color={iconSecondaryColor} />
            </TouchableOpacity>
          </LiquidGlassCard>

          <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
            <ThemedText style={styles.sectionTitle}>
              {t('settings.section')}
            </ThemedText>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/app-settings')}
            >
              <View style={styles.menuItemIcon}>
                <IconSymbol name="gear" size={24} color={iconAccentColor} />
              </View>
              <View style={styles.menuItemContent}>
                <ThemedText style={styles.menuItemTitle}>
                  {t('settings.appTitle')}
                </ThemedText>
                <ThemedText style={styles.menuItemDescription}>
                  {t('settings.appDescription')}
                </ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={20} color={iconSecondaryColor} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/profil')}
            >
              <View style={styles.menuItemIcon}>
                <IconSymbol name="person.crop.circle" size={24} color={iconAccentColor} />
              </View>
              <View style={styles.menuItemContent}>
                <ThemedText style={styles.menuItemTitle}>
                  {t('settings.profileTitle')}
                </ThemedText>
                <ThemedText style={styles.menuItemDescription}>
                  {t('settings.profileDescription')}
                </ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={20} color={iconSecondaryColor} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/account-linking')}
            >
              <View style={styles.menuItemIcon}>
                <IconSymbol name="link" size={24} color={iconAccentColor} />
              </View>
              <View style={styles.menuItemContent}>
                <ThemedText style={styles.menuItemTitle}>
                  {t('settings.linkTitle')}
                </ThemedText>
                <ThemedText style={styles.menuItemDescription}>
                  {t('settings.linkDescription')}
                </ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={20} color={iconSecondaryColor} />
            </TouchableOpacity>

          </LiquidGlassCard>

          <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
            <ThemedText style={styles.sectionTitle}>
              {t('support.section')}
            </ThemedText>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/support' as any)}
            >
              <View style={styles.menuItemIcon}>
                <IconSymbol name="envelope.fill" size={24} color={iconAccentColor} />
              </View>
              <View style={styles.menuItemContent}>
                <ThemedText style={styles.menuItemTitle}>
                  {t('support.contact')}
                </ThemedText>
                <ThemedText style={styles.menuItemDescription}>
                  support@lottibaby.de
                </ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={20} color={iconSecondaryColor} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/feature-requests' as any)}
            >
              <View style={styles.menuItemIcon}>
                <IconSymbol name="lightbulb.fill" size={24} color={iconAccentColor} />
              </View>
              <View style={styles.menuItemContent}>
                <ThemedText style={styles.menuItemTitle}>
                  {t('support.suggestions')}
                </ThemedText>
                <ThemedText style={styles.menuItemDescription}>
                  {t('support.suggestionsDescription')}
                </ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={20} color={iconSecondaryColor} />
            </TouchableOpacity>
          </LiquidGlassCard>

          <LiquidGlassCard style={styles.sectionCard} intensity={26} overlayColor={GLASS_OVERLAY}>
            <ThemedText style={styles.sectionTitle}>
              {t('legal.section')}
            </ThemedText>

            <TouchableOpacity
              style={styles.legalItem}
              onPress={() => router.push('/datenschutz' as any)}
            >
              <ThemedText style={styles.legalTitle}>{t('legal.privacy')}</ThemedText>
              <ThemedText style={styles.legalMeta}>{t('legal.privacyVersion')}</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.legalItem}
              onPress={() => router.push('/nutzungsbedingungen' as any)}
            >
              <ThemedText style={styles.legalTitle}>{t('legal.terms')}</ThemedText>
              <ThemedText style={styles.legalMeta}>{t('legal.termsVersion')}</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.legalItem}
              onPress={() => router.push('/impressum' as any)}
            >
              <ThemedText style={styles.legalTitle}>{t('legal.imprint')}</ThemedText>
            </TouchableOpacity>
          </LiquidGlassCard>

          {/* Logout Section */}
          <View style={styles.logoutSection}>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <ThemedText style={styles.logoutButtonText}>
                {t('logout.action')}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: { paddingHorizontal: LAYOUT_PAD, paddingBottom: 40, paddingTop: 10 },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionCard: {
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)'
  },
  menuItemIcon: {
    width: 40,
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  menuItemDescription: {
    fontSize: 13,
    opacity: 0.8,
  },
  legalItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  legalTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  legalMeta: {
    marginTop: 2,
    fontSize: 12,
    opacity: 0.7,
  },
  logoutSection: {
    marginTop: 20,
    marginBottom: 40,
    alignItems: 'center',
  },
  logoutButton: {
    backgroundColor: '#E9C9B6', // Using warning color from our palette
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 30,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutButtonText: {
    color: '#5C4033', // Dark brown text
    fontWeight: 'bold',
    fontSize: 18,
  },
});
