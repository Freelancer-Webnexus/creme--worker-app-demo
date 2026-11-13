/**
 * Tuned for outdoor reading on small phones. Body starts at 18 and nothing is
 * below 14. Line heights are plain numbers on text that scales with the system
 * font, never on a container with a fixed height. Large text sits slightly
 * tighter so headings read as one shape; digits that change in place are
 * tabular so the line never shifts.
 */
export const typography = {
	caption: {
		fontSize: 14,
		lineHeight: 20,
	},
	body: {
		fontSize: 18,
		lineHeight: 26,
	},
	/** Body size with weight: field labels, values, short emphasis. */
	label: {
		fontSize: 18,
		fontWeight: '600' as const,
		lineHeight: 26,
	},
	button: {
		fontSize: 18,
		fontWeight: '600' as const,
		lineHeight: 24,
	},
	headline: {
		fontSize: 22,
		fontWeight: '700' as const,
		letterSpacing: -0.2,
		lineHeight: 28,
	},
	title: {
		fontSize: 30,
		fontWeight: '700' as const,
		letterSpacing: -0.4,
		lineHeight: 36,
	},
};

/**
 * Headings stop growing before a long word such as "Documentos" outgrows a
 * 360 dp line and breaks mid-word. Each cap keeps the heading larger than body
 * text at 2x (36), so the hierarchy holds at every setting.
 */
export const headingMaxFontScale = { headline: 1.75, title: 1.5 } as const;

/** Text typed into a field: large, and phone numbers and codes keep their width. */
export const inputText = {
	fontSize: 24,
	fontVariant: ['tabular-nums' as const],
	lineHeight: 32,
};
