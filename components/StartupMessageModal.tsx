import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

import { Colors } from '@/constants/Colors';
import { ThemedText } from '@/components/ThemedText';
import { type StartupMessage } from '@/lib/startupMessages';

type StartupMessageModalProps = {
  visible: boolean;
  message: StartupMessage | null;
  isSubmitting?: boolean;
  onConfirm: () => void;
};

const wrapHtmlDocument = (html: string) => `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #5c4033;
        background: #fffaf6;
      }
      img, video, iframe {
        max-width: 100%;
      }
      a {
        color: #c9825c;
      }
    </style>
  </head>
  <body>${html}</body>
</html>`;

const stripHtmlTags = (value: string) =>
  value
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isSameTrustedHost = (value: string | null | undefined) => {
  if (!value) return false;

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export function StartupMessageModal({
  visible,
  message,
  isSubmitting = false,
  onConfirm,
}: StartupMessageModalProps) {
  const { height } = useWindowDimensions();
  const webViewHeight = Math.min(Math.max(height * 0.42, 220), 420);

  const htmlDocument = useMemo(() => {
    if (message?.content_type !== 'html' || !message.content) {
      return null;
    }

    return wrapHtmlDocument(message.content);
  }, [message]);

  if (!message) {
    return null;
  }

  const renderContent = () => {
    if (message.content_type === 'text') {
      return (
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.contentScrollInner}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText style={styles.contentText}>
            {message.content ?? ''}
          </ThemedText>
        </ScrollView>
      );
    }

    if (Platform.OS === 'web') {
      if (message.content_type === 'remote_url' && message.source_url) {
        return (
          <View style={[styles.webFallback, { minHeight: webViewHeight }]}>
            <ThemedText style={styles.webFallbackText}>
              Diese Web-Ansicht wird in der nativen App direkt eingebettet.
            </ThemedText>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => {
                void Linking.openURL(message.source_url!);
              }}
            >
              <ThemedText style={styles.linkButtonText}>Seite öffnen</ThemedText>
            </TouchableOpacity>
          </View>
        );
      }

      return (
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.contentScrollInner}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText style={styles.contentText}>
            {stripHtmlTags(message.content ?? '')}
          </ThemedText>
        </ScrollView>
      );
    }

    if (message.content_type === 'remote_url' && isSameTrustedHost(message.source_url)) {
      return (
        <View style={[styles.webViewShell, { height: webViewHeight }]}>
          <WebView
            source={{ uri: message.source_url! }}
            style={styles.webView}
            javaScriptEnabled={false}
            domStorageEnabled={false}
            setSupportMultipleWindows={false}
            originWhitelist={['https://*']}
            onShouldStartLoadWithRequest={(request) => {
              if (request.url === message.source_url) {
                return true;
              }

              return isSameTrustedHost(request.url);
            }}
          />
        </View>
      );
    }

    return (
      <View style={[styles.webViewShell, { height: webViewHeight }]}>
        <WebView
          source={{ html: htmlDocument ?? wrapHtmlDocument(''), baseUrl: 'https://lottibaby.de' }}
          style={styles.webView}
          javaScriptEnabled={false}
          domStorageEnabled={false}
          setSupportMultipleWindows={false}
          originWhitelist={['https://*']}
          onShouldStartLoadWithRequest={(request) => {
            if (request.url === 'about:blank') {
              return true;
            }

            return isSameTrustedHost(request.url);
          }}
        />
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} />
        <View style={styles.card}>
          <View style={styles.badge}>
            <ThemedText style={styles.badgeText}>Neu in LottiBaby</ThemedText>
          </View>

          <ThemedText style={styles.title}>{message.title}</ThemedText>

          {message.summary ? (
            <ThemedText style={styles.summary}>{message.summary}</ThemedText>
          ) : null}

          {renderContent()}

          <TouchableOpacity
            style={[styles.confirmButton, isSubmitting && styles.confirmButtonDisabled]}
            disabled={isSubmitting}
            onPress={onConfirm}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.confirmButtonText}>
                {message.button_label || 'Okay'}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(38, 22, 15, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 28,
    backgroundColor: '#FFF9F5',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(201, 130, 92, 0.16)',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(201, 130, 92, 0.14)',
    marginBottom: 12,
  },
  badgeText: {
    color: '#A55E3A',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 8,
  },
  summary: {
    fontSize: 15,
    lineHeight: 21,
    color: '#7D5A50',
    marginBottom: 14,
  },
  contentScroll: {
    maxHeight: 320,
    marginBottom: 16,
  },
  contentScrollInner: {
    paddingBottom: 4,
  },
  contentText: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.light.text,
  },
  webViewShell: {
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(201, 130, 92, 0.16)',
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  webView: {
    backgroundColor: '#FFFFFF',
  },
  webFallback: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(201, 130, 92, 0.16)',
    backgroundColor: '#FFFFFF',
    padding: 18,
    justifyContent: 'center',
    marginBottom: 16,
  },
  webFallbackText: {
    fontSize: 15,
    lineHeight: 21,
    color: '#7D5A50',
    marginBottom: 12,
  },
  linkButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(201, 130, 92, 0.12)',
  },
  linkButtonText: {
    color: '#A55E3A',
    fontWeight: '700',
  },
  confirmButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: '#C9825C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
