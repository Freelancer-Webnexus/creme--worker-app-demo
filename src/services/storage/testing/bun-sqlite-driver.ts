import { Database } from 'bun:sqlite';
import { createSerialGate } from '@/services/storage/serial-gate';
import type {
	SqlDriver,
	SqlExecutor,
	SqlValue,
} from '@/services/storage/sql-driver';

export type BunSqliteDriver = SqlDriver & { close: () => void };

export function openBunSqliteDriver(path: string): BunSqliteDriver {
	const db = new Database(path);
	db.exec('PRAGMA journal_mode = WAL');
	db.exec('PRAGMA synchronous = NORMAL');
	// Same guarantee as expo's exclusive transaction: while a transaction is open,
	// no other statement runs on this connection, so none can join it.
	const gate = createSerialGate();
	const executor: SqlExecutor = {
		run: async (sql, params = []) => {
			db.query(sql).run(...params);
		},
		all: async <TRow>(sql: string, params: SqlValue[] = []) =>
			db.query(sql).all(...params) as TRow[],
	};
	return {
		exec: (sql) =>
			gate(async () => {
				db.exec(sql);
			}),
		run: (sql, params) => gate(() => executor.run(sql, params)),
		all: <TRow>(sql: string, params?: SqlValue[]) =>
			gate(() => executor.all<TRow>(sql, params)),
		transaction: (work) =>
			gate(async () => {
				db.exec('BEGIN IMMEDIATE');
				try {
					await work(executor);
				} catch (error) {
					db.exec('ROLLBACK');
					throw error;
				}
				db.exec('COMMIT');
			}),
		close: () => {
			db.close();
		},
	};
}
