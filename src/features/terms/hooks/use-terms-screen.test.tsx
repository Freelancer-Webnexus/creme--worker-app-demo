import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import useTermsScreen from '@/features/terms/hooks/use-terms-screen';
import type { TermsContent } from '@/features/terms/terms-content';
import type { Assignment, TermsVersion } from '@/services/api/api-types';
import { getLanguage } from '@/services/i18n/language-store';
import { translate } from '@/services/i18n/translate';
import type { AppRuntime } from '@/services/runtime/app-runtime';
import { AppRuntimeContext } from '@/services/runtime/app-runtime-context';
import { createQueueSnapshotStore } from '@/services/runtime/queue-snapshot-store';
import { useInvalidateOnEngineChange } from '@/services/runtime/use-invalidate-on-engine-change';
import type { WorkerCache } from '@/services/storage/worker-cache-store';
import type { EngineState, QueuedAction } from '@/services/sync/sync-types';

jest.mock('expo-router', () => ({
	useFocusEffect: (effect: () => void) =>
		require('react').useEffect(effect, [effect]),
}));

jest.mock('@/services/connectivity/use-is-online', () => ({
	useIsOnline: () => true,
}));

jest.mock('@/services/runtime/use-active-worker', () => ({
	useActiveWorker: () => ({ id: 'w1', name: 'Ana Perez' }),
}));

jest.mock('@/services/query/use-refresh-assignment', () => ({
	useRefreshAssignment: () => ({
		isPulling: false,
		outcome: 'refreshed',
		refresh: () => undefined,
	}),
}));

const v3: TermsVersion = {
	id: 'terms-v3',
	publishedAt: '2026-05-04T09:00:00.000Z',
	summary: { en: 'English summary v3', es: 'Resumen en español v3' },
	version: 3,
};

const cacheOf = (acceptedTermsVersionId: string | null): WorkerCache => {
	const assignment: Assignment = {
		acceptedTermsVersionId,
		currentTerms: v3,
		documents: [],
		flags: {},
		order: {
			employer: 'Valle Verde Farms',
			id: 'JO-2026-0142',
			seasonEnd: '2026-07-31',
			seasonStart: '2026-03-01',
			worksite: 'Yuma, AZ',
		},
		requiredDocuments: ['passport'],
	};
	return { assignment, fetchedAt: 1, lastSeenTermsVersionId: 'terms-v3' };
};

const idle: EngineState = { kind: 'idle' };

const settle = async (): Promise<void> => {
	for (let turn = 0; turn < 4; turn += 1) {
		await act(async () => {
			await new Promise<void>((resolve) => {
				setTimeout(resolve, 0);
			});
		});
	}
};

const Bridge = ({
	children,
	runtime,
}: {
	children: ReactNode;
	runtime: AppRuntime;
}): ReactNode => {
	useInvalidateOnEngineChange(runtime);
	return children;
};

const startHarness = async () => {
	let rows: QueuedAction[] = [];
	let accepted: string | null = null;
	let hold = false;
	let held: (() => void)[] = [];
	let listeners: (() => void)[] = [];
	const notify = (): void => {
		for (const listener of listeners) {
			listener();
		}
	};

	const queue = { listAll: async () => rows.map((row) => ({ ...row })) };
	const queueSnapshot = createQueueSnapshotStore(queue);
	const runtime = {
		cache: {
			markTermsSeen: async () => undefined,
			read: async () => {
				const snapshot = cacheOf(accepted);
				if (hold) {
					await new Promise<void>((resolve) => {
						held.push(resolve);
					});
				}
				return snapshot;
			},
		},
		engine: {
			enqueue: async (action: Pick<QueuedAction, 'kind' | 'workerId'>) => {
				const row: QueuedAction = {
					attempts: 0,
					clientActionId: 'a1',
					createdAt: 1,
					kind: action.kind,
					nextAttemptAt: 0,
					status: { kind: 'queued' },
					workerId: action.workerId,
				};
				rows = [...rows, row];
				notify();
				return row;
			},
			getState: () => idle,
			subscribe: (listener: () => void) => {
				listeners = [...listeners, listener];
				return () => {
					listeners = listeners.filter((other) => other !== listener);
				};
			},
		},
		queue,
		queueSnapshot,
		serverFacts: { subscribe: () => () => undefined },
	} as unknown as AppRuntime;
	runtime.engine.subscribe(() => {
		void queueSnapshot.refresh('w1');
	});
	await queueSnapshot.refresh('w1');

	const client = new QueryClient({
		defaultOptions: { queries: { gcTime: Number.POSITIVE_INFINITY } },
	});
	const seen: TermsContent[] = [];
	const view = await renderHook(
		() => {
			const model = useTermsScreen();
			seen.push(model.content);
			return model;
		},
		{
			wrapper: ({ children }) => (
				<QueryClientProvider client={client}>
					<AppRuntimeContext.Provider value={runtime}>
						<Bridge runtime={runtime}>{children}</Bridge>
					</AppRuntimeContext.Provider>
				</QueryClientProvider>
			),
		},
	);
	await settle();

	return {
		client,
		confirm: async () => {
			await act(async () => {
				view.result.current.onConfirm('terms-v3');
			});
			await settle();
		},
		deliver: async () => {
			accepted = 'terms-v3';
			rows = [];
			notify();
			await settle();
		},
		holdCacheReads: () => {
			hold = true;
		},
		releaseCacheReads: async () => {
			hold = false;
			const pending = held;
			held = [];
			for (const release of pending) {
				release();
			}
			await settle();
		},
		seen,
	};
};

const needsConfirmationText = (): string =>
	translate(getLanguage(), 'terms.needs_confirmation');

const showsNeedsConfirmation = (content: TermsContent): boolean =>
	content.kind === 'ready' && content.statusText === needsConfirmationText();

describe('useTermsScreen after the worker confirms', () => {
	it('never falls back to needs-confirmation when the delivery removes the row', async () => {
		const harness = await startHarness();
		expect(harness.seen.some(showsNeedsConfirmation)).toBe(true);

		await harness.confirm();
		const queuedAt = harness.seen.length;
		harness.holdCacheReads();
		await harness.deliver();
		await harness.releaseCacheReads();

		const after = harness.seen.slice(queuedAt);
		expect(after.filter(showsNeedsConfirmation)).toEqual([]);
		const last = harness.seen[harness.seen.length - 1];
		expect(last).toMatchObject({
			action: { kind: 'none' },
			statusRole: 'approved',
			statusText: translate(getLanguage(), 'terms.confirmed'),
		});
		harness.client.clear();
	});

	it('keeps the button busy until the saved row is visible', async () => {
		const harness = await startHarness();

		const pressedAt = harness.seen.length;
		harness.holdCacheReads();
		await harness.confirm();

		const whileHeld = harness.seen.slice(pressedAt);
		const idleButtons = whileHeld.filter(
			(content) =>
				showsNeedsConfirmation(content) &&
				content.kind === 'ready' &&
				!(content.action.kind === 'confirm' && content.action.busy),
		);
		expect(idleButtons).toEqual([]);

		await harness.releaseCacheReads();
		expect(harness.seen[harness.seen.length - 1]).toMatchObject({
			action: { kind: 'none' },
			statusRole: 'pending_sync',
		});
		harness.client.clear();
	});
});
