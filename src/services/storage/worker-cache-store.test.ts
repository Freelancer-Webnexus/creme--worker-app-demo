import type { Assignment, TermsVersion } from '@/services/api/api-types';
import { migrate } from '@/services/storage/schema';
import {
	type BunSqliteDriver,
	openBunSqliteDriver,
} from '@/services/storage/testing/bun-sqlite-driver';
import { createWorkerCacheStore } from '@/services/storage/worker-cache-store';

const terms2: TermsVersion = {
	id: 'tv2',
	version: 2,
	publishedAt: '2026-01-01',
	summary: { es: 'dos', en: 'two' },
};

const terms3: TermsVersion = { ...terms2, id: 'tv3', version: 3 };

const assignment: Assignment = {
	order: {
		id: 'o1',
		employer: 'Farm',
		worksite: 'Field',
		seasonStart: '2026-03-01',
		seasonEnd: '2026-09-01',
	},
	currentTerms: terms2,
	acceptedTermsVersionId: null,
	requiredDocuments: ['passport'],
	documents: [],
	flags: {},
};

describe('worker cache store', () => {
	let driver: BunSqliteDriver;
	let store: ReturnType<typeof createWorkerCacheStore>;
	let nowMs: number;

	const patchedAt = async (workerId: string) =>
		(
			await driver.all<{ patched_at: number }>(
				'SELECT patched_at FROM worker_cache WHERE worker_id = ?',
				[workerId],
			)
		)[0]?.patched_at;

	beforeEach(async () => {
		nowMs = 100;
		driver = openBunSqliteDriver(':memory:');
		await migrate(driver);
		store = createWorkerCacheStore(driver, { now: () => nowMs });
	});

	afterEach(() => {
		driver.close();
	});

	it('reads null when empty', async () => {
		expect(await store.read('w1')).toBeNull();
	});

	it('saves and reads an assignment', async () => {
		await store.saveAssignment('w1', assignment, 7);
		expect(await store.read('w1')).toEqual({
			assignment,
			lastSeenTermsVersionId: null,
			fetchedAt: 7,
		});
	});

	it('saveAssignment keeps lastSeenTermsVersionId', async () => {
		await store.saveAssignment('w1', assignment, 7);
		await store.markTermsSeen('w1', 'tv2');
		await store.saveAssignment('w1', { ...assignment, flags: { a: true } }, 9);
		const cache = await store.read('w1');
		expect(cache?.lastSeenTermsVersionId).toBe('tv2');
		expect(cache?.fetchedAt).toBe(9);
		expect(cache?.assignment.flags).toEqual({ a: true });
	});

	it('applyTermsAccepted changes only the accepted id', async () => {
		await store.saveAssignment('w1', assignment, 7);
		await store.applyTermsAccepted('w1', 'tv2');
		expect(await store.read('w1')).toEqual({
			assignment: { ...assignment, acceptedTermsVersionId: 'tv2' },
			lastSeenTermsVersionId: null,
			fetchedAt: 7,
		});
	});

	it('applyCurrentTerms replaces current terms and keeps the accepted id', async () => {
		await store.saveAssignment('w1', assignment, 7);
		await store.applyTermsAccepted('w1', 'tv2');
		await store.applyCurrentTerms('w1', terms3);
		const cache = await store.read('w1');
		expect(cache?.assignment.currentTerms).toEqual(terms3);
		expect(cache?.assignment.acceptedTermsVersionId).toBe('tv2');
	});

	it('applyDocumentPendingReview marks that document only', async () => {
		await store.saveAssignment('w1', assignment, 7);
		await store.applyDocumentPendingReview('w1', 'passport');
		const cache = await store.read('w1');
		expect(cache?.assignment.documents).toEqual([
			{ documentType: 'passport', state: 'pending_review' },
		]);
		expect(cache?.assignment.acceptedTermsVersionId).toBeNull();
	});

	it('apply functions are no-ops without a row', async () => {
		await store.applyTermsAccepted('w1', 'tv2');
		await store.applyCurrentTerms('w1', terms3);
		await store.applyDocumentPendingReview('w1', 'passport');
		await store.markTermsSeen('w1', 'tv2');
		expect(await store.read('w1')).toBeNull();
	});

	it('M2 two patches issued at once both land', async () => {
		await store.saveAssignment('w1', assignment, 7);

		await Promise.all([
			store.applyTermsAccepted('w1', 'tv2'),
			store.applyDocumentPendingReview('w1', 'passport'),
		]);

		const cache = await store.read('w1');
		expect(cache?.assignment.acceptedTermsVersionId).toBe('tv2');
		expect(cache?.assignment.documents).toEqual([
			{ documentType: 'passport', state: 'pending_review' },
		]);
	});

	it('saveAssignment reports that the first save of a worker was applied', async () => {
		expect(await store.saveAssignment('w1', assignment, 7)).toBe(true);
	});

	it.each([
		[
			'applyTermsAccepted',
			(s: typeof store) => s.applyTermsAccepted('w1', 'tv2'),
		],
		[
			'applyCurrentTerms',
			(s: typeof store) => s.applyCurrentTerms('w1', terms3),
		],
		[
			'applyDocumentPendingReview',
			(s: typeof store) => s.applyDocumentPendingReview('w1', 'passport'),
		],
	])('%s stamps patched_at with the injected clock', async (_name, apply) => {
		await store.saveAssignment('w1', assignment, 7);
		expect(await patchedAt('w1')).toBe(0);

		nowMs = 250;
		await apply(store);

		expect(await patchedAt('w1')).toBe(250);
	});

	describe('M3 M4 a fetch never overwrites a newer local server fact', () => {
		it('discards a save whose request started before the last patch', async () => {
			await store.saveAssignment('w1', assignment, 7);
			nowMs = 200;
			await store.applyDocumentPendingReview('w1', 'passport');

			const applied = await store.saveAssignment('w1', assignment, 199);

			expect(applied).toBe(false);
			const cache = await store.read('w1');
			expect(cache?.assignment.documents).toEqual([
				{ documentType: 'passport', state: 'pending_review' },
			]);
			expect(cache?.fetchedAt).toBe(7);
		});

		it('applies a save whose request started at or after the last patch', async () => {
			await store.saveAssignment('w1', assignment, 7);
			nowMs = 200;
			await store.applyDocumentPendingReview('w1', 'passport');

			expect(await store.saveAssignment('w1', assignment, 200)).toBe(true);

			const cache = await store.read('w1');
			expect(cache?.assignment.documents).toEqual([]);
			expect(cache?.fetchedAt).toBe(200);
		});

		it('keeps two workers independent', async () => {
			await store.saveAssignment('w1', assignment, 7);
			await store.saveAssignment('w2', assignment, 7);
			nowMs = 200;
			await store.applyDocumentPendingReview('w1', 'passport');

			expect(await store.saveAssignment('w2', assignment, 50)).toBe(true);
			expect(await store.saveAssignment('w1', assignment, 50)).toBe(false);
			expect((await store.read('w2'))?.fetchedAt).toBe(50);
			expect((await store.read('w1'))?.fetchedAt).toBe(7);
		});
	});

	describe('saveAssignment racing a patch', () => {
		const fresh: Assignment = {
			...assignment,
			requiredDocuments: ['passport', 'signed_contract'],
			flags: { fresh: true },
		};

		it('a patch issued first beats a snapshot whose request started before it', async () => {
			await store.saveAssignment('w1', assignment, 7);

			await Promise.all([
				store.applyTermsAccepted('w1', 'tv2'),
				store.saveAssignment('w1', fresh, 9),
			]);

			const cache = await store.read('w1');
			expect(cache?.assignment).toEqual({
				...assignment,
				acceptedTermsVersionId: 'tv2',
			});
			expect(cache?.fetchedAt).toBe(7);
		});

		it('a patch issued first is followed by a snapshot that started after it, which wins the whole row', async () => {
			await store.saveAssignment('w1', assignment, 7);

			await Promise.all([
				store.applyTermsAccepted('w1', 'tv2'),
				store.saveAssignment('w1', fresh, 100),
			]);

			const cache = await store.read('w1');
			expect(cache?.assignment).toEqual(fresh);
			expect(cache?.fetchedAt).toBe(100);
		});

		it('a patch issued second edits the fresh row and keeps the fields it does not own', async () => {
			await store.saveAssignment('w1', assignment, 7);

			await Promise.all([
				store.saveAssignment('w1', fresh, 9),
				store.applyTermsAccepted('w1', 'tv2'),
			]);

			const cache = await store.read('w1');
			expect(cache?.assignment).toEqual({
				...fresh,
				acceptedTermsVersionId: 'tv2',
			});
		});
	});

	it('keeps two workers separate (M10)', async () => {
		await store.saveAssignment('w1', assignment, 1);
		await store.saveAssignment('w2', assignment, 2);
		await store.applyTermsAccepted('w1', 'tv2');
		expect((await store.read('w1'))?.assignment.acceptedTermsVersionId).toBe(
			'tv2',
		);
		expect(
			(await store.read('w2'))?.assignment.acceptedTermsVersionId,
		).toBeNull();
	});
});
