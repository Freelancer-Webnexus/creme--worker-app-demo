import {
	type LogEntry,
	resetLoggerSink,
	setLoggerSink,
} from '@/services/logger/logger';
import { createQueueSnapshotStore } from '@/services/runtime/queue-snapshot-store';
import type { QueuedAction } from '@/services/sync/sync-types';
import { createMemoryQueueStore } from '@/services/sync/testing/memory-queue-store';

const action = (id: string, workerId: string): QueuedAction => ({
	attempts: 0,
	clientActionId: id,
	createdAt: 1,
	kind: { termsVersionId: 'v2', type: 'terms_acceptance' },
	nextAttemptAt: 0,
	status: { kind: 'queued' },
	workerId,
});

describe('queue snapshot store', () => {
	it('starts unloaded so a screen cannot claim everything is sent', () => {
		const store = createQueueSnapshotStore(createMemoryQueueStore());
		expect(store.getSnapshot()).toEqual({ kind: 'unloaded' });
	});

	it("loads the active worker's rows and notifies once", async () => {
		const queue = createMemoryQueueStore();
		await queue.insert(action('a', 'ana'));
		await queue.insert(action('b', 'bruno'));
		const store = createQueueSnapshotStore(queue);
		let notifications = 0;
		store.subscribe(() => {
			notifications += 1;
		});

		await store.refresh('ana');

		const snapshot = store.getSnapshot();
		expect(snapshot.kind).toBe('loaded');
		expect(snapshot.kind === 'loaded' && snapshot.rows).toHaveLength(1);
		expect(notifications).toBe(1);
	});

	it('does not notify when the rows did not change', async () => {
		const queue = createMemoryQueueStore();
		await queue.insert(action('a', 'ana'));
		const store = createQueueSnapshotStore(queue);
		await store.refresh('ana');
		const first = store.getSnapshot();
		let notifications = 0;
		store.subscribe(() => {
			notifications += 1;
		});

		await store.refresh('ana');

		expect(store.getSnapshot()).toBe(first);
		expect(notifications).toBe(0);
	});

	it('shows a new row after a refresh', async () => {
		const queue = createMemoryQueueStore();
		const store = createQueueSnapshotStore(queue);
		await store.refresh('ana');
		await queue.insert(action('a', 'ana'));

		await store.refresh('ana');

		const snapshot = store.getSnapshot();
		expect(snapshot.kind === 'loaded' && snapshot.rows).toHaveLength(1);
	});

	it('drops to unloaded at once when another worker takes over', async () => {
		const queue = createMemoryQueueStore();
		await queue.insert(action('a', 'ana'));
		const store = createQueueSnapshotStore(queue);
		await store.refresh('ana');

		const pending = store.refresh('bruno');
		expect(store.getSnapshot()).toEqual({ kind: 'unloaded' });
		await pending;

		expect(store.getSnapshot()).toEqual({
			kind: 'loaded',
			rows: [],
			workerId: 'bruno',
		});
	});

	it('goes back to unloaded when nobody is signed in', async () => {
		const queue = createMemoryQueueStore();
		const store = createQueueSnapshotStore(queue);
		await store.refresh('ana');

		await store.refresh(null);

		expect(store.getSnapshot()).toEqual({ kind: 'unloaded' });
	});

	it('ignores a read that finished after a newer request', async () => {
		let release: (rows: QueuedAction[]) => void = () => undefined;
		const slow = new Promise<QueuedAction[]>((resolve) => {
			release = resolve;
		});
		const store = createQueueSnapshotStore({
			listAll: (workerId) => (workerId === 'ana' ? slow : Promise.resolve([])),
		});

		const first = store.refresh('ana');
		await store.refresh('bruno');
		release([action('late', 'ana')]);
		await first;

		expect(store.getSnapshot()).toEqual({
			kind: 'loaded',
			rows: [],
			workerId: 'bruno',
		});
	});

	it('keeps the old rows and logs a warning when a read fails', async () => {
		const entries: LogEntry[] = [];
		setLoggerSink((entry) => entries.push(entry));
		const queue = createMemoryQueueStore();
		await queue.insert(action('a', 'ana'));
		let failing = false;
		const store = createQueueSnapshotStore({
			listAll: (workerId) =>
				failing ? Promise.reject(new Error('disk')) : queue.listAll(workerId),
		});
		await store.refresh('ana');
		const before = store.getSnapshot();
		failing = true;

		await store.refresh('ana');
		resetLoggerSink();

		expect(store.getSnapshot()).toBe(before);
		expect(entries.map((entry) => entry.level)).toEqual(['warn']);
	});
});
