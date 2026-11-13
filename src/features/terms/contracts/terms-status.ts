import type { TermsVersion } from '@/services/api/api-types';
import type { QueuedAction } from '@/services/sync/sync-types';
import { termsState } from '@/services/sync/terms-state';
import type { StatusRole } from '@/uikit/tokens/status-role';

/**
 * What the Terms screen and the Home terms line both show. Derived, never
 * stored (M6). `rejected` is `needs_confirmation` plus a failed acceptance row:
 * the server refused the confirmation for good, so the worker must try again.
 */
export type TermsScreenState =
	| {
			kind: 'needs_confirmation';
			version: TermsVersion;
			changedSinceLastSeen: boolean;
	  }
	| { kind: 'rejected'; version: TermsVersion; changedSinceLastSeen: boolean }
	| { kind: 'pending_sync'; version: TermsVersion }
	| { kind: 'confirmed'; version: TermsVersion };

export type TermsScreenInput = {
	current: TermsVersion;
	acceptedTermsVersionId: string | null;
	lastSeenTermsVersionId: string | null;
	localActions: QueuedAction[];
};

const hasFailedAcceptance = (actions: QueuedAction[]): boolean =>
	actions.some(
		(action) =>
			action.kind.type === 'terms_acceptance' &&
			action.status.kind === 'failed',
	);

export const termsScreenState = (input: TermsScreenInput): TermsScreenState => {
	const state = termsState(input);
	switch (state.kind) {
		case 'needs_confirmation':
			return hasFailedAcceptance(input.localActions)
				? {
						changedSinceLastSeen: state.changedSinceLastSeen,
						kind: 'rejected',
						version: state.version,
					}
				: state;
		case 'pending_sync':
		case 'confirmed':
			return state;
		default:
			return state satisfies never;
	}
};

/**
 * Amber only while the acceptance is saved on this phone, green only for a
 * version the server confirmed (M4).
 */
export const termsRoleFor = (state: TermsScreenState): StatusRole => {
	switch (state.kind) {
		case 'confirmed':
			return 'approved';
		case 'pending_sync':
			return 'pending_sync';
		case 'rejected':
			return 'failed';
		case 'needs_confirmation':
			return state.changedSinceLastSeen ? 'correction' : 'neutral';
		default:
			return state satisfies never;
	}
};
