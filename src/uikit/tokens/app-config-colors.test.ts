import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AndroidConfig, type ExportedConfig } from 'expo/config-plugins';
import { darkSemanticColors, lightSemanticColors } from '@/uikit/tokens/colors';
import config from '../../../app.config';
import withNightWindowBackground, {
	type NightWindowBackgroundProps,
} from '../../../plugins/with-night-window-background';

const ROOT = join(__dirname, '../../..');

type SplashOptions = {
	backgroundColor: string;
	dark: { backgroundColor: string; image: string };
	image: string;
};

type AppearanceIcons = { dark?: string; light?: string; tinted?: string };

const iosIcons = (): AppearanceIcons => {
	const icon = config.ios?.icon;
	return typeof icon === 'object' ? icon : {};
};

const splashOptions = (): SplashOptions => {
	const entry = config.plugins?.find(
		(plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
	);
	if (!Array.isArray(entry)) {
		throw new Error('expo-splash-screen plugin is missing');
	}
	return entry[1] as SplashOptions;
};

/** The native config cannot import TS, so its colours are copies; this keeps them equal. */
describe('app config colours', () => {
	it('paints the root view and the splash with the page colour', () => {
		expect(config.backgroundColor).toBe(lightSemanticColors.background);
		expect(splashOptions().backgroundColor).toBe(
			lightSemanticColors.background,
		);
		expect(splashOptions().dark.backgroundColor).toBe(
			darkSemanticColors.background,
		);
	});

	it('paints the Android night window with the dark page colour', async () => {
		const entry = config.plugins?.find(
			(plugin) =>
				Array.isArray(plugin) &&
				plugin[0] === './plugins/with-night-window-background',
		);
		if (!Array.isArray(entry)) {
			throw new Error('night window plugin is missing');
		}
		const planned = withNightWindowBackground(
			{ name: 'stub', slug: 'stub' },
			entry[1] as NightWindowBackgroundProps,
		) as ExportedConfig;
		const run = planned.mods?.android?.colorsNight;
		if (run === undefined) {
			throw new Error('the plugin did not add a colorsNight mod');
		}

		const result = (await run({
			...planned,
			modRequest: {
				introspect: false,
				modName: 'colorsNight',
				platform: 'android',
				platformProjectRoot: ROOT,
				projectRoot: ROOT,
			},
			modRawConfig: planned,
			modResults: { resources: {} },
		})) as { modResults: AndroidConfig.Resources.ResourceXML };

		expect(
			AndroidConfig.Colors.getColorsAsObject(result.modResults)
				?.activityBackground,
		).toBe(darkSemanticColors.background);
	});

	it('points every icon and splash image at a file in the repo', () => {
		const paths = [
			config.icon,
			iosIcons().light,
			iosIcons().dark,
			iosIcons().tinted,
			config.android?.adaptiveIcon?.foregroundImage,
			config.android?.adaptiveIcon?.monochromeImage,
			splashOptions().image,
			splashOptions().dark.image,
		];
		for (const path of paths) {
			expect(typeof path).toBe('string');
			expect(existsSync(join(ROOT, String(path)))).toBe(true);
		}
	});

	it('uses the brand green behind the Android icon', () => {
		expect(config.android?.adaptiveIcon?.backgroundColor).toBe(
			lightSemanticColors.primary,
		);
	});
});
