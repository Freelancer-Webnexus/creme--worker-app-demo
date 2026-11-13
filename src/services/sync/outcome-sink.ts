import type { WorkerCacheStore } from '@/services/storage/worker-cache-store';
import type { OutcomeSink } from '@/services/sync/sync-ports';
import { assertNever } from '@/services/sync/sync-step';

export type OutcomeSinkOptions = {
	cache: WorkerCacheStore;
	deleteUpload: (fileUri: string) => Promise<void>;
	/**
	 * M3, M4: called after the cache holds a server fact learned from a send, so
	 * the app can fetch the server's own copy soon after.
	 */
	onServerFactChanged: () => void;
};

export const createOutcomeSink = ({
	cache,
	deleteUpload,
	onServerFactChanged,
}: OutcomeSinkOptions): OutcomeSink => ({
	delivered: async (action) => {
		const { kind } = action;
		switch (kind.type) {
			case 'terms_acceptance':
				await cache.applyTermsAccepted(action.workerId, kind.termsVersionId);
				break;
			case 'document_upload':
				await cache.applyDocumentPendingReview(
					action.workerId,
					kind.documentType,
				);
				break;
			default:
				return assertNever(kind);
		}
		onServerFactChanged();
	},

	staleTerms: async (action, currentTerms) => {
		await cache.applyCurrentTerms(action.workerId, currentTerms);
		onServerFactChanged();
	},

	// The failed row stays in the queue so the UI can show the error and offer a
	// retake; the file is kept until the worker retakes or dismisses (M5, M7).
	rejected: async () => {},

	// M7: the engine calls this after the row is gone. A failed delete leaves a
	// stray file that the startup sweep removes, never a lost delivery.
	discarded: async (action) => {
		const { kind } = action;
		switch (kind.type) {
			case 'terms_acceptance':
				return;
			case 'document_upload':
				try {
					await deleteUpload(kind.fileUri);
				} catch {
					return;
				}
				return;
			default:
				return assertNever(kind);
		}
	},
});
