// @ts-nocheck

/**
 * @typedef {import('expo/config').ExpoConfig} ExpoConfig
 * @typedef {import('expo/config').ConfigContext} ConfigContext
 */

/**
 * @param {ConfigContext} context
 * @returns {ExpoConfig}
 */
module.exports = function({ config }) {
  const iosJsEngine = process.env.LOTTI_IOS_JS_ENGINE?.trim() || config.ios?.jsEngine || 'jsc';
  const androidJsEngine = process.env.LOTTI_ANDROID_JS_ENGINE?.trim() || config.android?.jsEngine || 'hermes';
  const addPlugin = (plugins, plugin) => {
    const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
    const exists = plugins.some((item) => (Array.isArray(item) ? item[0] : item) === pluginName);
    if (!exists) plugins.push(plugin);
  };

  const plugins = [...(config.plugins || [])];

  addPlugin(plugins, [
    './plugins/withRevenueCat',
    {
      iosApiKey: process.env.EXPO_PUBLIC_RC_IOS_KEY,
      androidApiKey: process.env.EXPO_PUBLIC_RC_ANDROID_KEY,
    },
  ]);
  addPlugin(plugins, 'expo-task-manager');
  addPlugin(plugins, '@react-native-community/datetimepicker');
  addPlugin(plugins, 'expo-image');
  addPlugin(plugins, 'expo-sharing');
  addPlugin(plugins, './plugins/withLiveActivityModule');

  // Konfiguration für Updates
  const updatedConfig = {
    ...config,
    // Stelle sicher, dass Updates für Development-Builds aktiviert sind
    updates: {
      ...config.updates,
      enabled: true,
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0
    },
    ios: {
      ...config.ios,
      jsEngine: iosJsEngine,
      version: config.version,
    },
    android: {
      ...config.android,
      jsEngine: androidJsEngine,
    },
    // Zusätzliche Expo-Konfiguration
    extra: {
      ...config.extra,
      eas: {
        ...config.extra?.eas,
        projectId: "d7120520-e4ff-4967-a797-627a2cb3680b"
      }
    },
    // Plugins konfigurieren
    plugins,
  };

  return updatedConfig;
}; 
