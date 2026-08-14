// Cho phép import GeoJSON và TFLite assets trong Expo/Metro.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'geojson');
config.resolver.assetExts = [...new Set([...config.resolver.assetExts, 'tflite'])];
config.resolver.sourceExts = [...new Set([...config.resolver.sourceExts, 'geojson'])];

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;
