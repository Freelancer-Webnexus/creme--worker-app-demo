import { migrate } from '@/services/storage/schema';
import {
	type BunSqliteDriver,
	openBunSqliteDriver,
} from '@/services/storage/testing/bun-sqlite-driver';

describe('migrate', () => {
	let driver: BunSqliteDriver;

	beforeEach(() => {
		driver = openBunSqliteDriver(':memory:');
	});

	afterEach(() => {
		driver.close();
	});

	it('sets user_version to 1', async () => {
		await migrate(driver);
		const rows = await driver.all<{ user_version: number }>(
			'PRAGMA user_version',
		);
		expect(rows[0]?.user_version).toBe(1);
	});

	it('is a no-op the second time', async () => {
		await migrate(driver);
		await driver.run(
			`INSERT INTO device (key, value) VALUES ('language', 'es')`,
		);
		await migrate(driver);
		const rows = await driver.all<{ value: string }>(
			'SELECT value FROM device',
		);
		expect(rows).toEqual([{ value: 'es' }]);
	});

	it('creates the three tables', async () => {
		await migrate(driver);
		const rows = await driver.all<{ name: string }>(
			`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
		);
		expect(rows.map((row) => row.name)).toEqual([
			'device',
			'queue',
			'worker_cache',
		]);
	});

	it('gives worker_cache a patched_at that defaults to 0', async () => {
		await migrate(driver);
		await driver.run(
			`INSERT INTO worker_cache (worker_id, assignment_json, fetched_at)
			 VALUES ('w', '{}', 1)`,
		);
		const rows = await driver.all<{ patched_at: number }>(
			'SELECT patched_at FROM worker_cache',
		);
		expect(rows).toEqual([{ patched_at: 0 }]);
	});

	it('rejects a status outside the CHECK constraint', async () => {
		await migrate(driver);
		await expect(
			driver.run(
				`INSERT INTO queue (client_action_id, worker_id, action_type, status, created_at, attempts, next_attempt_at)
				 VALUES ('a', 'w', 'terms_acceptance', 'sending', 1, 0, 1)`,
			),
		).rejects.toThrow();
	});

	it('rejects an action_type outside the CHECK constraint', async () => {
		await migrate(driver);
		await expect(
			driver.run(
				`INSERT INTO queue (client_action_id, worker_id, action_type, status, created_at, attempts, next_attempt_at)
				 VALUES ('a', 'w', 'other', 'queued', 1, 0, 1)`,
			),
		).rejects.toThrow();
	});
});
