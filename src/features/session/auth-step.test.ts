import {
	type AuthStep,
	authStepOf,
	isPhoneFlowOpen,
	lastKnownPhone,
	shouldClearPendingSignIn,
	type VerifiedOutcome,
	verifiedOutcomeOf,
} from '@/features/session/auth-step';
import type { SessionState } from '@/services/session/session-state';
import type { EngineState } from '@/services/sync/sync-types';

const ana = { id: 'w-ana', name: 'Ana López' };
const carla = { id: 'w-carla', name: 'Carla Díaz' };

const signedOut: SessionState = {
	kind: 'signed_out',
	lastPhone: '+525510000001',
};
const choosing: SessionState = {
	expiresAt: 1,
	kind: 'choosing_worker',
	phone: '+525510000002',
	token: 't',
	workers: [ana, carla],
};
const signedIn: SessionState = {
	expiresAt: 1,
	kind: 'signed_in',
	phone: '+525510000001',
	token: 't',
	worker: ana,
	workers: [ana],
};

const idle: EngineState = { kind: 'idle' };
const rows: [string, SessionState, EngineState, AuthStep][] = [
	['signed out', signedOut, idle, 'enter_phone'],
	[
		'signed out, engine says 401',
		signedOut,
		{ kind: 'auth_required' },
		'enter_phone',
	],
	['choosing a worker', choosing, idle, 'choose_worker'],
	['signed in and working', signedIn, idle, 'signed_in'],
	['signed in and offline', signedIn, { kind: 'offline' }, 'signed_in'],
	[
		'signed in and backing off',
		signedIn,
		{ kind: 'backing_off', until: 9 },
		'signed_in',
	],
	[
		'signed in after a 401',
		signedIn,
		{ kind: 'auth_required' },
		'reauthenticate',
	],
];

describe('authStepOf', () => {
	it.each(rows)('%s', (_name, session, engine, expected) => {
		expect(authStepOf(session, engine)).toBe(expected);
	});

	it('opens the phone flow for a new login and a renewed one only', () => {
		expect(isPhoneFlowOpen('enter_phone')).toBe(true);
		expect(isPhoneFlowOpen('reauthenticate')).toBe(true);
		expect(isPhoneFlowOpen('choose_worker')).toBe(false);
		expect(isPhoneFlowOpen('signed_in')).toBe(false);
	});
});

describe('verifiedOutcomeOf', () => {
	it.each([
		['a signed-in session', signedIn, 'accepted'],
		['a worker to choose', choosing, 'accepted'],
		['no worker for the number', signedOut, 'no_workers'],
	] as [string, SessionState, VerifiedOutcome][])(
		'%s',
		(_name, next, expected) => {
			expect(verifiedOutcomeOf(next)).toBe(expected);
		},
	);
});

describe('shouldClearPendingSignIn', () => {
	it('clears the pending number only once the phone is signed in, when the code screen is gone', () => {
		expect(shouldClearPendingSignIn('signed_in')).toBe(true);
		expect(shouldClearPendingSignIn('enter_phone')).toBe(false);
		expect(shouldClearPendingSignIn('choose_worker')).toBe(false);
		expect(shouldClearPendingSignIn('reauthenticate')).toBe(false);
	});
});

describe('lastKnownPhone', () => {
	it('prefills the phone from every session state, spaced as the hint shows it', () => {
		expect(lastKnownPhone(signedOut)).toBe('+52 55 1000 0001');
		expect(lastKnownPhone(choosing)).toBe('+52 55 1000 0002');
		expect(lastKnownPhone(signedIn)).toBe('+52 55 1000 0001');
	});

	it('is empty when nobody signed in before', () => {
		expect(lastKnownPhone({ kind: 'signed_out', lastPhone: null })).toBe('');
	});
});
