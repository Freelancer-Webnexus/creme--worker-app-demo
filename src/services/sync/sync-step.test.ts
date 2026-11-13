import { type EngineEvent, sameState, step } from '@/services/sync/sync-step';
import type { EngineState } from '@/services/sync/sync-types';

type StateKind = EngineState['kind'];

const idle: EngineState = { kind: 'idle' };
const offline: EngineState = { kind: 'offline' };
const syncing: EngineState = { kind: 'syncing' };
const backingOff: EngineState = { kind: 'backing_off', until: 5_000 };
const authRequired: EngineState = { kind: 'auth_required' };

const states: Record<StateKind, EngineState> = {
	idle,
	offline,
	syncing,
	backing_off: backingOff,
	auth_required: authRequired,
};

const events = {
	online: { kind: 'connectivity_changed', online: true },
	went_offline: { kind: 'connectivity_changed', online: false },
	run_started: { kind: 'run_started' },
	run_finished_empty: { kind: 'run_finished', nextDueAt: null },
	run_finished_waiting: { kind: 'run_finished', nextDueAt: 9_000 },
	send_retryable: { kind: 'send_retryable', until: 7_000 },
	unauthorized: { kind: 'unauthorized' },
	signed_in: { kind: 'signed_in' },
	signed_out: { kind: 'signed_out' },
	backoff_timer_fired: { kind: 'backoff_timer_fired' },
} satisfies Record<string, EngineEvent>;

type EventLabel = keyof typeof events;

const everyEventKind: Record<EngineEvent['kind'], true> = {
	connectivity_changed: true,
	run_started: true,
	run_finished: true,
	send_retryable: true,
	unauthorized: true,
	signed_in: true,
	signed_out: true,
	backoff_timer_fired: true,
};

const backingOffUntil = (until: number): EngineState => ({
	kind: 'backing_off',
	until,
});

const expected: Record<EventLabel, Record<StateKind, EngineState>> = {
	online: {
		idle,
		offline: idle,
		syncing,
		backing_off: backingOff,
		auth_required: authRequired,
	},
	went_offline: {
		idle: offline,
		offline,
		syncing: offline,
		backing_off: offline,
		auth_required: authRequired,
	},
	run_started: {
		idle: syncing,
		offline: syncing,
		syncing,
		backing_off: syncing,
		auth_required: authRequired,
	},
	run_finished_empty: {
		idle,
		offline,
		syncing: idle,
		backing_off: backingOff,
		auth_required: authRequired,
	},
	run_finished_waiting: {
		idle,
		offline,
		syncing: backingOffUntil(9_000),
		backing_off: backingOff,
		auth_required: authRequired,
	},
	send_retryable: {
		idle,
		offline,
		syncing: backingOffUntil(7_000),
		backing_off: backingOff,
		auth_required: authRequired,
	},
	unauthorized: {
		idle: authRequired,
		offline: authRequired,
		syncing: authRequired,
		backing_off: authRequired,
		auth_required: authRequired,
	},
	signed_in: {
		idle,
		offline,
		syncing,
		backing_off: idle,
		auth_required: idle,
	},
	signed_out: {
		idle,
		offline,
		syncing: idle,
		backing_off: idle,
		auth_required: idle,
	},
	backoff_timer_fired: {
		idle,
		offline,
		syncing,
		backing_off: idle,
		auth_required: authRequired,
	},
};

const expectationKey = (stateKind: string, label: string) =>
	`${stateKind} + ${label}`;

const lookup = new Map<string, EngineState>(
	Object.entries(expected).flatMap(([label, perState]) =>
		Object.entries(perState).map(([stateKind, to]): [string, EngineState] => [
			expectationKey(stateKind, label),
			to,
		]),
	),
);

const pairs = Object.entries(states).flatMap(([stateKind, from]) =>
	Object.entries(events).map(([label, event]) => ({
		stateKind,
		label,
		from,
		event: event,
	})),
);

describe('step', () => {
	it.each(pairs)('$stateKind + $label', ({ stateKind, label, from, event }) => {
		const to = lookup.get(expectationKey(stateKind, label));
		if (to === undefined) {
			throw new Error(`No expectation for ${stateKind} + ${label}`);
		}

		expect(step(from, event)).toEqual(to);
	});

	it('the sample events cover every event kind and the table has no extra rows', () => {
		const sampled = new Set(
			Object.values(events).map((event: EngineEvent) => event.kind),
		);

		expect([...sampled].sort()).toEqual(Object.keys(everyEventKind).sort());
		expect(lookup.size).toBe(pairs.length);
	});
});

describe('sameState', () => {
	it('compares by kind, and by the due time for backing off', () => {
		expect(sameState(idle, { kind: 'idle' })).toBe(true);
		expect(sameState(offline, { kind: 'offline' })).toBe(true);
		expect(sameState(backingOff, { kind: 'backing_off', until: 5_000 })).toBe(
			true,
		);
		expect(sameState(backingOff, { kind: 'backing_off', until: 6_000 })).toBe(
			false,
		);
		expect(sameState(idle, offline)).toBe(false);
		expect(sameState(syncing, backingOff)).toBe(false);
	});
});
