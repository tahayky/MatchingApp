// app.config.js
// Expo configuration file with Firebase integration
module.exports = {
  name: "MatchingApp",
  slug: "matchingapp",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "matchingapp",
  userInterfaceStyle: "automatic",
  
  // React Native's new architecture flag
  newArchEnabled: true,
  
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.lambaapp.lambacorp"
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff"
    },
    package: "com.lambaapp.lambacorp",
    googleServicesFile: "./google-services.json"
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png"
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        "image": "./assets/images/splash-icon.png",
        "imageWidth": 200,
        "resizeMode": "contain",
        "backgroundColor": "#ffffff"
      }
    ]
  ],
  experiments: {
    typedRoutes: true
  },
  extra: {
    eas: {
      projectId: "matchingapp-c439a"
    },
    // Firebase configuration from environment variables
    firebaseApiKey: process.env.FIREBASE_API_KEY,
    firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
    firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppId: process.env.FIREBASE_APP_ID,
    // API configuration
    apiUrlIos: process.env.API_URL_IOS,
    apiUrlAndroid: process.env.API_URL_ANDROID,
    apiUrlDevice: process.env.API_URL_DEVICE,
    useLocalIp: process.env.USE_LOCAL_IP
  }
};
