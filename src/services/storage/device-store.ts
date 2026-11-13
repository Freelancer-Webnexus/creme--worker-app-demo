import type { SqlDriver } from '@/services/storage/sql-driver';

export type DeviceKey = 'language' | 'last_phone' | 'last_worker_id';

export type DeviceStore = {
	get: (key: DeviceKey) => Promise<string | null>;
	set: (key: DeviceKey, value: string) => Promise<void>;
	remove: (key: DeviceKey) => Promise<void>;
};

export function createDeviceStore(driver: SqlDriver): DeviceStore {
	return {
		get: async (key) => {
			const rows = await driver.all<{ value: string }>(
				`SELECT value FROM device WHERE key = ?`,
				[key],
			);
			return rows[0]?.value ?? null;
		},
		set: (key, value) =>
			driver.run(
				`INSERT INTO device (key, value) VALUES (?, ?)
				 ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
				[key, value],
			),
		remove: (key) => driver.run(`DELETE FROM device WHERE key = ?`, [key]),
	};
}
