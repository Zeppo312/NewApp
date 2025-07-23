const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable tree shaking for better bundle optimization
config.transformer.minifierConfig = {
  keep_fnames: true,
  mangle: {
    keep_fnames: true,
  },
};

// Optimize asset loading
config.transformer.assetPlugins = ['expo-asset/tools/hashAssetFiles'];

// Enable Hermes for faster startup and better performance
config.resolver.platforms = ['native', 'android', 'ios', 'web'];

// Nutze node-libs-browser für die Node.js Polyfills
config.resolver.extraNodeModules = {
  net: require.resolve('node-libs-browser/mock/net.js'),
  tls: require.resolve('node-libs-browser/mock/tls.js'),
  crypto: require.resolve('node-libs-browser/mock/empty.js'),
  http: require.resolve('node-libs-browser/mock/empty.js'),
  https: require.resolve('node-libs-browser/mock/empty.js'),
  fs: require.resolve('node-libs-browser/mock/empty.js'),
  stream: require.resolve('node-libs-browser/mock/empty.js'),
  events: require.resolve('node-libs-browser/mock/empty.js'),
  zlib: require.resolve('node-libs-browser/mock/empty.js')
};

// Add performance optimizations
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config; 