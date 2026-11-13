import { borderRadius } from '@/uikit/tokens/border-radius';
import { spacing } from '@/uikit/tokens/spacing';

const borderWidth = 1;
const padding = spacing.xs;
const contentInset = borderWidth + padding;
const baseTabHeight = 56;

/**
 * Geometry for the floating tab bar. Kept apart from colour tokens so the
 * resolvers below stay pure and testable without a theme.
 */
export const tabBar = {
	borderWidth,
	/** Bottom padding a tab screen needs to scroll its last line clear of the bar. */
	contentClearance: 84,
	contentInset,
	/** Inner radius that keeps the selection pill concentric with the bar. */
	innerRadius: Math.max(borderRadius.lg - contentInset, 0),
	/**
	 * Largest font scale the label grows to. The label keeps to one line and
	 * shrinks to fit rather than break a word, so the bar height never changes.
	 */
	maxFontScale: 2,
	maxWidth: 560,
	outerHeight: baseTabHeight + contentInset * 2,
	outerRadius: borderRadius.lg,
	padding,
	tabHeight: baseTabHeight,
} as const;

const normalizeFontScale = (fontScale: number): number => {
	if (!Number.isFinite(fontScale)) {
		return 1;
	}
	return Math.min(Math.max(fontScale, 1), tabBar.maxFontScale);
};

export const resolveTabBarHorizontalInset = (fontScale: number): number =>
	normalizeFontScale(fontScale) > 1 ? spacing.sm : spacing.lg;

export const resolveTabBarWidth = (
	viewportWidth: number,
	fontScale: number,
): number => {
	const inset = resolveTabBarHorizontalInset(fontScale);
	const available = Math.max(viewportWidth - inset * 2, 0);
	return Math.min(available, tabBar.maxWidth);
};

export const resolveTabWidth = (barWidth: number, tabCount: number): number => {
	if (tabCount <= 0) {
		return 0;
	}
	return Math.max(barWidth - tabBar.contentInset * 2, 0) / tabCount;
};

/** Horizontal padding collapses at large font scales so labels keep their room. */
export const resolveTabHorizontalPadding = (fontScale: number): number => {
	return normalizeFontScale(fontScale) > 1 ? 0 : spacing.xs;
};
