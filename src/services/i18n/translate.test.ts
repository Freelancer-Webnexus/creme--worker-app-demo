import { en } from '@/services/i18n/en';
import { es } from '@/services/i18n/es';
import {
	isLanguage,
	pluralKey,
	translate,
	type TranslationKey,
} from '@/services/i18n/translate';

const keys = Object.keys(es) as TranslationKey[];

const placeholdersOf = (text: string): string[] =>
	[...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort();

describe('translate', () => {
	it('interpolates string and number params', () => {
		expect(translate('es', 'home.greeting', { name: 'Ana' })).toBe('Hola, Ana');
		expect(translate('en', 'sync.saved_other', { count: 3 })).toBe(
			'3 actions saved on this phone, not sent yet.',
		);
	});

	it('leaves a visible marker when a param is missing', () => {
		expect(translate('es', 'home.greeting')).toBe('Hola, {name}');
		expect(translate('en', 'documents.state.correction_reason', {})).toBe(
			'Reason: {reason}',
		);
	});

	it('interpolates a param given as zero', () => {
		expect(translate('en', 'sync.retrying', { seconds: 0 })).toBe(
			'Trying again in 0 s',
		);
	});

	it('uses the dictionary of the requested language', () => {
		expect(translate('es', 'language.label')).toBe('Idioma');
		expect(translate('en', 'language.label')).toBe('Language');
	});
});

describe('pluralKey', () => {
	it.each([
		[0, 'sync.saved_other'],
		[1, 'sync.saved_one'],
		[2, 'sync.saved_other'],
		[11, 'sync.saved_other'],
	] as const)('count %d picks %s', (count, expected) => {
		expect(pluralKey(count, 'sync.saved_one', 'sync.saved_other')).toBe(
			expected,
		);
	});
});

describe('isLanguage', () => {
	it.each([
		['es', true],
		['en', true],
		['fr', false],
		[null, false],
		[undefined, false],
	] as const)('%s -> %s', (value, expected) => {
		expect(isLanguage(value)).toBe(expected);
	});
});

describe('dictionaries (M9)', () => {
	it('have the same keys in Spanish and English', () => {
		expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
	});

	it.each(keys)('%s has the same placeholders in both languages', (key) => {
		expect(placeholdersOf(en[key])).toEqual(placeholdersOf(es[key]));
	});

	it.each(keys)('%s is not empty in either language', (key) => {
		expect(es[key].trim().length).toBeGreaterThan(0);
		expect(en[key].trim().length).toBeGreaterThan(0);
	});
});
