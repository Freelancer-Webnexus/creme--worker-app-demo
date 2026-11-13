import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const failures: string[] = [];

const readFirstExisting = (relativePaths: string[]): string => {
  for (const relativePath of relativePaths) {
    try {
      return readFileSync(resolve(root, relativePath), "utf8");
    } catch {
      // try the next candidate
    }
  }
  throw new Error(`Missing one of: ${relativePaths.join(", ")}`);
};

/** Comments are not configuration; a flag mentioned in prose is not a flag set. */
const withoutComments = (source: string): string => {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
};

/**
 * The config is evaluated rather than pattern-matched. Text matching passes on
 * a commented-out flag and on a config that throws before it exports anything.
 */
type ExpoConfigShape = {
  android?: { edgeToEdgeEnabled?: unknown };
  experiments?: { reactCompiler?: unknown; typedRoutes?: unknown };
  ios?: {
    config?: { usesNonExemptEncryption?: unknown };
    privacyManifests?: {
      NSPrivacyAccessedAPITypes?: { NSPrivacyAccessedAPIType?: string }[];
    };
  };
  jsEngine?: unknown;
  newArchEnabled?: unknown;
  runtimeVersion?: { policy?: unknown };
  userInterfaceStyle?: unknown;
};

/** Required-reason categories an upload is rejected for omitting (ITMS-91053). */
const REQUIRED_PRIVACY_CATEGORIES = [
  "NSPrivacyAccessedAPICategoryFileTimestamp",
  "NSPrivacyAccessedAPICategoryUserDefaults",
  "NSPrivacyAccessedAPICategorySystemBootTime",
  "NSPrivacyAccessedAPICategoryDiskSpace",
];

let config: ExpoConfigShape | undefined;
for (const candidate of ["app.config.ts", "app.config.js"]) {
  try {
    // Absolute URL: a bare relative specifier would resolve against this
    // script's directory rather than the app root.
    const imported = (await import(
      pathToFileURL(resolve(root, candidate)).href
    )) as { default?: ExpoConfigShape };
    config = imported.default;
    break;
  } catch {
    // try the next candidate
  }
}

if (!config) {
  failures.push(
    "app.config could not be evaluated. A config that throws ships a broken app.",
  );
} else {
  if (config.newArchEnabled !== true) {
    failures.push("newArchEnabled must be true (New Architecture only)");
  }
  if (config.userInterfaceStyle !== "automatic") {
    failures.push('userInterfaceStyle must be "automatic"');
  }
  if (config.experiments?.reactCompiler !== true) {
    failures.push("experiments.reactCompiler must be true");
  }
  if (config.experiments?.typedRoutes !== true) {
    failures.push("experiments.typedRoutes must be true");
  }
  if (config.runtimeVersion?.policy !== "fingerprint") {
    failures.push('runtimeVersion.policy must be "fingerprint"');
  }
  if (config.jsEngine !== undefined) {
    failures.push("Do not set jsEngine (Hermes only; never opt into JSC)");
  }
  if (config.android?.edgeToEdgeEnabled !== undefined) {
    failures.push(
      "Do not set android.edgeToEdgeEnabled (removed in SDK 55+; edge-to-edge is mandatory)",
    );
  }
  if (config.ios?.config?.usesNonExemptEncryption !== false) {
    failures.push(
      "ios.config.usesNonExemptEncryption must be false, or App Store Connect asks the export-compliance question on every build",
    );
  }
  const declared = (config.ios?.privacyManifests?.NSPrivacyAccessedAPITypes ?? [])
    .map((entry) => entry.NSPrivacyAccessedAPIType)
    .filter((value): value is string => typeof value === "string");
  for (const category of REQUIRED_PRIVACY_CATEGORIES) {
    if (!declared.includes(category)) {
      failures.push(
        `ios.privacyManifests must declare ${category} (missing declarations fail ITMS-91053)`,
      );
    }
  }
}

const rawConfig = withoutComments(readFirstExisting(["app.config.ts", "app.config.js"]));
if (/buildReactNativeFromSource\s*:\s*true/.test(rawConfig)) {
  failures.push("Do not force build-from-source React Native");
}
if (/hermesV1\s*:\s*false/.test(rawConfig)) {
  failures.push("Do not disable Hermes V1");
}

const entry = withoutComments(readFirstExisting(["src/entry.ts", "src/entry.js"]));
if (!/import\s+['"][^'"]*enable-native-screens['"]/.test(entry)) {
  failures.push(
    "src/entry must import enable-native-screens first (enableScreens + enableFreeze)",
  );
}

const runtimeModule = withoutComments(
  readFirstExisting([
    "src/services/runtime/enable-native-screens.ts",
    "src/services/runtime/enable-native-screens.js",
  ]),
);
if (!/enableScreens\s*\(/.test(runtimeModule)) {
  failures.push("enable-native-screens must call enableScreens()");
}
if (!/enableFreeze\s*\(/.test(runtimeModule)) {
  failures.push("enable-native-screens must call enableFreeze()");
}

if (failures.length > 0) {
  throw new Error(`Runtime flag check failed:\n- ${failures.join("\n- ")}`);
}

process.stdout.write("Runtime flags: app.config evaluated, entry wiring present\n");
