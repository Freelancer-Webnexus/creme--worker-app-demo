import type { CodeProblem } from '@/features/session/code-form';
import type { PhoneProblem } from '@/features/session/phone-form';
import {
	codeProblemKey,
	phoneProblemKey,
} from '@/features/session/sign-in-copy';
import { translate, type TranslationKey } from '@/services/i18n/translate';

const phoneKeys: Record<PhoneProblem, TranslationKey> = {
	invalid_phone: 'signin.invalid_phone',
	needs_connection: 'signin.no_connection',
	server_unavailable: 'signin.server_error',
};

const codeKeys: Record<CodeProblem, TranslationKey> = {
	needs_connection: 'signin.no_connection',
	server_unavailable: 'signin.server_error',
	wrong_code: 'signin.wrong_code',
};

describe('phoneProblemKey', () => {
	it.each(Object.entries(phoneKeys) as [PhoneProblem, TranslationKey][])(
		'says %s with %s',
		(problem, key) => {
			expect(phoneProblemKey(problem)).toBe(key);
		},
	);
});

describe('codeProblemKey', () => {
	it.each(Object.entries(codeKeys) as [CodeProblem, TranslationKey][])(
		'says %s with %s',
		(problem, key) => {
			expect(codeProblemKey(problem)).toBe(key);
		},
	);
});

describe('sign-in problem copy', () => {
	it('tells a missing connection apart from a server failure in both languages', () => {
		for (const language of ['es', 'en'] as const) {
			expect(translate(language, phoneProblemKey('needs_connection'))).not.toBe(
				translate(language, phoneProblemKey('server_unavailable')),
			);
		}
	});
});
