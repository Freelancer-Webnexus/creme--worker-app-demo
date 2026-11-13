import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHttpTransport } from '@/services/api/http-transport';
import { createWorkerApi, type WorkerApi } from '@/services/api/worker-api';
import { createHttpClient, type HttpClient } from '@/services/http/http-client';
import { refreshAssignment } from '@/services/query/refresh-assignment';
import { createQueueStore } from '@/services/storage/queue-store';
import { migrate } from '@/services/storage/schema';
import {
	type BunSqliteDriver,
	openBunSqliteDriver,
} from '@/services/storage/testing/bun-sqlite-driver';
import {
	createWorkerCacheStore,
	type WorkerCacheStore,
} from '@/services/storage/worker-cache-store';
import { documentRowState } from '@/services/sync/document-row-state';
import { createOutcomeSink } from '@/services/sync/outcome-sink';
import { createSyncEngine } from '@/services/sync/sync-engine';
import type { QueueStore, SyncEngine } from '@/services/sync/sync-ports';
import { termsState } from '@/services/sync/terms-state';
import {
	createFakeClock,
	type FakeClock,
} from '@/services/sync/testing/fake-clock';
import {
	createFakeConnectivity,
	type FakeConnectivity,
} from '@/services/sync/testing/fake-connectivity';
import { createMockBackend, type MockBackend } from '../../../mock/backend';
import { startMockServer, type RunningMockServer } from '../../../mock/server';

const ANA_PHONE = '+52 55 1000 0001';
const SHARED_PHONE = '+52 55 1000 0002';
const CODE = '123456';
const MAX_IMAGE_BYTES = 1_572_864;

const SIZE_BY_URI: Record<string, number> = {
	'file:///uploads/huge.jpg': MAX_IMAGE_BYTES + 1_000,
};
const SMALL_IMAGE_BYTES = 2_000;

type MockState = {
	currentTermsVersionId: string;
	termsAcceptances: { workerId: string; termsVersionId: string }[];
	documents: { workerId: string; documentType: string }[];
	workers: {
		id: string;
		acceptedTermsVersionId: string | null;
		documents: { documentType: string; state: string }[];
	}[];
};

type Device = {
	driver: BunSqliteDriver;
	queue: QueueStore;
	cache: WorkerCacheStore;
	connectivity: FakeConnectivity;
	engine: SyncEngine;
};

type World = {
	dir: string;
	dbFile: string;
	server: RunningMockServer;
	admin: HttpClient;
	api: WorkerApi;
	clock: FakeClock;
	tokens: Map<string, string>;
	deletedFiles: string[];
	device: Device;
};

let world: World | null = null;

const current = (): World => {
	if (world === null) {
		throw new Error('World is not set up.');
	}
	return world;
};

const openDevice = async (
	shared: Omit<World, 'device'>,
	online: boolean,
	wrapQueue: (queue: QueueStore) => QueueStore = (queue) => queue,
): Promise<Device> => {
	const driver = openBunSqliteDriver(shared.dbFile);
	await migrate(driver);
	const queue = wrapQueue(createQueueStore(driver));
	const cache = createWorkerCacheStore(driver, { now: shared.clock.now });
	const connectivity = createFakeConnectivity(online);
	let counter = 0;
	const http = createHttpClient({ baseUrl: shared.server.url });
	const engine = createSyncEngine({
		store: queue,
		transport: createHttpTransport({
			http,
			fileBody: (fileUri) =>
				shared.deletedFiles.includes(fileUri)
					? null
					: new Blob(
							[new Uint8Array(SIZE_BY_URI[fileUri] ?? SMALL_IMAGE_BYTES)],
							{ type: 'image/jpeg' },
						),
		}),
		clock: shared.clock,
		connectivity,
		session: { token: (workerId) => shared.tokens.get(workerId) ?? null },
		outcomes: createOutcomeSink({
			cache,
			onServerFactChanged: () => {},
			deleteUpload: async (fileUri) => {
				shared.deletedFiles.push(fileUri);
			},
		}),
		random: () => 0.5,
		newId: () => {
			counter += 1;
			return `action-${Date.now()}-${counter}`;
		},
	});
	engine.start();
	return { driver, queue, cache, connectivity, engine };
};

