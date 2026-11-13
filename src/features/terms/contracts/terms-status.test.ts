import {
	termsRoleFor,
	type TermsScreenInput,
	termsScreenState,
} from '@/features/terms/contracts/terms-status';
import type { TermsVersion } from '@/services/api/api-types';
import type { QueuedAction } from '@/services/sync/sync-types';

const v2: TermsVersion = {
	id: 'terms-v2',
	publishedAt: '2026-02-10T09:00:00.000Z',
	summary: { en: 'English', es: 'Español' },
	version: 2,
};

const v3: TermsVersion = { ...v2, id: 'terms-v3', version: 3 };

const acceptance = (
	termsVersionId: string,
	status: QueuedAction['status'],
): QueuedAction => ({
	attempts: 0,
	clientActionId: `a-${termsVersionId}-${status.kind}`,
	createdAt: 1,
	kind: { termsVersionId, type: 'terms_acceptance' },
	nextAttemptAt: 0,
	status,
	workerId: 'w1',
});

const base: TermsScreenInput = {
	acceptedTermsVersionId: null,
	current: v2,
	lastSeenTermsVersionId: null,
	localActions: [],
};

describe('termsScreenState', () => {
	it('is confirmed when the server accepted the current version', () => {
		const state = termsScreenState({
			...base,
			acceptedTermsVersionId: 'terms-v2',
		});
		expect(state).toEqual({ kind: 'confirmed', version: v2 });
		expect(termsRoleFor(state)).toBe('approved');
	});

	it('is pending sync while the acceptance of this version is only on the phone', () => {
		const state = termsScreenState({
			...base,
			localActions: [acceptance('terms-v2', { kind: 'queued' })],
		});
		expect(state).toEqual({ kind: 'pending_sync', version: v2 });
		expect(termsRoleFor(state)).toBe('pending_sync');
	});

	it('does not call v3 confirmed or pending because of an acceptance of v2 (M6)', () => {
		const state = termsScreenState({
			...base,
			acceptedTermsVersionId: 'terms-v2',
			current: v3,
			lastSeenTermsVersionId: 'terms-v2',
			localActions: [acceptance('terms-v2', { kind: 'queued' })],
		});
		expect(state).toEqual({
			changedSinceLastSeen: true,
			kind: 'needs_confirmation',
			version: v3,
		});
	});

	it('asks to confirm, quietly the first time', () => {
		const state = termsScreenState(base);
		expect(state).toEqual({
			changedSinceLastSeen: false,
			kind: 'needs_confirmation',
			version: v2,
		});
		expect(termsRoleFor(state)).toBe('neutral');
	});

	it('flags a change when the worker saw another version before', () => {
		const state = termsScreenState({
			...base,
			current: v3,
			lastSeenTermsVersionId: 'terms-v2',
		});
		expect(state.kind).toBe('needs_confirmation');
		expect(termsRoleFor(state)).toBe('correction');
	});

	it('is rejected when an acceptance failed for good', () => {
		const state = termsScreenState({
			...base,
			localActions: [
				acceptance('terms-v2', { kind: 'failed', reason: 'rejected' }),
			],
		});
		expect(state).toEqual({
			changedSinceLastSeen: false,
			kind: 'rejected',
			version: v2,
		});
		expect(termsRoleFor(state)).toBe('failed');
	});

	it('is confirmed even if an old failed row is still listed', () => {
		const state = termsScreenState({
			...base,
			acceptedTermsVersionId: 'terms-v2',
			localActions: [
				acceptance('terms-v2', { kind: 'failed', reason: 'rejected' }),
			],
		});
		expect(state.kind).toBe('confirmed');
	});

	it('prefers pending sync over an old failed row', () => {
		const state = termsScreenState({
			...base,
			localActions: [
				acceptance('terms-v2', { kind: 'failed', reason: 'rejected' }),
				acceptance('terms-v2', { kind: 'queued' }),
			],
		});
		expect(state.kind).toBe('pending_sync');
	});
});
