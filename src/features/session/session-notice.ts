import type { AuthStep } from '@/features/session/auth-step';
import type { Translate } from '@/services/i18n/translate';

export type SessionNotice = {
	title: string;
	body: string;
};

/**
 * Shown on the phone and code screens when a worker who is still signed in must
 * sign in again after a 401. It says in plain words that the saved actions are
 * safe on this phone (M2).
 */
export const sessionNoticeFor = (
	step: AuthStep,
	t: Translate,
): SessionNotice | null =>
	step === 'reauthenticate'
		? { body: t('reauth.body'), title: t('reauth.title') }
		: null;
