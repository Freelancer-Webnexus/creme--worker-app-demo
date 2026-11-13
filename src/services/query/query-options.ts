import {
	type QueryClient,
	type RefetchOptions,
	queryOptions,
	skipToken,
} from '@tanstack/react-query';
import { queryKeys } from '@/services/query/query-keys';
import {
	type RefreshPorts,
	refreshAssignmentRetryingSuperseded,
} from '@/services/query/refresh-assignment';
import type {
	WorkerCache,
	WorkerCacheStore,
} from '@/services/storage/worker-cache-store';
import type { QueueStore } from '@/services/sync/sync-ports';
import type { QueuedAction } from '@/services/sync/sync-types';

export type WorkerView = {
	cache: WorkerCache | null;
	rows: QueuedAction[];
};

/**
 * A delivery patches the cache before the engine deletes the row. Reading the
 * rows first means a read that finds the row gone also finds the patch, so the
 * two never disagree.
 */
const readWorkerView = async (
	cache: WorkerCacheStore,
	queue: Pick<QueueStore, 'listAll'>,
	workerId: string,
): Promise<WorkerView> => {
	const rows = await queue.listAll(workerId);
	return { cache: await cache.read(workerId), rows };
};

export const workerViewOptions = (
	cache: WorkerCacheStore,
	queue: Pick<QueueStore, 'listAll'>,
	workerId: string | null,
) =>
	queryOptions({
		networkMode: 'always',
		queryFn:
			workerId === null
				? skipToken
				: () => readWorkerView(cache, queue, workerId),
		queryKey: queryKeys.workerView.detail(workerId),
		retry: false,
		staleTime: Number.POSITIVE_INFINITY,
	});

/**
 * `invalidateQueries` refetches only views a screen is watching. The read is
 * stored directly, so the next screen to mount shows the fresh view at once,
 * never the old one first; the invalidation then replaces any older fetch in
 * flight.
 */
export const refreshWorkerView = async (
	queryClient: QueryClient,
	cache: WorkerCacheStore,
	queue: Pick<QueueStore, 'listAll'>,
	workerId: string,
): Promise<void> => {
	const view = await readWorkerView(cache, queue, workerId);
	queryClient.setQueryData(queryKeys.workerView.detail(workerId), view);
	void queryClient.invalidateQueries({
		queryKey: queryKeys.workerView.detail(workerId),
	});
};

type AssignmentRefreshInput = {
	expiresAt: number | null;
	ports: RefreshPorts;
	queryClient: QueryClient;
	workerId: string | null;
};

/**
 * `networkMode` stays at the default `'online'`, so the fetch pauses offline and
 * the sync indicator can say `waiting_for_connection`.
 */
export const assignmentRefreshOptions = (input: AssignmentRefreshInput) => {
	const { expiresAt, ports, queryClient, workerId } = input;
	return queryOptions({
		queryFn:
			workerId === null
				? skipToken
				: async () => {
						const outcome = await refreshAssignmentRetryingSuperseded(
							ports,
							workerId,
						);
						await queryClient.invalidateQueries({
							queryKey: queryKeys.workerView.detail(workerId),
						});
						return outcome;
					},
		queryKey: queryKeys.assignment.detail(workerId, expiresAt),
		retry: false,
		staleTime: 0,
	});
};

/** A pull that lands during an automatic fetch joins it instead of starting a second GET. */
export const pullRefetchOptions: RefetchOptions = { cancelRefetch: false };
