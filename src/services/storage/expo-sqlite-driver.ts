import { openDatabaseAsync } from 'expo-sqlite';
import { createSerialGate } from '@/services/storage/serial-gate';
import type {
	ClosableSqlDriver,
	SqlExecutor,
	SqlValue,
} from '@/services/storage/sql-driver';

type Queryable = {
	runAsync: (sql: string, params: SqlValue[]) => Promise<unknown>;
	getAllAsync: <TRow>(sql: string, params: SqlValue[]) => Promise<TRow[]>;
};

const executorOf = (queryable: Queryable): SqlExecutor => ({
	run: async (sql, params = []) => {
		await queryable.runAsync(sql, params);
	},
	all: <TRow>(sql: string, params: SqlValue[] = []) =>
		queryable.getAllAsync<TRow>(sql, params),
});

export async function openExpoSqliteDriver(
	databaseName: string,
): Promise<ClosableSqlDriver> {
	const db = await openDatabaseAsync(databaseName);
	// WAL + FULL: M2 forbids losing an acknowledged worker action, and the queue is small and write-rare, so the extra fsync is cheap.
	await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
	// M2: an exclusive transaction runs on its own connection, and a write on the
	// main connection meanwhile fails with "database is locked". The gate makes
	// every other call wait its turn instead, like the bun driver in tests.
	const gate = createSerialGate();
	const main = executorOf(db);
	return {
		close: () => gate(() => db.closeAsync()),
		exec: (sql) => gate(() => db.execAsync(sql)),
		run: (sql, params) => gate(() => main.run(sql, params)),
		all: <TRow>(sql: string, params?: SqlValue[]) =>
			gate(() => main.all<TRow>(sql, params)),
		transaction: (work) =>
			gate(() =>
				db.withExclusiveTransactionAsync((txn) => work(executorOf(txn))),
			),
	};
}
