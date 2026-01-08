const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Set the app root for expo-router
process.env.EXPO_ROUTER_APP_ROOT = './app';

module.exports = config;