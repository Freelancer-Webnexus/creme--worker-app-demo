import { presentDocumentsContent } from '@/features/documents/documents-content';
import type { DocumentsScreenModel } from '@/features/documents/documents-screen-model';
import { useTranslation } from '@/services/i18n/use-translation';
import { logger } from '@/services/logger/logger';
import useAppRouter from '@/services/navigation/use-app-router';
import { cacheGateFor } from '@/services/query/cache-gate';
import { useRefreshAssignment } from '@/services/query/use-refresh-assignment';
import { useWorkerView } from '@/services/query/use-worker-view';
import { pendingSyncReason } from '@/services/runtime/pending-sync-line';
import { rowsOf } from '@/services/runtime/queue-status';
import { useActiveWorker } from '@/services/runtime/use-active-worker';
import { useAppRuntime } from '@/services/runtime/use-app-runtime';
import { useSyncStatus } from '@/services/runtime/use-sync-status';

const useDocumentsScreen = (): DocumentsScreenModel => {
	const { engine, queueSnapshot } = useAppRuntime();
	const workerId = useActiveWorker()?.id ?? null;
	const { t } = useTranslation();
	const status = useSyncStatus();
	const view = useWorkerView();
	const refresh = useRefreshAssignment();
	const router = useAppRouter();

	const gate = cacheGateFor({
		cache: view.cache,
		isOnline: status.isOnline,
		queue: view.queue,
		refreshOutcome: refresh.outcome,
	});

	return {
		content: presentDocumentsContent(
			gate,
			rowsOf(view.queue),
			t,
			pendingSyncReason(status),
		),
		onDismissFailed: (failedActionId) => {
			engine
				.dismissFailed(failedActionId)
				.then(() => queueSnapshot.refresh(workerId))
				.catch(() => {
					logger.warn('documents', 'Could not dismiss a failed upload.');
				});
		},
		onOpenCapture: (documentType) => {
			router.push({
				params: { documentType },
				pathname: '/capture/[documentType]',
			});
		},
		onRefresh: refresh.refresh,
		refreshing: refresh.isPulling,
		title: t('documents.title'),
	};
};

export default useDocumentsScreen;
