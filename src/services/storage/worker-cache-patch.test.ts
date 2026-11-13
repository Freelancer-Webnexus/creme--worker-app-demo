import type { Assignment, TermsVersion } from '@/services/api/api-types';
import {
	withCurrentTerms,
	withDocumentPendingReview,
	withTermsAccepted,
} from '@/services/storage/worker-cache-patch';

const terms2: TermsVersion = {
	id: 'tv2',
	version: 2,
	publishedAt: '2026-01-01',
	summary: { es: 'dos', en: 'two' },
};

const terms3: TermsVersion = {
	id: 'tv3',
	version: 3,
	publishedAt: '2026-02-01',
	summary: { es: 'tres', en: 'three' },
};

const base: Assignment = {
	order: {
		id: 'o1',
		employer: 'Farm',
		worksite: 'Field',
		seasonStart: '2026-03-01',
		seasonEnd: '2026-09-01',
	},
	currentTerms: terms2,
	acceptedTermsVersionId: null,
	requiredDocuments: ['passport', 'visa'],
	documents: [{ documentType: 'visa', state: 'approved' }],
	flags: { x: true },
};

describe('withTermsAccepted', () => {
	it('sets only the accepted id', () => {
		expect(withTermsAccepted(base, 'tv2')).toEqual({
			...base,
			acceptedTermsVersionId: 'tv2',
		});
	});
});

describe('withCurrentTerms', () => {
	it('replaces current terms and keeps the accepted id', () => {
		const accepted = { ...base, acceptedTermsVersionId: 'tv2' };
		expect(withCurrentTerms(accepted, terms3)).toEqual({
			...accepted,
			currentTerms: terms3,
		});
	});
});

describe('withDocumentPendingReview', () => {
	it('adds a pending_review document when none exists', () => {
		expect(withDocumentPendingReview(base, 'passport').documents).toEqual([
			{ documentType: 'visa', state: 'approved' },
			{ documentType: 'passport', state: 'pending_review' },
		]);
	});

	it('replaces a correction_requested document and leaves others', () => {
		const corrected: Assignment = {
			...base,
			documents: [
				{
					documentType: 'passport',
					state: 'correction_requested',
					reason: 'blurry',
				},
				{ documentType: 'visa', state: 'approved' },
			],
		};
		expect(withDocumentPendingReview(corrected, 'passport').documents).toEqual([
			{ documentType: 'passport', state: 'pending_review' },
			{ documentType: 'visa', state: 'approved' },
		]);
	});

	it('does not mutate its input', () => {
		const snapshot = structuredClone(base);
		withDocumentPendingReview(base, 'passport');
		expect(base).toEqual(snapshot);
	});
});
