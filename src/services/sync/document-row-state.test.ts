import type { ServerDocument } from '@/services/api/api-types';
import {
	canSubmitDocument,
	type DocumentRowState,
	documentRowState,
} from '@/services/sync/document-row-state';
import type { ActionStatus, QueuedAction } from '@/services/sync/sync-types';

const upload = (
	id: string,
	documentType: string,
	status: ActionStatus,
	createdAt = 1,
): QueuedAction => ({
	clientActionId: id,
	workerId: 'ana',
	kind: { type: 'document_upload', documentType, fileUri: 'file:///x.jpg' },
	status,
	createdAt,
	attempts: 0,
	nextAttemptAt: 0,
});

const queued = (id: string, documentType: string, createdAt = 1) =>
	upload(id, documentType, { kind: 'queued' }, createdAt);

const failed = (id: string, documentType: string, createdAt = 1) =>
	upload(id, documentType, { kind: 'failed', reason: 'too_large' }, createdAt);

const termsAcceptance: QueuedAction = {
	clientActionId: 't1',
	workerId: 'ana',
	kind: { type: 'terms_acceptance', termsVersionId: 'v2' },
	status: { kind: 'queued' },
	createdAt: 1,
	attempts: 0,
	nextAttemptAt: 0,
};

const pendingReview: ServerDocument = {
	documentType: 'passport',
	state: 'pending_review',
};
const approved: ServerDocument = {
	documentType: 'passport',
	state: 'approved',
};
const correction: ServerDocument = {
	documentType: 'passport',
	state: 'correction_requested',
	reason: 'Foto borrosa',
};

type Row = {
	name: string;
	server: ServerDocument[];
	local: QueuedAction[];
	expected: DocumentRowState;
};

const rows: Row[] = [
	{
		name: 'nothing anywhere',
		server: [],
		local: [],
		expected: { kind: 'not_submitted' },
	},
	{
		name: 'queued upload',
		server: [],
		local: [queued('a', 'passport')],
		expected: { kind: 'pending_sync' },
	},
	{
		name: 'failed upload',
		server: [],
		local: [failed('a', 'passport')],
		expected: { kind: 'send_failed', reason: 'too_large' },
	},
	{
		name: 'newest failed upload decides the reason',
		server: [],
		local: [
			upload('a', 'passport', { kind: 'failed', reason: 'rejected' }, 1),
			upload('b', 'passport', { kind: 'failed', reason: 'too_large' }, 2),
		],
		expected: { kind: 'send_failed', reason: 'too_large' },
	},
	{
		name: 'queued upload wins over a failed upload',
		server: [],
		local: [failed('a', 'passport', 1), queued('b', 'passport', 2)],
		expected: { kind: 'pending_sync' },
	},
	{
		name: 'queued upload wins over server approved',
		server: [approved],
		local: [queued('a', 'passport')],
		expected: { kind: 'pending_sync' },
	},
	{
		name: 'failed upload wins over server pending review until the next action replaces it',
		server: [pendingReview],
		local: [failed('a', 'passport')],
		expected: { kind: 'send_failed', reason: 'too_large' },
	},
	{
		name: 'server pending review',
		server: [pendingReview],
		local: [],
		expected: { kind: 'pending_review' },
	},
	{
		name: 'server approved',
		server: [approved],
		local: [],
		expected: { kind: 'approved' },
	},
	{
		name: 'server correction requested',
		server: [correction],
		local: [],
		expected: { kind: 'correction_requested', reason: 'Foto borrosa' },
	},
	{
		name: 'resubmission after a correction is pending sync',
		server: [correction],
		local: [queued('a', 'passport')],
		expected: { kind: 'pending_sync' },
	},
	{
		name: 'actions for other document types are ignored',
		server: [],
		local: [queued('a', 'ds160_confirmation'), failed('b', 'signed_contract')],
		expected: { kind: 'not_submitted' },
	},
	{
		name: 'server documents of other types are ignored',
		server: [{ documentType: 'ds160_confirmation', state: 'approved' }],
		local: [],
		expected: { kind: 'not_submitted' },
	},
	{
		name: 'terms actions are ignored',
		server: [],
		local: [termsAcceptance],
		expected: { kind: 'not_submitted' },
	},
];

describe('documentRowState', () => {
	it.each(rows)('$name', ({ server, local, expected }) => {
		expect(documentRowState('passport', server, local)).toEqual(expected);
	});

	it('M4 pending review, approved and correction requested never come from local actions', () => {
		const localOnly: QueuedAction[][] = [
			[],
			[queued('a', 'passport')],
			[failed('a', 'passport')],
			[queued('a', 'passport'), failed('b', 'passport', 2)],
			[termsAcceptance],
		];
		const serverOnlyKinds = [
			'pending_review',
			'approved',
			'correction_requested',
		];
		for (const local of localOnly) {
			const state = documentRowState('passport', [], local);
			expect(serverOnlyKinds).not.toContain(state.kind);
		}
	});
});

describe('canSubmitDocument', () => {
	const cases: { state: DocumentRowState; expected: boolean }[] = [
		{ state: { kind: 'not_submitted' }, expected: true },
		{ state: { kind: 'pending_sync' }, expected: false },
		{ state: { kind: 'send_failed', reason: 'rejected' }, expected: true },
		{ state: { kind: 'pending_review' }, expected: false },
		{ state: { kind: 'approved' }, expected: false },
		{
			state: { kind: 'correction_requested', reason: 'Foto borrosa' },
			expected: true,
		},
	];

	it.each(cases)('$state.kind -> $expected', ({ state, expected }) => {
		expect(canSubmitDocument(state)).toBe(expected);
	});
});
