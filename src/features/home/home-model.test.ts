import {
	buildHomeBody,
	firstNameOf,
	type HomeBodyInput,
	termsLineFor,
} from '@/features/home/home-model';
import type { Assignment } from '@/services/api/api-types';
import { loadedQueue, queueLoading } from '@/services/runtime/queue-status';
import type { WorkerCache } from '@/services/storage/worker-cache-store';
import type { QueuedAction } from '@/services/sync/sync-types';

const terms = {
	id: 'terms-v2',
	publishedAt: '2026-02-01',
	summary: { en: 'English', es: 'Español' },
	version: 2,
};

const assignment: Assignment = {
	acceptedTermsVersionId: null,
	currentTerms: terms,
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
};

const cache: WorkerCache = {
	assignment,
	fetchedAt: 1,
	lastSeenTermsVersionId: null,
};

const base: HomeBodyInput = {
	cache,
	isOnline: true,
	queue: loadedQueue([]),
	refreshOutcome: 'refreshed',
};

const acceptance: QueuedAction = {
	attempts: 0,
	clientActionId: 'a1',
	createdAt: 1,
	kind: { termsVersionId: 'terms-v2', type: 'terms_acceptance' },
	nextAttemptAt: 0,
	status: { kind: 'queued' },
	workerId: 'w1',
};

describe('firstNameOf', () => {
	it.each([
		['Ana López', 'Ana'],
		['  Bruno   Díaz ', 'Bruno'],
		['Carla', 'Carla'],
		['', ''],
		['   ', ''],
	])('%j gives %j', (fullName, expected) => {
		expect(firstNameOf(fullName)).toBe(expected);
	});
});

describe('termsLineFor', () => {
	it('is green only for terms the server confirmed', () => {
		expect(termsLineFor({ kind: 'confirmed', version: terms })).toEqual({
			role: 'approved',
			textKey: 'home.terms_confirmed',
		});
	});

	it('is amber and says so while the acceptance is only on this phone', () => {
		expect(termsLineFor({ kind: 'pending_sync', version: terms })).toEqual({
			role: 'pending_sync',
			textKey: 'home.terms_pending_sync',
		});
	});

	it('asks for confirmation, and says when the terms changed', () => {
		expect(
			termsLineFor({
				changedSinceLastSeen: false,
				kind: 'needs_confirmation',
				version: terms,
			}),
		).toEqual({ role: 'neutral', textKey: 'home.terms_needs_confirmation' });
		expect(
			termsLineFor({
				changedSinceLastSeen: true,
				kind: 'needs_confirmation',
				version: terms,
			}),
		).toEqual({ role: 'correction', textKey: 'terms.changed' });
	});

	it('is red when the confirmation could not be sent', () => {
		expect(
			termsLineFor({
				changedSinceLastSeen: false,
				kind: 'rejected',
				version: terms,
			}),
		).toEqual({ role: 'failed', textKey: 'home.terms_rejected' });
	});
});

describe('buildHomeBody', () => {
	it('waits while the cache is being read', () => {
		expect(buildHomeBody({ ...base, cache: undefined })).toEqual({
			kind: 'loading',
		});
	});

	it('waits for the queue so terms never look unconfirmed by mistake', () => {
		expect(buildHomeBody({ ...base, queue: queueLoading })).toEqual({
			kind: 'loading',
		});
	});

	it('shows the first-load message offline with nothing cached', () => {
		expect(
			buildHomeBody({
				...base,
				cache: null,
				isOnline: false,
				refreshOutcome: undefined,
			}),
		).toEqual({ kind: 'needs_connection' });
	});

	it('shows the first-load message when the first fetch failed', () => {
		expect(
			buildHomeBody({ ...base, cache: null, refreshOutcome: 'kept_cache' }),
		).toEqual({ kind: 'needs_connection' });
	});

	it('says the server is not answering when the first fetch hit a server error', () => {
		expect(
			buildHomeBody({ ...base, cache: null, refreshOutcome: 'server_error' }),
		).toEqual({ kind: 'server_unavailable' });
	});

	it('keeps loading while the first fetch is still running', () => {
		expect(
			buildHomeBody({ ...base, cache: null, refreshOutcome: undefined }),
		).toEqual({ kind: 'loading' });
	});

	it('keeps loading right after a fetch saved the first copy', () => {
		expect(
			buildHomeBody({ ...base, cache: null, refreshOutcome: 'refreshed' }),
		).toEqual({ kind: 'loading' });
	});

	it('derives order, terms line and timeline from the cache and the queue', () => {
		const body = buildHomeBody({
			...base,
			queue: loadedQueue([acceptance]),
		});

		expect(body.kind).toBe('ready');
		if (body.kind !== 'ready') {
			return;
		}
		expect(body.order.employer).toBe('Valle Verde Farms');
		expect(body.terms.role).toBe('pending_sync');
		expect(body.timeline.map((step) => step.status)).toEqual([
			'saved_on_phone',
			'not_done',
			'not_done',
		]);
	});

	it('works offline once something is cached (M1)', () => {
		const body = buildHomeBody({
			...base,
			isOnline: false,
			refreshOutcome: undefined,
		});

		expect(body.kind).toBe('ready');
	});
});
