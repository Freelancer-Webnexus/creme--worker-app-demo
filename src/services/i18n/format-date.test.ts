import { formatDate } from '@/services/i18n/format-date';

describe('formatDate', () => {
	it('writes the date in Spanish', () => {
		const text = formatDate('2026-03-01', 'es');
		expect(text).toContain('marzo');
		expect(text).toContain('2026');
		expect(text).toContain('1');
	});

	it('writes the date in English', () => {
		const text = formatDate('2026-07-31', 'en');
		expect(text).toContain('July');
		expect(text).toContain('31');
		expect(text).toContain('2026');
	});

	it('does not move the day in any time zone', () => {
		expect(formatDate('2026-01-01', 'en')).toContain('January 1');
		expect(formatDate('2026-12-31', 'en')).toContain('December 31');
	});

	it('keeps the calendar day of a server timestamp', () => {
		expect(formatDate('2026-05-04T09:00:00.000Z', 'en')).toContain('May 4');
		expect(formatDate('2026-05-04T23:30:00.000Z', 'es')).toContain('4 de mayo');
	});

	it.each(['', 'soon', '2026-13-45', '2026-3-1', '01/03/2026'])(
		'falls back to the original text for %j',
		(value) => {
			expect(formatDate(value, 'es')).toBe(value);
		},
	);
});
