import type { SqlValue } from '@/services/storage/sql-driver';
import type {
	ActionKind,
	ActionStatus,
	FailureReason,
	QueuedAction,
} from '@/services/sync/sync-types';

export type QueueRow = {
	client_action_id: string;
	worker_id: string;
	action_type: string;
	terms_version_id: string | null;
	document_type: string | null;
	file_uri: string | null;
	status: string;
	failure_reason: string | null;
	created_at: number;
	attempts: number;
	next_attempt_at: number;
};

export const queueColumns = `client_action_id, worker_id, action_type, terms_version_id, document_type, file_uri, status, failure_reason, created_at, attempts, next_attempt_at`;

function corrupt(row: QueueRow, detail: string): Error {
	return new Error(`Corrupt queue row ${row.client_action_id}: ${detail}`);
}

function required(row: QueueRow, value: string | null, column: string): string {
	if (value === null) throw corrupt(row, `${column} is missing`);
	return value;
}

function parseFailureReason(row: QueueRow): FailureReason {
	const reason = required(row, row.failure_reason, 'failure_reason');
	switch (reason) {
		case 'too_large':
		case 'unknown_document_type':
		case 'rejected':
			return reason;
		default:
			throw corrupt(row, `unknown failure_reason ${reason}`);
	}
}

function parseKind(row: QueueRow): ActionKind {
	switch (row.action_type) {
		case 'terms_acceptance':
			return {
				type: 'terms_acceptance',
				termsVersionId: required(row, row.terms_version_id, 'terms_version_id'),
			};
		case 'document_upload':
			return {
				type: 'document_upload',
				documentType: required(row, row.document_type, 'document_type'),
				fileUri: required(row, row.file_uri, 'file_uri'),
			};
		default:
			throw corrupt(row, `unknown action_type ${row.action_type}`);
	}
}

function parseStatus(row: QueueRow): ActionStatus {
	switch (row.status) {
		case 'queued':
			return { kind: 'queued' };
		case 'failed':
			return { kind: 'failed', reason: parseFailureReason(row) };
		default:
			throw corrupt(row, `unknown status ${row.status}`);
	}
}

export function rowToAction(row: QueueRow): QueuedAction {
	return {
		clientActionId: row.client_action_id,
		workerId: row.worker_id,
		kind: parseKind(row),
		status: parseStatus(row),
		createdAt: row.created_at,
		attempts: row.attempts,
		nextAttemptAt: row.next_attempt_at,
	};
}

/** Same order as `queueColumns`. */
export function actionToParams(action: QueuedAction): SqlValue[] {
	const { kind, status } = action;
	return [
		action.clientActionId,
		action.workerId,
		kind.type,
		kind.type === 'terms_acceptance' ? kind.termsVersionId : null,
		kind.type === 'document_upload' ? kind.documentType : null,
		kind.type === 'document_upload' ? kind.fileUri : null,
		status.kind,
		status.kind === 'failed' ? status.reason : null,
		action.createdAt,
		action.attempts,
		action.nextAttemptAt,
	];
}