const setUp = async (
	online: boolean,
	backend?: MockBackend,
	wrapQueue?: (queue: QueueStore) => QueueStore,
) => {
	const dir = await mkdtemp(join(tmpdir(), 'creme-sync-'));
	const server = await startMockServer({
		port: 0,
		host: '127.0.0.1',
		log: () => {},
		backend,
	});
	const http = createHttpClient({ baseUrl: server.url });
	const shared: Omit<World, 'device'> = {
		dir,
		dbFile: join(dir, 'worker.db'),
		server,
		admin: http,
		api: createWorkerApi({ http }),
		clock: createFakeClock(),
		tokens: new Map(),
		deletedFiles: [],
	};
	world = { ...shared, device: await openDevice(shared, online, wrapQueue) };
};

afterEach(async () => {
	if (world === null) {
		return;
	}
	const { device, server, dir } = world;
	world = null;
	device.engine.stop();
	device.driver.close();
	await server.close();
	await rm(dir, { recursive: true, force: true });
});

const signIn = async (phone: string) => {
	const { api, tokens, device, clock } = current();
	const result = await api.verifyOtp(phone, CODE);
	if (result.kind !== 'ok') {
		throw new Error(`Sign-in failed: ${result.kind}`);
	}
	for (const worker of result.session.workers) {
		tokens.set(worker.id, result.session.token);
		const assignment = await api.fetchAssignment(
			result.session.token,
			worker.id,
		);
		if (assignment.kind !== 'ok') {
			throw new Error(`Assignment failed: ${assignment.kind}`);
		}
		await device.cache.saveAssignment(
			worker.id,
			assignment.assignment,
			clock.now(),
		);
		await device.cache.markTermsSeen(
			worker.id,
			assignment.assignment.currentTerms.id,
		);
	}
	return result.session;
};

const postAdmin = async (path: string, body?: unknown) => {
	await current().admin.request(path, { method: 'POST', body: body ?? {} });
};

const serverState = () => current().admin.request<MockState>('/__admin/state');

const settle = () => current().device.engine.whenSettled();

const acceptTerms = (workerId: string, termsVersionId = 'terms-v2') =>
	current().device.engine.enqueue({
		workerId,
		kind: { type: 'terms_acceptance', termsVersionId },
	});

const uploadPassport = (
	workerId: string,
	fileUri = 'file:///uploads/passport.jpg',
	documentType = 'passport',
) =>
	current().device.engine.enqueue({
		workerId,
		kind: { type: 'document_upload', documentType, fileUri },
	});

