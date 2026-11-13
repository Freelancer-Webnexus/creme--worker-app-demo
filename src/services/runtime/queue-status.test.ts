import {
	loadedQueue,
	queueLoading,
	rowsOf,
} from '@/services/runtime/queue-status';
import type { QueuedAction } from '@/services/sync/sync-types';

const rowWith = (
	clientActionId: string,
	status: QueuedAction['status'],
): QueuedAction => ({
	attempts: 0,
	clientActionId,
	createdAt: 1,
	kind: { termsVersionId: 'terms-v2', type: 'terms_acceptance' },
	nextAttemptAt: 0,
	status,
	workerId: 'w1',
});

describe('loadedQueue', () => {
	it('counts queued and failed rows apart', () => {
		const rows = [
			rowWith('a1', { kind: 'queued' }),
			rowWith('a2', { kind: 'queued' }),
			rowWith('a3', { kind: 'failed', reason: 'rejected' }),
		];

		expect(loadedQueue(rows)).toEqual({
			failedCount: 1,
			kind: 'loaded',
			queuedCount: 2,
			rows,
		});
	});
});

describe('rowsOf', () => {
	it('lists no rows while the queue is being read', () => {
		expect(rowsOf(queueLoading)).toEqual([]);
	});

	it('lists the rows once read', () => {
		const rows = [rowWith('a1', { kind: 'queued' })];

		expect(rowsOf(loadedQueue(rows))).toBe(rows);
	});
});
