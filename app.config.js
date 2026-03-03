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
    // Einheitliche Runtime-Version für alle Builds
    runtimeVersion: "1.0.0",
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
    // iOS-spezifische Konfiguration 
    ios: {
      ...config.ios,
      infoPlist: {
        ...(config.ios?.infoPlist || {}),
        BGTaskSchedulerPermittedIdentifiers: [
          "CONTRACTION_TIMER_TASK"
        ]
      }
    }
  };

  return updatedConfig;
}; 
