import { QueryClient, skipToken } from '@tanstack/react-query';
import type { WorkerApi } from '@/services/api/worker-api';
import { queryKeys } from '@/services/query/query-keys';
import {
	assignmentRefreshOptions,
	refreshWorkerView,
	workerViewOptions,
} from '@/services/query/query-options';
import type { WorkerCacheStore } from '@/services/storage/worker-cache-store';
import type { QueuedAction } from '@/services/sync/sync-types';

let reads: string[] = [];
const cache = {
	read: async (workerId: string) => {
		reads.push(`cache:${workerId}`);
		return null;
	},
} as unknown as WorkerCacheStore;
const queue = {
	listAll: async (workerId: string) => {
		reads.push(`rows:${workerId}`);
		return [];
	},
};

beforeEach(() => {
	reads = [];
});

describe('workerViewOptions', () => {
	it('skips the read when nobody is signed in', () => {
		const options = workerViewOptions(cache, queue, null);
		expect(options.queryKey).toEqual(['worker-view', null]);
		expect(options.queryFn).toBe(skipToken);
	});

	it('reads the rows before the cache', async () => {
		const client = new QueryClient();
		const view = await client.fetchQuery(workerViewOptions(cache, queue, 'w1'));
		expect(reads).toEqual(['rows:w1', 'cache:w1']);
		expect(view).toEqual({ cache: null, rows: [] });
	});

	it.each(['before', 'between', 'after'] as const)(
		'never pairs a missing row with an unpatched cache when the delivery lands %s the reads',
		async (moment) => {
			const row = { clientActionId: 'a1' } as QueuedAction;
			let rows = [row];
			let accepted = false;
			const deliver = (): void => {
				accepted = true;
				rows = [];
			};
			const racingQueue = {
				listAll: async () => {
					const snapshot = rows;
					if (moment === 'between') {
						deliver();
					}
					return snapshot;
				},
			};
			const racingCache = {
				read: async () => {
					const snapshot = { accepted };
					if (moment === 'after') {
						deliver();
					}
					return snapshot;
				},
			} as unknown as WorkerCacheStore;
			if (moment === 'before') {
				deliver();
			}

			const view = await new QueryClient().fetchQuery(
				workerViewOptions(racingCache, racingQueue, 'w1'),
			);

			const patched =
				(view.cache as { accepted?: boolean } | null)?.accepted === true;
			expect(view.rows.length > 0 || patched).toBe(true);
		},
	);
});

describe('refreshWorkerView', () => {
	it('stores the fresh view when no screen is watching it', async () => {
		let rows = [{ clientActionId: 'a1' } as QueuedAction];
		const changingQueue = { listAll: async () => rows };
		const client = new QueryClient();
		const key = queryKeys.workerView.detail('w1');
		client.setQueryData(key, { cache: null, rows });
		rows = [];

		await refreshWorkerView(client, cache, changingQueue, 'w1');

		expect(client.getQueryData<{ rows: QueuedAction[] }>(key)?.rows).toEqual(
			[],
		);
	});
});

describe('assignmentRefreshOptions', () => {
	const ports = {
		api: {} as WorkerApi,
		cache,
		now: () => 0,
		onUnauthorized: () => undefined,
		token: () => null,
	};

	it('invalidates only the fetched worker cache (M10)', async () => {
		const client = new QueryClient();
		client.setQueryData(queryKeys.workerView.detail('w1'), null);
		client.setQueryData(queryKeys.workerView.detail('w2'), null);
		const outcome = await client.fetchQuery(
			assignmentRefreshOptions({
				expiresAt: 1,
				ports,
				queryClient: client,
				workerId: 'w1',
			}),
		);
		expect(outcome).toBe('skipped');
		expect(
			client.getQueryState(queryKeys.workerView.detail('w1'))?.isInvalidated,
		).toBe(true);
		expect(
			client.getQueryState(queryKeys.workerView.detail('w2'))?.isInvalidated,
		).toBe(false);
	});

	it('skips the fetch when nobody is signed in', () => {
		const options = assignmentRefreshOptions({
			expiresAt: null,
			ports,
			queryClient: new QueryClient(),
			workerId: null,
		});
		expect(options.queryFn).toBe(skipToken);
	});
});
