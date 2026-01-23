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
const combinedBlockList = config.resolver?.blockList
  ? new RegExp(`${config.resolver.blockList.source}|${backupBlock.source}`)
  : backupBlock;

// Ignore the backup repo so Metro doesn't pick up its node_modules or sources
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
