import { ExpoConfig, ConfigContext } from 'expo/config';

const IS_DEV = process.env.APP_VARIANT === 'development';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_DEV ? '学級アラート(dev)' : '学級アラート',
  slug: 'gakkyu-alert',
  description: '学級閉鎖・感染症情報をリアルタイムでお届けするアラートアプリ',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'gakkyu-alert',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/images/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#1a4bab',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: IS_DEV ? 'jp.gakkyu-alert.app.dev' : 'jp.gakkyu-alert.app',
    icon: './assets/images/icon.png',
    infoPlist: {
      NSLocationWhenInUseUsageDescription: '現在地から居住都道府県を自動取得するために使用します。',
      ITSAppUsesNonExemptEncryption: false,
    },
    entitlements: {
      'aps-environment': 'production',
    },
  },
  android: {
    package: IS_DEV ? 'jp.gakkyu_alert.app.dev' : 'jp.gakkyu_alert.app',
    icon: './assets/images/icon.png',
    adaptiveIcon: {
      foregroundImage: './assets/images/icon.png',
      backgroundColor: '#1a4bab',
    },
    permissions: ['android.permission.RECEIVE_BOOT_COMPLETED'],
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/images/icon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-web-browser',
    [
      'expo-notifications',
      {
        icon: './assets/images/icon.png',
        color: '#ffffff',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: '43651976-ec65-4b52-912e-6b16ff4f2942',
    },
  },
  owner: 'bonopo',
});
