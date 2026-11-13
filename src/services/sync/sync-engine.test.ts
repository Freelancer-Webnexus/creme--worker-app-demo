import type { Assignment, TermsVersion } from '@/services/api/api-types';
import { migrate } from '@/services/storage/schema';
import { openBunSqliteDriver } from '@/services/storage/testing/bun-sqlite-driver';
import { createWorkerCacheStore } from '@/services/storage/worker-cache-store';
import {
	canSubmitDocument,
	documentRowState,
} from '@/services/sync/document-row-state';
import { createOutcomeSink } from '@/services/sync/outcome-sink';
import { createSyncEngine } from '@/services/sync/sync-engine';
import type {
	OutcomeSink,
	QueueStore,
	Transport,
} from '@/services/sync/sync-ports';
import type { NewAction, SendResult } from '@/services/sync/sync-types';
import { termsState } from '@/services/sync/terms-state';
import { createFakeClock } from '@/services/sync/testing/fake-clock';
import { createFakeConnectivity } from '@/services/sync/testing/fake-connectivity';
import {
	createFakeServerTransport,
	createFakeTransport,
	type SendCall,
} from '@/services/sync/testing/fake-transport';
import {
	createMemoryQueueStore,
	type MemoryQueueStore,
} from '@/services/sync/testing/memory-queue-store';
import {
	createRecordingOutcomeSink,
	type RecordingOutcomeSink,
} from '@/services/sync/testing/recording-outcome-sink';

type Options = {
	online?: boolean;
	store?: MemoryQueueStore;
	wrapStore?: (store: MemoryQueueStore) => QueueStore;
	transport?: Transport & { calls: SendCall[] };
	wrapOutcomes?: (sink: RecordingOutcomeSink) => OutcomeSink;
	token?: (workerId: string) => string | null;
};

const createHarness = (options: Options = {}) => {
	const store = options.store ?? createMemoryQueueStore();
	const transport = options.transport ?? createFakeTransport();
	const clock = createFakeClock();
	const connectivity = createFakeConnectivity(options.online ?? false);
	const outcomes = createRecordingOutcomeSink();
	let counter = 0;

	const engine = createSyncEngine({
		store: options.wrapStore ? options.wrapStore(store) : store,
		transport,
		clock,
		connectivity,
		session: { token: options.token ?? ((workerId) => `token-${workerId}`) },
		outcomes: options.wrapOutcomes ? options.wrapOutcomes(outcomes) : outcomes,
		random: () => 0.5,
		newId: () => {
			counter += 1;
			return `action-${counter}`;
		},
	});

	return { engine, store, transport, clock, connectivity, outcomes };
};

const upload = (
	workerId: string,
	documentType = 'passport',
	fileUri = 'file:///photo.jpg',
): NewAction => ({
	workerId,
	kind: { type: 'document_upload', documentType, fileUri },
});

const acceptance = (workerId: string, termsVersionId: string): NewAction => ({
	workerId,
	kind: { type: 'terms_acceptance', termsVersionId },
});

const sentIds = (transport: { calls: SendCall[] }) =>
	transport.calls.map((call) => call.clientActionId);

const delivered: SendResult = { kind: 'delivered', replay: false };

const termsV2: TermsVersion = {
	id: 'terms-v2',
	version: 2,
	publishedAt: '2026-01-01',
	summary: { es: 'texto', en: 'text' },
};

const termsV3: TermsVersion = {
	id: 'terms-v3',
	version: 3,
	publishedAt: '2026-06-01',
	summary: { es: 'texto nuevo', en: 'new text' },
};

const anaAssignment: Assignment = {
	order: {
		id: 'JO',
		employer: 'e',
		worksite: 'w',
		seasonStart: '2026-03-01',
		seasonEnd: '2026-07-31',
	},
	currentTerms: termsV2,
	acceptedTermsVersionId: null,
	requiredDocuments: ['passport', 'signed_contract'],
	documents: [],
	flags: {},
};

const openRealOutcomes = async (
	onDelete: (fileUri: string) => void = () => undefined,
) => {
	const driver = openBunSqliteDriver(':memory:');
	await migrate(driver);
	const cache = createWorkerCacheStore(driver, { now: () => 5 });
	await cache.saveAssignment('ana', anaAssignment, 1);
	const deletedFiles: string[] = [];
	const sink = createOutcomeSink({
		cache,
		onServerFactChanged: () => undefined,
		deleteUpload: async (fileUri) => {
			deletedFiles.push(fileUri);
			onDelete(fileUri);
		},
	});
	return { driver, cache, sink, deletedFiles };
};

