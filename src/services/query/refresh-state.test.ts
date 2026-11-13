import {
	type RefreshStateInput,
	refreshStateOf,
	resultOf,
} from '@/services/query/refresh-state';

const base: RefreshStateInput = {
	fetchPhase: 'idle',
	hasWorker: true,
	outcome: undefined,
	pull: 'idle',
};

describe('refreshStateOf', () => {
	it.each([
		['nobody signed in', { hasWorker: false }, { kind: 'no_worker' }],
		[
			'nobody signed in wins over everything',
			{ fetchPhase: 'fetching', hasWorker: false, pull: 'pulling' },
			{ kind: 'no_worker' },
		],
		['first fetch running', { fetchPhase: 'fetching' }, { kind: 'loading' }],
		['first fetch not started yet', {}, { kind: 'loading' }],
		[
			'first fetch waits for a connection',
			{ fetchPhase: 'paused' },
			{ kind: 'waiting_for_connection' },
		],
		[
			'a result is in',
			{ outcome: 'refreshed' },
			{ kind: 'settled', outcome: 'refreshed' },
		],
		[
			'a result is in and it was superseded by a newer local fact',
			{ outcome: 'superseded' },
			{ kind: 'settled', outcome: 'superseded' },
		],
		[
			'a result is in and a refetch waits for a connection',
			{ fetchPhase: 'paused', outcome: 'kept_cache' },
			{ kind: 'settled', outcome: 'kept_cache' },
		],
		[
			'a result is in and an automatic refetch runs',
			{ fetchPhase: 'fetching', outcome: 'server_error' },
			{ kind: 'settled', outcome: 'server_error' },
		],
		[
			'the worker pulled before any result',
			{ fetchPhase: 'fetching', pull: 'pulling' },
			{ kind: 'pulling', previous: null },
		],
		[
			'the worker pulled with a result in',
			{ fetchPhase: 'fetching', outcome: 'kept_cache', pull: 'pulling' },
			{ kind: 'pulling', previous: 'kept_cache' },
		],
	] as [string, Partial<RefreshStateInput>, unknown][])(
		'%s',
		(_name, input, expected) => {
			expect(refreshStateOf({ ...base, ...input })).toEqual(expected);
		},
	);
});

describe('resultOf', () => {
	it.each([
		[{ kind: 'no_worker' }, undefined],
		[{ kind: 'loading' }, undefined],
		[{ kind: 'waiting_for_connection' }, undefined],
		[{ kind: 'settled', outcome: 'refreshed' }, 'refreshed'],
		[{ kind: 'pulling', previous: null }, undefined],
		[{ kind: 'pulling', previous: 'unauthorized' }, 'unauthorized'],
	] as const)('%j gives %s', (state, expected) => {
		expect(resultOf(state)).toBe(expected);
	});
});
