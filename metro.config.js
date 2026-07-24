if (!Array.prototype.toReversed) {
  // Polyfill for Node <20 used by metro-config's mergeConfig.
  Object.defineProperty(Array.prototype, "toReversed", {
    value: function toReversed() {
      return Array.from(this).reverse();
    },
    writable: true,
    configurable: true,
    enumerable: false
  });
}

const { getDefaultConfig } = require("expo/metro-config");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const useSentryMetro =
  process.env.LOTTI_FORCE_SENTRY_METRO === "1" ||
  process.env.NODE_ENV === "production" ||
  process.env.CI === "1" ||
  process.env.EAS_BUILD === "true";

// The Sentry Metro wrapper is useful for production artifacts, but it makes the
// first local dev-client bundle noticeably slower in this project.
const config = useSentryMetro
  ? getSentryExpoConfig(__dirname)
  : getDefaultConfig(__dirname);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const projectRootPattern = escapeRegExp(__dirname);
const atProjectRoot = (pattern) => `${projectRootPattern}[\\\\/]${pattern}`;

const backupBlock = /LottiBaby\.bak_mmap[\\/].*/;
const backupGitBlock = new RegExp(atProjectRoot("\\.git\\.backup-corrupt-[^\\\\/]+(?:[\\\\/].*)?"));
const distArtifactsBlock = new RegExp(atProjectRoot("dist(?:[^\\\\/]*)(?:[\\\\/].*)?"));
const backupDirsBlock = new RegExp(
  atProjectRoot("(?:backup|dist_backup_[^\\\\/]+|ownership-map-out|hostinger-coming-soon)(?:[\\\\/].*)?"),
);
const pythonVenvBlock = new RegExp(atProjectRoot("venv(?:[\\\\/].*)?"));
const localBuildOutputBlock = new RegExp(
  atProjectRoot("(?:ios[\\\\/]build|\\.expo[\\\\/]web)(?:[\\\\/].*)?"),
);
const localWorkspaceNoiseBlock = new RegExp(
  atProjectRoot(
    "(?:android|ios|targets|output|docs|db|scripts|sql|supabase|\\.local-disabled|\\.agents|\\.claude)(?:[\\\\/].*)?",
  ),
);
const duplicateNativeDirsBlock = new RegExp(
  atProjectRoot("android[\\\\/](?:app 2|gradle 2)(?:[\\\\/].*)?"),
);
const duplicateNodeModulesBlock = new RegExp(
  atProjectRoot("node_modules[\\\\/].* \\d+(?:[\\\\/].*)?"),
);
const tempNodeModulesBlock = new RegExp(
  atProjectRoot("node_modules[\\\\/]\\.(?!bin(?:[\\\\/]|$))[^\\\\/]+-[A-Za-z0-9]{6,}(?:[\\\\/].*)?"),
);
const combinedBlockSources = [
  config.resolver?.blockList?.source,
  backupBlock.source,
  backupGitBlock.source,
  distArtifactsBlock.source,
  backupDirsBlock.source,
  pythonVenvBlock.source,
  localBuildOutputBlock.source,
  localWorkspaceNoiseBlock.source,
  duplicateNativeDirsBlock.source,
  duplicateNodeModulesBlock.source,
  tempNodeModulesBlock.source
].filter(Boolean);
const combinedBlockList = new RegExp(combinedBlockSources.join("|"));

// Ignore local build outputs, backups, generated artifacts, and duplicate folders so Metro does not crawl them.
config.resolver = {
  ...config.resolver,
  blockList: combinedBlockList,
  extraNodeModules: {
    ...(config.resolver?.extraNodeModules || {}),
    net: require.resolve('node-libs-browser/mock/net.js'),
    tls: require.resolve('node-libs-browser/mock/tls.js'),
    crypto: require.resolve('node-libs-browser/mock/empty.js'),
    http: require.resolve('node-libs-browser/mock/empty.js'),
    https: require.resolve('node-libs-browser/mock/empty.js'),
    fs: require.resolve('node-libs-browser/mock/empty.js'),
    stream: require.resolve('node-libs-browser/mock/empty.js'),
    events: require.resolve('node-libs-browser/mock/empty.js'),
    zlib: require.resolve('node-libs-browser/mock/empty.js')
  }
};

config.watcher = {
  ...(config.watcher || {}),
  watchman: false,
};

module.exports = config;
