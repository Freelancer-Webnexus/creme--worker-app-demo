import { spacing } from '@/uikit/tokens/spacing';
import {
	resolveTabBarHorizontalInset,
	resolveTabBarWidth,
	resolveTabHorizontalPadding,
	resolveTabWidth,
	tabBar,
} from '@/uikit/tokens/tab-bar';
import { typography } from '@/uikit/tokens/typography';

describe('tab bar geometry', () => {
	it('caps the bar at its max width on wide viewports', () => {
		expect(resolveTabBarWidth(1200, 1)).toBe(tabBar.maxWidth);
	});

	it('hugs the screen edges on a phone', () => {
		const width = resolveTabBarWidth(390, 1);
		expect(width).toBeLessThan(390);
		expect(width).toBeGreaterThan(0);
	});

	it('never returns a negative width on a degenerate viewport', () => {
		expect(resolveTabBarWidth(0, 1)).toBe(0);
	});

	it('splits the inner width evenly between tabs', () => {
		const barWidth = 360;
		const tabWidth = resolveTabWidth(barWidth, 3);
		expect(tabWidth * 3).toBeCloseTo(barWidth - tabBar.contentInset * 2);
	});

	it('returns zero tab width when there are no tabs', () => {
		expect(resolveTabWidth(360, 0)).toBe(0);
	});

	it('fits one line of label at the largest font scale', () => {
		const labelLine = typography.caption.lineHeight * tabBar.maxFontScale;

		expect(tabBar.tabHeight).toBeGreaterThanOrEqual(labelLine + spacing.xs * 2);
	});

	it('never lets a tab fall under the 48 dp touch target', () => {
		expect(tabBar.tabHeight).toBeGreaterThanOrEqual(48);
	});

	it('ignores a font scale that is not a number', () => {
		expect(resolveTabHorizontalPadding(Number.NaN)).toBe(
			resolveTabHorizontalPadding(1),
		);
	});

	it('drops the tab padding once the font scale grows', () => {
		expect(resolveTabHorizontalPadding(1.4)).toBe(0);
		expect(resolveTabHorizontalPadding(1)).toBeGreaterThan(0);
	});

	it('insets the bar less once the font scale grows, so labels keep their room', () => {
		expect(resolveTabBarHorizontalInset(1)).toBeGreaterThan(
			resolveTabBarHorizontalInset(1.4),
		);
	});

	it('keeps the selection pill concentric with the bar', () => {
		expect(tabBar.innerRadius).toBe(tabBar.outerRadius - tabBar.contentInset);
	});
});
