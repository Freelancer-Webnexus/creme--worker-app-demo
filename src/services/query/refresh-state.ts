import type { RefreshOutcome } from '@/services/query/refresh-assignment';

/** What the assignment refresh is doing, derived from the query and the worker's pull; never stored. */
export type RefreshState =
	| { kind: 'no_worker' }
	| { kind: 'loading' }
	| { kind: 'waiting_for_connection' }
	| { kind: 'settled'; outcome: RefreshOutcome }
	| { kind: 'pulling'; previous: RefreshOutcome | null };

export type RefreshStateInput = {
	hasWorker: boolean;
	fetchPhase: 'fetching' | 'paused' | 'idle';
	outcome: RefreshOutcome | undefined;
	pull: 'idle' | 'pulling';
};

export const refreshStateOf = (input: RefreshStateInput): RefreshState => {
	if (!input.hasWorker) {
		return { kind: 'no_worker' };
	}
	if (input.pull === 'pulling') {
		return { kind: 'pulling', previous: input.outcome ?? null };
	}
	if (input.outcome !== undefined) {
		return { kind: 'settled', outcome: input.outcome };
	}
	return input.fetchPhase === 'paused'
		? { kind: 'waiting_for_connection' }
		: { kind: 'loading' };
};

/** The last finished result, or `undefined` while there is none yet. The state says why. */
export const resultOf = (state: RefreshState): RefreshOutcome | undefined => {
	switch (state.kind) {
		case 'settled':
			return state.outcome;
		case 'pulling':
			return state.previous ?? undefined;
		case 'no_worker':
		case 'loading':
		case 'waiting_for_connection':
			return undefined;
		default:
			return state satisfies never;
	}
};
