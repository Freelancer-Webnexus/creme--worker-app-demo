import type { CodeProblem } from '@/features/session/code-form';
import type { PhoneProblem } from '@/features/session/phone-form';
import type { TranslationKey } from '@/services/i18n/translate';

export const phoneProblemKey = (problem: PhoneProblem): TranslationKey => {
	switch (problem) {
		case 'invalid_phone':
			return 'signin.invalid_phone';
		case 'needs_connection':
			return 'signin.no_connection';
		case 'server_unavailable':
			return 'signin.server_error';
		default:
			return problem satisfies never;
	}
};

export const codeProblemKey = (problem: CodeProblem): TranslationKey => {
	switch (problem) {
		case 'wrong_code':
			return 'signin.wrong_code';
		case 'needs_connection':
			return 'signin.no_connection';
		case 'server_unavailable':
			return 'signin.server_error';
		default:
			return problem satisfies never;
	}
};
