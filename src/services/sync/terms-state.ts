import type { TermsVersion } from '@/services/api/api-types';
import type { QueuedAction } from '@/services/sync/sync-types';

/** What the terms screen shows. Derived, never stored (M6). */
export type TermsState =
	| {
			kind: 'needs_confirmation';
			version: TermsVersion;
			changedSinceLastSeen: boolean;
	  }
	| { kind: 'pending_sync'; version: TermsVersion }
	| { kind: 'confirmed'; version: TermsVersion };

type TermsInput = {
	current: TermsVersion;
	acceptedTermsVersionId: string | null;
	lastSeenTermsVersionId: string | null;
	localActions: QueuedAction[];
};

export const termsState = (input: TermsInput): TermsState => {
	const { current } = input;

	if (input.acceptedTermsVersionId === current.id) {
		return { kind: 'confirmed', version: current };
	}

	// M6: only an acceptance of the version on screen is pending. One queued for
	// an older version will get a 409, so the worker must confirm again.
	const hasQueuedAcceptance = input.localActions.some(
		(action) =>
			action.kind.type === 'terms_acceptance' &&
			action.kind.termsVersionId === current.id &&
			action.status.kind === 'queued',
	);
	if (hasQueuedAcceptance) {
		return { kind: 'pending_sync', version: current };
	}

	return {
		kind: 'needs_confirmation',
		version: current,
		changedSinceLastSeen:
			input.lastSeenTermsVersionId !== null &&
			input.lastSeenTermsVersionId !== current.id,
	};
};
