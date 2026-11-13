export type ColorScheme = 'dark' | 'light';

export type SemanticColors = {
	/** The page behind every screen, the splash and the root view. */
	background: string;
	border: string;
	borderStrong: string;
	/** Error text and error input borders. */
	danger: string;
	primary: string;
	primaryText: string;
	secondary: string;
	secondaryText: string;
	shadow: string;
	statusApprovedBackground: string;
	statusApprovedForeground: string;
	statusCorrectionBackground: string;
	statusCorrectionForeground: string;
	statusFailedBackground: string;
	statusFailedForeground: string;
	statusNeutralBackground: string;
	statusNeutralForeground: string;
	statusPendingReviewBackground: string;
	statusPendingReviewForeground: string;
	statusPendingSyncBackground: string;
	statusPendingSyncForeground: string;
	/** Raised elements on the page: cards, inputs, the tab bar. */
	surface: string;
	text: string;
	textMuted: string;
};

/**
 * Brand: forest green for the field and for "done", on warm paper and ink
 * neutrals. Status roles follow M4: amber is "saved on this
 * phone only", blue is "delivered, staff has not looked yet", green is
 * "approved by staff", plum is "staff asked for a correction", red is "could
 * not be sent". Every text pair passes WCAG AA (colors.test.ts), and a status
 * never relies on colour: it also carries a word and a shape.
 */
export const lightSemanticColors: SemanticColors = {
	background: '#f7f7f5',
	border: '#e2e0da',
	borderStrong: '#827f77',
	danger: '#b3261e',
	primary: '#1b5e20',
	primaryText: '#ffffff',
	secondary: '#e3ede1',
	secondaryText: '#1b5e20',
	shadow: 'rgba(23, 26, 22, 0.08)',
	statusApprovedBackground: '#ddeedc',
	statusApprovedForeground: '#1b5e20',
	statusCorrectionBackground: '#f3e5f5',
	statusCorrectionForeground: '#6b2a7a',
	statusFailedBackground: '#f9dada',
	statusFailedForeground: '#8a1010',
	statusNeutralBackground: '#ecebe6',
	statusNeutralForeground: '#3d3f3a',
	statusPendingReviewBackground: '#e3edf8',
	statusPendingReviewForeground: '#1e4e85',
	statusPendingSyncBackground: '#fcebd2',
	statusPendingSyncForeground: '#7a3e00',
	surface: '#ffffff',
	text: '#171a16',
	textMuted: '#595c55',
};

export const darkSemanticColors: SemanticColors = {
	background: '#0f1210',
	border: '#2a302b',
	borderStrong: '#7d857e',
	danger: '#ff9c8f',
	primary: '#8fd093',
	primaryText: '#0b2a0e',
	secondary: '#20301f',
	secondaryText: '#cdebcb',
	shadow: 'rgba(0, 0, 0, 0.5)',
	statusApprovedBackground: '#13301a',
	statusApprovedForeground: '#9fdba6',
	statusCorrectionBackground: '#33173d',
	statusCorrectionForeground: '#e6b8f2',
	statusFailedBackground: '#45121a',
	statusFailedForeground: '#ffb3bd',
	statusNeutralBackground: '#262b27',
	statusNeutralForeground: '#d6dbd4',
	statusPendingReviewBackground: '#10253d',
	statusPendingReviewForeground: '#a9cbf2',
	statusPendingSyncBackground: '#3a2508',
	statusPendingSyncForeground: '#ffcb8a',
	surface: '#181c19',
	text: '#eef1ec',
	textMuted: '#a9b0a8',
};

export const semanticColors: SemanticColors = lightSemanticColors;

export const semanticColorsByScheme: Record<ColorScheme, SemanticColors> = {
	dark: darkSemanticColors,
	light: lightSemanticColors,
};

export const getSemanticColors = (scheme: ColorScheme): SemanticColors => {
	return semanticColorsByScheme[scheme];
};
