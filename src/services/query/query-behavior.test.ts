import {
	QueryClient,
	QueryObserver,
	type RefetchOptions,
	onlineManager,
} from '@tanstack/react-query';
import type { WorkerApi } from '@/services/api/worker-api';
import {
	assignmentRefreshOptions,
	pullRefetchOptions,
	workerViewOptions,
} from '@/services/query/query-options';
import type { WorkerCacheStore } from '@/services/storage/worker-cache-store';

let reads: string[] = [];
const cache = {
	read: async (workerId: string) => {
		reads.push(workerId);
		return null;
	},
} as unknown as WorkerCacheStore;
const queue = { listAll: async () => [] };

const assignmentFor = (client: QueryClient) =>
	assignmentRefreshOptions({
		expiresAt: 1,
		ports: {
			api: {} as WorkerApi,
			cache,
			now: () => 0,
			onUnauthorized: () => undefined,
			token: () => null,
		},
		queryClient: client,
		workerId: 'w1',
	});

beforeEach(() => {
	reads = [];
});

afterEach(() => {
	onlineManager.setOnline(true);
});

describe('offline behavior of the query factories', () => {
	it('pauses the assignment fetch while offline (M1)', () => {
		onlineManager.setOnline(false);
		const client = new QueryClient();
		const observer = new QueryObserver(client, assignmentFor(client));
		const unsubscribe = observer.subscribe(() => undefined);
		expect(observer.getCurrentResult().fetchStatus).toBe('paused');
		unsubscribe();
	});

	it('still reads the local view while offline (M1)', async () => {
		onlineManager.setOnline(false);
		const client = new QueryClient();
		const observer = new QueryObserver(
			client,
			workerViewOptions(cache, queue, 'w1'),
		);
		let markLoaded: () => void = () => undefined;
		const loaded = new Promise<void>((resolve) => {
			markLoaded = resolve;
		});
		const unsubscribe = observer.subscribe((result) => {
			if (result.status === 'success') {
				markLoaded();
			}
		});
		expect(observer.getCurrentResult().fetchStatus).toBe('fetching');
		await loaded;
		expect(reads).toEqual(['w1']);
		unsubscribe();
	});
});

describe('a refetch while another is in flight, with data cached', () => {
	const runPull = async (options: RefetchOptions) => {
		let calls = 0;
		const releases: (() => void)[] = [];
		const client = new QueryClient();
		const base = assignmentFor(client);
		client.setQueryData(base.queryKey, 'refreshed');
		const observer = new QueryObserver(client, {
			...base,
			queryFn: () => {
				calls += 1;
				return new Promise<'refreshed'>((resolve) => {
					releases.push(() => {
						resolve('refreshed');
					});
				});
			},
			refetchOnMount: false,
		});
		const unsubscribe = observer.subscribe(() => undefined);
		const automatic = observer.refetch();
		const pulled = observer.refetch(options);
		for (const release of releases) {
			release();
		}
		await Promise.allSettled([automatic, pulled]);
		unsubscribe();
		return calls;
	};

	it('joins the running fetch on pull', async () => {
		expect(await runPull(pullRefetchOptions)).toBe(1);
	});

	it('starts a second fetch when cancelling is on', async () => {
		expect(await runPull({ cancelRefetch: true })).toBe(2);
	});
});
