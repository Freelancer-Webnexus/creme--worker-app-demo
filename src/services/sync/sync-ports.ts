import type { TermsVersion } from '@/services/api/api-types';
import type {
	EngineState,
	FailureReason,
	NewAction,
	QueuedAction,
	SendResult,
} from '@/services/sync/sync-types';

/**
 * Everything the engine needs from the outside world. The engine imports no
 * React Native module, so the tests run it with in-memory fakes and a fake
 * clock.
 */

export type QueueStore = {
	/** Resolves only after the row is durable (M3). */
	insert: (action: QueuedAction) => Promise<void>;
	/** Queued actions of one worker that are due, oldest first. */
	listReady: (workerId: string, now: number) => Promise<QueuedAction[]>;
	/** Every action of one worker, queued and failed, oldest first. */
	listAll: (workerId: string) => Promise<QueuedAction[]>;
	recordAttempt: (
		clientActionId: string,
		attempts: number,
		nextAttemptAt: number,
	) => Promise<void>;
	/**
	 * Makes every queued row of one worker due at `now`. Keeps `attempts`, so the
	 * next backoff continues where it was, and leaves failed rows failed.
	 */
	makeDueNow: (workerId: string, now: number) => Promise<void>;
	markFailed: (clientActionId: string, reason: FailureReason) => Promise<void>;
	remove: (clientActionId: string) => Promise<void>;
};

export type Transport = {
	send: (action: QueuedAction, token: string) => Promise<SendResult>;
};

export type Clock = {
	now: () => number;
	/** Returns a cancel function. */
	setTimer: (delayMs: number, callback: () => void) => () => void;
};

export type Connectivity = {
	isOnline: () => boolean;
	/** Returns an unsubscribe function. */
	subscribe: (listener: (online: boolean) => void) => () => void;
};

export type SessionSource = {
	/** Token of the signed-in worker, or null when nobody is signed in. */
	token: (workerId: string) => string | null;
};

/**
 * Side effects of a finished attempt that are not the queue's business:
 * updating the worker's cached server state and deleting uploaded files.
 */
export type OutcomeSink = {
	delivered: (action: QueuedAction) => Promise<void>;
	staleTerms: (
		action: QueuedAction,
		currentTerms: TermsVersion,
	) => Promise<void>;
	rejected: (action: QueuedAction, reason: FailureReason) => Promise<void>;
	/** The row is gone (delivered, replaced or dismissed): its upload file is no longer needed. */
	discarded: (action: QueuedAction) => Promise<void>;
};

export type SyncEnginePorts = {
	store: QueueStore;
	transport: Transport;
	clock: Clock;
	connectivity: Connectivity;
	session: SessionSource;
	outcomes: OutcomeSink;
	/** Returns a number in [0, 1). Injected so backoff jitter is testable. */
	random: () => number;
	newId: () => string;
};

export type SyncEngine = {
	/** Subscribes to connectivity and accepts runs. The engine is stopped until this is called. */
	start: () => void;
	/**
	 * No new send and no timer after this. A send already in flight finishes its
	 * store work. `enqueue` still stores. `start` works again.
	 */
	stop: () => void;
	/**
	 * Only the active worker's queue is sent, because the token belongs to the
	 * signed-in worker. Other workers' actions wait on the device (M10).
	 * Passing a worker id also resumes from `auth_required`.
	 */
	setActiveWorker: (workerId: string | null) => void;
	/** Stores the action, then triggers a run. Works offline (M1). */
	enqueue: (action: NewAction) => Promise<QueuedAction>;
	/**
	 * Removes one failed row of the active worker so the worker can try again or
	 * leave it. A queued row or an unknown id is left alone.
	 */
	dismissFailed: (clientActionId: string) => Promise<void>;
	/** Asks for a run. A run already in progress is never doubled. */
	requestRun: () => void;
	/**
	 * The worker tapped "retry now", or the connection came back: queued
	 * actions of the active worker become due at once instead of waiting out
	 * their backoff. Failed actions are not revived.
	 */
	retryNow: () => Promise<void>;
	/** A 401 seen outside the queue (for example on GET /me/assignment). */
	reportUnauthorized: () => void;
	/** Resolves when no run is in progress. For tests. */
	whenSettled: () => Promise<void>;
	getState: () => EngineState;
	/** Fires on every state or queue change. Fits useSyncExternalStore. */
	subscribe: (listener: () => void) => () => void;
};
