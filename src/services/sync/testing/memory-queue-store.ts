import type { QueueStore } from '@/services/sync/sync-ports';
import type { QueuedAction } from '@/services/sync/sync-types';

export type MemoryQueueStore = QueueStore & {
	/** Every row of every worker, in insert order. For assertions. */
	rows: () => QueuedAction[];
};

/** Rows are kept in insert order. Reads return copies, like a database. */
export const createMemoryQueueStore = (): MemoryQueueStore => {
	let rows: QueuedAction[] = [];

	const byOldest = (a: QueuedAction, b: QueuedAction) =>
		a.createdAt - b.createdAt;

	const update = (
		clientActionId: string,
		change: (action: QueuedAction) => QueuedAction,
	) => {
		rows = rows.map((row) =>
			row.clientActionId === clientActionId ? change(row) : row,
		);
	};

	return {
		rows: () => rows.map((row) => ({ ...row })),

		insert: async (action) => {
			rows = [...rows, { ...action }];
		},

		listReady: async (workerId, now) =>
			rows
				.filter(
					(row) =>
						row.workerId === workerId &&
						row.status.kind === 'queued' &&
						row.nextAttemptAt <= now,
				)
				.sort(byOldest)
				.map((row) => ({ ...row })),

		listAll: async (workerId) =>
			rows
				.filter((row) => row.workerId === workerId)
				.sort(byOldest)
				.map((row) => ({ ...row })),

		recordAttempt: async (clientActionId, attempts, nextAttemptAt) => {
			update(clientActionId, (row) => ({ ...row, attempts, nextAttemptAt }));
		},

		makeDueNow: async (workerId, now) => {
			rows = rows.map((row) =>
				row.workerId === workerId && row.status.kind === 'queued'
					? { ...row, nextAttemptAt: now }
					: row,
			);
		},

		markFailed: async (clientActionId, reason) => {
			update(clientActionId, (row) => ({
				...row,
				status: { kind: 'failed', reason },
			}));
		},

		remove: async (clientActionId) => {
			rows = rows.filter((row) => row.clientActionId !== clientActionId);
		},
	};
};
