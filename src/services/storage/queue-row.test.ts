import {
	actionToParams,
	type QueueRow,
	rowToAction,
} from '@/services/storage/queue-row';
import type { QueuedAction } from '@/services/sync/sync-types';

const termsRow: QueueRow = {
	client_action_id: 'a1',
	worker_id: 'w1',
	action_type: 'terms_acceptance',
	terms_version_id: 'tv2',
	document_type: null,
	file_uri: null,
	status: 'queued',
	failure_reason: null,
	created_at: 10,
	attempts: 0,
	next_attempt_at: 10,
};

const uploadRow: QueueRow = {
	...termsRow,
	client_action_id: 'a2',
	action_type: 'document_upload',
	terms_version_id: null,
	document_type: 'passport',
	file_uri: 'file:///x.jpg',
	status: 'failed',
	failure_reason: 'too_large',
};

describe('rowToAction', () => {
	it('maps a terms row', () => {
		expect(rowToAction(termsRow)).toEqual({
			clientActionId: 'a1',
			workerId: 'w1',
			kind: { type: 'terms_acceptance', termsVersionId: 'tv2' },
			status: { kind: 'queued' },
			createdAt: 10,
			attempts: 0,
			nextAttemptAt: 10,
		});
	});

	it('maps a failed upload row', () => {
		expect(rowToAction(uploadRow)).toMatchObject({
			kind: {
				type: 'document_upload',
				documentType: 'passport',
				fileUri: 'file:///x.jpg',
			},
			status: { kind: 'failed', reason: 'too_large' },
		});
	});

	it.each<[string, QueueRow]>([
		['unknown action_type', { ...termsRow, action_type: 'sms' }],
		['unknown status', { ...termsRow, status: 'sending' }],
		['unknown failure_reason', { ...uploadRow, failure_reason: 'boom' }],
		['failed without a reason', { ...uploadRow, failure_reason: null }],
		['terms without terms_version_id', { ...termsRow, terms_version_id: null }],
		['upload without document_type', { ...uploadRow, document_type: null }],
		['upload without file_uri', { ...uploadRow, file_uri: null }],
	])('throws on %s', (_name, row) => {
		expect(() => rowToAction(row)).toThrow();
	});
});

describe('actionToParams', () => {
	it.each<[string, QueuedAction]>([
		['terms', rowToAction(termsRow)],
		['upload', rowToAction(uploadRow)],
	])('round-trips %s through the column order', (_name, action) => {
		const params = actionToParams(action);
		const row: QueueRow = {
			client_action_id: String(params[0]),
			worker_id: String(params[1]),
			action_type: String(params[2]),
			terms_version_id: params[3] as string | null,
			document_type: params[4] as string | null,
			file_uri: params[5] as string | null,
			status: String(params[6]),
			failure_reason: params[7] as string | null,
			created_at: Number(params[8]),
			attempts: Number(params[9]),
			next_attempt_at: Number(params[10]),
		};
		expect(rowToAction(row)).toEqual(action);
	});
});
