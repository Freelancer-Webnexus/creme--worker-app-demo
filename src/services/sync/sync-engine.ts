import { nextDelayMs } from '@/services/sync/backoff';
import type { SyncEngine, SyncEnginePorts } from '@/services/sync/sync-ports';
import {
	assertNever,
	type EngineEvent,
	sameState,
	step,
} from '@/services/sync/sync-step';
import type {
	ActionKind,
	EngineState,
	QueuedAction,
	SendResult,
} from '@/services/sync/sync-types';

/**
 * Whether the engine accepts work and whether a run loop exists. The engine
 * starts `stopped` and does nothing until `start()`. A request that arrives
 * during a run must not start a second loop (M3), but it must not be lost
 * either: `running_with_pending` makes the loop do one more pass. `stopping` is
 * a stop that arrived while a pass was in flight: that pass ends its current
 * action and then the loop exits. The server also deduplicates on
 * clientActionId, so even a doubled send could not create a doubled record.
 */
type RunState =
	| { kind: 'stopped' }
	| { kind: 'stopping' }
	| { kind: 'idle' }
	| { kind: 'running' }
	| { kind: 'running_with_pending' };

type RunEvent = 'start' | 'stop' | 'run_requested' | 'pass_finished';

type RunStep = { run: RunState; startLoop: boolean };

const stepRun = (run: RunState, event: RunEvent): RunStep => {
	const stay: RunStep = { run, startLoop: false };
	const go = (kind: RunState['kind'], startLoop = false): RunStep => ({
		run: { kind },
		startLoop,
	});
	switch (event) {
		case 'start':
			switch (run.kind) {
				case 'stopped':
					return go('idle');
				case 'stopping':
					return go('running_with_pending');
				case 'idle':
				case 'running':
				case 'running_with_pending':
					return stay;
				default:
					return assertNever(run);
			}
		case 'stop':
			switch (run.kind) {
				case 'idle':
					return go('stopped');
				case 'running':
				case 'running_with_pending':
					return go('stopping');
				case 'stopped':
				case 'stopping':
					return stay;
				default:
					return assertNever(run);
			}
		case 'run_requested':
			switch (run.kind) {
				case 'idle':
					return go('running', true);
				case 'running':
					return go('running_with_pending');
				case 'stopped':
				case 'stopping':
				case 'running_with_pending':
					return stay;
				default:
					return assertNever(run);
			}
		case 'pass_finished':
			switch (run.kind) {
				case 'running_with_pending':
					return go('running');
				case 'running':
					return go('idle');
				case 'stopping':
					return go('stopped');
				case 'stopped':
				case 'idle':
					return stay;
				default:
					return assertNever(run);
			}
		default:
			return assertNever(event);
	}
};

type NextAction = { action: QueuedAction; token: string };

/** One slot per document type, and one for the terms acceptance. */
const sameSlot = (a: ActionKind, b: ActionKind): boolean =>
	a.type === 'terms_acceptance'
		? b.type === 'terms_acceptance'
		: b.type === 'document_upload' && a.documentType === b.documentType;

