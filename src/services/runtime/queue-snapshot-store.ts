import { logger } from '@/services/logger/logger';
import type { QueuedAction } from '@/services/sync/sync-types';

/**
 * The queue rows of the active worker as the screens see them. `unloaded` is a
 * real state: until the first read finishes, a screen must not claim that
 * everything is sent.
 */
export type QueueSnapshot =
	| { kind: 'unloaded' }
	| { kind: 'loaded'; workerId: string; rows: QueuedAction[] };

export type QueueSnapshotStore = {
	getSnapshot: () => QueueSnapshot;
	subscribe: (listener: () => void) => () => void;
	/** Re-reads the queue of one worker. Null means nobody is signed in. */
	refresh: (workerId: string | null) => Promise<void>;
};

type QueueSource = {
	listAll: (workerId: string) => Promise<QueuedAction[]>;
};

const unloaded: QueueSnapshot = { kind: 'unloaded' };

const sameRows = (first: QueuedAction[], second: QueuedAction[]): boolean =>
	JSON.stringify(first) === JSON.stringify(second);

export const createQueueSnapshotStore = (
	source: QueueSource,
): QueueSnapshotStore => {
	let snapshot: QueueSnapshot = unloaded;
	let listeners: (() => void)[] = [];
	let latestRequest = 0;

	const publish = (next: QueueSnapshot): void => {
		snapshot = next;
		for (const listener of listeners) {
			listener();
		}
	};

	return {
		getSnapshot: () => snapshot,

		subscribe: (listener) => {
			listeners = [...listeners, listener];
			return () => {
				listeners = listeners.filter((other) => other !== listener);
			};
		},

		refresh: async (workerId) => {
			latestRequest += 1;
			const request = latestRequest;

			if (workerId === null) {
				if (snapshot.kind !== 'unloaded') {
					publish(unloaded);
				}
				return;
			}
			if (snapshot.kind === 'loaded' && snapshot.workerId !== workerId) {
				publish(unloaded);
			}

			let rows: QueuedAction[];
			try {
				rows = await source.listAll(workerId);
			} catch {
				logger.warn('queue', 'Could not read the queue.');
				return;
			}
			// A newer refresh asked for different data while this read was running.
			if (request !== latestRequest) {
				return;
			}
			if (
				snapshot.kind === 'loaded' &&
				snapshot.workerId === workerId &&
				sameRows(snapshot.rows, rows)
			) {
				return;
			}
			publish({ kind: 'loaded', rows, workerId });
		},
	};
};
