import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, AppState, BackHandler, Linking, ScrollView, StyleSheet,
  TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ThemedText } from '@/components/ThemedText';
import {
  translateAccountLinkingText, type AccountLinkingLocale,
  type AccountLinkingTranslationKey,
} from '@/lib/accountLinkingTranslations';
import { parseAccountLinkingQr } from '@/lib/account-linking-qr';

type Props = {
  code: string | null;
  invitationLink: string;
  locale: AccountLinkingLocale;
  isDark: boolean;
  onClose: () => void;
  onScanned: (code: string) => void;
  parseCode?: (data: string, invitationLink: string) => string | null;
  displayCode?: string;
  scanHint?: string;
  showHint?: string;
  codeHint?: string;
};

/** Inline content mounted inside the account-linking page and its shared navigation. */
export function AccountLinkingQrModal({ code, invitationLink, locale, isDark, onClose, onScanned, parseCode = parseAccountLinkingQr, displayCode, scanHint, showHint, codeHint }: Props) {
  const t = (key: AccountLinkingTranslationKey) => translateAccountLinkingText(locale, key);
  const [permission, requestPermission, getPermission] = useCameraPermissions({ get: false });
  const [appState, setAppState] = useState(AppState.currentState);
  const [error, setError] = useState<AccountLinkingTranslationKey | null>(null);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const scanned = useRef(false);
  const { width } = useWindowDimensions();
  const foreground = appState === 'active';
  const scanning = code === null;
  const textColor = isDark ? '#F0E6DC' : '#5C4033';
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (foreground && scanning) {
      void getPermission().catch(() => setError('qr.cameraFailed'));
    }
  }, [foreground, scanning, getPermission]);

  const allowCamera = async () => {
    setRequesting(true);
    setError(null);
    try {
      if (permission?.canAskAgain === false) {
        await Linking.openSettings();
      } else {
        await requestPermission();
      }
    } catch {
      setError('qr.cameraFailed');
    } finally {
      setRequesting(false);
    }
  };

  const handleScan = ({ data }: BarcodeScanningResult) => {
    if (scanned.current) return;
    const result = parseCode(data, invitationLink);
    if (!result) {
      setError('qr.invalid');
      return;
    }
    scanned.current = true;
    onScanned(result);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <ThemedText style={[styles.description, { color: textColor }]}>
        {scanning ? scanHint ?? t('qr.scanHint') : showHint ?? t('qr.showHint')}
      </ThemedText>
      {code !== null ? (
        <>
          <View accessible accessibilityLabel={t('qr.show')} style={styles.qrCard}>
            <QRCode value={invitationLink} size={Math.min(240, Math.max(120, width - 96))} quietZone={20} color="#000000" backgroundColor="#FFFFFF" />
          </View>
          <ThemedText selectable style={[styles.code, { color: textColor }]}>{displayCode ?? code}</ThemedText>
          <ThemedText style={[styles.description, { color: textColor }]}>{codeHint ?? t('create.hint')}</ThemedText>
        </>
      ) : !permission ? (
        <ActivityIndicator color={textColor} />
      ) : !permission.granted ? (
        <>
          <IconSymbol name="camera" size={48} color={textColor} />
          <ThemedText style={[styles.description, { color: textColor }]}>
            {t(permission.canAskAgain ? 'qr.permissionHint' : 'qr.permissionDenied')}
          </ThemedText>
          <TouchableOpacity accessibilityRole="button" disabled={requesting} onPress={() => void allowCamera()} style={styles.button}>
            {requesting ? <ActivityIndicator color="#FFFFFF" /> : (
              <ThemedText style={styles.buttonText}>{t(permission.canAskAgain ? 'qr.allowCamera' : 'qr.openSettings')}</ThemedText>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.cameraFrame}>
          {foreground && !cameraFailed && (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleScan}
              onMountError={() => { setCameraFailed(true); setError('qr.cameraFailed'); }}
            />
          )}
        </View>
      )}
      {error && <ThemedText accessibilityRole="alert" style={[styles.description, { color: textColor }]}>{t(error)}</ThemedText>}
      <TouchableOpacity accessibilityRole="button" onPress={onClose} style={[styles.button, styles.secondaryButton]}>
        <ThemedText style={{ color: textColor, fontWeight: '700' }}>{t(scanning ? 'qr.manual' : 'qr.close')}</ThemedText>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 140, gap: 24 },
  description: { textAlign: 'center', fontSize: 16, lineHeight: 24, maxWidth: 380 },
  qrCard: { backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden' },
  code: { fontSize: 26, lineHeight: 34, fontWeight: '800', letterSpacing: 3, textAlign: 'center' },
  cameraFrame: { width: '100%', maxWidth: 380, aspectRatio: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: '#000000' },
  button: { minHeight: 50, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 18, backgroundColor: '#8E4EC6', alignItems: 'center', justifyContent: 'center' },
  secondaryButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#A8C4C1' },
  buttonText: { color: '#FFFFFF', fontWeight: '700', textAlign: 'center' },
});
