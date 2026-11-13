import {
	CODE_LENGTH,
	isCompleteCode,
	sanitizeCode,
} from '@/features/session/otp-code';

describe('one-time code', () => {
	it.each([
		['123456', '123456'],
		['123 456', '123456'],
		['12-34-56', '123456'],
		['12345678', '123456'],
		['abc', ''],
		['', ''],
	])('sanitizes %j to %j', (input, expected) => {
		expect(sanitizeCode(input)).toBe(expected);
	});

	it('is complete only at six digits', () => {
		expect(CODE_LENGTH).toBe(6);
		expect(isCompleteCode('12345')).toBe(false);
		expect(isCompleteCode('123456')).toBe(true);
	});
});
