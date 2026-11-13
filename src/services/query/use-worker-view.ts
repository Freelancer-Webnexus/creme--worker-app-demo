import { useQuery } from '@tanstack/react-query';
import { workerViewOptions } from '@/services/query/query-options';
import {
	loadedQueue,
	type QueueStatus,
	queueLoading,
} from '@/services/runtime/queue-status';
import { useActiveWorker } from '@/services/runtime/use-active-worker';
import { useAppRuntime } from '@/services/runtime/use-app-runtime';
import type { WorkerCache } from '@/services/storage/worker-cache-store';

export type WorkerViewState = {
	/** `undefined` while SQLite is being read, `null` when nothing is cached yet. */
	cache: WorkerCache | null | undefined;
	queue: QueueStatus;
};

/**
 * The signed-in worker's cached server facts and queue rows, read together from
 * SQLite so a screen never combines a cache with rows from a different moment.
 * The reads are local, so they run offline too. The runtime invalidates the
 * query on every engine change, because a delivered action patches the cache and
 * removes its row.
 */
export const useWorkerView = (): WorkerViewState => {
	const { cache, queue } = useAppRuntime();
	const worker = useActiveWorker();
	const { data } = useQuery(
		workerViewOptions(cache, queue, worker?.id ?? null),
	);

	return data === undefined
		? { cache: undefined, queue: queueLoading }
		: { cache: data.cache, queue: loadedQueue(data.rows) };
};
