import { type CacheGateInput, cacheGateFor } from '@/services/query/cache-gate';
import { loadedQueue, queueLoading } from '@/services/runtime/queue-status';
import type { WorkerCache } from '@/services/storage/worker-cache-store';

const cached: WorkerCache = {
	assignment: {
		acceptedTermsVersionId: null,
		currentTerms: {
			id: 'terms-v2',
			publishedAt: '2026-02-01',
			summary: { en: 'English', es: 'Español' },
			version: 2,
		},
		documents: [],
		flags: {},
		order: {
			employer: 'Valle Verde Farms',
			id: 'JO-2026-0142',
			seasonEnd: '2026-07-31',
			seasonStart: '2026-03-01',
			worksite: 'Yuma, AZ',
		},
		requiredDocuments: ['passport'],
	},
	fetchedAt: 1,
	lastSeenTermsVersionId: null,
};

const base: CacheGateInput = {
	cache: cached,
	isOnline: true,
	queue: loadedQueue([]),
	refreshOutcome: 'refreshed',
};

describe('cacheGateFor', () => {
	it('waits while the cache is being read', () => {
		expect(cacheGateFor({ ...base, cache: undefined })).toEqual({
			kind: 'loading',
		});
	});

	it('waits for the queue', () => {
		expect(cacheGateFor({ ...base, queue: queueLoading })).toEqual({
			kind: 'loading',
		});
	});

	it('asks for a connection offline with nothing cached', () => {
		expect(
			cacheGateFor({
				...base,
				cache: null,
				isOnline: false,
				refreshOutcome: undefined,
			}),
		).toEqual({ kind: 'needs_connection' });
	});

	it('asks for a connection when the first fetch failed', () => {
		expect(
			cacheGateFor({ ...base, cache: null, refreshOutcome: 'kept_cache' }),
		).toEqual({ kind: 'needs_connection' });
	});

	it('says the server is not answering when the first fetch hit a server error online', () => {
		expect(
			cacheGateFor({ ...base, cache: null, refreshOutcome: 'server_error' }),
		).toEqual({ kind: 'server_unavailable' });
	});

	it('asks for a connection, not a server wait, when offline after a server error', () => {
		expect(
			cacheGateFor({
				...base,
				cache: null,
				isOnline: false,
				refreshOutcome: 'server_error',
			}),
		).toEqual({ kind: 'needs_connection' });
	});

	it.each([undefined, 'refreshed' as const, 'superseded' as const])(
		'keeps loading while the first fetch can still arrive (%s)',
		(refreshOutcome) => {
			expect(cacheGateFor({ ...base, cache: null, refreshOutcome })).toEqual({
				kind: 'loading',
			});
		},
	);

	it('is ready, offline too, once something is cached (M1)', () => {
		expect(
			cacheGateFor({ ...base, isOnline: false, refreshOutcome: undefined }),
		).toEqual({ cache: cached, kind: 'ready' });
	});
});
