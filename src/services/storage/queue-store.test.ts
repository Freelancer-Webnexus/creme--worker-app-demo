import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createQueueStore } from '@/services/storage/queue-store';
import { migrate } from '@/services/storage/schema';
import {
	type BunSqliteDriver,
	openBunSqliteDriver,
} from '@/services/storage/testing/bun-sqlite-driver';
import type { QueuedAction } from '@/services/sync/sync-types';

function terms(id: string, workerId = 'w1', createdAt = 100): QueuedAction {
	return {
		clientActionId: id,
		workerId,
		kind: { type: 'terms_acceptance', termsVersionId: 'tv2' },
		status: { kind: 'queued' },
		createdAt,
		attempts: 0,
		nextAttemptAt: createdAt,
	};
}

function upload(id: string, workerId = 'w1', createdAt = 100): QueuedAction {
	return {
		clientActionId: id,
		workerId,
		kind: {
			type: 'document_upload',
			documentType: 'passport',
			fileUri: 'file:///uploads/a.jpg',
		},
		status: { kind: 'queued' },
		createdAt,
		attempts: 0,
		nextAttemptAt: createdAt,
	};
}

describe('queue store', () => {
	let driver: BunSqliteDriver;
	let store: ReturnType<typeof createQueueStore>;

	beforeEach(async () => {
		driver = openBunSqliteDriver(':memory:');
		await migrate(driver);
		store = createQueueStore(driver);
	});

	afterEach(() => {
		driver.close();
	});

	it('round-trips both action kinds', async () => {
		const a = terms('a', 'w1', 1);
		const b = upload('b', 'w1', 2);
		await store.insert(a);
		await store.insert(b);
		expect(await store.listAll('w1')).toEqual([a, b]);
	});

	it('keeps insert order for equal created_at, whatever the ids are', async () => {
		await store.insert(terms('c'));
		await store.insert(terms('a'));
		await store.insert(terms('b'));
		const all = (await store.listAll('w1')).map((a) => a.clientActionId);
		const ready = (await store.listReady('w1', 1_000)).map(
			(a) => a.clientActionId,
		);
		expect(all).toEqual(['c', 'a', 'b']);
		expect(ready).toEqual(['c', 'a', 'b']);
	});

	it('listReady excludes not-yet-due and failed rows', async () => {
		await store.insert({ ...terms('due', 'w1', 1), nextAttemptAt: 50 });
		await store.insert({ ...terms('later', 'w1', 2), nextAttemptAt: 500 });
		await store.insert(terms('failed', 'w1', 3));
		await store.markFailed('failed', 'rejected');
		const ready = await store.listReady('w1', 100);
		expect(ready.map((a) => a.clientActionId)).toEqual(['due']);
	});

	it('records an attempt', async () => {
		await store.insert(terms('a'));
		await store.recordAttempt('a', 3, 900);
		const [action] = await store.listAll('w1');
		expect(action?.attempts).toBe(3);
		expect(action?.nextAttemptAt).toBe(900);
		expect(await store.listReady('w1', 899)).toEqual([]);
		expect(await store.listReady('w1', 900)).toHaveLength(1);
	});

	it('makeDueNow makes only queued rows of that worker due and keeps attempts', async () => {
		await store.insert({ ...terms('waiting', 'w1', 1), nextAttemptAt: 9_000 });
		await store.recordAttempt('waiting', 4, 9_000);
		await store.insert({ ...terms('failed', 'w1', 2), nextAttemptAt: 9_000 });
		await store.markFailed('failed', 'rejected');
		await store.insert({ ...terms('other', 'w2', 3), nextAttemptAt: 9_000 });

		await store.makeDueNow('w1', 500);

		const [waiting, failed] = await store.listAll('w1');
		expect(waiting).toMatchObject({ attempts: 4, nextAttemptAt: 500 });
		expect(failed).toMatchObject({
			status: { kind: 'failed', reason: 'rejected' },
			nextAttemptAt: 9_000,
		});
		expect((await store.listAll('w2'))[0]?.nextAttemptAt).toBe(9_000);
		expect(
			(await store.listReady('w1', 500)).map((a) => a.clientActionId),
		).toEqual(['waiting']);
	});

	it('markFailed keeps the row in listAll with its reason', async () => {
		await store.insert(upload('a'));
		await store.markFailed('a', 'too_large');
		expect(await store.listReady('w1', 1_000)).toEqual([]);
		const [action] = await store.listAll('w1');
		expect(action?.status).toEqual({ kind: 'failed', reason: 'too_large' });
	});

	it('removes a row', async () => {
		await store.insert(terms('a'));
		await store.insert(terms('b'));
		await store.remove('a');
		const ids = (await store.listAll('w1')).map((a) => a.clientActionId);
		expect(ids).toEqual(['b']);
	});

	it('keeps two workers separate (M10)', async () => {
		await store.insert(terms('a', 'w1'));
		await store.insert(upload('b', 'w2'));
		expect((await store.listAll('w1')).map((a) => a.clientActionId)).toEqual([
			'a',
		]);
		expect((await store.listAll('w2')).map((a) => a.clientActionId)).toEqual([
			'b',
		]);
		expect(await store.listReady('w1', 1_000)).toHaveLength(1);
		expect((await store.listReady('w2', 1_000))[0]?.clientActionId).toBe('b');
	});

	it('rejects a duplicate clientActionId', async () => {
		await store.insert(terms('a'));
		await expect(store.insert(terms('a'))).rejects.toThrow();
	});
});

describe('queue store on a file database (M2)', () => {
	let directory: string;

	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'creme-queue-'));
	});

	afterEach(async () => {
		await rm(directory, { recursive: true, force: true });
	});

	it('keeps queued actions after the database is closed and reopened', async () => {
		const path = join(directory, 'creme.db');
		const a = terms('a', 'w1', 1);
		const b = upload('b', 'w1', 2);

		const first = openBunSqliteDriver(path);
		await migrate(first);
		const firstStore = createQueueStore(first);
		await firstStore.insert(a);
		await firstStore.insert(b);
		first.close();

		const second = openBunSqliteDriver(path);
		await migrate(second);
		const restored = await createQueueStore(second).listAll('w1');
		second.close();

		expect(restored).toEqual([a, b]);
	});
});
