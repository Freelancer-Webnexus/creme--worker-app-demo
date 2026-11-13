import {
	loadedQueue,
	type QueueStatus,
	queueLoading,
} from '@/services/runtime/queue-status';
import {
	buildSyncIndicator,
	showsCountdown,
	type SyncIndicator,
	type SyncIndicatorInput,
} from '@/services/runtime/sync-indicator-model';

const NOW = 1_000_000;

type CaseInput = Partial<Omit<SyncIndicatorInput, 'queue'>> & {
	queue?: QueueStatus;
	queuedCount?: number;
	failedCount?: number;
};

const inputFor = ({
	failedCount = 0,
	queue,
	queuedCount = 0,
	...rest
}: CaseInput): SyncIndicatorInput => ({
	engineState: { kind: 'idle' },
	isOnline: true,
	now: NOW,
	queue: queue ?? { failedCount, kind: 'loaded', queuedCount, rows: [] },
	...rest,
});

const termsRow = (attempts: number) => ({
	attempts,
	clientActionId: `a-${attempts}`,
	createdAt: 0,
	kind: { termsVersionId: 'v2', type: 'terms_acceptance' as const },
	nextAttemptAt: 0,
	status: { kind: 'queued' as const },
	workerId: 'w1',
});

type Row = [name: string, input: CaseInput, expected: SyncIndicator];

const rows: Row[] = [
	[
		'queue not read yet is never "all sent"',
		{ queue: queueLoading },
		{ kind: 'checking' },
	],
	[
		'offline with two actions waiting',
		{ engineState: { kind: 'offline' }, isOnline: false, queuedCount: 2 },
		{ count: 2, kind: 'offline_waiting' },
	],
	[
		'offline signal ahead of the engine state',
		{ isOnline: false, queuedCount: 1 },
		{ count: 1, kind: 'offline_waiting' },
	],
	[
		'engine offline while the signal still says online',
		{ engineState: { kind: 'offline' }, queuedCount: 3 },
		{ count: 3, kind: 'offline_waiting' },
	],
	[
		'offline with nothing waiting',
		{ engineState: { kind: 'offline' }, isOnline: false },
		{ kind: 'offline_clear' },
	],
	[
		'offline, nothing waiting, one failed, still says offline',
		{ engineState: { kind: 'offline' }, failedCount: 1, isOnline: false },
		{
			failedCount: 1,
			isOnline: false,
			kind: 'needs_attention',
			queuedCount: 0,
		},
	],
	[
		'offline with a failed action keeps the waiting count',
		{
			engineState: { kind: 'offline' },
			failedCount: 1,
			isOnline: false,
			queuedCount: 1,
		},
		{
			failedCount: 1,
			isOnline: false,
			kind: 'needs_attention',
			queuedCount: 1,
		},
	],
	[
		'offline signal with a failed action says offline before the engine does',
		{ failedCount: 1, isOnline: false, queuedCount: 2 },
		{
			failedCount: 1,
			isOnline: false,
			kind: 'needs_attention',
			queuedCount: 2,
		},
	],
	[
		'engine offline with a failed action says offline while the signal says online',
		{ engineState: { kind: 'offline' }, failedCount: 2 },
		{
			failedCount: 2,
			isOnline: false,
			kind: 'needs_attention',
			queuedCount: 0,
		},
	],
	[
		'sending two actions',
		{ engineState: { kind: 'syncing' }, queuedCount: 2 },
		{ count: 2, isRetry: false, kind: 'sending' },
	],
	[
		'sending again an action that already failed once says it is a retry',
		{
			engineState: { kind: 'syncing' },
			queue: loadedQueue([termsRow(0), termsRow(1)]),
		},
		{ count: 2, isRetry: true, kind: 'sending' },
	],
	[
		'syncing with an empty queue has nothing pending',
		{ engineState: { kind: 'syncing' } },
		{ kind: 'nothing_pending' },
	],
	[
		'idle with a fresh action about to be sent',
		{ queuedCount: 1 },
		{ count: 1, isRetry: false, kind: 'sending' },
	],
	['nothing waiting', {}, { kind: 'nothing_pending' }],
	[
		'retrying in 30 seconds',
		{
			engineState: { kind: 'backing_off', until: NOW + 30_000 },
			queuedCount: 1,
		},
		{ count: 1, kind: 'retrying', seconds: 30 },
	],
	[
		'retry countdown rounds up to whole seconds',
		{
			engineState: { kind: 'backing_off', until: NOW + 1_200 },
			queuedCount: 1,
		},
		{ count: 1, kind: 'retrying', seconds: 2 },
	],
	[
		'retry countdown never shows zero',
		{
			engineState: { kind: 'backing_off', until: NOW - 50 },
			queuedCount: 1,
		},
		{ count: 1, kind: 'retrying', seconds: 1 },
	],
	[
		'session expired with saved actions',
		{ engineState: { kind: 'auth_required' }, queuedCount: 4 },
		{ kind: 'session_expired', savedCount: 4 },
	],
	[
		'session expired beats offline',
		{ engineState: { kind: 'auth_required' }, isOnline: false, queuedCount: 1 },
		{ kind: 'session_expired', savedCount: 1 },
	],
	[
		'failed items need attention while online',
		{ failedCount: 2 },
		{ failedCount: 2, isOnline: true, kind: 'needs_attention', queuedCount: 0 },
	],
	[
		'failed items beat sending and keep the waiting count',
		{ engineState: { kind: 'syncing' }, failedCount: 1, queuedCount: 2 },
		{ failedCount: 1, isOnline: true, kind: 'needs_attention', queuedCount: 2 },
	],
	[
		'failed items beat the retry countdown',
		{
			engineState: { kind: 'backing_off', until: NOW + 5_000 },
			failedCount: 1,
			queuedCount: 1,
		},
		{ failedCount: 1, isOnline: true, kind: 'needs_attention', queuedCount: 1 },
	],
	[
		'backing off with an empty queue has nothing pending',
		{ engineState: { kind: 'backing_off', until: NOW + 5_000 } },
		{ kind: 'nothing_pending' },
	],
];

