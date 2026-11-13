import {
	type SessionChangeEffect,
	sessionChangeEffects,
} from '@/services/runtime/session-change-effects';
import type { SessionState } from '@/services/session/session-state';

const ana = { id: 'w-ana', name: 'Ana López' };
const bruno = { id: 'w-bruno', name: 'Bruno Díaz' };

const signedOut: SessionState = { kind: 'signed_out', lastPhone: null };
const choosing: SessionState = {
	expiresAt: 1,
	kind: 'choosing_worker',
	phone: '+525510000002',
	token: 't',
	workers: [ana, bruno],
};
const signedInAs = (worker: typeof ana, token = 't'): SessionState => ({
	expiresAt: 1,
	kind: 'signed_in',
	phone: '+525510000002',
	token,
	worker,
	workers: [ana, bruno],
});

const effectsFor = (workerId: string | null): SessionChangeEffect[] => [
	{ type: 'set_active_worker', workerId },
	{ type: 'refresh_queue', workerId },
];

const rows: [string, SessionState, SessionState, SessionChangeEffect[]][] = [
	['signing in', signedOut, signedInAs(ana), effectsFor('w-ana')],
	['signing out', signedInAs(ana), signedOut, effectsFor(null)],
	[
		'choosing a worker after signing in',
		choosing,
		signedInAs(bruno),
		effectsFor('w-bruno'),
	],
	[
		'switching person, back to choosing',
		signedInAs(bruno),
		choosing,
		effectsFor(null),
	],
	[
		'a new token for the same worker still tells the engine to run',
		signedInAs(ana, 'old'),
		signedInAs(ana, 'new'),
		effectsFor('w-ana'),
	],
	[
		'signed out to choosing keeps nobody active',
		signedOut,
		choosing,
		effectsFor(null),
	],
];

describe('sessionChangeEffects', () => {
	it.each(rows)('%s', (_name, previous, next, expected) => {
		expect(sessionChangeEffects(previous, next)).toEqual(expected);
	});

	it('does nothing when the session did not change', () => {
		const same = signedInAs(ana);

		expect(sessionChangeEffects(same, same)).toEqual([]);
	});
});
