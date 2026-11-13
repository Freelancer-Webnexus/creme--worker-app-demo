import { DarkTheme, DefaultTheme } from 'expo-router';
import { darkSemanticColors, lightSemanticColors } from '@/uikit/tokens/colors';
import { navigationThemeFor } from '@/uikit/tokens/navigation-theme';

describe('navigationThemeFor', () => {
	it('maps the light tokens on the default theme', () => {
		const theme = navigationThemeFor('light');

		expect(theme.dark).toBe(false);
		expect(theme.fonts).toBe(DefaultTheme.fonts);
		expect(theme.colors).toEqual({
			background: lightSemanticColors.background,
			border: lightSemanticColors.border,
			card: lightSemanticColors.background,
			notification: lightSemanticColors.danger,
			primary: lightSemanticColors.primary,
			text: lightSemanticColors.text,
		});
	});

	it('maps the dark tokens on the dark theme', () => {
		const theme = navigationThemeFor('dark');

		expect(theme.dark).toBe(true);
		expect(theme.fonts).toBe(DarkTheme.fonts);
		expect(theme.colors).toEqual({
			background: darkSemanticColors.background,
			border: darkSemanticColors.border,
			card: darkSemanticColors.background,
			notification: darkSemanticColors.danger,
			primary: darkSemanticColors.primary,
			text: darkSemanticColors.text,
		});
	});
});