export const createSyncEngine = (ports: SyncEnginePorts): SyncEngine => {
	const { store, transport, clock, connectivity, session, outcomes } = ports;

	let state: EngineState = { kind: 'idle' };
	let run: RunState = { kind: 'stopped' };
	let activeWorker: string | null = null;
	let cancelTimer: (() => void) | null = null;
	let stopListeningToConnectivity: (() => void) | null = null;
	let listeners: (() => void)[] = [];
	let settledWaiters: (() => void)[] = [];

	const notify = () => {
		for (const listener of listeners) {
			// M2: a listener is UI code. Its bug must never strand the queue.
			try {
				listener();
			} catch {
				continue;
			}
		}
	};

	const isStopped = () => run.kind === 'stopped' || run.kind === 'stopping';

	/** The backoff timer exists exactly while the state is `backing_off` and the engine is not stopped. */
	const syncTimer = () => {
		cancelTimer?.();
		cancelTimer = null;
		if (state.kind !== 'backing_off' || isStopped()) {
			return;
		}
		const delayMs = Math.max(0, state.until - clock.now());
		cancelTimer = clock.setTimer(delayMs, () => {
			cancelTimer = null;
			dispatch({ kind: 'backoff_timer_fired' });
			requestRun();
		});
	};

	const dispatch = (event: EngineEvent) => {
		const next = step(state, event);
		if (sameState(state, next)) {
			return;
		}
		state = next;
		syncTimer();
		notify();
	};

	const canStartRun = (): boolean => {
		if (activeWorker === null || state.kind === 'auth_required') {
			return false;
		}
		if (session.token(activeWorker) === null) {
			return false;
		}
		if (!connectivity.isOnline()) {
			dispatch({ kind: 'connectivity_changed', online: false });
			return false;
		}
		return true;
	};

	/**
	 * M3, M4: one order everywhere. The server fact is cached first, then the row
	 * is removed, then the file is deleted. A row that survives a kill still has
	 * its file, so the retry gets a replay instead of "file missing". The file
	 * goes last and best effort: a stray file is swept at startup.
	 */
	const discardRows = async (rows: QueuedAction[]) => {
		for (const row of rows) {
			await store.remove(row.clientActionId);
		}
		for (const row of rows) {
			try {
				await outcomes.discarded(row);
			} catch {
				continue;
			}
		}
	};

	const discard = (row: QueuedAction) => discardRows([row]);

	/**
	 * M4: a failed row only means "the last send of this slot failed". Once the
	 * worker acts on the slot again, that fact is stale and would outrank the
	 * server state in the UI.
	 */
	const olderFailedOfSlot = async (
		fresh: QueuedAction,
	): Promise<QueuedAction[]> => {
		const rows = await store.listAll(fresh.workerId);
		const position = rows.findIndex(
			(row) => row.clientActionId === fresh.clientActionId,
		);
		const older =
			position === -1
				? rows.filter((row) => row.createdAt <= fresh.createdAt)
				: rows.slice(0, position);
		return older.filter(
			(row) =>
				row.clientActionId !== fresh.clientActionId &&
				row.status.kind === 'failed' &&
				sameSlot(row.kind, fresh.kind),
		);
	};

	const discardOlderFailed = async (fresh: QueuedAction) => {
		await discardRows(await olderFailedOfSlot(fresh));
	};

	const findNextAction = async (
		sentThisPass: ReadonlySet<string>,
	): Promise<NextAction | null> => {
		const workerId = activeWorker;
		if (workerId === null) {
			return null;
		}
		const token = session.token(workerId);
		if (token === null) {
			return null;
		}
		// Deliberately not strict FIFO across backoff: a row waiting out its
		// backoff is not ready, so newer rows go first. Actions are independent and
		// the server deduplicates each id (M3), and strict FIFO would let one
		// failing action block every newer one. A pass sends each row at most
		// once, so a backoff that ends during a slow pass cannot keep it going.
		const ready = await store.listReady(workerId, clock.now());
		if (activeWorker !== workerId) {
			return null;
		}
		const action = ready.find(
			(candidate) => !sentThisPass.has(candidate.clientActionId),
		);
		return action === undefined ? null : { action, token };
	};

	const earliestWaitingTime = async (): Promise<number | null> => {
		const workerId = activeWorker;
		if (workerId === null) {
			return null;
		}
		const waiting = (await store.listAll(workerId)).filter(
			(action) => action.status.kind === 'queued',
		);
		return waiting.length === 0
			? null
			: Math.min(...waiting.map((action) => action.nextAttemptAt));
	};

	const sendSafely = async (
		action: QueuedAction,
		token: string,
	): Promise<SendResult> => {
		try {
			return await transport.send(action, token);
		} catch {
			return { kind: 'unreachable' };
		}
	};

	/**
	 * M10: a send can finish after the worker switched. The row still gets its
	 * store work, but the result must not change the engine state of the worker
	 * who is signed in now.
	 */
	const isActiveWorker = (action: QueuedAction) =>
		action.workerId === activeWorker;

	const scheduleRetry = async (action: QueuedAction): Promise<number> => {
		const until = clock.now() + nextDelayMs(action.attempts, ports.random);
		await store.recordAttempt(
			action.clientActionId,
			action.attempts + 1,
			until,
		);
		notify();
		return until;
	};

	const applyResult = async (
		{ action, token }: NextAction,
		result: SendResult,
	) => {
		switch (result.kind) {
			case 'delivered':
				// M3, M4: the sink is idempotent and runs before any removal. The
				// slot's older failed rows go before this row, so if a removal fails,
				// this row stays and its 200 replay redoes the cleanup.
				await outcomes.delivered(action);
				await discardRows([...(await olderFailedOfSlot(action)), action]);
				notify();
				return;

			case 'retryable':
				// M5: the server answered, so the link works. This row is no longer
				// ready, and the pass goes on with the next due row.
				await scheduleRetry(action);
				return;

			case 'unreachable': {
				const until = await scheduleRetry(action);
				if (isActiveWorker(action)) {
					dispatch({ kind: 'send_retryable', until });
				}
				return;
			}

			case 'stale_terms':
				await outcomes.staleTerms(action, result.currentTerms);
				await discard(action);
				notify();
				return;

			case 'rejected':
				await store.markFailed(action.clientActionId, result.reason);
				notify();
				await outcomes.rejected(action, result.reason);
				return;

			case 'unauthorized': {
				// The worker signed in again while this send used the old token: the
				// row stays queued and goes out again with the new one. No token at
				// all means the session ended, so the worker has to sign in.
				const current = session.token(action.workerId);
				if (current !== null && current !== token) {
					requestRun();
					return;
				}
				if (isActiveWorker(action)) {
					dispatch({ kind: 'unauthorized' });
				}
				return;
			}

			default:
				return assertNever(result);
		}
	};

	const passOverQueue = async () => {
		if (!canStartRun()) {
			return;
		}
		dispatch({ kind: 'run_started' });

		const sentThisPass = new Set<string>();
		while (state.kind === 'syncing') {
			const next = await findNextAction(sentThisPass);
			if (isStopped() || next === null) {
				const nextDueAt = await earliestWaitingTime();
				dispatch({ kind: 'run_finished', nextDueAt });
				return;
			}
			sentThisPass.add(next.action.clientActionId);
			const result = await sendSafely(next.action, next.token);
			await applyResult(next, result);
		}
	};

	/** Passes in a row that threw. The queue rows carry no attempt for these, so the engine counts. */
	let consecutivePassFailures = 0;

	/**
	 * One pass over the queue. It never throws: if a store or outcome call
	 * fails, the action stays in the queue and the engine backs off, longer each
	 * time the store keeps failing (M2, M5).
	 */
	const runOnePass = async () => {
		try {
			await passOverQueue();
			consecutivePassFailures = 0;
		} catch {
			dispatch({
				kind: 'send_retryable',
				until: clock.now() + nextDelayMs(consecutivePassFailures, ports.random),
			});
			consecutivePassFailures += 1;
		}
	};

	const runLoop = async () => {
		while (run.kind === 'running' || run.kind === 'running_with_pending') {
			await runOnePass();
			transition('pass_finished');
		}
		const waiters = settledWaiters;
		settledWaiters = [];
		for (const resolve of waiters) {
			resolve();
		}
	};

	const transition = (event: RunEvent) => {
		const next = stepRun(run, event);
		run = next.run;
		if (next.startLoop) {
			void runLoop();
		}
	};

	const requestRun = () => {
		transition('run_requested');
	};

	const makeDueThenRun = async () => {
		const workerId = activeWorker;
		if (workerId === null) {
			return;
		}
		try {
			await store.makeDueNow(workerId, clock.now());
		} catch {
			// The backoff timer still retries, so a failed write must not block the run.
		}
		requestRun();
	};

	/** Only `whenSettled` reads this, so a test can wait for a reconnect's retry. */
	let lastRetry: Promise<void> = Promise.resolve();

	const retryNow = () => {
		lastRetry = makeDueThenRun();
		return lastRetry;
	};

	return {
		start: () => {
			transition('start');
			stopListeningToConnectivity?.();
			stopListeningToConnectivity = connectivity.subscribe((online) => {
				// M5: only the offline -> online edge skips the backoff. A repeated
				// online event must not make a failing action due again.
				const cameBack = online && state.kind === 'offline';
				dispatch({ kind: 'connectivity_changed', online });
				if (cameBack) {
					void retryNow();
				} else if (online) {
					requestRun();
				}
			});
			dispatch({
				kind: 'connectivity_changed',
				online: connectivity.isOnline(),
			});
			requestRun();
		},

		stop: () => {
			stopListeningToConnectivity?.();
			stopListeningToConnectivity = null;
			cancelTimer?.();
			cancelTimer = null;
			transition('stop');
		},

		setActiveWorker: (workerId) => {
			activeWorker = workerId;
			dispatch({ kind: workerId === null ? 'signed_out' : 'signed_in' });
			if (workerId !== null) {
				requestRun();
			}
		},

		enqueue: async (newAction) => {
			const action: QueuedAction = {
				clientActionId: ports.newId(),
				workerId: newAction.workerId,
				kind: newAction.kind,
				status: { kind: 'queued' },
				createdAt: clock.now(),
				attempts: 0,
				nextAttemptAt: 0,
			};
			await store.insert(action);
			try {
				await discardOlderFailed(action);
			} catch {
				// The new action is already durable (M3). Its delivery removes the
				// stray failed row (M4).
			}
			notify();
			requestRun();
			return action;
		},

		dismissFailed: async (clientActionId) => {
			if (activeWorker === null) {
				return;
			}
			const row = (await store.listAll(activeWorker)).find(
				(action) => action.clientActionId === clientActionId,
			);
			if (row?.status.kind !== 'failed') {
				return;
			}
			await discard(row);
			notify();
		},

		requestRun,

		retryNow,

		reportUnauthorized: () => {
			dispatch({ kind: 'unauthorized' });
		},

		whenSettled: async () => {
			await lastRetry;
			if (run.kind === 'idle' || run.kind === 'stopped') {
				return;
			}
			await new Promise<void>((resolve) => {
				settledWaiters = [...settledWaiters, resolve];
			});
		},

		getState: () => state,

		subscribe: (listener) => {
			listeners = [...listeners, listener];
			return () => {
				listeners = listeners.filter((other) => other !== listener);
			};
		},
	};
};
