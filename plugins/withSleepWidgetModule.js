/**
 * Expo config plugin für das Schlaf-Widget.
 *
 * Kopiert die Bridge (SleepWidgetModule.swift/.m) sowie den geteilten
 * App-Group-Speicher (targets/widget/SleepWidgetStore.swift) in das generierte
 * iOS-Projekt und registriert sie im Xcode-Projekt.
 *
 * Die App-Group und die Entitlements richtet bereits withShoppingWidgetModule
 * ein — beide Widgets teilen sich dieselbe Gruppe, deshalb bleibt dieser Plugin
 * auf das Nötige beschränkt.
 *
 * ACHTUNG: Im Build-Flow läuft kein `expo prebuild`, `ios/` ist committet.
 * Änderungen hier müssen zusätzlich von Hand ins Xcode-Projekt übertragen
 * werden, sonst bleibt NativeModules.SleepWidgetModule null.
 */
const { withXcodeProject, withDangerousMod, IOSConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SOURCE_FILES = [
  { from: 'native-modules/SleepWidget/SleepWidgetModule.swift', name: 'SleepWidgetModule.swift' },
  { from: 'native-modules/SleepWidget/SleepWidgetModule.m', name: 'SleepWidgetModule.m' },
  { from: 'targets/widget/SleepWidgetStore.swift', name: 'SleepWidgetStore.swift' },
];

/** Step 1 – Dateien nach ios/<AppName>/ kopieren */
function withCopyFiles(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const appName = cfg.modRequest.projectName;
      const targetDir = path.join(projectRoot, 'ios', appName);

      for (const file of SOURCE_FILES) {
        const src = path.join(projectRoot, file.from);
        const dst = path.join(targetDir, file.name);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dst);
        } else {
          console.warn(`[withSleepWidgetModule] Source not found: ${src}`);
        }
      }

      return cfg;
    },
  ]);
}

/** Step 2 – Dateien im Xcode-Projekt registrieren */
function withAddToXcode(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const appName = cfg.modRequest.projectName;
    const projectRoot = cfg.modRequest.projectRoot;

    const { target } = IOSConfig.XcodeUtils.getApplicationNativeTarget({
      project,
      projectName: appName,
    });

    const groupPath = path.join(projectRoot, 'ios', appName);

    for (const file of SOURCE_FILES) {
      if (project.hasFile(`${appName}/${file.name}`)) continue;

      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: path.join(groupPath, file.name),
        groupName: appName,
        project,
        targetUuid: target.uuid,
      });
    }

    return cfg;
  });
}

module.exports = function withSleepWidgetModule(config) {
  config = withCopyFiles(config);
  config = withAddToXcode(config);
  return config;
};
