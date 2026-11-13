import type { Assignment, TermsVersion } from '@/services/api/api-types';
import type { SqlDriver, SqlExecutor } from '@/services/storage/sql-driver';
import {
	withCurrentTerms,
	withDocumentPendingReview,
	withTermsAccepted,
} from '@/services/storage/worker-cache-patch';

export type WorkerCache = {
	assignment: Assignment;
	lastSeenTermsVersionId: string | null;
	fetchedAt: number;
};

export type WorkerCacheStore = {
	read: (workerId: string) => Promise<WorkerCache | null>;
	/**
	 * Replaces the cached assignment with a server copy. Keeps lastSeenTermsVersionId.
	 * `fetchStartedAt` is when the request started. A copy that started before the
	 * last local patch may predate that server fact and is discarded. Resolves
	 * true when the copy was saved.
	 */
	saveAssignment: (
		workerId: string,
		assignment: Assignment,
		fetchStartedAt: number,
	) => Promise<boolean>;
	markTermsSeen: (workerId: string, termsVersionId: string) => Promise<void>;
	/** Server confirmed the acceptance (201/200). */
	applyTermsAccepted: (
		workerId: string,
		termsVersionId: string,
	) => Promise<void>;
	/** Server answered 409 with a newer version (M6). Does not touch the accepted id. */
	applyCurrentTerms: (
		workerId: string,
		currentTerms: TermsVersion,
	) => Promise<void>;
	/** Server confirmed an upload: that document is now pending_review (M4: this is a server fact). */
	applyDocumentPendingReview: (
		workerId: string,
		documentType: string,
	) => Promise<void>;
};

type CacheRow = {
	assignment_json: string;
	last_seen_terms_version_id: string | null;
	fetched_at: number;
};

export type WorkerCacheStoreOptions = {
	/** The clock the sync engine uses. Every patch is stamped with it. */
	now: () => number;
};

export function createWorkerCacheStore(
	driver: SqlDriver,
	{ now }: WorkerCacheStoreOptions,
): WorkerCacheStore {
	async function readFrom(
		executor: SqlExecutor,
		workerId: string,
	): Promise<WorkerCache | null> {
		const rows = await executor.all<CacheRow>(
			`SELECT assignment_json, last_seen_terms_version_id, fetched_at
			 FROM worker_cache WHERE worker_id = ?`,
			[workerId],
		);
		const row = rows[0];
		if (row === undefined) return null;
		return {
			assignment: JSON.parse(row.assignment_json) as Assignment,
			lastSeenTermsVersionId: row.last_seen_terms_version_id,
			fetchedAt: row.fetched_at,
		};
	}

	/**
	 * M2: statements run one at a time in call order, and a patch reads and
	 * writes inside one exclusive transaction. So a patch always edits the row
	 * that exists when it runs and keeps every field it does not own.
	 * M3, M4: a patch is a server fact the device learned from a send, and it
	 * stamps `patched_at`. Against `saveAssignment` the winner is the one that
	 * knows more: a snapshot whose request started before the last patch may have
	 * read the server before that fact and is discarded; one that started at or
	 * after it replaces the whole row.
	 */
	function patch(
		workerId: string,
		change: (assignment: Assignment) => Assignment,
	): Promise<void> {
		return driver.transaction(async (tx) => {
			const current = await readFrom(tx, workerId);
			if (current === null) return;
			await tx.run(
				`UPDATE worker_cache SET assignment_json = ?, patched_at = ? WHERE worker_id = ?`,
				[JSON.stringify(change(current.assignment)), now(), workerId],
			);
		});
	}

	return {
		read: (workerId) => readFrom(driver, workerId),
		saveAssignment: async (workerId, assignment, fetchStartedAt) => {
			const saved = await driver.all<{ worker_id: string }>(
				`INSERT INTO worker_cache (worker_id, assignment_json, fetched_at)
				 VALUES (?, ?, ?)
				 ON CONFLICT (worker_id) DO UPDATE SET
					assignment_json = excluded.assignment_json,
					fetched_at = excluded.fetched_at
				 WHERE excluded.fetched_at >= worker_cache.patched_at
				 RETURNING worker_id`,
				[workerId, JSON.stringify(assignment), fetchStartedAt],
			);
			return saved.length > 0;
		},
		markTermsSeen: (workerId, termsVersionId) =>
			driver.run(
				`UPDATE worker_cache SET last_seen_terms_version_id = ? WHERE worker_id = ?`,
				[termsVersionId, workerId],
			),
		applyTermsAccepted: (workerId, termsVersionId) =>
			patch(workerId, (assignment) =>
				withTermsAccepted(assignment, termsVersionId),
			),
		applyCurrentTerms: (workerId, currentTerms) =>
			patch(workerId, (assignment) =>
				withCurrentTerms(assignment, currentTerms),
			),
		applyDocumentPendingReview: (workerId, documentType) =>
			patch(workerId, (assignment) =>
				withDocumentPendingReview(assignment, documentType),
			),
	};
}
