module.exports = () => ({
  expo: {
    name: 'Homehub',
    slug: 'homehub',
    scheme: 'homehub',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.bhavyam.homehub',
      associatedDomains: ['applinks:myapp-ceb0c.firebaseapp.com'],
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: 'com.bhavyam.homehub',
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: 'myapp-ceb0c.firebaseapp.com',
              pathPrefix: '/auth/email-link',
            },
            {
              scheme: 'https',
              host: 'myapp-ceb0c.firebaseapp.com',
              pathPrefix: '/__/auth',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    owner: 'bhavjain2011',
    extra: {
      emailLinkUrlBase: 'https://myapp-ceb0c.firebaseapp.com',
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
      googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
      eas: {
        projectId: '5220c3c5-f997-4ee5-b91d-edeb4c14ee7f',
      },
    },
    plugins: [
      'expo-web-browser',
      'expo-asset',
      'expo-audio',
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
        },
      ],
    ],
  },
});
