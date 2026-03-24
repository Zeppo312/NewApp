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

const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

const backupBlock = /LottiBaby\.bak_mmap[\\/].*/;
const duplicateNodeModulesBlock = /node_modules[\\/].* \d+(?:[\\/].*)?/;
const tempNodeModulesBlock = /node_modules[\\/]\.(?!bin(?:[\\/]|$))[^\\/]+-[A-Za-z0-9]{6,}(?:[\\/].*)?/;
const combinedBlockSources = [
  config.resolver?.blockList?.source,
  backupBlock.source,
  duplicateNodeModulesBlock.source,
  tempNodeModulesBlock.source
].filter(Boolean);
const combinedBlockList = new RegExp(combinedBlockSources.join("|"));

// Ignore the backup repo and Finder-style duplicate packages so Metro does not crawl them.
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

module.exports = config;
