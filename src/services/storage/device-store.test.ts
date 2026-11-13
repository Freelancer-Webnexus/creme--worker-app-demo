import { createDeviceStore } from '@/services/storage/device-store';
import { migrate } from '@/services/storage/schema';
import {
	type BunSqliteDriver,
	openBunSqliteDriver,
} from '@/services/storage/testing/bun-sqlite-driver';

describe('device store', () => {
	let driver: BunSqliteDriver;
	let store: ReturnType<typeof createDeviceStore>;

	beforeEach(async () => {
		driver = openBunSqliteDriver(':memory:');
		await migrate(driver);
		store = createDeviceStore(driver);
	});

	afterEach(() => {
		driver.close();
	});

	it('returns null for a missing key', async () => {
		expect(await store.get('language')).toBeNull();
	});

	it('sets, overwrites and removes a value', async () => {
		await store.set('language', 'es');
		expect(await store.get('language')).toBe('es');
		await store.set('language', 'en');
		expect(await store.get('language')).toBe('en');
		await store.remove('language');
		expect(await store.get('language')).toBeNull();
	});

	it('keeps keys independent', async () => {
		await store.set('last_phone', '+10000000000');
		await store.set('last_worker_id', 'w1');
		expect(await store.get('last_phone')).toBe('+10000000000');
		expect(await store.get('last_worker_id')).toBe('w1');
	});
});
