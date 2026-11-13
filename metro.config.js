const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Expo ships `inlineRequires: false` while bare React Native ships `true`, so
// the two lanes bundled differently and nothing said so. Inline requires defer
// module evaluation until first use, which is the largest time-to-interactive
// lever available here. `experimentalImportSupport` stays on: it is the Expo
// default and dropping it would regress.
//
// Side-effect-only imports (`import '@/services/runtime/enable-native-screens'`)
// are never inlined by Metro, so `src/entry.ts` ordering is unaffected.
config.transformer.getTransformOptions = async () => ({
	transform: {
		experimentalImportSupport: true,
		inlineRequires: true,
	},
});

module.exports = config;
