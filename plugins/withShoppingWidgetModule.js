/**
 * Expo config plugin für das Einkaufslisten-Widget.
 *
 * 1. Kopiert die Bridge (ShoppingWidgetModule.swift/.m) sowie den geteilten
 *    App-Group-Speicher (targets/widget/ShoppingWidgetStore.swift) in das
 *    generierte iOS-Projekt und registriert sie im Xcode-Projekt.
 * 2. Trägt die App-Group in die Debug- und Release-Entitlements der App ein.
 *
 * ShoppingWidgetStore.swift liegt bewusst im Widget-Target und wird nur in die
 * App kopiert — so teilen sich App und Widget genau ein Datenformat.
 */
const {
  withXcodeProject,
  withDangerousMod,
  withEntitlementsPlist,
  IOSConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const APP_GROUP = 'group.com.LottiBaby.app';
const APP_GROUP_KEY = 'com.apple.security.application-groups';

const SOURCE_FILES = [
  { from: 'native-modules/ShoppingWidget/ShoppingWidgetModule.swift', name: 'ShoppingWidgetModule.swift' },
  { from: 'native-modules/ShoppingWidget/ShoppingWidgetModule.m', name: 'ShoppingWidgetModule.m' },
  { from: 'targets/widget/ShoppingWidgetStore.swift', name: 'ShoppingWidgetStore.swift' },
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
          console.warn(`[withShoppingWidgetModule] Source not found: ${src}`);
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

/** Step 3 – App-Group in die generierten (Debug-)Entitlements eintragen */
function withAppGroupEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    const existing = cfg.modResults[APP_GROUP_KEY] || [];
    if (!existing.includes(APP_GROUP)) {
      cfg.modResults[APP_GROUP_KEY] = [...existing, APP_GROUP];
    }
    return cfg;
  });
}

/**
 * Step 4 – App-Group auch in die Release-Entitlements schreiben.
 * withLiveActivityModule zeigt CODE_SIGN_ENTITLEMENTS im Release-Build auf
 * <AppName>.release.entitlements; ohne diesen Schritt fehlte dort die Gruppe.
 */
function withReleaseAppGroup(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const appName = cfg.modRequest.projectName;
      const releasePath = path.join(projectRoot, 'ios', appName, `${appName}.release.entitlements`);

      if (!fs.existsSync(releasePath)) {
        console.warn(`[withShoppingWidgetModule] Release entitlements not found: ${releasePath}`);
        return cfg;
      }

      const contents = fs.readFileSync(releasePath, 'utf8');
      if (contents.includes(APP_GROUP)) return cfg;

      const entry = `  <key>${APP_GROUP_KEY}</key>\n  <array>\n    <string>${APP_GROUP}</string>\n  </array>\n`;
      const updated = contents.replace(/(\s*)<\/dict>/, `\n${entry}</dict>`);
      if (updated === contents) {
        console.warn('[withShoppingWidgetModule] Could not patch release entitlements.');
        return cfg;
      }

      fs.writeFileSync(releasePath, updated);
      return cfg;
    },
  ]);
}

module.exports = function withShoppingWidgetModule(config) {
  config = withAppGroupEntitlement(config);
  config = withCopyFiles(config);
  config = withAddToXcode(config);
  config = withReleaseAppGroup(config);
  return config;
};
