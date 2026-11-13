import { displayPhone } from '@/features/session/phone-number';
import type { SessionState } from '@/services/session/session-state';
import type { EngineState } from '@/services/sync/sync-types';

/**
 * Which part of the sign-in flow the phone is in. Derived from the session and
 * the engine, never stored. `reauthenticate` is a worker who is still signed in
 * but whose token the server refused (engine `auth_required`): they use the same
 * phone and code screens, and their saved actions stay on the phone.
 */
export type AuthStep =
	'enter_phone' | 'choose_worker' | 'reauthenticate' | 'signed_in';

export const authStepOf = (
	session: SessionState,
	engine: EngineState,
): AuthStep => {
	switch (session.kind) {
		case 'signed_out':
			return 'enter_phone';
		case 'choosing_worker':
			return 'choose_worker';
		case 'signed_in':
			return engine.kind === 'auth_required' ? 'reauthenticate' : 'signed_in';
		default:
			return session satisfies never;
	}
};

export type VerifiedOutcome = 'accepted' | 'no_workers';

/** What a verified code led to. A number with no workers leaves the phone signed out. */
export const verifiedOutcomeOf = (next: SessionState): VerifiedOutcome =>
	next.kind === 'signed_out' ? 'no_workers' : 'accepted';

/**
 * The pending number is cleared once the phone is signed in. By then the auth
 * group renders a redirect instead of the code screen, so clearing cannot send
 * a mounted code screen back to the phone screen for a frame.
 */
export const shouldClearPendingSignIn = (step: AuthStep): boolean =>
	step === 'signed_in';

/**
 * The phone number to put in the field: the last one used, when known, spaced
 * as the hint shows it.
 */
export const lastKnownPhone = (session: SessionState): string =>
	displayPhone(
		session.kind === 'signed_out' ? (session.lastPhone ?? '') : session.phone,
	);

/** Phone and code screens are open to someone entering or renewing a login. */
export const isPhoneFlowOpen = (step: AuthStep): boolean =>
	step === 'enter_phone' || step === 'reauthenticate';
