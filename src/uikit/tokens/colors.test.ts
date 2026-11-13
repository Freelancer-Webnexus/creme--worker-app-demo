import {
	type ColorScheme,
	getSemanticColors,
	semanticColors,
} from '@/uikit/tokens/colors';
import { type StatusRole, statusColorsFor } from '@/uikit/tokens/status-role';

const channel = (value: number): number => {
	const unit = value / 255;
	return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string): number => {
	const red = Number.parseInt(hex.slice(1, 3), 16);
	const green = Number.parseInt(hex.slice(3, 5), 16);
	const blue = Number.parseInt(hex.slice(5, 7), 16);
	return (
		0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
	);
};

const contrast = (first: string, second: string): number => {
	const [light, dark] = [luminance(first), luminance(second)].sort(
		(a, b) => b - a,
	);
	return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
};

const AA_TEXT = 4.5;
const AA_UI = 3;
const schemes: ColorScheme[] = ['light', 'dark'];
const roles: StatusRole[] = [
	'approved',
	'correction',
	'failed',
	'neutral',
	'pending_review',
	'pending_sync',
];

describe('semantic color tokens', () => {
	it('exposes role names instead of a raw palette API', () => {
		expect(semanticColors.surface).toBeTruthy();
		expect(semanticColors.text).toBeTruthy();
		expect(getSemanticColors('dark').surface).not.toBe(semanticColors.surface);
	});

	describe.each(schemes)('page layers in %s', (scheme) => {
		const palette = getSemanticColors(scheme);
		const layers = {
			background: palette.background,
			surface: palette.surface,
		};

		it.each(Object.entries(layers))('keeps text readable on %s', (_, layer) => {
			for (const foreground of [
				palette.text,
				palette.textMuted,
				palette.danger,
			]) {
				expect(contrast(foreground, layer)).toBeGreaterThanOrEqual(AA_TEXT);
			}
		});

		it.each(Object.entries(layers))(
			'keeps outlines and controls visible on %s',
			(_, layer) => {
				for (const control of [palette.borderStrong, palette.primary]) {
					expect(contrast(control, layer)).toBeGreaterThanOrEqual(AA_UI);
				}
			},
		);

		it('keeps the switch thumb visible on both tracks', () => {
			for (const track of [palette.borderStrong, palette.primary]) {
				expect(contrast(palette.surface, track)).toBeGreaterThanOrEqual(AA_UI);
			}
		});

		it('keeps filled controls readable', () => {
			const pairs: [string, string][] = [
				[palette.primaryText, palette.primary],
				[palette.secondaryText, palette.secondary],
				[palette.text, palette.secondary],
			];
			for (const [foreground, background] of pairs) {
				expect(contrast(foreground, background)).toBeGreaterThanOrEqual(
					AA_TEXT,
				);
			}
		});
	});

	describe.each(schemes)('status roles in %s', (scheme) => {
		it.each(roles)('%s passes AA on its own background', (role) => {
			const { background, foreground } = statusColorsFor(
				getSemanticColors(scheme),
				role,
			);
			expect(contrast(foreground, background)).toBeGreaterThanOrEqual(AA_TEXT);
		});

		it.each(roles)(
			'%s card border stands out from both page layers',
			(role) => {
				const palette = getSemanticColors(scheme);
				const { foreground } = statusColorsFor(palette, role);
				for (const layer of [palette.background, palette.surface]) {
					expect(contrast(foreground, layer)).toBeGreaterThanOrEqual(AA_UI);
				}
			},
		);

		it('gives every role its own pair', () => {
			const pairs = roles.map((role) => {
				const { background, foreground } = statusColorsFor(
					getSemanticColors(scheme),
					role,
				);
				return `${background}/${foreground}`;
			});
			expect(new Set(pairs).size).toBe(roles.length);
		});
	});
});
