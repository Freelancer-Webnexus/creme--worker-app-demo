export type SqlValue = string | number | null;

export type SqlExecutor = {
	run: (sql: string, params?: SqlValue[]) => Promise<void>;
	all: <TRow>(sql: string, params?: SqlValue[]) => Promise<TRow[]>;
};

/** A driver the app opened and must close again if boot fails after opening it. */
export type ClosableSqlDriver = SqlDriver & {
	close: () => Promise<void>;
};

export type SqlDriver = SqlExecutor & {
	/** Runs statements without parameters (schema). */
	exec: (sql: string) => Promise<void>;
	/**
	 * Commits when `work` resolves, rolls back when it throws. Nothing else runs
	 * on the database while it is open (M2), so `work` must use only `tx`. A call
	 * to `run`, `all`, `exec` or `transaction` on this driver from inside `work`
	 * queues behind the transaction it is part of, and the transaction waits for
	 * that call: a deadlock that never rejects. Nothing can detect it, because the
	 * driver cannot tell a call from inside `work` from one that other code makes
	 * at the same moment and that must wait its turn.
	 */
	transaction: (work: (tx: SqlExecutor) => Promise<void>) => Promise<void>;
};
