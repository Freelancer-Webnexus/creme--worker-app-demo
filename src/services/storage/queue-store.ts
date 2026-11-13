import {
	actionToParams,
	queueColumns,
	type QueueRow,
	rowToAction,
} from '@/services/storage/queue-row';
import type { SqlDriver } from '@/services/storage/sql-driver';
import type { QueueStore } from '@/services/sync/sync-ports';

export function createQueueStore(driver: SqlDriver): QueueStore {
	return {
		// Resolves after the statement commits, so the row is durable (M3).
		insert: (action) =>
			driver.run(
				`INSERT INTO queue (${queueColumns}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				actionToParams(action),
			),
		listReady: async (workerId, now) => {
			const rows = await driver.all<QueueRow>(
				`SELECT ${queueColumns} FROM queue
				 WHERE worker_id = ? AND status = 'queued' AND next_attempt_at <= ?
				 ORDER BY created_at, rowid`,
				[workerId, now],
			);
			return rows.map(rowToAction);
		},
		listAll: async (workerId) => {
			const rows = await driver.all<QueueRow>(
				`SELECT ${queueColumns} FROM queue
				 WHERE worker_id = ?
				 ORDER BY created_at, rowid`,
				[workerId],
			);
			return rows.map(rowToAction);
		},
		recordAttempt: (clientActionId, attempts, nextAttemptAt) =>
			driver.run(
				`UPDATE queue SET attempts = ?, next_attempt_at = ? WHERE client_action_id = ?`,
				[attempts, nextAttemptAt, clientActionId],
			),
		makeDueNow: (workerId, now) =>
			driver.run(
				`UPDATE queue SET next_attempt_at = ? WHERE worker_id = ? AND status = 'queued'`,
				[now, workerId],
			),
		markFailed: (clientActionId, reason) =>
			driver.run(
				`UPDATE queue SET status = 'failed', failure_reason = ? WHERE client_action_id = ?`,
				[reason, clientActionId],
			),
		remove: (clientActionId) =>
			driver.run(`DELETE FROM queue WHERE client_action_id = ?`, [
				clientActionId,
			]),
	};
}
