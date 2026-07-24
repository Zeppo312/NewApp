import 'react-native-url-polyfill/auto';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const PRINTS_URL = 'https://lottibaby.de';

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
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

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
          subtitle="Shop & Checkout"
          showBackButton
          onBackPress={handleBackPress}
          showBabySwitcher={false}
          rightContent={
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => {
                setLoadError(false);
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
            ref={webViewRef}
            source={{ uri: PRINTS_URL }}
            originWhitelist={['https://*']}
            injectedJavaScriptBeforeContentLoaded={SHOP_WEBVIEW_CUSTOMIZATION}
            injectedJavaScript={SHOP_WEBVIEW_CUSTOMIZATION}
            onNavigationStateChange={(state) => {
              setCanGoBack(state.canGoBack);
            }}
            onLoadStart={() => {
              setIsLoading(true);
              setLoadError(false);
            }}
            onLoadEnd={() => setIsLoading(false)}
            onError={() => {
              setLoadError(true);
              setIsLoading(false);
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
              <ThemedText style={styles.errorTitle}>Shop konnte nicht geladen werden</ThemedText>
              <ThemedText style={styles.errorText}>
                Bitte prüfe deine Verbindung und versuche es erneut.
              </ThemedText>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: theme.accent }]}
                onPress={() => {
                  setLoadError(false);
                  webViewRef.current?.reload();
                }}
              >
                <ThemedText style={styles.retryButtonText}>Neu laden</ThemedText>
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
