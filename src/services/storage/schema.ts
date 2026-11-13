import type { SqlDriver } from '@/services/storage/sql-driver';

// One statement per entry: a transaction only offers `run`, which executes one.
const migrations: string[][] = [
	[
		`CREATE TABLE queue (
			client_action_id TEXT PRIMARY KEY,
			worker_id TEXT NOT NULL,
			action_type TEXT NOT NULL CHECK (action_type IN ('terms_acceptance', 'document_upload')),
			terms_version_id TEXT,
			document_type TEXT,
			file_uri TEXT,
			status TEXT NOT NULL CHECK (status IN ('queued', 'failed')),
			failure_reason TEXT,
			created_at INTEGER NOT NULL,
			attempts INTEGER NOT NULL,
			next_attempt_at INTEGER NOT NULL
		)`,
		`CREATE INDEX queue_worker_status_created ON queue (worker_id, status, created_at)`,
		`CREATE TABLE worker_cache (
			worker_id TEXT PRIMARY KEY,
			assignment_json TEXT NOT NULL,
			last_seen_terms_version_id TEXT,
			fetched_at INTEGER NOT NULL,
			patched_at INTEGER NOT NULL DEFAULT 0
		)`,
		`CREATE TABLE device (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		)`,
	],
];

async function readVersion(driver: SqlDriver): Promise<number> {
	const rows = await driver.all<{ user_version: number }>(
		'PRAGMA user_version',
	);
	return rows[0]?.user_version ?? 0;
}

export async function migrate(driver: SqlDriver): Promise<void> {
	const current = await readVersion(driver);
	for (let index = current; index < migrations.length; index += 1) {
		const statements = migrations[index];
		if (statements === undefined) continue;
		await driver.transaction(async (tx) => {
			for (const statement of statements) {
				await tx.run(statement);
			}
			await tx.run(`PRAGMA user_version = ${index + 1}`);
		});
	}
}
