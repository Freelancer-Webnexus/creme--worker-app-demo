import type { QueuedAction } from '@/services/sync/sync-types';

/**
 * The queue of the signed-in worker as the screens see it. Until it is read, a
 * screen must not claim that everything is sent (M4).
 */
export type QueueStatus =
	| { kind: 'loading' }
	| {
			kind: 'loaded';
			/** Queued and failed rows, oldest first. */
			rows: QueuedAction[];
			queuedCount: number;
			failedCount: number;
	  };

const noRows: QueuedAction[] = [];

export const queueLoading: QueueStatus = { kind: 'loading' };

export const loadedQueue = (rows: QueuedAction[]): QueueStatus => ({
	failedCount: rows.filter((row) => row.status.kind === 'failed').length,
	kind: 'loaded',
	queuedCount: rows.filter((row) => row.status.kind === 'queued').length,
	rows,
});

/** The rows a screen lists: none while the queue is still being read. */
export const rowsOf = (queue: QueueStatus): QueuedAction[] => {
	switch (queue.kind) {
		case 'loading':
			return noRows;
		case 'loaded':
			return queue.rows;
		default:
			return queue satisfies never;
	}
};
