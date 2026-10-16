import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useLocale } from '@/contexts/LocaleContext';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { translateAppSettingsText } from '@/lib/appSettingsTranslations';
import { ConsentCard, consentStyles as s, useConsentColors } from './DataConsentPanel';

/** Recovery actions stay independent of settings loading, health consent and billing. */
export function AccountDeletionSettings() {
  const router = useRouter();
  const { locale } = useLocale();
  const c = useConsentColors();
  const links = [
    { title: 'data.deleteAccountTitle', description: 'data.deleteAccountDescription', href: '/account-deletion' },
    { title: 'data.deleteTitle', description: 'data.deleteDescription', href: '/account-deletion?scope=data' },
  ] as const;
  return <ConsentCard style={{ padding: 0, paddingVertical: 4, gap: 0 }}>
    {links.map((link, index) => <React.Fragment key={link.href}>
      {index > 0 && <View style={[s.menuDivider, { backgroundColor: c.divider }]} />}
      <Pressable accessibilityRole="button" accessibilityLabel={translateAppSettingsText(locale, link.title)}
        style={s.menuRow} onPress={() => router.push(link.href)}>
        <IconSymbol name="trash" size={20} color={c.error} />
        <View style={{ flex: 1, gap: 4 }}>
          <ThemedText adaptive={false} style={[s.menuText, { color: c.error }]}>{translateAppSettingsText(locale, link.title)}</ThemedText>
          <ThemedText adaptive={false} style={[s.small, { color: c.secondary }]}>{translateAppSettingsText(locale, link.description)}</ThemedText>
        </View>
        <IconSymbol name="chevron.right" size={14} color={c.muted} />
      </Pressable>
    </React.Fragment>)}
  </ConsentCard>;
}
