import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';
import { type ColorScheme, getSemanticColors } from '@/uikit/tokens/colors';

/**
 * The navigation container paints its own background behind every screen. It
 * must be the page colour, or a dark-mode worker sees the library default
 * flash during a transition.
 */
export const navigationThemeFor = (scheme: ColorScheme): Theme => {
	const tokens = getSemanticColors(scheme);
	const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
	return {
		...base,
		colors: {
			background: tokens.background,
			border: tokens.border,
			card: tokens.background,
			notification: tokens.danger,
			primary: tokens.primary,
			text: tokens.text,
		},
		dark: scheme === 'dark',
	};
};