describe('sync engine', () => {
	it('M1 sends a queued action once when connectivity returns', async () => {
		const { engine, store, transport, connectivity, outcomes } = createHarness({
			online: false,
		});
		engine.start();
		engine.setActiveWorker('ana');

		const action = await engine.enqueue(upload('ana'));
		await engine.whenSettled();

		expect(transport.calls).toHaveLength(0);
		expect(engine.getState()).toEqual({ kind: 'offline' });
		expect(store.rows()).toHaveLength(1);

		connectivity.setOnline(true);
		await engine.whenSettled();

		expect(sentIds(transport)).toEqual([action.clientActionId]);
		expect(store.rows()).toHaveLength(0);
		expect(outcomes.deliveredActions).toHaveLength(1);
		expect(engine.getState()).toEqual({ kind: 'idle' });
	});

	it('M2 rehydrates the queue after a restart', async () => {
		const first = createHarness({ online: false });
		first.engine.start();
		const a = await first.engine.enqueue(upload('ana', 'passport'));
		const b = await first.engine.enqueue(upload('ana', 'signed_contract'));
		first.engine.stop();

		const second = createHarness({ online: false, store: first.store });
		second.engine.start();
		second.engine.setActiveWorker('ana');
		second.connectivity.setOnline(true);
		await second.engine.whenSettled();

		expect(sentIds(second.transport)).toEqual([
			a.clientActionId,
			b.clientActionId,
		]);
		expect(
			second.outcomes.deliveredActions.map((action) => action.clientActionId),
		).toEqual([a.clientActionId, b.clientActionId]);
		expect(first.store.rows()).toHaveLength(0);
	});

	it('M3 dropped response then retry leaves one server record', async () => {
		const server = createFakeServerTransport();
		const { engine, store, clock } = createHarness({
			online: true,
			transport: server,
		});
		engine.start();
		engine.setActiveWorker('ana');
		server.loseNextResponse();

		const action = await engine.enqueue(upload('ana'));
		await engine.whenSettled();

		expect(server.savedIds()).toEqual([action.clientActionId]);
		expect(store.rows()).toHaveLength(1);

		clock.advance(1_000);
		await engine.whenSettled();

		expect(sentIds(server)).toEqual([
			action.clientActionId,
			action.clientActionId,
		]);
		expect(server.savedIds()).toHaveLength(1);
		expect(store.rows()).toHaveLength(0);
	});

	it('M5 retries a 500 with backoff', async () => {
		const transport = createFakeTransport();
		transport.script({ kind: 'retryable' }, { kind: 'retryable' });
		const { engine, store, clock, outcomes } = createHarness({
			online: true,
			transport,
		});
		engine.start();
		engine.setActiveWorker('ana');
		const startedAt = clock.now();

		await engine.enqueue(upload('ana'));
		await engine.whenSettled();

		expect(transport.calls).toHaveLength(1);
		expect(engine.getState()).toEqual({
			kind: 'backing_off',
			until: startedAt + 1_000,
		});

		clock.advance(999);
		await engine.whenSettled();
		expect(transport.calls).toHaveLength(1);

		clock.advance(1);
		await engine.whenSettled();
		expect(transport.calls).toHaveLength(2);
		expect(engine.getState()).toEqual({
			kind: 'backing_off',
			until: startedAt + 1_000 + 2_000,
		});
		expect(store.rows()[0]?.attempts).toBe(2);

		clock.advance(1_999);
		await engine.whenSettled();
		expect(transport.calls).toHaveLength(2);

		clock.advance(1);
		await engine.whenSettled();
		expect(transport.calls).toHaveLength(3);
		expect(store.rows()).toHaveLength(0);
		expect(outcomes.deliveredActions).toHaveLength(1);
		expect(engine.getState()).toEqual({ kind: 'idle' });
	});

	it('M5 does not retry 413 or 422 and surfaces the error', async () => {
		const transport = createFakeTransport();
		transport.script({ kind: 'rejected', reason: 'too_large' });
		const { engine, store, outcomes } = createHarness({
			online: true,
			transport,
		});
		engine.start();
		engine.setActiveWorker('ana');

		const a = await engine.enqueue(upload('ana', 'passport'));
		const b = await engine.enqueue(upload('ana', 'signed_contract'));
		await engine.whenSettled();

		expect(sentIds(transport)).toEqual([a.clientActionId, b.clientActionId]);
		expect(store.rows()).toHaveLength(1);
		expect(store.rows()[0]).toMatchObject({
			clientActionId: a.clientActionId,
			status: { kind: 'failed', reason: 'too_large' },
		});
		expect(outcomes.rejectedCalls).toHaveLength(1);
		expect(outcomes.rejectedCalls[0]?.reason).toBe('too_large');
		expect(outcomes.rejectedCalls[0]?.action.clientActionId).toBe(
			a.clientActionId,
		);
		expect(outcomes.deliveredActions.map((x) => x.clientActionId)).toEqual([
			b.clientActionId,
		]);
	});

	it('M5 keeps going after a 422 as well', async () => {
		const transport = createFakeTransport();
		transport.script({ kind: 'rejected', reason: 'unknown_document_type' });
		const { engine, store } = createHarness({ online: true, transport });
		engine.start();
		engine.setActiveWorker('ana');

		await engine.enqueue(upload('ana', 'nonsense'));
		await engine.enqueue(upload('ana', 'passport'));
		await engine.whenSettled();

		expect(transport.calls).toHaveLength(2);
		expect(store.rows()).toHaveLength(1);
		expect(store.rows()[0]?.status).toEqual({
			kind: 'failed',
			reason: 'unknown_document_type',
		});
	});

	it('M5 a pass sends each action at most once, even when its backoff ends during the pass', async () => {
		const calls: SendCall[] = [];
		let advanceDuringSend = (): void => undefined;
		const transport: Transport & { calls: SendCall[] } = {
			calls,
			send: async (action, token) => {
				calls.push({
					clientActionId: action.clientActionId,
					workerId: action.workerId,
					token,
				});
				advanceDuringSend();
				return calls.length > 10 ? delivered : { kind: 'retryable' };
			},
		};
		const { engine, clock, connectivity } = createHarness({
			online: false,
			transport,
		});
		advanceDuringSend = () => {
			clock.advance(120_000);
		};
		engine.start();
		engine.setActiveWorker('ana');
		await engine.enqueue(upload('ana'));
		await engine.enqueue(acceptance('ana', 'terms-v2'));

		connectivity.setOnline(true);
		await engine.whenSettled();

		expect(calls).toHaveLength(2);
		expect(engine.getState().kind).toBe('backing_off');
	});

	it('M5 an older action that keeps getting a 5xx does not hold a newer due one', async () => {
		const alwaysFailing = new Set<string>();
		const calls: SendCall[] = [];
		const transport: Transport & { calls: SendCall[] } = {
			calls,
			send: async (action, token) => {
				calls.push({
					clientActionId: action.clientActionId,
					workerId: action.workerId,
					token,
				});
				return alwaysFailing.has(action.clientActionId)
					? { kind: 'retryable' }
					: delivered;
			},
		};
		const { engine, store, clock, connectivity } = createHarness({
			online: false,
			transport,
		});
		engine.start();
		engine.setActiveWorker('ana');
		const older = await engine.enqueue(upload('ana'));
		const newer = await engine.enqueue(acceptance('ana', 'terms-v2'));
		alwaysFailing.add(older.clientActionId);

		connectivity.setOnline(true);
		await engine.whenSettled();

		expect(sentIds(transport)).toEqual([
			older.clientActionId,
			newer.clientActionId,
		]);
		const until = clock.now() + 1_000;
		expect(store.rows()).toEqual([
			{ ...older, attempts: 1, nextAttemptAt: until },
		]);
		expect(engine.getState()).toEqual({ kind: 'backing_off', until });
		expect(clock.pendingTimers()).toBe(1);
	});

	for (const failure of [
		{ kind: 'unreachable' },
		{ kind: 'throws' },
	] as const) {
		it(`M5 a transport failure (${failure.kind}) ends the pass and the newer action waits`, async () => {
			const transport = createFakeTransport();
			const { engine, store, connectivity } = createHarness({
				online: false,
				transport,
			});
			engine.start();
			engine.setActiveWorker('ana');
			const older = await engine.enqueue(upload('ana'));
			const newer = await engine.enqueue(acceptance('ana', 'terms-v2'));
			transport.script(failure);

			connectivity.setOnline(true);
			await engine.whenSettled();

			expect(sentIds(transport)).toEqual([older.clientActionId]);
			expect(
				store.rows().map((row) => [row.clientActionId, row.attempts]),
			).toEqual([
				[older.clientActionId, 1],
				[newer.clientActionId, 0],
			]);
			expect(engine.getState().kind).toBe('backing_off');
		});
	}

	it('M6 stale terms removes the acceptance and requires reconfirmation', async () => {
		const transport = createFakeTransport();
		transport.script({ kind: 'stale_terms', currentTerms: termsV3 });
		const real = await openRealOutcomes();
		await real.cache.markTermsSeen('ana', 'terms-v2');
		const { engine, store } = createHarness({
			online: true,
			transport,
			wrapOutcomes: () => real.sink,
		});
		engine.start();
		engine.setActiveWorker('ana');

		await engine.enqueue(acceptance('ana', 'terms-v2'));
		await engine.whenSettled();

		expect(store.rows()).toHaveLength(0);
		const cached = await real.cache.read('ana');
		if (cached === null) {
			throw new Error('The cache row is missing.');
		}
		expect(cached.assignment.currentTerms).toEqual(termsV3);
		const state = termsState({
			current: cached.assignment.currentTerms,
			acceptedTermsVersionId: cached.assignment.acceptedTermsVersionId,
			lastSeenTermsVersionId: cached.lastSeenTermsVersionId,
			localActions: await store.listAll('ana'),
		});
		expect(state).toEqual({
			kind: 'needs_confirmation',
			version: termsV3,
			changedSinceLastSeen: true,
		});
		real.driver.close();
	});

	it('M10 two workers keep separate queues', async () => {
		const { engine, store, transport } = createHarness({ online: true });
		engine.start();
		const bruno = await engine.enqueue(upload('bruno'));
		const carla = await engine.enqueue(upload('carla'));

		engine.setActiveWorker('carla');
		await engine.whenSettled();

		expect(sentIds(transport)).toEqual([carla.clientActionId]);
		expect(transport.calls[0]?.workerId).toBe('carla');
		expect(await store.listAll('bruno')).toEqual([bruno]);
		expect(await store.listAll('carla')).toEqual([]);

		engine.setActiveWorker('bruno');
		await engine.whenSettled();

		expect(sentIds(transport)).toEqual([
			carla.clientActionId,
			bruno.clientActionId,
		]);
		expect(store.rows()).toHaveLength(0);
	});

	it('401 pauses and keeps the queue', async () => {
		const transport = createFakeTransport();
		transport.script({ kind: 'unauthorized' });
		const { engine, store } = createHarness({ online: true, transport });
		engine.start();
		engine.setActiveWorker('ana');

		const action = await engine.enqueue(upload('ana'));
		await engine.whenSettled();

		expect(engine.getState()).toEqual({ kind: 'auth_required' });
		expect(store.rows()).toEqual([action]);
		expect(transport.calls).toHaveLength(1);

		engine.requestRun();
		await engine.whenSettled();
		expect(transport.calls).toHaveLength(1);
		expect(engine.getState()).toEqual({ kind: 'auth_required' });

		engine.setActiveWorker('ana');
		await engine.whenSettled();

		expect(sentIds(transport)).toEqual([
			action.clientActionId,
			action.clientActionId,
		]);
		expect(store.rows()).toHaveLength(0);
		expect(engine.getState()).toEqual({ kind: 'idle' });
	});

	it('two triggers start one loop', async () => {
		const transport = createFakeTransport();
		const held = transport.holdNextSend();
		const { engine, store } = createHarness({ online: true, transport });
		engine.start();
		engine.setActiveWorker('ana');

		const first = await engine.enqueue(upload('ana', 'passport'));
		await held.sendStarted;
		const second = await engine.enqueue(upload('ana', 'signed_contract'));
		engine.requestRun();
		engine.requestRun();
		engine.requestRun();

		expect(sentIds(transport)).toEqual([first.clientActionId]);

		held.release(delivered);
		await engine.whenSettled();

		expect(sentIds(transport)).toEqual([
			first.clientActionId,
			second.clientActionId,
		]);
		expect(store.rows()).toHaveLength(0);
	});

	it('an action enqueued during a run is sent in the same session', async () => {
		const transport = createFakeTransport();
		const held = transport.holdNextSend();
		const { engine, store, clock } = createHarness({ online: true, transport });
		engine.start();
		engine.setActiveWorker('ana');

		const first = await engine.enqueue(upload('ana', 'passport'));
		await held.sendStarted;
		const second = await engine.enqueue(upload('ana', 'signed_contract'));
		held.release(delivered);
		await engine.whenSettled();

		expect(sentIds(transport)).toEqual([
			first.clientActionId,
			second.clientActionId,
		]);
		expect(store.rows()).toHaveLength(0);
		expect(clock.pendingTimers()).toBe(0);
		expect(engine.getState()).toEqual({ kind: 'idle' });
	});

	it('a transport that throws does not lose the action', async () => {
		const transport = createFakeTransport();
		transport.script({ kind: 'throws' });
		const { engine, store, clock, outcomes } = createHarness({
			online: true,
			transport,
		});
		engine.start();
		engine.setActiveWorker('ana');

		const action = await engine.enqueue(upload('ana'));
		await engine.whenSettled();

		expect(store.rows()).toHaveLength(1);
		expect(store.rows()[0]).toMatchObject({
			clientActionId: action.clientActionId,
			attempts: 1,
		});
		expect(engine.getState().kind).toBe('backing_off');

		clock.advance(1_000);
		await engine.whenSettled();

		expect(sentIds(transport)).toEqual([
			action.clientActionId,
			action.clientActionId,
		]);
		expect(store.rows()).toHaveLength(0);
		expect(outcomes.deliveredActions).toHaveLength(1);
	});

	it('a store that throws backs off and keeps the action', async () => {
		let failNextRemove = true;
		const { engine, store } = createHarness({
			online: true,
			wrapStore: (memory) => ({
				...memory,
				remove: async (clientActionId) => {
					if (failNextRemove) {
						failNextRemove = false;
						throw new Error('disk full');
					}
					await memory.remove(clientActionId);
				},
			}),
		});
		engine.start();
		engine.setActiveWorker('ana');
		await engine.whenSettled();

		await engine.enqueue(upload('ana'));
		await engine.whenSettled();

		expect(engine.getState().kind).toBe('backing_off');
		expect(store.rows()).toHaveLength(1);
	});

	it('M5 a store that keeps throwing backs off 1 s, 2 s, 4 s up to the cap and resets after a good pass', async () => {
		let failing = true;
		const { engine, clock, store, outcomes } = createHarness({
			online: true,
			wrapStore: (memory) => ({
				...memory,
				listReady: async (workerId, now) => {
					if (failing) {
						throw new Error('disk');
					}
					return memory.listReady(workerId, now);
				},
			}),
		});
		engine.start();
		await engine.enqueue(upload('ana'));
		const waitedMs = async () => {
			await engine.whenSettled();
			const state = engine.getState();
			if (state.kind !== 'backing_off') {
				throw new Error(`Expected backing_off, got ${state.kind}`);
			}
			const delay = state.until - clock.now();
			clock.advance(delay);
			return delay;
		};

		engine.setActiveWorker('ana');
		const delays: number[] = [];
		for (let failure = 0; failure < 8; failure += 1) {
			delays.push(await waitedMs());
		}

		expect(delays).toEqual([
			1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000,
		]);

		failing = false;
		await engine.whenSettled();
		clock.advance(60_000);
		await engine.whenSettled();
		expect(store.rows()).toHaveLength(0);
		expect(outcomes.deliveredActions).toHaveLength(1);

		failing = true;
		await engine.enqueue(upload('ana', 'signed_contract'));
		expect(await waitedMs()).toBe(1_000);
	});

	it('signing out while offline stays offline, and a repeated offline event tells nobody', async () => {
		const { engine, connectivity } = createHarness({ online: false });
		engine.start();
		engine.setActiveWorker('ana');
		let notifications = 0;
		engine.subscribe(() => {
			notifications += 1;
		});

		engine.setActiveWorker(null);
		expect(engine.getState()).toEqual({ kind: 'offline' });

		connectivity.setOnline(false);
		connectivity.setOnline(false);
		expect(notifications).toBe(0);
	});

	it('does not send anything until a worker is active, but still stores the action', async () => {
		const { engine, store, transport } = createHarness({ online: true });
		engine.start();

		await engine.enqueue(upload('ana'));
		await engine.whenSettled();

		expect(transport.calls).toHaveLength(0);
		expect(store.rows()).toHaveLength(1);

		engine.setActiveWorker(null);
		await engine.whenSettled();
		expect(transport.calls).toHaveLength(0);
		expect(engine.getState()).toEqual({ kind: 'idle' });
	});

	it('M5 going offline cancels the backoff timer, and coming back sends without waiting out the backoff', async () => {
		const transport = createFakeTransport();
		transport.script({ kind: 'retryable' });
		const { engine, clock, connectivity } = createHarness({
			online: true,
			transport,
		});
		engine.start();
		engine.setActiveWorker('ana');
		const startedAt = clock.now();

		await engine.enqueue(upload('ana'));
		await engine.whenSettled();
		expect(clock.pendingTimers()).toBe(1);

		connectivity.setOnline(false);
		expect(engine.getState()).toEqual({ kind: 'offline' });
		expect(clock.pendingTimers()).toBe(0);

		connectivity.setOnline(true);
		await engine.whenSettled();
		expect(transport.calls).toHaveLength(2);
		expect(engine.getState()).toEqual({ kind: 'idle' });
		expect(clock.now()).toBe(startedAt);
	});

	it('reportUnauthorized pauses the engine', async () => {
		const { engine, transport } = createHarness({ online: true });
		engine.start();
		engine.setActiveWorker('ana');

		engine.reportUnauthorized();
		await engine.enqueue(upload('ana'));
		await engine.whenSettled();

		expect(engine.getState()).toEqual({ kind: 'auth_required' });
		expect(transport.calls).toHaveLength(0);
	});

	it('tells subscribers about queue changes and state changes', async () => {
		const { engine } = createHarness({ online: true });
		engine.start();
		engine.setActiveWorker('ana');
		let notifications = 0;
		const unsubscribe = engine.subscribe(() => {
			notifications += 1;
		});

		await engine.enqueue(upload('ana'));
		const afterEnqueue = notifications;
		expect(afterEnqueue).toBeGreaterThan(0);

		await engine.whenSettled();
		expect(notifications).toBeGreaterThan(afterEnqueue);

		unsubscribe();
		const afterUnsubscribe = notifications;
		await engine.enqueue(upload('ana'));
		await engine.whenSettled();
		expect(notifications).toBe(afterUnsubscribe);
	});

	it('M2 a throwing subscriber does not break enqueue, the run or the backoff timer', async () => {
		const transport = createFakeTransport();
		transport.script({ kind: 'retryable' });
		const { engine, store, clock } = createHarness({ online: true, transport });
		engine.subscribe(() => {
			throw new Error('ui bug');
		});
		engine.start();
		engine.setActiveWorker('ana');

		const action = await engine.enqueue(upload('ana'));
		await engine.whenSettled();

		expect(store.rows()).toHaveLength(1);
		expect(transport.calls).toHaveLength(1);
		expect(engine.getState().kind).toBe('backing_off');
		expect(clock.pendingTimers()).toBe(1);

		clock.advance(1_000);
		await engine.whenSettled();

		expect(sentIds(transport)).toEqual([
			action.clientActionId,
			action.clientActionId,
		]);
		expect(store.rows()).toHaveLength(0);
	});

	describe('M10 a result that arrives after the worker switched', () => {
		const switchWorkerDuringSend = async (result: SendResult) => {
			const transport = createFakeTransport();
			const held = transport.holdNextSend();
			const harness = createHarness({ online: true, transport });
			const { engine } = harness;
			engine.start();
			const ana = await engine.enqueue(upload('ana'));
			const carla = await engine.enqueue(upload('carla'));
			const seenStates: string[] = [];
			engine.subscribe(() => {
				seenStates.push(engine.getState().kind);
			});

			engine.setActiveWorker('ana');
			await held.sendStarted;
			engine.setActiveWorker('carla');
			held.release(result);
			await engine.whenSettled();

			return { ...harness, ana, carla, seenStates };
		};

		for (const failure of [
			{ kind: 'retryable' },
			{ kind: 'unreachable' },
		] as const) {
			it(`does not back off Carla because of a ${failure.kind} result for Ana`, async () => {
				const { engine, store, transport, clock, ana, carla, seenStates } =
					await switchWorkerDuringSend(failure);

				expect(seenStates).not.toContain('backing_off');
				expect(clock.pendingTimers()).toBe(0);
				expect(engine.getState()).toEqual({ kind: 'idle' });
				expect(sentIds(transport)).toEqual([
					ana.clientActionId,
					carla.clientActionId,
				]);
				expect(store.rows()).toHaveLength(1);
				expect(store.rows()[0]).toMatchObject({
					clientActionId: ana.clientActionId,
					attempts: 1,
				});
			});
		}

		it('does not pause Carla because of a 401 for Ana', async () => {
			const { engine, store, transport, ana, carla } =
				await switchWorkerDuringSend({ kind: 'unauthorized' });

			expect(engine.getState()).toEqual({ kind: 'idle' });
			expect(sentIds(transport)).toEqual([
				ana.clientActionId,
				carla.clientActionId,
			]);
			expect(store.rows().map((row) => row.clientActionId)).toEqual([
				ana.clientActionId,
			]);
		});

		it("does not pause Carla when Ana's token is gone by the time her 401 arrives", async () => {
			const tokens = new Map([
				['ana', 'a'],
				['carla', 'c'],
			]);
			const transport = createFakeTransport();
			const held = transport.holdNextSend();
			const { engine, store } = createHarness({
				online: true,
				transport,
				token: (workerId) => tokens.get(workerId) ?? null,
			});
			engine.start();
			const ana = await engine.enqueue(upload('ana'));
			const carla = await engine.enqueue(upload('carla'));

			engine.setActiveWorker('ana');
			await held.sendStarted;
			engine.setActiveWorker('carla');
			tokens.delete('ana');
			held.release({ kind: 'unauthorized' });
			await engine.whenSettled();

			expect(engine.getState()).toEqual({ kind: 'idle' });
			expect(sentIds(transport)).toEqual([
				ana.clientActionId,
				carla.clientActionId,
			]);
			expect(store.rows().map((row) => row.clientActionId)).toEqual([
				ana.clientActionId,
			]);
		});
	});

	describe('failed rows', () => {
		const tooLarge: SendResult = { kind: 'rejected', reason: 'too_large' };

		it('M4 a retake replaces the older failed row of the same document and discards its file', async () => {
			const transport = createFakeTransport();
			transport.script(tooLarge);
			const { engine, store, outcomes } = createHarness({
				online: true,
				transport,
			});
			engine.start();
			engine.setActiveWorker('ana');
			const failed = await engine.enqueue(
				upload('ana', 'passport', 'file:///old.jpg'),
			);
			await engine.whenSettled();
			expect(store.rows()[0]?.status.kind).toBe('failed');

			const retake = await engine.enqueue(
				upload('ana', 'passport', 'file:///new.jpg'),
			);
			await engine.whenSettled();

			expect(store.rows()).toHaveLength(0);
			expect(sentIds(transport)).toEqual([
				failed.clientActionId,
				retake.clientActionId,
			]);
			expect(outcomes.discardedActions.map((x) => x.clientActionId)).toEqual([
				failed.clientActionId,
				retake.clientActionId,
			]);
		});

		it('M4 keeps failed rows of other documents and of other workers', async () => {
			const transport = createFakeTransport();
			transport.script(tooLarge, tooLarge, tooLarge);
			const { engine, store, outcomes } = createHarness({
				online: true,
				transport,
			});
			engine.start();
			engine.setActiveWorker('ana');
			const contract = await engine.enqueue(upload('ana', 'signed_contract'));
			const passport = await engine.enqueue(upload('ana', 'passport'));
			await engine.whenSettled();
			engine.setActiveWorker('bruno');
			const brunoPassport = await engine.enqueue(upload('bruno', 'passport'));
			await engine.whenSettled();
			engine.setActiveWorker('ana');
			await engine.whenSettled();

			const retake = await engine.enqueue(
				upload('ana', 'passport', 'file:///new.jpg'),
			);
			await engine.whenSettled();

			expect(store.rows().map((row) => row.clientActionId)).toEqual([
				contract.clientActionId,
				brunoPassport.clientActionId,
			]);
			expect(outcomes.discardedActions.map((x) => x.clientActionId)).toEqual([
				passport.clientActionId,
				retake.clientActionId,
			]);
		});

		it('M6 a new acceptance replaces the failed acceptance', async () => {
			const transport = createFakeTransport();
			transport.script({ kind: 'rejected', reason: 'rejected' });
			const { engine, store, outcomes } = createHarness({
				online: true,
				transport,
			});
			engine.start();
			engine.setActiveWorker('ana');
			const failed = await engine.enqueue(acceptance('ana', 'terms-v2'));
			await engine.whenSettled();

			const second = await engine.enqueue(acceptance('ana', 'terms-v2'));
			await engine.whenSettled();

			expect(store.rows()).toHaveLength(0);
			expect(outcomes.discardedActions.map((x) => x.clientActionId)).toEqual([
				failed.clientActionId,
				second.clientActionId,
			]);
		});

		it('M2 a sink that fails to discard does not fail the enqueue', async () => {
			const transport = createFakeTransport();
			transport.script(tooLarge);
			const { engine, store } = createHarness({
				online: true,
				transport,
				wrapOutcomes: (recording) => ({
					...recording,
					discarded: async () => {
						throw new Error('disk');
					},
				}),
			});
			engine.start();
			engine.setActiveWorker('ana');
			await engine.enqueue(upload('ana'));
			await engine.whenSettled();

			const retake = await engine.enqueue(upload('ana'));
			await engine.whenSettled();

			expect(retake.status.kind).toBe('queued');
			expect(store.rows()).toHaveLength(0);
		});

		it('M4 dismissFailed removes one failed row and discards its file', async () => {
			const transport = createFakeTransport();
			transport.script(tooLarge);
			const { engine, store, outcomes } = createHarness({
				online: true,
				transport,
			});
			engine.start();
			engine.setActiveWorker('ana');
			const failed = await engine.enqueue(upload('ana'));
			await engine.whenSettled();

			await engine.dismissFailed(failed.clientActionId);

			expect(store.rows()).toHaveLength(0);
			expect(outcomes.discardedActions.map((x) => x.clientActionId)).toEqual([
				failed.clientActionId,
			]);
		});

		it('dismissFailed does nothing for a queued row or an unknown id', async () => {
			const { engine, store, outcomes } = createHarness({ online: false });
			engine.start();
			engine.setActiveWorker('ana');
			const queued = await engine.enqueue(upload('ana'));

			await engine.dismissFailed(queued.clientActionId);
			await engine.dismissFailed('nope');

			expect(store.rows()).toEqual([queued]);
			expect(outcomes.discardedActions).toHaveLength(0);
		});

		it('M4 413 on the passport, then a retake that is delivered, shows pending review and blocks a new submit', async () => {
			const transport = createFakeTransport();
			transport.script(tooLarge);
			const real = await openRealOutcomes();
			const { engine, store } = createHarness({
				online: true,
				transport,
				wrapOutcomes: () => real.sink,
			});
			engine.start();
			engine.setActiveWorker('ana');
			await engine.enqueue(upload('ana', 'passport', 'file:///old.jpg'));
			await engine.whenSettled();
			const afterFailure = documentRowState(
				'passport',
				(await real.cache.read('ana'))?.assignment.documents ?? [],
				await store.listAll('ana'),
			);
			expect(afterFailure).toEqual({
				kind: 'send_failed',
				reason: 'too_large',
			});

			await engine.enqueue(upload('ana', 'passport', 'file:///new.jpg'));
			await engine.whenSettled();

			const row = documentRowState(
				'passport',
				(await real.cache.read('ana'))?.assignment.documents ?? [],
				await store.listAll('ana'),
			);
			expect(row).toEqual({ kind: 'pending_review' });
			expect(canSubmitDocument(row)).toBe(false);
			expect(real.deletedFiles.sort()).toEqual([
				'file:///new.jpg',
				'file:///old.jpg',
			]);
			real.driver.close();
		});

		it('M4 a retake whose cleanup of the failed row was interrupted shows pending review once delivered', async () => {
			const transport = createFakeTransport();
			transport.script(tooLarge);
			const real = await openRealOutcomes();
			let failNextListAll = false;
			const { engine, store } = createHarness({
				online: true,
				transport,
				wrapOutcomes: () => real.sink,
				wrapStore: (memory) => ({
					...memory,
					listAll: async (workerId) => {
						if (failNextListAll) {
							failNextListAll = false;
							throw new Error('killed before the cleanup');
						}
						return memory.listAll(workerId);
					},
				}),
			});
			engine.start();
			engine.setActiveWorker('ana');
			await engine.enqueue(upload('ana', 'passport', 'file:///old.jpg'));
			await engine.whenSettled();

			failNextListAll = true;
			await engine.enqueue(upload('ana', 'passport', 'file:///new.jpg'));
			expect(failNextListAll).toBe(false);
			await engine.whenSettled();

			expect(store.rows()).toEqual([]);
			expect(
				documentRowState(
					'passport',
					(await real.cache.read('ana'))?.assignment.documents ?? [],
					await store.listAll('ana'),
				),
			).toEqual({ kind: 'pending_review' });
			expect(real.deletedFiles.sort()).toEqual([
				'file:///new.jpg',
				'file:///old.jpg',
			]);
			real.driver.close();
		});
	});

	describe('a 401 for a send made with a token that was replaced', () => {
		const withHeldSend = () => {
			const tokens = new Map([['ana', 'old']]);
			const transport = createFakeTransport();
			const held = transport.holdNextSend();
			const harness = createHarness({
				online: true,
				transport,
				token: (workerId) => tokens.get(workerId) ?? null,
			});
			return { ...harness, tokens, held };
		};

		const sentWith = (transport: { calls: SendCall[] }) =>
			transport.calls.map((call) => [call.clientActionId, call.token]);

		it('signing in again while the old send is in flight does not end in auth_required', async () => {
			const { engine, store, transport, tokens, held } = withHeldSend();
			engine.start();
			engine.setActiveWorker('ana');
			const action = await engine.enqueue(upload('ana'));
			await held.sendStarted;

			engine.reportUnauthorized();
			tokens.set('ana', 'new');
			engine.setActiveWorker('ana');
			held.release({ kind: 'unauthorized' });
			await engine.whenSettled();

			expect(engine.getState()).toEqual({ kind: 'idle' });
			expect(sentWith(transport)).toEqual([
				[action.clientActionId, 'old'],
				[action.clientActionId, 'new'],
			]);
			expect(store.rows()).toEqual([]);
		});

		it('a token replaced during the send sends the row again with the new token', async () => {
			const { engine, store, transport, tokens, held } = withHeldSend();
			engine.start();
			engine.setActiveWorker('ana');
			const action = await engine.enqueue(upload('ana'));
			await held.sendStarted;

			tokens.set('ana', 'new');
			held.release({ kind: 'unauthorized' });
			await engine.whenSettled();

			expect(engine.getState()).toEqual({ kind: 'idle' });
			expect(sentWith(transport)).toEqual([
				[action.clientActionId, 'old'],
				[action.clientActionId, 'new'],
			]);
			expect(store.rows()).toEqual([]);
		});

		it('a session that ended during the send still ends in auth_required', async () => {
			const { engine, store, transport, tokens, held } = withHeldSend();
			engine.start();
			engine.setActiveWorker('ana');
			const action = await engine.enqueue(upload('ana'));
			await held.sendStarted;

			tokens.delete('ana');
			held.release({ kind: 'unauthorized' });
			await engine.whenSettled();

			expect(engine.getState()).toEqual({ kind: 'auth_required' });
			expect(sentWith(transport)).toEqual([[action.clientActionId, 'old']]);
			expect(store.rows().map((row) => row.clientActionId)).toEqual([
				action.clientActionId,
			]);
		});
	});

	describe('retry now and reconnect', () => {
		const seedWaiting = async (store: MemoryQueueStore, nowMs: number) => {
			await store.insert({
				clientActionId: 'seeded',
				workerId: 'ana',
				kind: {
					type: 'document_upload',
					documentType: 'passport',
					fileUri: 'file:///photo.jpg',
				},
				status: { kind: 'queued' },
				createdAt: nowMs - 60_000,
				attempts: 5,
				nextAttemptAt: nowMs + 30_000,
			});
		};

		const backingOffForThirtySeconds = async (options: Options = {}) => {
			const harness = createHarness({ online: true, ...options });
			await seedWaiting(harness.store, harness.clock.now());
			harness.engine.start();
			harness.engine.setActiveWorker('ana');
			await harness.engine.whenSettled();
			expect(harness.engine.getState()).toEqual({
				kind: 'backing_off',
				until: harness.clock.now() + 30_000,
			});
			return harness;
		};

		it('M5 retryNow sends at once and keeps the attempt count', async () => {
			const transport = createFakeTransport();
			transport.script({ kind: 'retryable' });
			const { engine, store, clock } = await backingOffForThirtySeconds({
				transport,
			});

			await engine.retryNow();
			await engine.whenSettled();

			expect(sentIds(transport)).toEqual(['seeded']);
			expect(store.rows()[0]?.attempts).toBe(6);
			expect(engine.getState()).toEqual({
				kind: 'backing_off',
				until: clock.now() + 32_000,
			});
		});

		it('M5 coming back online during a backoff sends at once', async () => {
			const { engine, store, transport, connectivity } =
				await backingOffForThirtySeconds();

			connectivity.setOnline(false);
			connectivity.setOnline(true);
			await engine.whenSettled();

			expect(sentIds(transport)).toEqual(['seeded']);
			expect(store.rows()).toHaveLength(0);
		});

		it('M5 a repeated online event does not make the backoff due again', async () => {
			const transport = createFakeTransport();
			transport.script({ kind: 'retryable' });
			const { engine, clock, connectivity } = await backingOffForThirtySeconds({
				transport,
			});
			connectivity.setOnline(false);
			connectivity.setOnline(true);
			await engine.whenSettled();
			expect(transport.calls).toHaveLength(1);
			const waitingUntil = clock.now() + 32_000;

			connectivity.setOnline(true);
			connectivity.setOnline(true);
			await engine.whenSettled();

			expect(transport.calls).toHaveLength(1);
			expect(engine.getState()).toEqual({
				kind: 'backing_off',
				until: waitingUntil,
			});
		});

		it('M5 retryNow does not revive a failed row', async () => {
			const transport = createFakeTransport();
			transport.script({ kind: 'rejected', reason: 'too_large' });
			const { engine, store } = createHarness({ online: true, transport });
			engine.start();
			engine.setActiveWorker('ana');
			await engine.enqueue(upload('ana'));
			await engine.whenSettled();

			await engine.retryNow();
			await engine.whenSettled();

			expect(transport.calls).toHaveLength(1);
			expect(store.rows()[0]?.status.kind).toBe('failed');
		});

		it('retryNow does nothing without an active worker', async () => {
			let makeDueNowCalls = 0;
			const { engine, transport } = createHarness({
				online: true,
				wrapStore: (memory) => ({
					...memory,
					makeDueNow: async (workerId, now) => {
						makeDueNowCalls += 1;
						await memory.makeDueNow(workerId, now);
					},
				}),
			});
			engine.start();

			await engine.retryNow();
			await engine.whenSettled();

			expect(makeDueNowCalls).toBe(0);
			expect(transport.calls).toHaveLength(0);
		});

		it('retryNow does not send while a 401 is unresolved', async () => {
			const transport = createFakeTransport();
			transport.script({ kind: 'unauthorized' });
			const { engine } = createHarness({ online: true, transport });
			engine.start();
			engine.setActiveWorker('ana');
			await engine.enqueue(upload('ana'));
			await engine.whenSettled();

			await engine.retryNow();
			await engine.whenSettled();

			expect(transport.calls).toHaveLength(1);
			expect(engine.getState()).toEqual({ kind: 'auth_required' });
		});
	});

	describe('stop', () => {
		it('M5 stopping during a send that comes back retryable arms no timer and sends nothing more', async () => {
			const transport = createFakeTransport();
			const held = transport.holdNextSend();
			const { engine, store, clock } = createHarness({
				online: true,
				transport,
			});
			engine.start();
			engine.setActiveWorker('ana');
			const first = await engine.enqueue(upload('ana', 'passport'));
			await engine.enqueue(upload('ana', 'signed_contract'));
			await held.sendStarted;

			engine.stop();
			held.release({ kind: 'retryable' });
			await engine.whenSettled();

			expect(sentIds(transport)).toEqual([first.clientActionId]);
			expect(clock.pendingTimers()).toBe(0);
			expect(store.rows()).toHaveLength(2);
			expect(store.rows()[0]?.attempts).toBe(1);

			clock.advance(60_000);
			await engine.whenSettled();
			expect(transport.calls).toHaveLength(1);
		});

		it('M4 a stop that arrives mid-pass shows backing_off, not idle, while a row waits out its backoff', async () => {
			const transport = createFakeTransport();
			const held = transport.holdNextSend();
			const { engine, store, clock } = createHarness({
				online: true,
				transport,
			});
			const nowMs = clock.now();
			await store.insert({
				clientActionId: 'waiting',
				workerId: 'ana',
				kind: {
					type: 'document_upload',
					documentType: 'passport',
					fileUri: 'file:///waiting.jpg',
				},
				status: { kind: 'queued' },
				createdAt: nowMs - 60_000,
				attempts: 5,
				nextAttemptAt: nowMs + 30_000,
			});
			engine.start();
			engine.setActiveWorker('ana');
			await engine.enqueue(upload('ana', 'signed_contract'));
			await held.sendStarted;

			engine.stop();
			held.release(delivered);
			await engine.whenSettled();

			expect(engine.getState()).toEqual({
				kind: 'backing_off',
				until: nowMs + 30_000,
			});
			expect(clock.pendingTimers()).toBe(0);
			expect(store.rows().map((row) => row.clientActionId)).toEqual([
				'waiting',
			]);
		});

		it('requestRun, enqueue and a worker switch do not send while stopped, and start sends again', async () => {
			const { engine, store, transport } = createHarness({ online: true });
			engine.start();
			engine.setActiveWorker('ana');
			engine.stop();

			const action = await engine.enqueue(upload('ana'));
			engine.requestRun();
			engine.setActiveWorker('ana');
			await engine.whenSettled();

			expect(transport.calls).toHaveLength(0);
			expect(store.rows()).toHaveLength(1);

			engine.start();
			await engine.whenSettled();

			expect(sentIds(transport)).toEqual([action.clientActionId]);
			expect(store.rows()).toHaveLength(0);
		});

		it('with two engines on one store, only the running one sends after the first is stopped', async () => {
			const store = createMemoryQueueStore();
			const firstTransport = createFakeTransport();
			const held = firstTransport.holdNextSend();
			const first = createHarness({
				online: true,
				store,
				transport: firstTransport,
			});
			first.engine.start();
			first.engine.setActiveWorker('ana');
			const a = await first.engine.enqueue(upload('ana', 'passport'));
			const b = await first.engine.enqueue(upload('ana', 'signed_contract'));
			await held.sendStarted;

			first.engine.stop();
			held.release(delivered);
			await first.engine.whenSettled();

			const second = createHarness({ online: true, store });
			second.engine.start();
			second.engine.setActiveWorker('ana');
			await second.engine.whenSettled();
			const c = await first.engine.enqueue(upload('ana', 'ds160_confirmation'));
			second.engine.requestRun();
			await second.engine.whenSettled();

			expect(sentIds(firstTransport)).toEqual([a.clientActionId]);
			expect(sentIds(second.transport)).toEqual([
				b.clientActionId,
				c.clientActionId,
			]);
			expect(store.rows()).toHaveLength(0);
		});
	});

	it('M3 an outcome sink that throws on delivered keeps the row until it is applied', async () => {
		let failNext = true;
		const { engine, store, clock, outcomes } = createHarness({
			online: true,
			wrapOutcomes: (recording) => ({
				...recording,
				delivered: async (action) => {
					if (failNext) {
						failNext = false;
						throw new Error('cache write failed');
					}
					await recording.delivered(action);
				},
			}),
		});
		engine.start();
		const action = await engine.enqueue(upload('ana'));
		engine.setActiveWorker('ana');
		await engine.whenSettled();

		expect(store.rows()).toHaveLength(1);
		expect(outcomes.deliveredActions).toHaveLength(0);
		expect(engine.getState().kind).toBe('backing_off');

		clock.advance(1_000);
		await engine.whenSettled();

		expect(store.rows()).toHaveLength(0);
		expect(outcomes.deliveredActions.map((x) => x.clientActionId)).toEqual([
			action.clientActionId,
		]);
	});

	it('M6 an outcome sink that throws on stale terms keeps the row until it is applied', async () => {
		let failNext = true;
		const transport = createFakeTransport();
		transport.script({ kind: 'stale_terms', currentTerms: termsV3 });
		const { engine, store, clock, outcomes } = createHarness({
			online: true,
			transport,
			wrapOutcomes: (recording) => ({
				...recording,
				staleTerms: async (action, currentTerms) => {
					if (failNext) {
						failNext = false;
						throw new Error('cache write failed');
					}
					await recording.staleTerms(action, currentTerms);
				},
			}),
		});
		engine.start();
		await engine.enqueue(acceptance('ana', 'terms-v2'));
		engine.setActiveWorker('ana');
		await engine.whenSettled();

		expect(store.rows()).toHaveLength(1);
		expect(outcomes.staleTermsCalls).toHaveLength(0);

		transport.script({ kind: 'stale_terms', currentTerms: termsV3 });
		clock.advance(1_000);
		await engine.whenSettled();

		expect(store.rows()).toHaveLength(0);
		expect(outcomes.staleTermsCalls).toHaveLength(1);
	});

	describe('M3 M4 a delivered upload whose row removal did not finish', () => {
		const PHOTO = 'file:///photo.jpg';

		const setUpDelivery = async () => {
			const files = new Set([PHOTO]);
			const events: string[] = [];
			const markedFailed: string[] = [];
			const counts = { removeCalls: 0 };
			const server = createFakeServerTransport(files);
			const real = await openRealOutcomes((fileUri) => {
				files.delete(fileUri);
				events.push('file deleted');
			});
			const wrapStoreWith =
				(removeFails: () => boolean) =>
				(memory: MemoryQueueStore): QueueStore => ({
					...memory,
					markFailed: async (clientActionId, reason) => {
						markedFailed.push(clientActionId);
						await memory.markFailed(clientActionId, reason);
					},
					remove: async (clientActionId) => {
						counts.removeCalls += 1;
						if (removeFails()) {
							throw new Error('disk full');
						}
						await memory.remove(clientActionId);
						events.push('row removed');
					},
				});
			return { counts, events, markedFailed, real, server, wrapStoreWith };
		};

		const expectDeliveredOnce = async (
			setup: Awaited<ReturnType<typeof setUpDelivery>>,
			store: MemoryQueueStore,
		) => {
			expect(setup.markedFailed).toEqual([]);
			expect(store.rows()).toHaveLength(0);
			expect(setup.events).toEqual(['row removed', 'file deleted']);
			expect(setup.server.savedIds()).toHaveLength(1);
			expect(
				documentRowState(
					'passport',
					(await setup.real.cache.read('ana'))?.assignment.documents ?? [],
					await store.listAll('ana'),
				),
			).toEqual({ kind: 'pending_review' });
		};

		it('a removal that throws once is not turned into a failed row, and the file goes after the row', async () => {
			const setup = await setUpDelivery();
			let failNext = true;
			const { engine, store, clock } = createHarness({
				online: true,
				transport: setup.server,
				wrapOutcomes: () => setup.real.sink,
				wrapStore: setup.wrapStoreWith(() => {
					const fails = failNext;
					failNext = false;
					return fails;
				}),
			});
			engine.start();
			engine.setActiveWorker('ana');
			await engine.enqueue(upload('ana', 'passport', PHOTO));
			await engine.whenSettled();
			clock.advance(1_000);
			await engine.whenSettled();

			expect(setup.counts.removeCalls).toBe(2);
			await expectDeliveredOnce(setup, store);
			setup.real.driver.close();
		});

		it('a kill between the outcome and the removal leaves a row the next engine delivers as a replay', async () => {
			const setup = await setUpDelivery();
			const first = createHarness({
				online: true,
				transport: setup.server,
				wrapOutcomes: () => setup.real.sink,
				wrapStore: setup.wrapStoreWith(() => true),
			});
			first.engine.start();
			first.engine.setActiveWorker('ana');
			await first.engine.enqueue(upload('ana', 'passport', PHOTO));
			await first.engine.whenSettled();
			first.engine.stop();
			expect(first.store.rows()).toHaveLength(1);

			const second = createHarness({
				online: true,
				store: first.store,
				transport: setup.server,
				wrapOutcomes: () => setup.real.sink,
				wrapStore: setup.wrapStoreWith(() => false),
			});
			second.engine.start();
			second.engine.setActiveWorker('ana');
			await second.engine.whenSettled();

			await expectDeliveredOnce(setup, first.store);
			setup.real.driver.close();
		});

		it('M2 a file that cannot be deleted after the removal does not fail the pass', async () => {
			let discardAttempts = 0;
			const { engine, store } = createHarness({
				online: true,
				wrapOutcomes: (recording) => ({
					...recording,
					discarded: async () => {
						discardAttempts += 1;
						throw new Error('disk');
					},
				}),
			});
			engine.start();
			engine.setActiveWorker('ana');
			await engine.enqueue(upload('ana'));
			await engine.whenSettled();

			expect(discardAttempts).toBe(1);
			expect(store.rows()).toHaveLength(0);
			expect(engine.getState()).toEqual({ kind: 'idle' });
		});
	});
});
