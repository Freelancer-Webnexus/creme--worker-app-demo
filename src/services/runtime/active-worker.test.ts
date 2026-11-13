import { activeWorkerIdOf } from '@/services/runtime/active-worker';
import type { SessionState } from '@/services/session/session-state';

const ana = { id: 'w-ana', name: 'Ana López' };
const bruno = { id: 'w-bruno', name: 'Bruno Díaz' };

const cases: [string, SessionState, string | null][] = [
	['signed out', { kind: 'signed_out', lastPhone: null }, null],
	[
		'choosing a worker',
		{
			expiresAt: 1,
			kind: 'choosing_worker',
			phone: '+525510000002',
			token: 't',
			workers: [ana, bruno],
		},
		null,
	],
	[
		'signed in',
		{
			expiresAt: 1,
			kind: 'signed_in',
			phone: '+525510000002',
			token: 't',
			worker: bruno,
			workers: [ana, bruno],
		},
		'w-bruno',
	],
];

describe('activeWorkerIdOf', () => {
	it.each(cases)('%s', (_name, state, expected) => {
		expect(activeWorkerIdOf(state)).toBe(expected);
	});
});
