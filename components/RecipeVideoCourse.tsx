import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { WebView } from "react-native-webview";

import { ThemedText } from "@/components/ThemedText";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { extractYouTubeVideoId, getRecipeVideoThumbnailUrl } from "@/lib/recipeVideo";

type RecipeVideoCourseProps = {
  accentColor: string;
  textColor: string;
  secondaryTextColor: string;
  videoUrl: string;
};

type PlayerMessage =
  | { type: "ready" }
  | { type: "state"; state: "playing" | "paused" | "ended" }
  | { type: "error" };

const buildHtmlDocument = (videoId: string) => `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #120d0a;
        overflow: hidden;
        width: 100%;
        height: 100%;
      }
      #player {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
      }
      #player iframe {
        width: 100% !important;
        height: 100% !important;
        transform: scale(1.18);
        transform-origin: center center;
      }
    </style>
    <script>
      var player = null;
      var isReady = false;

      function postMessage(payload) {
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        } catch (e) {}
      }

      function emitState(state) {
        postMessage({ type: 'state', state: state });
      }

      function onPlayerReady() {
        isReady = true;
        postMessage({ type: 'ready' });
      }

      function onPlayerStateChange(event) {
        if (!window.YT || !window.YT.PlayerState) return;

        switch (event.data) {
          case window.YT.PlayerState.PLAYING:
            emitState('playing');
            break;
          case window.YT.PlayerState.PAUSED:
            emitState('paused');
            break;
          case window.YT.PlayerState.ENDED:
            emitState('ended');
            break;
          default:
            break;
        }
      }

      function onPlayerError() {
        postMessage({ type: 'error' });
      }

      function createPlayer() {
        player = new window.YT.Player('player', {
          videoId: ${JSON.stringify(videoId)},
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            enablejsapi: 1,
            iv_load_policy: 3,
            playsinline: 1,
            rel: 0
          },
          events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
            onError: onPlayerError
          }
        });
      }

      function waitForApi() {
        if (window.YT && window.YT.Player) {
          createPlayer();
          return;
        }

        setTimeout(waitForApi, 50);
      }

      window.onYouTubeIframeAPIReady = waitForApi;

      window.__recipeVideoControl = function(action, payload) {
        if (!isReady || !player) return false;

        try {
          if (action === 'play') {
            player.playVideo();
          } else if (action === 'pause') {
            player.pauseVideo();
            emitState('paused');
          } else if (action === 'seekBy') {
            var current = typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : 0;
            var duration = typeof player.getDuration === 'function' ? player.getDuration() : 0;
            var next = current + Number(payload || 0);
            if (Number.isNaN(next)) next = current;
            if (next < 0) next = 0;
            if (duration > 0 && next > duration) next = duration;
            player.seekTo(next, true);
          }
          return true;
        } catch (e) {
          postMessage({ type: 'error' });
          return false;
        }
      };

      var tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      document.head.appendChild(tag);
    </script>
  </head>
  <body>
    <div id="player"></div>
  </body>
</html>`;

