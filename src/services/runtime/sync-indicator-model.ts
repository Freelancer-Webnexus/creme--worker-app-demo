import type { QueueStatus } from '@/services/runtime/queue-status';
import type { EngineState } from '@/services/sync/sync-types';

/**
 * What the sync indicator says. One closed union the view renders; nothing here
 * is stored. The worker must always see whether an action was delivered or is
 * only saved on this phone (M4), so each variant says which.
 */
export type SyncIndicator =
	/** The queue has not been read yet. Never "all sent". */
	| { kind: 'checking' }
	/** The server said 401. Saved actions wait, safe on this phone. */
	| { kind: 'session_expired'; savedCount: number }
	| { kind: 'offline_waiting'; count: number }
	| { kind: 'offline_clear' }
	/**
	 * Failed for good; the worker has to act. The waiting count and the
	 * connection stay visible, but no countdown: only failed rows need the worker.
	 */
	| {
			kind: 'needs_attention';
			failedCount: number;
			queuedCount: number;
			isOnline: boolean;
	  }
	/** `isRetry`: an action that already failed once is among those sent. */
	| { kind: 'sending'; count: number; isRetry: boolean }
	| { kind: 'retrying'; seconds: number; count: number }
	| { kind: 'nothing_pending' };

export type SyncIndicatorInput = {
	engineState: EngineState;
	isOnline: boolean;
	queue: QueueStatus;
	/** Epoch milliseconds. */
	now: number;
};

type Counts = { failedCount: number; queuedCount: number; isRetry: boolean };

const secondsUntil = (until: number, now: number): number =>
	Math.max(1, Math.ceil((until - now) / 1000));

const offlineIndicator = ({
	failedCount,
	queuedCount,
}: Counts): SyncIndicator => {
	if (failedCount > 0) {
		return {
			failedCount,
			isOnline: false,
			kind: 'needs_attention',
			queuedCount,
		};
	}
	return queuedCount > 0
		? { count: queuedCount, kind: 'offline_waiting' }
		: { kind: 'offline_clear' };
};

/** Failed actions come first: the worker has to act on them. */
const onlineIndicator = (
	counts: Counts,
	state: Exclude<EngineState, { kind: 'auth_required' } | { kind: 'offline' }>,
	now: number,
): SyncIndicator => {
	const { failedCount, isRetry, queuedCount } = counts;
	if (failedCount > 0) {
		return {
			failedCount,
			isOnline: true,
			kind: 'needs_attention',
			queuedCount,
		};
	}
	if (queuedCount === 0) {
		return { kind: 'nothing_pending' };
	}

	switch (state.kind) {
		case 'backing_off':
			return {
				count: queuedCount,
				kind: 'retrying',
				seconds: secondsUntil(state.until, now),
			};
		case 'syncing':
		// A run starts right after every enqueue, so a waiting row on an idle
		// engine is about to be sent.
		case 'idle':
			return { count: queuedCount, isRetry, kind: 'sending' };
		default:
			return state satisfies never;
	}
};

export const buildSyncIndicator = (
	input: SyncIndicatorInput,
): SyncIndicator => {
	const { engineState, isOnline, now, queue } = input;

	if (queue.kind === 'loading') {
		return { kind: 'checking' };
	}
	const counts = {
		failedCount: queue.failedCount,
		isRetry: queue.rows.some(
			(row) => row.status.kind === 'queued' && row.attempts > 0,
		),
		queuedCount: queue.queuedCount,
	};

	switch (engineState.kind) {
		case 'auth_required':
			return { kind: 'session_expired', savedCount: counts.queuedCount };
		case 'offline':
			return offlineIndicator(counts);
		case 'backing_off':
		case 'syncing':
		case 'idle':
			return isOnline
				? onlineIndicator(counts, engineState, now)
				: offlineIndicator(counts);
		default:
			return engineState satisfies never;
	}
};

/** Only the retry countdown changes with the clock, so only it needs a ticking `now`. */
export const showsCountdown = (
	input: Omit<SyncIndicatorInput, 'now'>,
): boolean => buildSyncIndicator({ ...input, now: 0 }).kind === 'retrying';
