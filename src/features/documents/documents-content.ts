import type { Assignment } from '@/services/api/api-types';
import type { Translate, TranslationKey } from '@/services/i18n/translate';
import type { CacheGate } from '@/services/query/cache-gate';
import {
	type EmptyStateCopy,
	emptyStateCopy,
} from '@/services/query/empty-state-copy';
import {
	type PendingSyncReason,
	pendingSyncLine,
} from '@/services/runtime/pending-sync-line';
import {
	canSubmitDocument,
	type DocumentRowState,
	documentRowState,
} from '@/services/sync/document-row-state';
import type { FailureReason, QueuedAction } from '@/services/sync/sync-types';
import type { StatusRole } from '@/uikit/tokens/status-role';

export type DocumentInteraction =
	| { kind: 'none' }
	| { kind: 'open'; actionLabel: string }
	| {
			kind: 'send_failed';
			failedActionId: string;
			retakeLabel: string;
			dismissLabel: string;
	  };

export type DocumentRowContent = {
	documentType: string;
	name: string;
	statusText: string;
	/** The staff's words, shown as written: they are not translated. */
	reason: string | null;
	role: StatusRole;
	accessibilityLabel: string;
	interaction: DocumentInteraction;
};

export type DocumentsContent =
	| { kind: 'loading'; text: string }
	| ({ kind: 'empty' } & EmptyStateCopy)
	| { kind: 'ready'; rows: DocumentRowContent[]; noneRequired: string | null };

export const documentNameKey = (documentType: string): TranslationKey => {
	switch (documentType) {
		case 'passport':
			return 'documents.type.passport';
		case 'ds160_confirmation':
			return 'documents.type.ds160_confirmation';
		case 'signed_contract':
			return 'documents.type.signed_contract';
		default:
			return 'documents.type.unknown';
	}
};

export const documentRoleFor = (state: DocumentRowState): StatusRole => {
	switch (state.kind) {
		case 'not_submitted':
			return 'neutral';
		case 'pending_sync':
			return 'pending_sync';
		case 'pending_review':
			return 'pending_review';
		case 'approved':
			return 'approved';
		case 'correction_requested':
			return 'correction';
		case 'send_failed':
			return 'failed';
		default:
			return state satisfies never;
	}
};

const failedKeyFor = (reason: FailureReason): TranslationKey => {
	switch (reason) {
		case 'too_large':
			return 'documents.state.failed_too_large';
		case 'unknown_document_type':
			return 'documents.state.failed_unknown_type';
		case 'rejected':
			return 'documents.state.failed_generic';
		default:
			return reason satisfies never;
	}
};

const statusTextFor = (
	state: DocumentRowState,
	reason: PendingSyncReason,
	t: Translate,
): string => {
	switch (state.kind) {
		case 'not_submitted':
			return t('documents.state.not_submitted');
		case 'pending_sync':
			return pendingSyncLine(reason, t);
		case 'pending_review':
			return t('documents.state.pending_review');
		case 'approved':
			return t('documents.state.approved');
		case 'correction_requested':
			return t('documents.state.correction_requested');
		case 'send_failed':
			return t(failedKeyFor(state.reason));
		default:
			return state satisfies never;
	}
};

/** The newest failed upload of one document type, the one `documentRowState` reports. */
export const failedUploadIdFor = (
	documentType: string,
	rows: QueuedAction[],
): string | null => {
	let newest: QueuedAction | null = null;
	for (const row of rows) {
		if (
			row.kind.type === 'document_upload' &&
			row.kind.documentType === documentType &&
			row.status.kind === 'failed' &&
			(newest === null || row.createdAt >= newest.createdAt)
		) {
			newest = row;
		}
	}
	return newest === null ? null : newest.clientActionId;
};

const interactionFor = (
	documentType: string,
	state: DocumentRowState,
	rows: QueuedAction[],
	t: Translate,
): DocumentInteraction => {
	if (!canSubmitDocument(state)) {
		return { kind: 'none' };
	}
	switch (state.kind) {
		case 'send_failed': {
			const failedActionId = failedUploadIdFor(documentType, rows);
			return failedActionId === null
				? { actionLabel: t('documents.action.retake'), kind: 'open' }
				: {
						dismissLabel: t('documents.action.dismiss'),
						failedActionId,
						kind: 'send_failed',
						retakeLabel: t('documents.action.retake'),
					};
		}
		case 'correction_requested':
			return { actionLabel: t('documents.action.retake'), kind: 'open' };
		case 'not_submitted':
			return { actionLabel: t('documents.action.take_photo'), kind: 'open' };
		case 'pending_sync':
		case 'pending_review':
		case 'approved':
			return { kind: 'none' };
		default:
			return state satisfies never;
	}
};

export const presentDocumentRow = (
	documentType: string,
	assignment: Assignment,
	rows: QueuedAction[],
	t: Translate,
	pendingReason: PendingSyncReason,
): DocumentRowContent => {
	const state = documentRowState(documentType, assignment.documents, rows);
	const name = t(documentNameKey(documentType));
	const statusText = statusTextFor(state, pendingReason, t);
	const reason =
		state.kind === 'correction_requested'
			? t('documents.state.correction_reason', { reason: state.reason })
			: null;
	const spokenStatus =
		reason === null ? statusText : `${statusText}. ${reason}`;

	return {
		accessibilityLabel: t('a11y.document_row', {
			document: name,
			status: spokenStatus,
		}),
		documentType,
		interaction: interactionFor(documentType, state, rows, t),
		name,
		reason,
		role: documentRoleFor(state),
		statusText,
	};
};

export const presentDocumentsContent = (
	gate: CacheGate,
	rows: QueuedAction[],
	t: Translate,
	pendingReason: PendingSyncReason,
): DocumentsContent => {
	switch (gate.kind) {
		case 'loading':
			return { kind: 'loading', text: t('state.loading') };
		case 'needs_connection':
		case 'server_unavailable':
			return { ...emptyStateCopy(gate.kind, t), kind: 'empty' };
		case 'ready': {
			const { assignment } = gate.cache;
			return {
				kind: 'ready',
				noneRequired:
					assignment.requiredDocuments.length === 0
						? t('documents.none_required')
						: null,
				rows: assignment.requiredDocuments.map((documentType) =>
					presentDocumentRow(documentType, assignment, rows, t, pendingReason),
				),
			};
		}
		default:
			return gate satisfies never;
	}
};
