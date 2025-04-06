module.exports = function (api) {
  api.cache(false); // Disable cache to ensure env values are reloaded
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module:react-native-dotenv',
        {
          moduleName: '@env',
          path: '.env',
          blacklist: null,
          whitelist: null,
          safe: false,
          allowUndefined: false, // Require env values to be defined
        },
      ],
      'react-native-reanimated/plugin'
    ],
  };
};
