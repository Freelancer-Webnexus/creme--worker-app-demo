import { useSyncExternalStore } from 'react';
import { useIsOnline } from '@/services/connectivity/use-is-online';
import {
	loadedQueue,
	type QueueStatus,
	queueLoading,
} from '@/services/runtime/queue-status';
import { useActiveWorker } from '@/services/runtime/use-active-worker';
import { useAppRuntime } from '@/services/runtime/use-app-runtime';
import type { EngineState } from '@/services/sync/sync-types';

export type SyncStatus = {
	engineState: EngineState;
	isOnline: boolean;
	queue: QueueStatus;
};

/**
 * Engine state plus the queue of the signed-in worker. Both re-render on a
 * change, so there is no polling. Feed it to `buildSyncIndicator` to say whether
 * work was delivered or is only saved on this phone.
 */
export const useSyncStatus = (): SyncStatus => {
	const { engine, queueSnapshot } = useAppRuntime();
	const worker = useActiveWorker();
	const isOnline = useIsOnline();
	const engineState = useSyncExternalStore(
		engine.subscribe,
		engine.getState,
		engine.getState,
	);
	const snapshot = useSyncExternalStore(
		queueSnapshot.subscribe,
		queueSnapshot.getSnapshot,
		queueSnapshot.getSnapshot,
	);

	const queue =
		snapshot.kind === 'loaded' && snapshot.workerId === worker?.id
			? loadedQueue(snapshot.rows)
			: queueLoading;

	return { engineState, isOnline, queue };
};
