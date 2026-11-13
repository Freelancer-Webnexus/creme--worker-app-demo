import {
	parseSession,
	serializeSession,
} from '@/services/session/session-codec';
import type { SessionState } from '@/services/session/session-state';

const signedOut: SessionState = { kind: 'signed_out', lastPhone: null };
const signedIn: SessionState = {
	kind: 'signed_in',
	phone: '+52 55 1000 0002',
	token: 'tok_1',
	expiresAt: 1_000,
	worker: { id: 'w_bruno', name: 'Bruno Díaz' },
	workers: [
		{ id: 'w_bruno', name: 'Bruno Díaz' },
		{ id: 'w_carla', name: 'Carla Díaz' },
	],
};
const choosing: SessionState = {
	kind: 'choosing_worker',
	phone: '+52 55 1000 0002',
	token: 'tok_1',
	expiresAt: 1_000,
	workers: signedIn.kind === 'signed_in' ? signedIn.workers : [],
};

describe('session codec', () => {
	it.each([[signedOut], [choosing], [signedIn]])('round-trips %j', (state) => {
		expect(parseSession(serializeSession(state))).toEqual(state);
	});

	it.each([
		['null', null],
		['empty string', ''],
		['not JSON', '{oops'],
		['a JSON string', '"signed_in"'],
		['a JSON array', '[]'],
		['an unknown kind', JSON.stringify({ kind: 'admin' })],
		['signed_out without lastPhone', JSON.stringify({ kind: 'signed_out' })],
		[
			'signed_in without a token',
			JSON.stringify({ ...signedIn, token: undefined }),
		],
		[
			'signed_in with an empty token',
			JSON.stringify({ ...signedIn, token: '' }),
		],
		[
			'signed_in with a string expiresAt',
			JSON.stringify({ ...signedIn, expiresAt: '1000' }),
		],
		[
			'signed_in with a worker outside the list',
			JSON.stringify({ ...signedIn, worker: { id: 'w_x', name: 'X' } }),
		],
		[
			'signed_in with a malformed worker list',
			JSON.stringify({ ...signedIn, workers: [{ id: 1 }] }),
		],
		[
			'choosing_worker with one worker',
			JSON.stringify({ ...choosing, workers: [{ id: 'w_a', name: 'A' }] }),
		],
	])('treats %s as signed out', (_name, raw) => {
		expect(parseSession(raw)).toEqual(signedOut);
	});
});
