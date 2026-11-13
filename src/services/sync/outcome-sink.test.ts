import type { Assignment, TermsVersion } from '@/services/api/api-types';
import { migrate } from '@/services/storage/schema';
import {
	type BunSqliteDriver,
	openBunSqliteDriver,
} from '@/services/storage/testing/bun-sqlite-driver';
import {
	createWorkerCacheStore,
	type WorkerCacheStore,
} from '@/services/storage/worker-cache-store';
import {
	createOutcomeSink,
	type OutcomeSinkOptions,
} from '@/services/sync/outcome-sink';
import type { QueuedAction } from '@/services/sync/sync-types';

const termsV2: TermsVersion = {
	id: 'terms-v2',
	version: 2,
	publishedAt: 'x',
	summary: { es: 'a', en: 'b' },
};
const termsV3: TermsVersion = { ...termsV2, id: 'terms-v3', version: 3 };

const assignment: Assignment = {
	order: {
		id: 'JO',
		employer: 'e',
		worksite: 'w',
		seasonStart: '2026-03-01',
		seasonEnd: '2026-07-31',
	},
	currentTerms: termsV2,
	acceptedTermsVersionId: null,
	requiredDocuments: ['passport'],
	documents: [],
	flags: {},
};

const action = (kind: QueuedAction['kind']): QueuedAction => ({
	clientActionId: 'a1',
	workerId: 'worker-ana',
	kind,
	status: { kind: 'queued' },
	createdAt: 1,
	attempts: 0,
	nextAttemptAt: 0,
});

const termsAction = action({
	type: 'terms_acceptance',
	termsVersionId: 'terms-v2',
});
const uploadAction = action({
	type: 'document_upload',
	documentType: 'passport',
	fileUri: 'file:///uploads/p.jpg',
});

let driver: BunSqliteDriver;
let cache: WorkerCacheStore;

beforeEach(async () => {
	driver = openBunSqliteDriver(':memory:');
	await migrate(driver);
	cache = createWorkerCacheStore(driver, { now: () => 5 });
	await cache.saveAssignment('worker-ana', assignment, 1);
});

afterEach(() => {
	driver.close();
});

const makeSink = (overrides: Partial<OutcomeSinkOptions> = {}) =>
	createOutcomeSink({
		cache,
		deleteUpload: async () => {},
		onServerFactChanged: () => {},
		...overrides,
	});

describe('outcome sink', () => {
	it('caches the accepted version when a terms acceptance is delivered', async () => {
		const sink = makeSink();

		await sink.delivered(termsAction);

		expect(
			(await cache.read('worker-ana'))?.assignment.acceptedTermsVersionId,
		).toBe('terms-v2');
	});

	it('marks the document pending review and leaves the file for the engine to discard on a delivered upload', async () => {
		const deleted: string[] = [];
		const sink = makeSink({
			deleteUpload: async (uri) => {
				deleted.push(uri);
			},
		});

		await sink.delivered(uploadAction);

		expect((await cache.read('worker-ana'))?.assignment.documents).toEqual([
			{ documentType: 'passport', state: 'pending_review' },
		]);
		expect(deleted).toEqual([]);
	});

	it('caches the current terms on stale terms and leaves the accepted id', async () => {
		const sink = makeSink();

		await sink.staleTerms(termsAction, termsV3);

		const cached = await cache.read('worker-ana');
		expect(cached?.assignment.currentTerms).toEqual(termsV3);
		expect(cached?.assignment.acceptedTermsVersionId).toBeNull();
	});

	describe('M3 M4 tells the app that a server fact changed, after the cache holds it', () => {
		const watch = () => {
			const events: string[] = [];
			const spyCache: WorkerCacheStore = {
				...cache,
				applyTermsAccepted: async (workerId, termsVersionId) => {
					await cache.applyTermsAccepted(workerId, termsVersionId);
					events.push('cache');
				},
				applyDocumentPendingReview: async (workerId, documentType) => {
					await cache.applyDocumentPendingReview(workerId, documentType);
					events.push('cache');
				},
				applyCurrentTerms: async (workerId, currentTerms) => {
					await cache.applyCurrentTerms(workerId, currentTerms);
					events.push('cache');
				},
			};
			const sink = makeSink({
				cache: spyCache,
				onServerFactChanged: () => {
					events.push('changed');
				},
			});
			return { events, sink };
		};

		it('after a delivered terms acceptance', async () => {
			const { events, sink } = watch();
			await sink.delivered(termsAction);
			expect(events).toEqual(['cache', 'changed']);
		});

		it('after a delivered upload', async () => {
			const { events, sink } = watch();
			await sink.delivered(uploadAction);
			expect(events).toEqual(['cache', 'changed']);
		});

		it('after stale terms', async () => {
			const { events, sink } = watch();
			await sink.staleTerms(termsAction, termsV3);
			expect(events).toEqual(['cache', 'changed']);
		});

		it('not for a rejection or a discard', async () => {
			const { events, sink } = watch();
			await sink.rejected(uploadAction, 'too_large');
			await sink.discarded(uploadAction);
			expect(events).toEqual([]);
		});
	});

	it('deletes the upload file of a discarded upload and ignores a delete failure', async () => {
		const deleted: string[] = [];
		const sink = makeSink({
			deleteUpload: async (uri) => {
				deleted.push(uri);
			},
		});
		const failing = makeSink({
			deleteUpload: async () => {
				throw new Error('disk');
			},
		});

		await sink.discarded(uploadAction);
		await failing.discarded(uploadAction);

		expect(deleted).toEqual(['file:///uploads/p.jpg']);
	});

	it('deletes nothing for a discarded terms acceptance', async () => {
		const deleted: string[] = [];
		const sink = makeSink({
			deleteUpload: async (uri) => {
				deleted.push(uri);
			},
		});

		await sink.discarded(termsAction);

		expect(deleted).toEqual([]);
	});

	it('changes nothing in the cache and keeps the file when rejected', async () => {
		const deleted: string[] = [];
		const sink = makeSink({
			deleteUpload: async (uri) => {
				deleted.push(uri);
			},
		});

		await sink.rejected(uploadAction, 'too_large');

		expect((await cache.read('worker-ana'))?.assignment).toEqual(assignment);
		expect(deleted).toEqual([]);
	});
});
