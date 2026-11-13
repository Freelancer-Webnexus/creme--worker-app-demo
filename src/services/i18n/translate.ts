import { en } from '@/services/i18n/en';
import { es } from '@/services/i18n/es';

export type Language = 'es' | 'en';

export type TranslationKey = keyof typeof es;

export type TranslationParams = Record<string, string | number>;

/**
 * The shape of `useTranslation().t`. Pure presenters take it as a parameter, so
 * they stay free of React and a test can pass the Spanish or English dictionary.
 */
export type Translate = (
	key: TranslationKey,
	params?: TranslationParams,
) => string;

const dictionaries: Record<Language, Record<TranslationKey, string>> = {
	es,
	en,
};

const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * A missing param leaves the `{name}` text in place on purpose: a visible gap
 * in a QA pass beats a silent blank that reads as a finished sentence (M9).
 */
export const translate = (
	language: Language,
	key: TranslationKey,
	params?: TranslationParams,
): string =>
	dictionaries[language][key].replace(PLACEHOLDER, (match, name: string) => {
		const value = params?.[name];
		return value === undefined ? match : String(value);
	});

export const pluralKey = <
	One extends TranslationKey,
	Other extends TranslationKey,
>(
	count: number,
	oneKey: One,
	otherKey: Other,
): One | Other => (count === 1 ? oneKey : otherKey);

export const isLanguage = (value: unknown): value is Language =>
	value === 'es' || value === 'en';
