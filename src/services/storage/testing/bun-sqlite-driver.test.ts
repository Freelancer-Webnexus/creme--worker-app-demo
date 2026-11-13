import { migrate } from '@/services/storage/schema';
import {
	type BunSqliteDriver,
	openBunSqliteDriver,
} from '@/services/storage/testing/bun-sqlite-driver';

const insertDevice = (key: string) =>
	`INSERT INTO device (key, value) VALUES ('${key}', 'x')`;

describe('bun sqlite driver transactions', () => {
	let driver: BunSqliteDriver;

	const keys = async () =>
		(
			await driver.all<{ key: string }>('SELECT key FROM device ORDER BY key')
		).map((row) => row.key);

	beforeEach(async () => {
		driver = openBunSqliteDriver(':memory:');
		await migrate(driver);
	});

	afterEach(() => {
		driver.close();
	});

	it('commits what the work wrote through tx', async () => {
		await driver.transaction(async (tx) => {
			await tx.run(insertDevice('a'));
			await tx.run(insertDevice('b'));
		});

		expect(await keys()).toEqual(['a', 'b']);
	});

	it('rolls back everything when the work throws', async () => {
		await expect(
			driver.transaction(async (tx) => {
				await tx.run(insertDevice('a'));
				throw new Error('boom');
			}),
		).rejects.toThrow('boom');

		expect(await keys()).toEqual([]);
	});

	it('M2 a run issued while a transaction is open is not rolled back with it', async () => {
		const failing = driver.transaction(async (tx) => {
			await tx.run(insertDevice('inside'));
			await Promise.resolve();
			await Promise.resolve();
			throw new Error('boom');
		});
		const outside = driver.run(insertDevice('outside'));

		await expect(failing).rejects.toThrow('boom');
		await outside;

		expect(await keys()).toEqual(['outside']);
	});

	it('a read issued while a transaction is open waits for the commit', async () => {
		const writing = driver.transaction(async (tx) => {
			await tx.run(insertDevice('a'));
			await Promise.resolve();
			await tx.run(insertDevice('b'));
		});
		const reading = keys();

		await writing;

		expect(await reading).toEqual(['a', 'b']);
	});

	it('M2 a call on the driver from inside the work waits for its own transaction, so the work must use tx', async () => {
		const settled = driver
			.transaction(async () => {
				await driver.run(insertDevice('inside'));
			})
			.then(() => 'finished');
		const timeout = new Promise<string>((resolve) => {
			setTimeout(() => {
				resolve('still waiting');
			}, 50);
		});

		expect(await Promise.race([settled, timeout])).toBe('still waiting');
	});

	it('keeps working after a transaction failed', async () => {
		await expect(
			driver.transaction(async () => {
				throw new Error('boom');
			}),
		).rejects.toThrow('boom');

		await driver.transaction(async (tx) => {
			await tx.run(insertDevice('a'));
		});

		expect(await keys()).toEqual(['a']);
	});
});
