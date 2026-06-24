/**
 * Expo config plugin that copies the native LiveActivityModule (.swift + .m)
 * into the generated iOS project and registers them in the Xcode project file.
 *
 * Source files live in  native-modules/LiveActivity/  so they survive
 * `npx expo prebuild --clean`.
 */
const {
  withXcodeProject,
  withDangerousMod,
  IOSConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const NATIVE_FILES = [
  'SleepActivityAttributes.swift',
  'LiveActivityModule.swift',
  'LiveActivityModule.m',
];
const SOURCE_DIR = 'native-modules/LiveActivity';

/** Step 1 – copy files into ios/<AppName>/ */
function withCopyFiles(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const appName = cfg.modRequest.projectName;
      const targetDir = path.join(projectRoot, 'ios', appName);
      const srcDir = path.join(projectRoot, SOURCE_DIR);

      for (const file of NATIVE_FILES) {
        const src = path.join(srcDir, file);
        const dst = path.join(targetDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dst);
        } else {
          console.warn(`[withLiveActivityModule] Source not found: ${src}`);
        }
      }

      return cfg;
    },
  ]);
}

/** Step 2 – register the files in the Xcode project */
function withAddToXcode(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const appName = cfg.modRequest.projectName;
    const projectRoot = cfg.modRequest.projectRoot;

    // Get the main app native target
    const { target } = IOSConfig.XcodeUtils.getApplicationNativeTarget({
      project,
      projectName: appName,
    });

    // Get or create the main app source group
    const groupPath = path.join(projectRoot, 'ios', appName);

    for (const file of NATIVE_FILES) {
      const filePath = path.join(groupPath, file);

      // Skip if file already in project
      if (project.hasFile(`${appName}/${file}`)) continue;

      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: filePath,
        groupName: appName,
        project,
        targetUuid: target.uuid,
      });
    }

    return cfg;
  });
}

module.exports = function withLiveActivityModule(config) {
  config = withCopyFiles(config);
  config = withAddToXcode(config);
  return config;
};
