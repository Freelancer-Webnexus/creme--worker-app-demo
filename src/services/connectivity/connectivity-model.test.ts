import {
	type ConnectivityEvent,
	type ConnectivityState,
	connectivityTransition,
	initialConnectivityState,
} from '@/services/connectivity/connectivity-model';

const stopped = (online: boolean): ConnectivityState => ({
	kind: 'stopped',
	online,
});
const starting = (online: boolean): ConnectivityState => ({
	kind: 'starting',
	online,
});
const listening = (online: boolean): ConnectivityState => ({
	kind: 'listening',
	online,
});

type Row = [
	name: string,
	from: ConnectivityState,
	event: ConnectivityEvent,
	to: ConnectivityState,
];

const rows: Row[] = [
	[
		'stopped + start',
		stopped(true),
		{ type: 'start_requested' },
		starting(true),
	],
	[
		'stopped + start keeps the last known value',
		stopped(false),
		{ type: 'start_requested' },
		starting(false),
	],
	[
		'stopped ignores a late event',
		stopped(true),
		{ online: false, type: 'event_received' },
		stopped(true),
	],
	[
		'stopped ignores a late initial read',
		stopped(true),
		{ online: false, type: 'initial_read' },
		stopped(true),
	],
	['stopped + stop', stopped(true), { type: 'stop_requested' }, stopped(true)],

	[
		'starting + start is ignored',
		starting(true),
		{ type: 'start_requested' },
		starting(true),
	],
	[
		'starting + initial read applies it',
		starting(true),
		{ online: false, type: 'initial_read' },
		listening(false),
	],
	[
		'starting + event applies it',
		starting(true),
		{ online: false, type: 'event_received' },
		listening(false),
	],
	[
		'starting + stop',
		starting(false),
		{ type: 'stop_requested' },
		stopped(false),
	],

	[
		'listening + start is ignored',
		listening(false),
		{ type: 'start_requested' },
		listening(false),
	],
	[
		'listening ignores a stale initial read',
		listening(false),
		{ online: true, type: 'initial_read' },
		listening(false),
	],
	[
		'listening + event applies it',
		listening(false),
		{ online: true, type: 'event_received' },
		listening(true),
	],
	[
		'listening + stop',
		listening(true),
		{ type: 'stop_requested' },
		stopped(true),
	],
];

describe('connectivityTransition', () => {
	it('starts stopped and online: unknown counts as online', () => {
		expect(initialConnectivityState).toEqual(stopped(true));
	});

	it.each(rows)('%s', (_name, from, event, to) => {
		expect(connectivityTransition(from, event)).toEqual(to);
	});

	it('an event that arrives during the first read wins over the older snapshot', () => {
		let state = connectivityTransition(initialConnectivityState, {
			type: 'start_requested',
		});
		state = connectivityTransition(state, {
			online: false,
			type: 'event_received',
		});
		state = connectivityTransition(state, {
			online: true,
			type: 'initial_read',
		});

		expect(state).toEqual(listening(false));
	});

	it('can start again after a stop', () => {
		let state = connectivityTransition(initialConnectivityState, {
			type: 'start_requested',
		});
		state = connectivityTransition(state, { type: 'stop_requested' });
		state = connectivityTransition(state, { type: 'start_requested' });

		expect(state.kind).toBe('starting');
	});
});
