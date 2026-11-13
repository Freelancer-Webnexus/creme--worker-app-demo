import type { WorkerSummary } from '@/services/api/api-types';
import {
	authStatusOf,
	type SessionEvent,
	type SessionState,
	tokenForWorker,
	transition,
} from '@/services/session/session-state';

const ana: WorkerSummary = { id: 'w_ana', name: 'Ana López' };
const bruno: WorkerSummary = { id: 'w_bruno', name: 'Bruno Díaz' };
const carla: WorkerSummary = { id: 'w_carla', name: 'Carla Díaz' };

const verified = (
	workers: WorkerSummary[],
	token = 'tok_1',
	phone = '+52 55 1000 0002',
): SessionEvent => ({
	type: 'otp_verified',
	phone,
	session: { token, expiresAt: 1_000, workers },
});

const signedOut: SessionState = { kind: 'signed_out', lastPhone: null };
const choosing: SessionState = {
	kind: 'choosing_worker',
	phone: '+52 55 1000 0002',
	token: 'tok_1',
	expiresAt: 1_000,
	workers: [bruno, carla],
};
const signedInBruno: SessionState = {
	kind: 'signed_in',
	phone: '+52 55 1000 0002',
	token: 'tok_1',
	expiresAt: 1_000,
	worker: bruno,
	workers: [bruno, carla],
};
const signedInAna: SessionState = {
	kind: 'signed_in',
	phone: '+52 55 1000 0001',
	token: 'tok_1',
	expiresAt: 1_000,
	worker: ana,
	workers: [ana],
};

type Row = {
	name: string;
	from: SessionState;
	event: SessionEvent;
	to: SessionState;
};

const rows: Row[] = [
	{
		name: 'one worker signs in directly',
		from: signedOut,
		event: verified([ana], 'tok_1', '+52 55 1000 0001'),
		to: signedInAna,
	},
	{
		name: 'several workers go to the picker',
		from: signedOut,
		event: verified([bruno, carla]),
		to: choosing,
	},
	{
		name: 'zero workers stay signed out and remember the phone',
		from: signedOut,
		event: verified([], 'tok_1', '+52 55 9999 0000'),
		to: { kind: 'signed_out', lastPhone: '+52 55 9999 0000' },
	},
	{
		name: 'a worker in the list is chosen',
		from: choosing,
		event: { type: 'worker_chosen', workerId: 'w_carla' },
		to: { ...signedInBruno, worker: carla },
	},
	{
		name: 'a worker outside the list is ignored',
		from: choosing,
		event: { type: 'worker_chosen', workerId: 'w_ana' },
		to: choosing,
	},
	{
		name: 'choosing a worker while signed out does nothing',
		from: signedOut,
		event: { type: 'worker_chosen', workerId: 'w_ana' },
		to: signedOut,
	},
	{
		name: 'choosing a worker while signed in does nothing',
		from: signedInBruno,
		event: { type: 'worker_chosen', workerId: 'w_carla' },
		to: signedInBruno,
	},
	{
		name: 'switching with several workers returns to the picker',
		from: signedInBruno,
		event: { type: 'switch_worker_requested' },
		to: choosing,
	},
	{
		name: 'switching with one worker changes nothing',
		from: signedInAna,
		event: { type: 'switch_worker_requested' },
		to: signedInAna,
	},
	{
		name: 'switching while signed out changes nothing',
		from: signedOut,
		event: { type: 'switch_worker_requested' },
		to: signedOut,
	},
	{
		name: 'signing out from signed in keeps the phone',
		from: signedInBruno,
		event: { type: 'signed_out' },
		to: { kind: 'signed_out', lastPhone: '+52 55 1000 0002' },
	},
	{
		name: 'signing out from the picker keeps the phone',
		from: choosing,
		event: { type: 'signed_out' },
		to: { kind: 'signed_out', lastPhone: '+52 55 1000 0002' },
	},
	{
		name: 'signing out while signed out keeps lastPhone',
		from: { kind: 'signed_out', lastPhone: '+52 55 1000 0001' },
		event: { type: 'signed_out' },
		to: { kind: 'signed_out', lastPhone: '+52 55 1000 0001' },
	},
	{
		name: 're-verifying as the same phone keeps the worker and replaces the token',
		from: signedInBruno,
		event: verified([bruno, carla], 'tok_2'),
		to: { ...signedInBruno, token: 'tok_2' },
	},
	{
		name: 're-verifying matches the phone by digits',
		from: signedInBruno,
		event: verified([bruno, carla], 'tok_2', '+525510000002'),
		to: { ...signedInBruno, token: 'tok_2', phone: '+525510000002' },
	},
	{
		name: 're-verifying drops the worker when they left the list',
		from: signedInBruno,
		event: verified([carla], 'tok_2'),
		to: {
			kind: 'signed_in',
			phone: '+52 55 1000 0002',
			token: 'tok_2',
			expiresAt: 1_000,
			worker: carla,
			workers: [carla],
		},
	},
	{
		name: 'verifying another phone while signed in starts over',
		from: signedInBruno,
		event: verified([ana], 'tok_9', '+52 55 1000 0001'),
		to: { ...signedInAna, token: 'tok_9' },
	},
];

describe('transition', () => {
	it.each(rows)('$name', ({ from, event, to }) => {
		expect(transition(from, event)).toEqual(to);
	});

	it('returns the same object when nothing changes', () => {
		expect(transition(signedOut, { type: 'signed_out' })).toBe(signedOut);
		expect(transition(choosing, { type: 'worker_chosen', workerId: 'x' })).toBe(
			choosing,
		);
	});
});

describe('tokenForWorker', () => {
	it('returns the token only for the signed-in worker', () => {
		expect(tokenForWorker(signedInBruno, 'w_bruno')).toBe('tok_1');
		expect(tokenForWorker(signedInBruno, 'w_carla')).toBeNull();
	});

	it('returns null while choosing or signed out', () => {
		expect(tokenForWorker(choosing, 'w_bruno')).toBeNull();
		expect(tokenForWorker(signedOut, 'w_bruno')).toBeNull();
	});
});

describe('authStatusOf', () => {
	it('is in-app only when signed in', () => {
		expect(authStatusOf(signedInBruno)).toBe('in-app');
		expect(authStatusOf(choosing)).toBe('signed-out');
		expect(authStatusOf(signedOut)).toBe('signed-out');
	});
});
