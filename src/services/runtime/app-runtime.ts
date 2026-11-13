import { AppState } from 'react-native';
import { randomUUID } from 'expo-crypto';
import {
	apiBaseUrl,
	JSON_TIMEOUT_MS,
	UPLOAD_TIMEOUT_MS,
} from '@/services/api/api-config';
import { createHttpTransport } from '@/services/api/http-transport';
import { reactNativeFileBody } from '@/services/api/react-native-file-body';
import { createWorkerApi, type WorkerApi } from '@/services/api/worker-api';
import { deviceConnectivity } from '@/services/connectivity/connectivity';
import { createHttpClient } from '@/services/http/http-client';
import {
	configureLanguagePersistence,
	hydrateLanguage,
} from '@/services/i18n/language-store';
import {
	createImageFiles,
	type ImageFiles,
} from '@/services/images/image-files';
import { logger } from '@/services/logger/logger';
import { activeWorkerIdOf } from '@/services/runtime/active-worker';
import {
	createDebugFlags,
	type DebugFlags,
} from '@/services/runtime/debug-flags';
import { openWithCleanup } from '@/services/runtime/open-with-cleanup';
import { runOrphanSweep } from '@/services/runtime/orphan-sweep';
import {
	createQueueSnapshotStore,
	type QueueSnapshotStore,
} from '@/services/runtime/queue-snapshot-store';
import {
	createServerFactSignal,
	type ServerFactSignal,
} from '@/services/runtime/server-fact-signal';
import { sessionChangeEffects } from '@/services/runtime/session-change-effects';
import { installSessionKeystore } from '@/services/session/session-keystore';
import {
	getSession,
	subscribe,
	tokenFor,
} from '@/services/session/session-store';
import {
	createDeviceStore,
	type DeviceStore,
} from '@/services/storage/device-store';
import { openExpoSqliteDriver } from '@/services/storage/expo-sqlite-driver';
import { createQueueStore } from '@/services/storage/queue-store';
import { migrate } from '@/services/storage/schema';
import type { SqlDriver } from '@/services/storage/sql-driver';
import {
	createWorkerCacheStore,
	type WorkerCacheStore,
} from '@/services/storage/worker-cache-store';
import { createOutcomeSink } from '@/services/sync/outcome-sink';
import { createSyncEngine } from '@/services/sync/sync-engine';
import type { Clock, QueueStore, SyncEngine } from '@/services/sync/sync-ports';

const DATABASE_NAME = 'worker-app.db';

/** Everything the screens reach, built once at app start from the real ports. */
export type AppRuntime = {
	api: WorkerApi;
	cache: WorkerCacheStore;
	connectivity: typeof deviceConnectivity;
	debugFlags: DebugFlags;
	device: DeviceStore;
	engine: SyncEngine;
	images: ImageFiles;
	queue: QueueStore;
	queueSnapshot: QueueSnapshotStore;
	/** Fires after a send taught the cache a server fact (M3, M4). */
	serverFacts: Pick<ServerFactSignal, 'subscribe'>;
	/** Detaches every listener. The app never calls it; tests and reloads do. */
	stop: () => void;
};

const buildRuntime = async (driver: SqlDriver): Promise<AppRuntime> => {
	await migrate(driver);

	const clock: Clock = {
		now: Date.now,
		setTimer: (delayMs, callback) => {
			const handle = setTimeout(callback, delayMs);
			return () => {
				clearTimeout(handle);
			};
		},
	};
	const serverFacts = createServerFactSignal();

	const queue = createQueueStore(driver);
	const cache = createWorkerCacheStore(driver, { now: clock.now });
	const device = createDeviceStore(driver);
	const debugFlags = createDebugFlags();
	const images = createImageFiles({
		compressionEnabled: () => debugFlags.getSnapshot().compressionEnabled,
	});

	configureLanguagePersistence((language) => device.set('language', language));
	await hydrateLanguage(() => device.get('language'));
	installSessionKeystore();

	const baseUrl = apiBaseUrl();
	const http = createHttpClient({ baseUrl, timeoutMs: JSON_TIMEOUT_MS });
	const api = createWorkerApi({ http });
	const transport = createHttpTransport({
		fileBody: reactNativeFileBody,
		http,
		uploadTimeoutMs: UPLOAD_TIMEOUT_MS,
	});
	const outcomes = createOutcomeSink({
		cache,
		deleteUpload: (fileUri) => {
			images.deleteUpload(fileUri);
			return Promise.resolve();
		},
		onServerFactChanged: serverFacts.emit,
	});

	const engine = createSyncEngine({
		clock,
		connectivity: deviceConnectivity,
		newId: randomUUID,
		outcomes,
		random: Math.random,
		session: { token: tokenFor },
		store: queue,
		transport,
	});
	const queueSnapshot = createQueueSnapshotStore(queue);

	await deviceConnectivity.start();
	engine.start();

	const activeWorkerId = activeWorkerIdOf(getSession());
	engine.setActiveWorker(activeWorkerId);
	await queueSnapshot.refresh(activeWorkerId);
	if (activeWorkerId !== null) {
		await runOrphanSweep({
			listRows: () => queue.listAll(activeWorkerId),
			sweep: images.sweepOrphans,
			warn: () => {
				logger.warn('runtime', 'Skipped the orphan upload sweep.');
			},
			workerId: activeWorkerId,
		});
	}

	let knownSession = getSession();
	const stopSession = subscribe(() => {
		const next = getSession();
		for (const effect of sessionChangeEffects(knownSession, next)) {
			switch (effect.type) {
				case 'set_active_worker':
					engine.setActiveWorker(effect.workerId);
					break;
				case 'refresh_queue':
					void queueSnapshot.refresh(effect.workerId);
					break;
				default:
					return effect satisfies never;
			}
		}
		knownSession = next;
	});
	const stopEngine = engine.subscribe(() => {
		void queueSnapshot.refresh(activeWorkerIdOf(getSession()));
	});
	const appState = AppState.addEventListener('change', (next) => {
		if (next === 'active') {
			engine.requestRun();
		}
	});

	return {
		api,
		cache,
		connectivity: deviceConnectivity,
		debugFlags,
		device,
		engine,
		images,
		queue,
		queueSnapshot,
		serverFacts: { subscribe: serverFacts.subscribe },
		stop: () => {
			stopSession();
			stopEngine();
			appState.remove();
			engine.stop();
			deviceConnectivity.stop();
		},
	};
};

export const createAppRuntime = (): Promise<AppRuntime> =>
	openWithCleanup({
		close: (driver) => driver.close(),
		open: () => openExpoSqliteDriver(DATABASE_NAME),
		setUp: buildRuntime,
	});
