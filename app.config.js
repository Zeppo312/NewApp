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
  if (process.env.EAS_BUILD_PROFILE && process.env.EXPO_PUBLIC_DATA_CONSENTS_ENABLED === 'false') {
    throw new Error('New EAS builds must include effective data consents; the inert preview is only available locally');
  }
  const { resolveBackendEnvironment } = require('./lib/backendEnvironment');
  const qa = resolveBackendEnvironment(process.env.EXPO_PUBLIC_BACKEND_ENV,
    process.env.EXPO_PUBLIC_QA_SUPABASE_URL, process.env.EXPO_PUBLIC_QA_SUPABASE_KEY,
    process.env.EXPO_PUBLIC_QA_PROJECT_REF);
  if (process.env.EAS_BUILD_PROFILE?.startsWith('family-qa') && !qa) {
    throw new Error('Family QA build requires explicit isolated backend configuration');
  }
  if (qa && process.env.EAS_BUILD_PROFILE && !process.env.EAS_BUILD_PROFILE.startsWith('family-qa')) {
    throw new Error('Family QA backend cannot be used with another build profile');
  }
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
  addPlugin(plugins, 'expo-asset');
  addPlugin(plugins, '@react-native-community/datetimepicker');
  addPlugin(plugins, 'expo-image');
  addPlugin(plugins, 'expo-sharing');
  addPlugin(plugins, [
    'expo-localization',
    {
      supportedLocales: {
        ios: ['de', 'en', 'es'],
        android: ['de', 'en', 'es'],
      },
    },
  ]);
  addPlugin(plugins, './plugins/withLiveActivityModule');
  // Muss nach withLiveActivityModule laufen: patcht dessen Release-Entitlements.
  addPlugin(plugins, './plugins/withShoppingWidgetModule');
  // Setzt die App-Group von withShoppingWidgetModule voraus und ergänzt nur die
  // Bridge des Schlaf-Widgets.
  addPlugin(plugins, './plugins/withSleepWidgetModule');
  addPlugin(plugins, './plugins/withPlannerWidgetModule');

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
      version: config.version,
      infoPlist: {
        ...config.ios?.infoPlist,
        CFBundleAllowMixedLocalizations: true,
      },
    },
    android: {
      ...config.android,
    },
    locales: {
      de: './assets/locales/de.json',
      en: './assets/locales/en.json',
      es: './assets/locales/es.json',
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

  if (qa) {
    updatedConfig.name = 'Lotti Baby QA';
    // Test binaries must never download a production OTA update.
    updatedConfig.updates.enabled = false;
    updatedConfig.ios.runtimeVersion = `family-qa-${config.version}`;
    updatedConfig.android.runtimeVersion = `family-qa-${config.version}`;
  }
  return updatedConfig;
}; 
