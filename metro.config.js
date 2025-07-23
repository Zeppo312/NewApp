const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

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

module.exports = config; 