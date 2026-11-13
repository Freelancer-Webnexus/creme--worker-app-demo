import type { WorkerApi } from '@/services/api/worker-api';
import type { WorkerCacheStore } from '@/services/storage/worker-cache-store';

export type RefreshOutcome =
	| 'refreshed'
	| 'superseded'
	| 'kept_cache'
	| 'server_error'
	| 'unauthorized'
	| 'skipped';

export type RefreshPorts = {
	api: WorkerApi;
	cache: WorkerCacheStore;
	now: () => number;
	/** Called once on a 401, so the engine can ask for a new sign-in. */
	onUnauthorized: () => void;
	/** Token of the signed-in worker, or null when nobody is signed in. */
	token: (workerId: string) => string | null;
};

/**
 * One GET /me/assignment. A fresh copy replaces the cache. A network or server
 * failure keeps the old cache without a word: the worker can still work offline
 * (M1). The two stay apart so an empty first load names the right cause.
 * A 401 is not a failure of the cache, it is the session ending.
 * M3, M4: the clock is read before the request. A copy whose request started
 * before a local server fact was cached may have read the server before that
 * fact, so the cache discards it and the outcome is `superseded`.
 */
export const refreshAssignment = async (
	ports: RefreshPorts,
	workerId: string,
): Promise<RefreshOutcome> => {
	const token = ports.token(workerId);
	if (token === null) {
		return 'skipped';
	}

	const startedAt = ports.now();
	const result = await ports.api.fetchAssignment(token, workerId);
	switch (result.kind) {
		case 'ok': {
			const applied = await ports.cache.saveAssignment(
				workerId,
				result.assignment,
				startedAt,
			);
			return applied ? 'refreshed' : 'superseded';
		}
		case 'network_error':
			return 'kept_cache';
		case 'server_error':
			return 'server_error';
		case 'unauthorized':
			ports.onUnauthorized();
			return 'unauthorized';
		default:
			return result satisfies never;
	}
};

/**
 * A superseded copy is replaced by one fresh fetch that starts after the local
 * fact. Only one: if a newer fact lands again, the sink's change signal asks
 * for the next fetch.
 */
export const refreshAssignmentRetryingSuperseded = async (
	ports: RefreshPorts,
	workerId: string,
): Promise<RefreshOutcome> => {
	const first = await refreshAssignment(ports, workerId);
	return first === 'superseded' ? refreshAssignment(ports, workerId) : first;
};