describe('sync engine against the mock backend over HTTP', () => {
	it('scenario 2: offline terms and passport survive a restart and deliver once as pending review', async () => {
		await setUp(false);
		await signIn(ANA_PHONE);
		current().device.engine.setActiveWorker('worker-ana');
		await acceptTerms('worker-ana');
		await uploadPassport('worker-ana');
		await settle();

		const first = current().device;
		first.engine.stop();
		first.driver.close();
		const { device: _discarded, ...shared } = current();
		const reopened = await openDevice(shared, false);
		world = { ...shared, device: reopened };
		reopened.engine.setActiveWorker('worker-ana');
		expect(await reopened.queue.listAll('worker-ana')).toHaveLength(2);
		expect((await serverState()).termsAcceptances).toHaveLength(0);

		reopened.connectivity.setOnline(true);
		await settle();

		const state = await serverState();
		expect(state.termsAcceptances).toHaveLength(1);
		expect(state.documents).toHaveLength(1);
		const cached = await reopened.cache.read('worker-ana');
		expect(cached?.assignment.acceptedTermsVersionId).toBe('terms-v2');
		expect(cached?.assignment.documents).toEqual([
			{ documentType: 'passport', state: 'pending_review' },
		]);
		expect(await reopened.queue.listAll('worker-ana')).toEqual([]);
		expect(current().deletedFiles).toEqual(['file:///uploads/passport.jpg']);
	});

	it('scenario 3: dropped response is retried and the server keeps one record', async () => {
		await setUp(true);
		await signIn(ANA_PHONE);
		const { device, clock } = current();
		device.engine.setActiveWorker('worker-ana');
		await postAdmin('/__admin/switches', { dropResponse: 'next' });

		await uploadPassport('worker-ana');
		await settle();

		expect(device.engine.getState().kind).toBe('backing_off');
		expect((await serverState()).documents).toHaveLength(1);
		expect(await device.queue.listAll('worker-ana')).toHaveLength(1);

		clock.advance(5_000);
		await settle();

		expect((await serverState()).documents).toHaveLength(1);
		expect(await device.queue.listAll('worker-ana')).toEqual([]);
		expect(
			(await device.cache.read('worker-ana'))?.assignment.documents,
		).toEqual([{ documentType: 'passport', state: 'pending_review' }]);
	});

	it('M3 M4: a delivered upload whose row removal failed once is one server record and pending review, never send failed', async () => {
		let failNextRemove = true;
		await setUp(true, undefined, (queue) => ({
			...queue,
			remove: async (clientActionId) => {
				if (failNextRemove) {
					failNextRemove = false;
					throw new Error('killed before the removal');
				}
				await queue.remove(clientActionId);
			},
		}));
		await signIn(ANA_PHONE);
		const { device, clock } = current();
		device.engine.setActiveWorker('worker-ana');

		await uploadPassport('worker-ana');
		await settle();
		clock.advance(5_000);
		await settle();

		expect((await serverState()).documents).toHaveLength(1);
		const cached = await device.cache.read('worker-ana');
		expect(cached?.assignment.documents).toEqual([
			{ documentType: 'passport', state: 'pending_review' },
		]);
		const rows = await device.queue.listAll('worker-ana');
		expect(rows).toEqual([]);
		expect(
			documentRowState('passport', cached?.assignment.documents ?? [], rows),
		).toEqual({ kind: 'pending_review' });
	});

	it('M3 M4: a fetch that read the server before the upload committed cannot overwrite the delivered fact', async () => {
		await setUp(true);
		await signIn(ANA_PHONE);
		const { api, clock, device, tokens } = current();
		device.engine.setActiveWorker('worker-ana');
		let serverRead: () => void = () => undefined;
		const serverWasRead = new Promise<void>((resolve) => {
			serverRead = resolve;
		});
		let releaseResponse: () => void = () => undefined;
		const responseHeld = new Promise<void>((resolve) => {
			releaseResponse = resolve;
		});
		const slowApi: WorkerApi = {
			...api,
			fetchAssignment: async (token, workerId) => {
				const result = await api.fetchAssignment(token, workerId);
				serverRead();
				await responseHeld;
				return result;
			},
		};

		const refreshing = refreshAssignment(
			{
				api: slowApi,
				cache: device.cache,
				now: clock.now,
				onUnauthorized: () => {},
				token: (workerId) => tokens.get(workerId) ?? null,
			},
			'worker-ana',
		);
		await serverWasRead;
		clock.advance(10);
		await uploadPassport('worker-ana');
		await settle();
		releaseResponse();
		const outcome = await refreshing;

		const cached = await device.cache.read('worker-ana');
		expect(cached?.assignment.documents).toEqual([
			{ documentType: 'passport', state: 'pending_review' },
		]);
		const rows = await device.queue.listAll('worker-ana');
		expect(
			documentRowState('passport', cached?.assignment.documents ?? [], rows),
		).toEqual({ kind: 'pending_review' });
		expect(outcome).toBe('superseded');
		expect((await serverState()).documents).toHaveLength(1);
	});

	it('scenario 4: v2 confirmed offline after v3 was published is not accepted', async () => {
		await setUp(false);
		await signIn(ANA_PHONE);
		const { device } = current();
		device.engine.setActiveWorker('worker-ana');
		await acceptTerms('worker-ana', 'terms-v2');
		await postAdmin('/__admin/publish-terms');

		device.connectivity.setOnline(true);
		await settle();

		const state = await serverState();
		expect(
			state.termsAcceptances.filter((row) => row.workerId === 'worker-ana'),
		).toEqual([]);
		const cached = await device.cache.read('worker-ana');
		expect(cached?.assignment.currentTerms.id).toBe('terms-v3');
		if (cached === null) {
			throw new Error('The cache row is missing.');
		}
		expect(
			termsState({
				current: cached.assignment.currentTerms,
				acceptedTermsVersionId: cached.assignment.acceptedTermsVersionId,
				lastSeenTermsVersionId: cached.lastSeenTermsVersionId,
				localActions: await device.queue.listAll('worker-ana'),
			}),
		).toMatchObject({
			kind: 'needs_confirmation',
			changedSinceLastSeen: true,
		});
	});

	it('scenario 5: a 413 fails that upload and the next action still delivers', async () => {
		await setUp(true);
		await signIn(ANA_PHONE);
		const { device } = current();
		device.engine.setActiveWorker('worker-ana');

		await uploadPassport('worker-ana', 'file:///uploads/huge.jpg');
		await acceptTerms('worker-ana');
		await settle();

		const rows = await device.queue.listAll('worker-ana');
		expect(rows).toHaveLength(1);
		expect(rows[0]?.status).toEqual({ kind: 'failed', reason: 'too_large' });
		const state = await serverState();
		expect(state.documents).toEqual([]);
		expect(state.termsAcceptances).toHaveLength(1);
		expect(current().deletedFiles).toEqual([]);
		expect(device.engine.getState().kind).toBe('idle');
	});

	it('scenario 6: a seeded 0.5 error rate fails twice, then delivers once with backoff', async () => {
		const draws = [0.9, 0.1, 0.2, 0.8];
		let drawn = 0;
		const random = () => {
			const value = draws[drawn % draws.length] ?? 0;
			drawn += 1;
			return value;
		};
		await setUp(true, createMockBackend({ random }));
		await signIn(ANA_PHONE);
		const { device, clock } = current();
		device.engine.setActiveWorker('worker-ana');
		await postAdmin('/__admin/switches', { errorRate: 0.5 });

		await acceptTerms('worker-ana');
		await settle();

		const afterFirstFailure = await device.queue.listAll('worker-ana');
		expect(afterFirstFailure).toHaveLength(1);
		expect(afterFirstFailure[0]?.attempts).toBe(1);
		expect(device.engine.getState().kind).toBe('backing_off');

		clock.advance(1_000);
		await settle();

		const afterSecondFailure = await device.queue.listAll('worker-ana');
		expect(afterSecondFailure[0]?.attempts).toBe(2);
		expect((await serverState()).termsAcceptances).toHaveLength(0);

		clock.advance(2_000);
		await settle();

		expect(await device.queue.listAll('worker-ana')).toEqual([]);
		expect((await serverState()).termsAcceptances).toHaveLength(1);
		expect(device.engine.getState().kind).toBe('idle');
	});

	it("scenario 7: Carla resubmits after a correction and Bruno's queue and cache are untouched", async () => {
		await setUp(true);
		await signIn(SHARED_PHONE);
		const { device } = current();
		const brunoBefore = await device.cache.read('worker-bruno');
		device.engine.setActiveWorker('worker-carla');
		await uploadPassport(
			'worker-bruno',
			'file:///uploads/bruno.jpg',
			'ds160_confirmation',
		);

		await uploadPassport('worker-carla');
		await settle();

		const state = await serverState();
		expect(state.documents).toHaveLength(1);
		expect(state.documents[0]).toMatchObject({
			workerId: 'worker-carla',
			documentType: 'passport',
		});
		const carla = await device.cache.read('worker-carla');
		expect(carla?.assignment.documents).toEqual([
			{ documentType: 'passport', state: 'pending_review' },
		]);
		expect(await device.queue.listAll('worker-carla')).toEqual([]);
		const brunoQueue = await device.queue.listAll('worker-bruno');
		expect(brunoQueue).toHaveLength(1);
		expect(brunoQueue[0]).toMatchObject({
			status: { kind: 'queued' },
			attempts: 0,
		});
		expect(await device.cache.read('worker-bruno')).toEqual(brunoBefore);
		expect(current().deletedFiles).toEqual(['file:///uploads/passport.jpg']);
	});

	it('scenario 8: expired token keeps the queue, and it resumes after signing in again', async () => {
		await setUp(true);
		await signIn(ANA_PHONE);
		const { device } = current();
		device.engine.setActiveWorker('worker-ana');
		await postAdmin('/__admin/expire-tokens');

		await acceptTerms('worker-ana');
		await settle();

		expect(device.engine.getState().kind).toBe('auth_required');
		expect(await device.queue.listAll('worker-ana')).toHaveLength(1);
		expect((await serverState()).termsAcceptances).toHaveLength(0);

		await signIn(ANA_PHONE);
		device.engine.setActiveWorker('worker-ana');
		await settle();

		expect(device.engine.getState().kind).toBe('idle');
		expect(await device.queue.listAll('worker-ana')).toEqual([]);
		expect((await serverState()).termsAcceptances).toHaveLength(1);
	});
});
