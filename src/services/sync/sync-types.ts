import type { TermsVersion } from '@/services/api/api-types';

/**
 * What the worker did. A resubmission after a correction is a new action with
 * a new clientActionId, never an edit of an old one (M8).
 */
export type ActionKind =
	| { type: 'terms_acceptance'; termsVersionId: string }
	| { type: 'document_upload'; documentType: string; fileUri: string };

/** Why the server refused an action for good. The worker must act (M5). */
export type FailureReason = 'too_large' | 'unknown_document_type' | 'rejected';

/**
 * Stored status of a queued action. "Sending" is deliberately absent: an action
 * that was in flight when the app died is still `queued` after a restart and is
 * sent again with the same clientActionId, which the server deduplicates
 * (M2, M3).
 */
export type ActionStatus =
	{ kind: 'queued' } | { kind: 'failed'; reason: FailureReason };

export type QueuedAction = {
	/** Generated when the worker taps, stored before any network call (M3). */
	clientActionId: string;
	/** Partition key. No query reads the queue without it (M10). */
	workerId: string;
	kind: ActionKind;
	status: ActionStatus;
	createdAt: number;
	attempts: number;
	nextAttemptAt: number;
};

export type NewAction = {
	workerId: string;
	kind: ActionKind;
};

/**
 * Result of one delivery attempt, already mapped from HTTP (M5). `retryable`
 * is a server answer (408, 429, 5xx): the link works, so other actions can
 * still go out. `unreachable` is no answer at all (network error, timeout):
 * the link is likely dead for every action.
 */
export type SendResult =
	| { kind: 'delivered'; replay: boolean }
	| { kind: 'retryable' }
	| { kind: 'unreachable' }
	| { kind: 'stale_terms'; currentTerms: TermsVersion }
	| { kind: 'rejected'; reason: FailureReason }
	| { kind: 'unauthorized' };

/** The one lifecycle of the engine. Every switch over it is exhaustive. */
export type EngineState =
	| { kind: 'idle' }
	| { kind: 'offline' }
	| { kind: 'syncing' }
	| { kind: 'backing_off'; until: number }
	| { kind: 'auth_required' };
