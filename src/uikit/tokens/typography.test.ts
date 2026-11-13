import { headingMaxFontScale, typography } from '@/uikit/tokens/typography';

const largestSystemScale = 2;

describe('type scale', () => {
	it('keeps every capped heading above body text at the largest system font', () => {
		const largestBody = typography.label.fontSize * largestSystemScale;

		for (const variant of ['headline', 'title'] as const) {
			expect(
				typography[variant].fontSize * headingMaxFontScale[variant],
			).toBeGreaterThan(largestBody);
		}
	});

	it('keeps a title above a headline once both stop growing', () => {
		expect(
			typography.title.fontSize * headingMaxFontScale.title,
		).toBeGreaterThan(
			typography.headline.fontSize * headingMaxFontScale.headline,
		);
	});
});
