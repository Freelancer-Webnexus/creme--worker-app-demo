import {
	buildTimeline,
	type TimelineStep,
} from '@/features/home/home-timeline';
import type { Assignment, ServerDocument } from '@/services/api/api-types';
import type { WorkerCache } from '@/services/storage/worker-cache-store';
import type { QueuedAction } from '@/services/sync/sync-types';

const REQUIRED = ['passport', 'ds160_confirmation', 'signed_contract'];

const cacheWith = (
	documents: ServerDocument[],
	acceptedTermsVersionId: string | null,
	requiredDocuments: string[] = REQUIRED,
): WorkerCache => {
	const assignment: Assignment = {
		acceptedTermsVersionId,
		currentTerms: {
			id: 'terms-v2',
			publishedAt: '2026-02-01',
			summary: { en: 'English', es: 'Español' },
			version: 2,
		},
		documents,
		flags: {},
		order: {
			employer: 'Valle Verde Farms',
			id: 'JO-2026-0142',
			seasonEnd: '2026-07-31',
			seasonStart: '2026-03-01',
			worksite: 'Yuma, AZ',
		},
		requiredDocuments,
	};
	return { assignment, fetchedAt: 1, lastSeenTermsVersionId: null };
};

const queued = (kind: QueuedAction['kind'], id: string): QueuedAction => ({
	attempts: 0,
	clientActionId: id,
	createdAt: 1,
	kind,
	nextAttemptAt: 0,
	status: { kind: 'queued' },
	workerId: 'w1',
});

const upload = (documentType: string): QueuedAction =>
	queued(
		{
			documentType,
			fileUri: `file:///u/${documentType}.jpg`,
			type: 'document_upload',
		},
		`up-${documentType}`,
	);

const acceptance = queued(
	{ termsVersionId: 'terms-v2', type: 'terms_acceptance' },
	'terms-1',
);

const doneIds = (steps: TimelineStep[]) =>
	steps.filter((step) => step.status === 'done').map((step) => step.id);

const statuses = (steps: TimelineStep[]) => steps.map((step) => step.status);

const pendingReview = (documentType: string): ServerDocument => ({
	documentType,
	state: 'pending_review',
});
const approved = (documentType: string): ServerDocument => ({
	documentType,
	state: 'approved',
});

describe('buildTimeline', () => {
	it('lists the three steps in order', () => {
		expect(
			buildTimeline(cacheWith([], null), []).map((step) => step.id),
		).toEqual(['terms_confirmed', 'documents_submitted', 'documents_approved']);
	});

	it('starts with nothing done', () => {
		expect(doneIds(buildTimeline(cacheWith([], null), []))).toEqual([]);
	});

	it('counts terms the server confirmed', () => {
		expect(doneIds(buildTimeline(cacheWith([], 'terms-v2'), []))).toEqual([
			'terms_confirmed',
		]);
	});

	it('does not count a terms acceptance that is only saved on this phone (M4)', () => {
		expect(doneIds(buildTimeline(cacheWith([], null), [acceptance]))).toEqual(
			[],
		);
	});

	it('does not count terms accepted for an older version', () => {
		expect(doneIds(buildTimeline(cacheWith([], 'terms-v1'), []))).toEqual([]);
	});

	it('needs every required document delivered before "submitted" is done', () => {
		const some = cacheWith([pendingReview('passport')], 'terms-v2');
		expect(doneIds(buildTimeline(some, []))).toEqual(['terms_confirmed']);

		const all = cacheWith(REQUIRED.map(pendingReview), 'terms-v2');
		expect(doneIds(buildTimeline(all, []))).toEqual([
			'terms_confirmed',
			'documents_submitted',
		]);
	});

	it('does not count a photo that is only saved on this phone as submitted (M4)', () => {
		const cache = cacheWith(
			[pendingReview('passport'), pendingReview('ds160_confirmation')],
			'terms-v2',
		);

		expect(doneIds(buildTimeline(cache, [upload('signed_contract')]))).toEqual([
			'terms_confirmed',
		]);
	});

	it('does not count a document staff sent back: the worker owes a new photo (M8)', () => {
		const cache = cacheWith(
			[
				approved('passport'),
				approved('ds160_confirmation'),
				{
					documentType: 'signed_contract',
					reason: 'Foto borrosa',
					state: 'correction_requested',
				},
			],
			'terms-v2',
		);

		expect(statuses(buildTimeline(cache, []))).toEqual([
			'done',
			'not_done',
			'not_done',
		]);
	});

	it('says the last step waits on staff once every document is delivered', () => {
		const cache = cacheWith(
			[approved('passport'), ...REQUIRED.slice(1).map(pendingReview)],
			'terms-v2',
		);

		expect(statuses(buildTimeline(cache, []))).toEqual([
			'done',
			'done',
			'in_review',
		]);
	});

	it('takes a resubmission after a correction as not delivered until it arrives (M8)', () => {
		const cache = cacheWith(
			[
				approved('passport'),
				approved('ds160_confirmation'),
				{
					documentType: 'signed_contract',
					reason: 'Foto borrosa',
					state: 'correction_requested',
				},
			],
			'terms-v2',
		);

		expect(doneIds(buildTimeline(cache, [upload('signed_contract')]))).toEqual([
			'terms_confirmed',
		]);
	});

	it('is done at the end when every document is approved', () => {
		const cache = cacheWith(REQUIRED.map(approved), 'terms-v2');

		expect(doneIds(buildTimeline(cache, []))).toEqual([
			'terms_confirmed',
			'documents_submitted',
			'documents_approved',
		]);
	});

	it('says a terms confirmation is saved on this phone while it waits to be sent', () => {
		expect(statuses(buildTimeline(cacheWith([], null), [acceptance]))).toEqual([
			'saved_on_phone',
			'not_done',
			'not_done',
		]);
	});

	it('says documents are saved on this phone when the last missing ones wait to be sent', () => {
		const cache = cacheWith(
			[pendingReview('passport'), pendingReview('ds160_confirmation')],
			'terms-v2',
		);

		expect(statuses(buildTimeline(cache, [upload('signed_contract')]))).toEqual(
			['done', 'saved_on_phone', 'not_done'],
		);
	});

	it('keeps documents not done while one is neither sent nor saved', () => {
		const cache = cacheWith([pendingReview('passport')], 'terms-v2');

		expect(
			statuses(buildTimeline(cache, [upload('ds160_confirmation')])),
		).toEqual(['done', 'not_done', 'not_done']);
	});

	it('does not call an empty catalog done', () => {
		expect(doneIds(buildTimeline(cacheWith([], 'terms-v2', []), []))).toEqual([
			'terms_confirmed',
		]);
	});
});
