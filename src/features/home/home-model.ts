import {
	buildTimeline,
	type TimelineStep,
} from '@/features/home/home-timeline';
import {
	termsRoleFor,
	type TermsScreenState,
	termsScreenState,
} from '@/features/terms/contracts/terms-status';
import type { JobOrder } from '@/services/api/api-types';
import type { TranslationKey } from '@/services/i18n/translate';
import { type CacheGateInput, cacheGateFor } from '@/services/query/cache-gate';
import { rowsOf } from '@/services/runtime/queue-status';
import type { WorkerCache } from '@/services/storage/worker-cache-store';
import type { QueuedAction } from '@/services/sync/sync-types';
import type { StatusRole } from '@/uikit/tokens/status-role';

export type TermsLine = {
	textKey: TranslationKey;
	role: StatusRole;
};

/** What the Home body shows. One closed union: the screen derives it, nothing stores it. */
export type HomeBody =
	| { kind: 'loading' }
	| { kind: 'needs_connection' }
	| { kind: 'server_unavailable' }
	| {
			kind: 'ready';
			order: JobOrder;
			terms: TermsLine;
			timeline: TimelineStep[];
	  };

export type HomeBodyInput = CacheGateInput;

const termsTextKeyFor = (state: TermsScreenState): TranslationKey => {
	switch (state.kind) {
		case 'confirmed':
			return 'home.terms_confirmed';
		case 'pending_sync':
			return 'home.terms_pending_sync';
		case 'rejected':
			return 'home.terms_rejected';
		case 'needs_confirmation':
			return state.changedSinceLastSeen
				? 'terms.changed'
				: 'home.terms_needs_confirmation';
		default:
			return state satisfies never;
	}
};

/**
 * The terms line on Home. The role comes from the Terms feature, so Home and the
 * Terms screen never disagree: device-only "pending sync" is amber and says so,
 * and only a version the server confirmed is green (M4, M6).
 */
export const termsLineFor = (state: TermsScreenState): TermsLine => ({
	role: termsRoleFor(state),
	textKey: termsTextKeyFor(state),
});

export const firstNameOf = (fullName: string): string =>
	fullName.trim().split(/\s+/)[0] ?? '';

const readyBody = (cache: WorkerCache, rows: QueuedAction[]): HomeBody => {
	const { assignment } = cache;
	return {
		kind: 'ready',
		order: assignment.order,
		terms: termsLineFor(
			termsScreenState({
				acceptedTermsVersionId: assignment.acceptedTermsVersionId,
				current: assignment.currentTerms,
				lastSeenTermsVersionId: cache.lastSeenTermsVersionId,
				localActions: rows,
			}),
		),
		timeline: buildTimeline(cache, rows),
	};
};

export const buildHomeBody = (input: HomeBodyInput): HomeBody => {
	const gate = cacheGateFor(input);
	switch (gate.kind) {
		case 'loading':
			return { kind: 'loading' };
		case 'needs_connection':
			return { kind: 'needs_connection' };
		case 'server_unavailable':
			return { kind: 'server_unavailable' };
		case 'ready':
			return readyBody(gate.cache, rowsOf(input.queue));
		default:
			return gate satisfies never;
	}
};
