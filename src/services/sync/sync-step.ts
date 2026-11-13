import type { EngineState } from '@/services/sync/sync-types';

export type EngineEvent =
	| { kind: 'connectivity_changed'; online: boolean }
	| { kind: 'run_started' }
	/** `nextDueAt` is when the earliest waiting action is due, or null when the queue has nothing waiting. */
	| { kind: 'run_finished'; nextDueAt: number | null }
	| { kind: 'send_retryable'; until: number }
	| { kind: 'unauthorized' }
	| { kind: 'signed_in' }
	| { kind: 'signed_out' }
	| { kind: 'backoff_timer_fired' };

export const assertNever = (value: never): never => {
	throw new Error(`Unhandled value: ${JSON.stringify(value)}`);
};

export const sameState = (a: EngineState, b: EngineState): boolean =>
	a.kind === 'backing_off' && b.kind === 'backing_off'
		? a.until === b.until
		: a.kind === b.kind;

/** The only place the engine state changes. Pure: no timers, no ports. */
export const step = (state: EngineState, event: EngineEvent): EngineState => {
	switch (event.kind) {
		case 'connectivity_changed':
			if (!event.online) {
				return state.kind === 'auth_required' ? state : { kind: 'offline' };
			}
			return state.kind === 'offline' ? { kind: 'idle' } : state;

		case 'run_started':
			return state.kind === 'syncing' || state.kind === 'auth_required'
				? state
				: { kind: 'syncing' };

		case 'run_finished':
			if (state.kind !== 'syncing') {
				return state;
			}
			return event.nextDueAt === null
				? { kind: 'idle' }
				: { kind: 'backing_off', until: event.nextDueAt };

		case 'send_retryable':
			return state.kind === 'syncing'
				? { kind: 'backing_off', until: event.until }
				: state;

		case 'unauthorized':
			return state.kind === 'auth_required' ? state : { kind: 'auth_required' };

		case 'signed_in':
			return state.kind === 'auth_required' || state.kind === 'backing_off'
				? { kind: 'idle' }
				: state;

		case 'signed_out':
			return state.kind === 'offline' ? state : { kind: 'idle' };

		case 'backoff_timer_fired':
			return state.kind === 'backing_off' ? { kind: 'idle' } : state;

		default:
			return assertNever(event);
	}
};
