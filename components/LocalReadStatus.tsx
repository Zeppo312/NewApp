import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useLocale } from '@/contexts/LocaleContext';
import { offlineText } from '@/lib/offlineTranslations';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
export function LocalReadStatus({ verifiedAt, failed, loading, onRetry }: {
  verifiedAt?: string; failed?: boolean; loading?: boolean; onRetry: () => void;
}) {
  const { locale } = useLocale();
  const colors = useAdaptiveColors();
  if (!failed || loading) return null;
  return <View accessibilityLiveRegion="polite" style={{
    marginHorizontal: 20, marginBottom: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
    backgroundColor: colors.cardBackground, borderColor: colors.border, borderWidth: 1, borderRadius: 20,
  }}>
    <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>
      {offlineText(locale, verifiedAt ? 'readSaved' : 'readUnavailable')}
    </Text>
    <TouchableOpacity accessibilityRole="button" onPress={onRetry} style={{
      minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingRight: 12,
    }}>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{offlineText(locale, 'retry')}</Text>
    </TouchableOpacity>
  </View>;
}
