import type { RefreshOutcome } from '@/services/query/refresh-assignment';
import type { QueueStatus } from '@/services/runtime/queue-status';
import type { WorkerCache } from '@/services/storage/worker-cache-store';

export type CacheGateInput = {
	/** `undefined` while SQLite is being read, `null` when nothing is cached. */
	cache: WorkerCache | null | undefined;
	isOnline: boolean;
	queue: QueueStatus;
	/** What the last assignment fetch did, `undefined` before it finished. */
	refreshOutcome: RefreshOutcome | undefined;
};

/** Whether a screen can show server facts yet. */
export type CacheGate =
	| { kind: 'loading' }
	| { kind: 'needs_connection' }
	| { kind: 'server_unavailable' }
	| { kind: 'ready'; cache: WorkerCache };

/**
 * Before the first copy of the assignment exists, "loading" holds while a fetch
 * can still arrive and "needs a connection" holds when it cannot. The queue is
 * waited for too: a screen must not call something unsent or unconfirmed
 * before it knows what is saved on this phone.
 */
export const cacheGateFor = (input: CacheGateInput): CacheGate => {
	const { cache } = input;
	if (cache === undefined || input.queue.kind === 'loading') {
		return { kind: 'loading' };
	}

	if (cache === null) {
		if (!input.isOnline) {
			return { kind: 'needs_connection' };
		}
		switch (input.refreshOutcome) {
			case undefined:
			case 'refreshed':
			case 'superseded':
				return { kind: 'loading' };
			case 'server_error':
				return { kind: 'server_unavailable' };
			case 'kept_cache':
			case 'unauthorized':
			case 'skipped':
				return { kind: 'needs_connection' };
			default:
				return input.refreshOutcome satisfies never;
		}
	}

	return { cache, kind: 'ready' };
};
