import type { ServerDocument } from '@/services/api/api-types';
import type { FailureReason, QueuedAction } from '@/services/sync/sync-types';

/**
 * What a document row shows. Not stored: derived from the device queue and the
 * last server facts. Only the server can say pending review, approved or
 * correction requested (M4).
 */
export type DocumentRowState =
	| { kind: 'not_submitted' }
	| { kind: 'pending_sync' }
	| { kind: 'send_failed'; reason: FailureReason }
	| { kind: 'pending_review' }
	| { kind: 'approved' }
	| { kind: 'correction_requested'; reason: string };

const isUploadOf = (action: QueuedAction, documentType: string): boolean =>
	action.kind.type === 'document_upload' &&
	action.kind.documentType === documentType;

const newest = (actions: QueuedAction[]): QueuedAction | undefined =>
	actions.reduce<QueuedAction | undefined>(
		(best, action) =>
			best === undefined || action.createdAt >= best.createdAt ? action : best,
		undefined,
	);

export const documentRowState = (
	documentType: string,
	serverDocuments: ServerDocument[],
	localActions: QueuedAction[],
): DocumentRowState => {
	const uploads = localActions.filter((action) =>
		isUploadOf(action, documentType),
	);

	if (uploads.some((action) => action.status.kind === 'queued')) {
		return { kind: 'pending_sync' };
	}

	const lastFailed = newest(
		uploads.filter((action) => action.status.kind === 'failed'),
	);
	if (lastFailed?.status.kind === 'failed') {
		return { kind: 'send_failed', reason: lastFailed.status.reason };
	}

	const server = serverDocuments.find(
		(document) => document.documentType === documentType,
	);
	if (server === undefined) {
		return { kind: 'not_submitted' };
	}
	return server.state === 'correction_requested'
		? { kind: 'correction_requested', reason: server.reason }
		: { kind: server.state };
};

export const canSubmitDocument = (state: DocumentRowState): boolean =>
	state.kind === 'not_submitted' ||
	state.kind === 'send_failed' ||
	state.kind === 'correction_requested';
