import type { TermsVersion } from '@/services/api/api-types';
import type { QueuedAction } from '@/services/sync/sync-types';
import { termsState } from '@/services/sync/terms-state';

const termsVersion = (id: string, version: number): TermsVersion => ({
	id,
	version,
	publishedAt: '2026-01-01',
	summary: { es: 'texto', en: 'text' },
});

const v2 = termsVersion('terms-v2', 2);
const v3 = termsVersion('terms-v3', 3);

const acceptance = (
	status: QueuedAction['status'],
	termsVersionId = 'terms-v2',
): QueuedAction => ({
	clientActionId: 't1',
	workerId: 'ana',
	kind: { type: 'terms_acceptance', termsVersionId },
	status,
	createdAt: 1,
	attempts: 0,
	nextAttemptAt: 0,
});

const upload: QueuedAction = {
	clientActionId: 'u1',
	workerId: 'ana',
	kind: { type: 'document_upload', documentType: 'passport', fileUri: 'x' },
	status: { kind: 'queued' },
	createdAt: 1,
	attempts: 0,
	nextAttemptAt: 0,
};

describe('termsState', () => {
	it('confirmed when the accepted id is the current id', () => {
		expect(
			termsState({
				current: v2,
				acceptedTermsVersionId: 'terms-v2',
				lastSeenTermsVersionId: 'terms-v2',
				localActions: [],
			}),
		).toEqual({ kind: 'confirmed', version: v2 });
	});

	it('confirmed wins over a leftover queued acceptance', () => {
		expect(
			termsState({
				current: v2,
				acceptedTermsVersionId: 'terms-v2',
				lastSeenTermsVersionId: 'terms-v2',
				localActions: [acceptance({ kind: 'queued' })],
			}).kind,
		).toBe('confirmed');
	});

	it('pending sync while an acceptance waits on the device', () => {
		expect(
			termsState({
				current: v2,
				acceptedTermsVersionId: null,
				lastSeenTermsVersionId: null,
				localActions: [acceptance({ kind: 'queued' })],
			}),
		).toEqual({ kind: 'pending_sync', version: v2 });
	});

	it('M6 a queued acceptance of an older version does not count while a newer version is current', () => {
		expect(
			termsState({
				current: v3,
				acceptedTermsVersionId: null,
				lastSeenTermsVersionId: 'terms-v2',
				localActions: [acceptance({ kind: 'queued' }, 'terms-v2')],
			}),
		).toEqual({
			kind: 'needs_confirmation',
			version: v3,
			changedSinceLastSeen: true,
		});
	});

	it('M6 the older queued acceptance with nothing seen yet needs confirmation without a change flag', () => {
		expect(
			termsState({
				current: v3,
				acceptedTermsVersionId: null,
				lastSeenTermsVersionId: null,
				localActions: [acceptance({ kind: 'queued' }, 'terms-v2')],
			}),
		).toEqual({
			kind: 'needs_confirmation',
			version: v3,
			changedSinceLastSeen: false,
		});
	});

	it('M6 a queued acceptance of the current version is pending sync', () => {
		expect(
			termsState({
				current: v3,
				acceptedTermsVersionId: null,
				lastSeenTermsVersionId: 'terms-v2',
				localActions: [acceptance({ kind: 'queued' }, 'terms-v3')],
			}),
		).toEqual({ kind: 'pending_sync', version: v3 });
	});

	it('needs confirmation when nothing was accepted', () => {
		expect(
			termsState({
				current: v2,
				acceptedTermsVersionId: null,
				lastSeenTermsVersionId: null,
				localActions: [],
			}),
		).toEqual({
			kind: 'needs_confirmation',
			version: v2,
			changedSinceLastSeen: false,
		});
	});

	it('needs confirmation when the last seen version is the current one', () => {
		expect(
			termsState({
				current: v2,
				acceptedTermsVersionId: null,
				lastSeenTermsVersionId: 'terms-v2',
				localActions: [],
			}),
		).toEqual({
			kind: 'needs_confirmation',
			version: v2,
			changedSinceLastSeen: false,
		});
	});

	it('flags a change when the worker last saw an older version', () => {
		expect(
			termsState({
				current: v3,
				acceptedTermsVersionId: 'terms-v2',
				lastSeenTermsVersionId: 'terms-v2',
				localActions: [],
			}),
		).toEqual({
			kind: 'needs_confirmation',
			version: v3,
			changedSinceLastSeen: true,
		});
	});

	it('a failed acceptance does not count as pending sync', () => {
		expect(
			termsState({
				current: v2,
				acceptedTermsVersionId: null,
				lastSeenTermsVersionId: null,
				localActions: [acceptance({ kind: 'failed', reason: 'rejected' })],
			}).kind,
		).toBe('needs_confirmation');
	});

	it('document uploads do not count as a terms acceptance', () => {
		expect(
			termsState({
				current: v2,
				acceptedTermsVersionId: null,
				lastSeenTermsVersionId: null,
				localActions: [upload],
			}).kind,
		).toBe('needs_confirmation');
	});
});
