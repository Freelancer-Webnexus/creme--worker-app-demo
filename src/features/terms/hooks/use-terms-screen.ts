import { useCallback, useEffect, useReducer } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
	confirmReducer,
	confirmTapped,
	initialConfirmState,
} from '@/features/terms/confirm-state';
import { presentTermsContent } from '@/features/terms/terms-content';
import type { TermsScreenModel } from '@/features/terms/terms-screen-model';
import {
	baselineSeenId,
	initialTermsVisit,
	termsVisitReducer,
	versionToMarkSeen,
} from '@/features/terms/terms-visit';
import { useTranslation } from '@/services/i18n/use-translation';
import { logger } from '@/services/logger/logger';
import { cacheGateFor } from '@/services/query/cache-gate';
import { queryKeys } from '@/services/query/query-keys';
import { refreshWorkerView } from '@/services/query/query-options';
import { useRefreshAssignment } from '@/services/query/use-refresh-assignment';
import { useWorkerView } from '@/services/query/use-worker-view';
import { pendingSyncReason } from '@/services/runtime/pending-sync-line';
import { rowsOf } from '@/services/runtime/queue-status';
import { useActiveWorker } from '@/services/runtime/use-active-worker';
import { useAppRuntime } from '@/services/runtime/use-app-runtime';
import { useSyncStatus } from '@/services/runtime/use-sync-status';

const useTermsScreen = (): TermsScreenModel => {
	const { cache: cacheStore, engine, queue, queueSnapshot } = useAppRuntime();
	const queryClient = useQueryClient();
	const workerId = useActiveWorker()?.id ?? null;
	const { language, t } = useTranslation();
	const status = useSyncStatus();
	const view = useWorkerView();
	const refresh = useRefreshAssignment();
	const [visit, dispatchVisit] = useReducer(
		termsVisitReducer,
		initialTermsVisit,
	);
	const [confirm, dispatchConfirm] = useReducer(
		confirmReducer,
		initialConfirmState,
	);

	const shownId = view.cache?.assignment.currentTerms.id ?? null;
	const storedLastSeenId = view.cache?.lastSeenTermsVersionId ?? null;
	const toMarkSeen = versionToMarkSeen(visit, storedLastSeenId);

	useFocusEffect(
		useCallback(() => {
			dispatchVisit({ type: 'focused' });
			return () => {
				dispatchVisit({ type: 'blurred' });
			};
		}, []),
	);

	useEffect(() => {
		if (shownId !== null) {
			dispatchVisit({
				lastSeenId: storedLastSeenId,
				type: 'displayed',
				versionId: shownId,
			});
		}
	}, [visit.kind, shownId, storedLastSeenId]);

	useEffect(() => {
		if (toMarkSeen === null || workerId === null) {
			return;
		}
		cacheStore
			.markTermsSeen(workerId, toMarkSeen)
			.then(() =>
				queryClient.invalidateQueries({
					queryKey: queryKeys.workerView.detail(workerId),
				}),
			)
			.catch(() => {
				logger.warn('terms', 'Could not record the terms as seen.');
			});
	}, [cacheStore, queryClient, toMarkSeen, workerId]);

	const gate = cacheGateFor({
		cache: view.cache,
		isOnline: status.isOnline,
		queue: view.queue,
		refreshOutcome: refresh.outcome,
	});

	return {
		content: presentTermsContent(
			gate,
			{
				confirm,
				language,
				pendingReason: pendingSyncReason(status),
				rows: rowsOf(view.queue),
				seenBeforeId: baselineSeenId(visit, storedLastSeenId),
			},
			t,
		),
		onConfirm: (versionId) => {
			if (workerId === null || !confirmTapped(confirm).start) {
				return;
			}
			dispatchConfirm({ type: 'tapped' });
			engine
				.enqueue({
					kind: { termsVersionId: versionId, type: 'terms_acceptance' },
					workerId,
				})
				.then(
					async () => {
						// Separate so the view refresh runs even when the snapshot fails:
						// the view is what keeps a second tap from saving twice.
						await queueSnapshot.refresh(workerId).catch(() => {
							logger.warn('terms', 'Could not refresh the queue snapshot.');
						});
						await refreshWorkerView(
							queryClient,
							cacheStore,
							queue,
							workerId,
						).catch(() => {
							logger.warn('terms', 'Could not refresh the saved confirmation.');
						});
						dispatchConfirm({ type: 'saved' });
					},
					() => {
						logger.warn('terms', 'Could not save the confirmation.');
						dispatchConfirm({ type: 'save_failed' });
					},
				);
		},
		onRefresh: refresh.refresh,
		refreshing: refresh.isPulling,
		title: t('terms.title'),
	};
};

export default useTermsScreen;
