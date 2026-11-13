import {
	checkPhone,
	displayPhone,
	type PhoneCheck,
} from '@/features/session/phone-number';

const cases: [name: string, input: string, expected: PhoneCheck][] = [
	[
		'the seed number as typed',
		'+52 55 1000 0001',
		{ kind: 'valid', phone: '+525510000001' },
	],
	[
		'already normalised',
		'+525510000001',
		{ kind: 'valid', phone: '+525510000001' },
	],
	[
		'brackets and dashes',
		'+52 (55) 1000-0001',
		{ kind: 'valid', phone: '+525510000001' },
	],
	[
		'country code without a plus',
		'525510000001',
		{ kind: 'valid', phone: '+525510000001' },
	],
	[
		'ten digits get the Mexican code',
		'55 1000 0001',
		{ kind: 'valid', phone: '+525510000001' },
	],
	[
		'surrounding spaces',
		'  +525510000001  ',
		{ kind: 'valid', phone: '+525510000001' },
	],
	[
		'another country with a plus',
		'+1 928 555 0100',
		{ kind: 'valid', phone: '+19285550100' },
	],
	['nothing typed', '', { kind: 'empty' }],
	['only spaces and symbols', ' + - ', { kind: 'empty' }],
	['too short', '55 1000', { kind: 'invalid' }],
	['nine digits', '551000000', { kind: 'invalid' }],
	['too long', '+52 55 1000 0001 99999', { kind: 'invalid' }],
];

describe('checkPhone', () => {
	it.each(cases)('%s', (_name, input, expected) => {
		expect(checkPhone(input)).toEqual(expected);
	});
});

describe('displayPhone', () => {
	it('shows a Mexican mobile in the spaced form the worker types', () => {
		expect(displayPhone('+525510000001')).toBe('+52 55 1000 0001');
	});

	it('shows any other number as it was sent', () => {
		expect(displayPhone('+19285550100')).toBe('+19285550100');
	});
});