export function RecipeVideoCourse({
  accentColor,
  textColor,
  secondaryTextColor,
  videoUrl,
}: RecipeVideoCourseProps) {
  const webViewRef = useRef<WebView>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [shouldAutoplay, setShouldAutoplay] = useState(false);

  const videoId = useMemo(() => extractYouTubeVideoId(videoUrl), [videoUrl]);
  const thumbnailUrl = useMemo(
    () => (videoId ? getRecipeVideoThumbnailUrl(videoId) : null),
    [videoId],
  );
  const htmlDocument = useMemo(
    () => (videoId ? buildHtmlDocument(videoId) : null),
    [videoId],
  );

  useEffect(() => {
    setHasStarted(false);
    setIsReady(false);
    setShouldAutoplay(false);
  }, [videoId]);

  useEffect(() => {
    if (!hasStarted || !isReady || !shouldAutoplay) return;

    webViewRef.current?.injectJavaScript(
      `(function(){window.__recipeVideoControl && window.__recipeVideoControl('play');})(); true;`,
    );
    setShouldAutoplay(false);
  }, [hasStarted, isReady, shouldAutoplay]);

  if (!videoId) {
    return null;
  }

  const handleOpenExternally = () => {
    void Linking.openURL(videoUrl);
  };

  const handleStart = () => {
    if (Platform.OS === "web") {
      handleOpenExternally();
      return;
    }

    if (!hasStarted) {
      setHasStarted(true);
      setShouldAutoplay(true);
      return;
    }

    if (isReady) {
      webViewRef.current?.injectJavaScript(
        `(function(){window.__recipeVideoControl && window.__recipeVideoControl('play');})(); true;`,
      );
    }
  };

  const handleStop = () => {
    if (!hasStarted || !isReady) return;

    webViewRef.current?.injectJavaScript(
      `(function(){window.__recipeVideoControl && window.__recipeVideoControl('pause');})(); true;`,
    );
  };

  const handleSeekBy = (seconds: number) => {
    if (!hasStarted || !isReady) return;

    webViewRef.current?.injectJavaScript(
      `(function(){window.__recipeVideoControl && window.__recipeVideoControl('seekBy', ${seconds});})(); true;`,
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.previewFrame}>
        <View style={styles.previewBackdrop} />

        <View style={styles.portraitStage}>
          {hasStarted && Platform.OS !== "web" && htmlDocument ? (
            <>
              <WebView
                ref={webViewRef}
                source={{ html: htmlDocument, baseUrl: "https://www.youtube-nocookie.com" }}
                style={styles.webView}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled
                domStorageEnabled={false}
                scrollEnabled={false}
                bounces={false}
                setSupportMultipleWindows={false}
                originWhitelist={["https://*"]}
              onMessage={(event) => {
                try {
                  const payload = JSON.parse(event.nativeEvent.data) as PlayerMessage;

                    if (payload.type === "ready") {
                      setIsReady(true);
                      return;
                    }

                    if (payload.type === "state") {
                      return;
                    }

                    setIsReady(false);
                  } catch {
                  setIsReady(false);
                }
              }}
            />
              {!isReady ? (
                <View style={styles.loadingOverlay} pointerEvents="none">
                  <ActivityIndicator color={accentColor} />
                </View>
              ) : null}
              <View pointerEvents="auto" style={styles.touchShield} />
            </>
          ) : (
            <>
              {thumbnailUrl ? (
                <Image
                  source={{ uri: thumbnailUrl }}
                  style={styles.poster}
                  contentFit="cover"
                  cachePolicy="disk"
                  transition={250}
                />
              ) : (
                <View style={styles.posterFallback} />
              )}
              <View style={styles.posterContentOverlay} />
              <View style={styles.posterContent}>
                <View style={[styles.badge, { backgroundColor: `${accentColor}22` }]}>
                  <IconSymbol name="play.rectangle.fill" size={14} color={accentColor} />
                  <ThemedText style={[styles.badgeText, { color: accentColor }]}>
                    Videokurs
                  </ThemedText>
                </View>
                <ThemedText style={styles.posterTitle}>
                  Schritt fuer Schritt ansehen
                </ThemedText>
                <ThemedText style={styles.posterSubtitle}>
                  Shorts-Format, sauber eingebettet und ohne sichtbare YouTube-Steuerung.
                </ThemedText>
              </View>
            </>
          )}
        </View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.actionButtonHalf,
            styles.primaryButton,
            { backgroundColor: accentColor },
          ]}
          onPress={handleStart}
          activeOpacity={0.88}
        >
          <IconSymbol name="play.fill" size={16} color="#FFFFFF" />
          <ThemedText style={styles.primaryButtonText}>Start</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.actionButtonHalf,
            !hasStarted && styles.actionButtonDisabled,
          ]}
          onPress={() => handleSeekBy(-10)}
          activeOpacity={0.88}
          disabled={!hasStarted || !isReady}
        >
          <IconSymbol name="gobackward.10" size={16} color={textColor} />
          <ThemedText style={[styles.secondaryButtonText, { color: textColor }]}>
            -10s
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.actionButtonHalf,
            !hasStarted && styles.actionButtonDisabled,
          ]}
          onPress={() => handleSeekBy(10)}
          activeOpacity={0.88}
          disabled={!hasStarted || !isReady}
        >
          <IconSymbol name="goforward.10" size={16} color={textColor} />
          <ThemedText style={[styles.secondaryButtonText, { color: textColor }]}>
            +10s
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.actionButtonHalf,
            !hasStarted && styles.actionButtonDisabled,
          ]}
          onPress={handleStop}
          activeOpacity={0.88}
          disabled={!hasStarted}
        >
          <IconSymbol name="stop.fill" size={16} color={textColor} />
          <ThemedText style={[styles.secondaryButtonText, { color: textColor }]}>
            Stop
          </ThemedText>
        </TouchableOpacity>
        {Platform.OS === "web" ? (
          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleOpenExternally}
            activeOpacity={0.88}
          >
            <IconSymbol name="arrow.up.right.square" size={16} color={secondaryTextColor} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  previewFrame: {
    minHeight: 620,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  previewBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  webView: {
    flex: 1,
    backgroundColor: "#120d0a",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(18, 13, 10, 0.18)",
  },
  touchShield: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  poster: {
    ...StyleSheet.absoluteFillObject,
  },
  posterFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1a1411",
  },
  portraitStage: {
    width: "92%",
    maxWidth: 340,
    minWidth: 280,
    aspectRatio: 9 / 16,
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: "#000000",
  },
  posterContentOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(18, 13, 10, 0.34)",
  },
  posterContent: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  posterTitle: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    color: "#FFFFFF",
  },
  posterSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: "rgba(255,255,255,0.84)",
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionButton: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  actionButtonHalf: {
    width: "48%",
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  primaryButton: {
    minWidth: 100,
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  linkButton: {
    width: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.55)",
  },
});