describe('buildSyncIndicator', () => {
	it.each(rows)('%s', (_name, input, expected) => {
		expect(buildSyncIndicator(inputFor(input))).toEqual(expected);
	});
});

const countdownRows: [string, CaseInput, boolean][] = [
	[
		'backing off online with a waiting action shows a countdown',
		{
			engineState: { kind: 'backing_off', until: NOW + 5_000 },
			queuedCount: 1,
		},
		true,
	],
	[
		'backing off with an empty queue shows nothing to count',
		{ engineState: { kind: 'backing_off', until: NOW + 5_000 } },
		false,
	],
	[
		'backing off offline shows the offline line',
		{
			engineState: { kind: 'backing_off', until: NOW + 5_000 },
			isOnline: false,
			queuedCount: 1,
		},
		false,
	],
	[
		'backing off with a failed action shows the attention line and the waiting count, not a countdown',
		{
			engineState: { kind: 'backing_off', until: NOW + 5_000 },
			failedCount: 1,
			queuedCount: 1,
		},
		false,
	],
	[
		'backing off before the queue is read',
		{
			engineState: { kind: 'backing_off', until: NOW + 5_000 },
			queue: queueLoading,
		},
		false,
	],
	['sending does not tick', { queuedCount: 1 }, false],
	[
		'session expired does not tick',
		{ engineState: { kind: 'auth_required' }, queuedCount: 1 },
		false,
	],
];

describe('showsCountdown', () => {
	it.each(countdownRows)('%s', (_name, input, expected) => {
		const { now: _now, ...rest } = inputFor(input);

		expect(showsCountdown(rest)).toBe(expected);
	});
});
