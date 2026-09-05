import 'react-native-url-polyfill/auto';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLocale } from '@/contexts/LocaleContext';
import { buildPrintsShopUrl } from '@/lib/printsShop';

const SHOP_WEBVIEW_CUSTOMIZATION = `
  (function () {
    function applyLottiBabyAppChrome() {
      var styleId = 'lotti-baby-app-shop-chrome';
      if (!document.getElementById(styleId)) {
        var style = document.createElement('style');
        style.id = styleId;
        style.textContent = [
          '.navbar-cta { display: none !important; }',
          '.navbar-right { gap: 10px !important; }'
        ].join('\\n');
        document.head.appendChild(style);
      }
    }

    applyLottiBabyAppChrome();
    document.addEventListener('DOMContentLoaded', applyLottiBabyAppChrome);
    setTimeout(applyLottiBabyAppChrome, 300);
    true;
  })();
`;

export default function PrintsShopScreen() {
  const { locale } = useLocale();
  const shopSource = useMemo(() => ({ uri: buildPrintsShopUrl(locale) }), [locale]);
  const copy = {
    de: { subtitle: 'Shop & Kasse', errorTitle: 'Shop konnte nicht geladen werden', errorText: 'Bitte prüfe deine Verbindung und versuche es erneut.', retry: 'Neu laden' },
    en: { subtitle: 'Shop & checkout', errorTitle: 'The shop could not be loaded', errorText: 'Check your connection and try again.', retry: 'Reload' },
    es: { subtitle: 'Tienda y pago', errorTitle: 'No se pudo cargar la tienda', errorText: 'Comprueba tu conexión e inténtalo de nuevo.', retry: 'Volver a cargar' },
  }[locale];
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const webViewRef = useRef<WebView>(null);
  const [navigationState, setNavigationState] = useState({ shopUrl: '', canGoBack: false });
  const [loadedShopUrl, setLoadedShopUrl] = useState<string | null>(null);
  const [loadErrorShopUrl, setLoadErrorShopUrl] = useState<string | null>(null);
  const canGoBack = navigationState.shopUrl === shopSource.uri && navigationState.canGoBack;
  const isLoading = loadedShopUrl !== shopSource.uri;
  const loadError = loadErrorShopUrl === shopSource.uri;

  const handleBackPress = useCallback(() => {
    if (canGoBack) {
      webViewRef.current?.goBack();
      return;
    }
    router.back();
  }, [canGoBack, router]);

  return (
    <ThemedBackground style={styles.background}>
      <SafeAreaView style={styles.container}>
        <Header
          title="Lotti Baby Shop"
          subtitle={copy.subtitle}
          showBackButton
          onBackPress={handleBackPress}
          showBabySwitcher={false}
          rightContent={
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => {
                setLoadedShopUrl(null);
                setLoadErrorShopUrl(null);
                webViewRef.current?.reload();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <IconSymbol name="arrow.clockwise" size={20} color={theme.text} />
            </TouchableOpacity>
          }
        />

        <View style={styles.webViewShell}>
          <WebView
            key={shopSource.uri}
            ref={webViewRef}
            source={shopSource}
            originWhitelist={['https://*']}
            injectedJavaScriptBeforeContentLoaded={SHOP_WEBVIEW_CUSTOMIZATION}
            injectedJavaScript={SHOP_WEBVIEW_CUSTOMIZATION}
            onNavigationStateChange={(state) => {
              setNavigationState({ shopUrl: shopSource.uri, canGoBack: state.canGoBack });
            }}
            onLoadStart={() => {
              setLoadedShopUrl(null);
              setLoadErrorShopUrl(null);
            }}
            onLoadEnd={() => setLoadedShopUrl(shopSource.uri)}
            onError={() => {
              setLoadErrorShopUrl(shopSource.uri);
              setLoadedShopUrl(shopSource.uri);
            }}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            setSupportMultipleWindows={false}
            pullToRefreshEnabled
            startInLoadingState
            style={styles.webView}
          />

          {isLoading ? (
            <View pointerEvents="none" style={styles.loadingOverlay}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : null}

          {loadError ? (
            <View style={styles.errorOverlay}>
              <IconSymbol name="exclamationmark.triangle.fill" size={26} color={theme.accent} />
              <ThemedText style={styles.errorTitle}>{copy.errorTitle}</ThemedText>
              <ThemedText style={styles.errorText}>
                {copy.errorText}
              </ThemedText>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: theme.accent }]}
                onPress={() => {
                  setLoadedShopUrl(null);
                  setLoadErrorShopUrl(null);
                  webViewRef.current?.reload();
                }}
              >
                <ThemedText style={styles.retryButtonText}>{copy.retry}</ThemedText>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webViewShell: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#F7F2EC',
  },
  webView: {
    flex: 1,
    backgroundColor: '#F7F2EC',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(247, 242, 236, 0.28)',
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 28,
    backgroundColor: '#F7F2EC',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    opacity: 0.72,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    minWidth: 132,
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
