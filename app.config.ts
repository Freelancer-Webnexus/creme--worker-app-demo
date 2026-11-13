import type { ExpoConfig } from "expo/config";
// Brand colours. app-config-colors.test.ts keeps them equal to the uikit tokens.
const BRAND_GREEN = "#1b5e20";
const PAGE_LIGHT = "#f7f7f5";
const PAGE_DARK = "#0f1210";

const APP_ID = "com.joaopaulomarra.workerapp";

const config: ExpoConfig & { newArchEnabled: true } = {
  name: "Worker App",
  slug: "creme-worker-app",
  scheme: "cremeworkerapp",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  // Root view colour before React draws; useSystemBackground follows the theme after.
  backgroundColor: PAGE_LIGHT,
  // SDK 55+ New Architecture is always-on. Keep the flag true; never ship false.
  newArchEnabled: true,
  icon: "./assets/icon.png",
  platforms: ["ios", "android"],
  runtimeVersion: {
    policy: "fingerprint",
  },
  experiments: {
    reactCompiler: true,
    typedRoutes: true,
  },
  ios: {
    bundleIdentifier: APP_ID,
    icon: {
      dark: "./assets/icon-dark.png",
      light: "./assets/icon.png",
      tinted: "./assets/icon-tinted.png",
    },
    supportsTablet: false,
    config: {
      // Only system HTTPS/TLS is used, which is exempt. Without this, App Store
      // Connect asks the export-compliance question on every build and blocks
      // TestFlight external testing until it is answered.
      usesNonExemptEncryption: false,
    },
    // Expo writes no PrivacyInfo.xcprivacy unless this key exists, and an upload
    // that touches a required-reason API without declaring it fails ITMS-91053.
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
          NSPrivacyAccessedAPITypeReasons: ["C617.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime",
          NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
          NSPrivacyAccessedAPITypeReasons: ["E174.1"],
        },
      ],
      NSPrivacyCollectedDataTypes: [],
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
    },
  },
  android: {
    package: APP_ID,
    // Edge-to-edge is mandatory on SDK 55+ / Android 16. Do not set the
    // removed Android edge-to-edge config key — Expo warns and ignores it.
    adaptiveIcon: {
      backgroundColor: BRAND_GREEN,
      foregroundImage: "./assets/android-icon-foreground.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
  },
  plugins: [
    "expo-router",
    "expo-image",
    "expo-status-bar",
    "expo-sqlite",
    ["./plugins/with-night-window-background", { color: PAGE_DARK }],
    [
      "expo-image-picker",
      {
        // Shown by the OS when the worker first photographs a document (M7).
        cameraPermission:
          "Permite usar la cámara para fotografiar tus documentos.",
        photosPermission:
          "Permite elegir fotos de tus documentos desde la galería.",
        microphonePermission: false,
      },
    ],
    [
      "expo-splash-screen",
      {
        // The splash matches the first screen, so the hand-off has no flash.
        backgroundColor: PAGE_LIGHT,
        dark: {
          backgroundColor: PAGE_DARK,
          image: "./assets/splash-icon-dark.png",
        },
        image: "./assets/splash-icon.png",
        imageWidth: 160,
        resizeMode: "contain",
      },
    ],
    [
      "expo-build-properties",
      {
        ios: {
          deploymentTarget: "16.4",
        },
        android: {
          // compileSdk and targetSdk follow the Expo SDK defaults, so an SDK
          // patch that raises them cannot break the build. minSdk 24 is
          // Android 7, below the Android 9 phones the workers use.
          minSdkVersion: 24,
          // The mock backend is plain HTTP on the emulator host. A production
          // build points at HTTPS and this flag is removed.
          usesCleartextTraffic: true,
        },
        // Hermes V1 is the SDK 56+ default. Leave useHermesV1 unset.
        // Do not disable Hermes V1 or force buildReactNativeFromSource.
      },
    ],
  ],
};

export default config;
