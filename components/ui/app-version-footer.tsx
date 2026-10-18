import { requireOptionalNativeModule } from 'expo';
import * as Updates from 'expo-updates';
import { View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { useLocale } from '@/contexts/LocaleContext';

// This identifies the JavaScript source even in local or embedded launches.
const SOURCE_REVISION = '2026.10.15.1';
const application = requireOptionalNativeModule<{
  nativeApplicationVersion: string | null;
  nativeBuildVersion: string | null;
}>('ExpoApplication');

const COPY = {
  de: { version: 'Version', embedded: 'Im Build enthalten', local: 'Lokal' },
  en: { version: 'Version', embedded: 'Included in build', local: 'Local' },
  es: { version: 'Versión', embedded: 'Incluida en la app', local: 'Local' },
};

export function AppVersionFooter({ color }: { color?: string }) {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const version = application?.nativeApplicationVersion ?? '—';
  const build = application?.nativeBuildVersion;
  const update = !Updates.isEnabled
    ? copy.local
    : Updates.isEmbeddedLaunch
      ? copy.embedded
      : `OTA ${Updates.updateId ?? '—'}`;
  const textStyle = { textAlign: 'center' as const, opacity: 0.65, ...(color ? { color } : {}) };

  return (
    <View testID="app-version-footer" style={{ paddingTop: 24, paddingBottom: 8, gap: 2 }}>
      <ThemedText type="caption" selectable style={textStyle}>
        {copy.version} {version}{build ? ` (${build})` : ''} · {SOURCE_REVISION}
      </ThemedText>
      <ThemedText type="caption" selectable style={textStyle}>
        {update}
      </ThemedText>
    </View>
  );
}
