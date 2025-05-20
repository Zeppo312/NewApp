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
    plugins: [
      ...(config.plugins || []),
      [
        "expo-background-fetch",
        {
          taskIdentifier: "CONTRACTION_TIMER_TASK",
          minimumInterval: 15,
          stopOnTerminate: false,
          startOnBoot: true
        }
      ],
      "expo-task-manager"
    ],
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