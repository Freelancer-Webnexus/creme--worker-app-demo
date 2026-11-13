import {
	AndroidConfig,
	type ConfigPlugin,
	withAndroidColorsNight,
} from 'expo/config-plugins';

const NIGHT_WINDOW_COLOR_NAME = 'activityBackground';

export type NightWindowBackgroundProps = { color: string };

/**
 * expo-system-ui points the theme's windowBackground at @color/activityBackground
 * with the light page colour. This overrides that colour in values-night, so the
 * window behind transitions and the keyboard is dark in dark mode. The colour
 * arrives as a prop because Node cannot load the TypeScript token file from a
 * config plugin; app-config-colors.test.ts keeps it equal to the token.
 */
const withNightWindowBackground: ConfigPlugin<NightWindowBackgroundProps> = (
	config,
	{ color },
) =>
	withAndroidColorsNight(config, (nightConfig) => {
		nightConfig.modResults = AndroidConfig.Colors.assignColorValue(
			nightConfig.modResults,
			{ name: NIGHT_WINDOW_COLOR_NAME, value: color },
		);
		return nightConfig;
	});

export default withNightWindowBackground;
