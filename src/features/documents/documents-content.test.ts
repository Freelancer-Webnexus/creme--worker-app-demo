import {
	documentNameKey,
	type DocumentRowContent,
	failedUploadIdFor,
	presentDocumentRow,
	presentDocumentsContent,
} from '@/features/documents/documents-content';
import type { Assignment, ServerDocument } from '@/services/api/api-types';
import { type Language, translate } from '@/services/i18n/translate';
import type { WorkerCache } from '@/services/storage/worker-cache-store';
import type { DocumentRowState } from '@/services/sync/document-row-state';
import type { FailureReason, QueuedAction } from '@/services/sync/sync-types';

const assignmentOf = (
	documents: ServerDocument[],
	requiredDocuments = ['passport', 'ds160_confirmation', 'signed_contract'],
): Assignment => ({
	acceptedTermsVersionId: null,
	currentTerms: {
		id: 'terms-v2',
		publishedAt: '2026-02-10T09:00:00.000Z',
		summary: { en: 'English', es: 'Español' },
		version: 2,
	},
	documents,
	flags: {},
	order: {
		employer: 'Valle Verde Farms',
		id: 'JO-2026-0142',
		seasonEnd: '2026-07-31',
		seasonStart: '2026-03-01',
		worksite: 'Yuma, AZ',
	},
	requiredDocuments,
});

const upload = (
	id: string,
	documentType: string,
	status: QueuedAction['status'],
	createdAt = 1,
): QueuedAction => ({
	attempts: 0,
	clientActionId: id,
	createdAt,
	kind: {
		documentType,
		fileUri: `file:///uploads/${id}.jpg`,
		type: 'document_upload',
	},
	nextAttemptAt: 0,
	status,
	workerId: 'w1',
});

const tFor =
	(language: Language) =>
	(
		key: Parameters<typeof translate>[1],
		params?: Record<string, string | number>,
	) =>
		translate(language, key, params);

type Case = {
	name: string;
	state: DocumentRowState['kind'];
	documents: ServerDocument[];
	rows: QueuedAction[];
};

const cases: Case[] = [
	{ documents: [], name: 'not submitted', rows: [], state: 'not_submitted' },
	{
		documents: [],
		name: 'saved on the phone',
		rows: [upload('u1', 'passport', { kind: 'queued' })],
		state: 'pending_sync',
	},
	{
		documents: [{ documentType: 'passport', state: 'pending_review' }],
		name: 'delivered, waiting for staff',
		rows: [],
		state: 'pending_review',
	},
	{
		documents: [{ documentType: 'passport', state: 'approved' }],
		name: 'approved',
		rows: [],
		state: 'approved',
	},
	{
		documents: [
			{
				documentType: 'passport',
				reason: 'Foto borrosa, vuelva a tomarla',
				state: 'correction_requested',
			},
		],
		name: 'correction requested',
		rows: [],
		state: 'correction_requested',
	},
	{
		documents: [],
		name: 'send failed',
		rows: [upload('u1', 'passport', { kind: 'failed', reason: 'too_large' })],
		state: 'send_failed',
	},
];

const passportRow = (testCase: Case, language: Language): DocumentRowContent =>
	presentDocumentRow(
		'passport',
		assignmentOf(testCase.documents),
		testCase.rows,
		tFor(language),
		'waiting_for_connection',
	);

describe('presentDocumentRow', () => {
	it('covers every row state', () => {
		expect(cases.map((testCase) => testCase.state).sort()).toEqual(
			[
				'approved',
				'correction_requested',
				'not_submitted',
				'pending_review',
				'pending_sync',
				'send_failed',
			].sort(),
		);
	});

	it.each(cases)(
		'$name has a name, a status and a label in both languages',
		(testCase) => {
			for (const language of ['es', 'en'] as const) {
				const row = passportRow(testCase, language);
				expect(row.name).toBe(translate(language, 'documents.type.passport'));
				expect(row.statusText.length).toBeGreaterThan(0);
				expect(row.accessibilityLabel).toContain(row.name);
				expect(row.accessibilityLabel).toContain(row.statusText);
				expect(row.statusText).not.toMatch(/\{\w+\}/);
			}
		},
	);

	it.each([
		['not_submitted', 'neutral'],
		['pending_sync', 'pending_sync'],
		['pending_review', 'pending_review'],
		['approved', 'approved'],
		['correction_requested', 'correction'],
		['send_failed', 'failed'],
	])('%s uses the %s role', (state, role) => {
		const testCase = cases.find((candidate) => candidate.state === state);
		expect(testCase && passportRow(testCase, 'es').role).toBe(role);
	});

	it('only opens capture where a worker can submit', () => {
		const kinds = Object.fromEntries(
			cases.map((testCase) => [
				testCase.state,
				passportRow(testCase, 'es').interaction.kind,
			]),
		);
		expect(kinds).toEqual({
			approved: 'none',
			correction_requested: 'open',
			not_submitted: 'open',
			pending_review: 'none',
			pending_sync: 'none',
			send_failed: 'send_failed',
		});
	});

	it('shows the staff reason as written, in both languages', () => {
		const testCase = cases.find(
			(candidate) => candidate.state === 'correction_requested',
		);
		if (testCase === undefined) {
			throw new Error('missing case');
		}
		expect(passportRow(testCase, 'es').reason).toBe(
			'Motivo: Foto borrosa, vuelva a tomarla',
		);
		expect(passportRow(testCase, 'en').reason).toBe(
			'Reason: Foto borrosa, vuelva a tomarla',
		);
		expect(passportRow(testCase, 'en').accessibilityLabel).toContain(
			'Foto borrosa, vuelva a tomarla',
		);
	});

	it.each(['es', 'en'] as const)(
		'never says delivered for a document saved only on the phone, and the reverse (%s)',
		(language) => {
			const saved = passportRow(cases[1], language).statusText;
			const delivered = [
				passportRow(cases[2], language).statusText,
				passportRow(cases[3], language).statusText,
			];
			const phone = language === 'es' ? 'teléfono' : 'phone';

			expect(saved.toLowerCase()).toContain(phone);
			const deliveredWords =
				language === 'es'
					? ['enviado', 'aprobado', 'revisión']
					: ['approved', 'review'];
			for (const word of deliveredWords) {
				expect(saved.toLowerCase()).not.toContain(word);
			}
			const unsentOnly = saved.toLowerCase().replace('not sent yet', '');
			expect(unsentOnly).not.toContain('sent');

			for (const text of delivered) {
				expect(text.toLowerCase()).not.toContain(phone);
				expect(text.toLowerCase()).not.toMatch(
					/saved|guardado|not sent|no se envía/,
				);
			}
		},
	);

	it('uses the shared pending line for a document saved on the phone', () => {
		const row = presentDocumentRow(
			'passport',
			assignmentOf([]),
			[upload('u1', 'passport', { kind: 'queued' })],
			tFor('es'),
			'sending_now',
		);

		expect(row.statusText).toBe(
			'Guardado en este teléfono. Todavía no se envió. Enviando ahora.',
		);
	});

	it.each([
		['too_large', 'documents.state.failed_too_large'],
		['unknown_document_type', 'documents.state.failed_unknown_type'],
		['rejected', 'documents.state.failed_generic'],
	] as [FailureReason, Parameters<typeof translate>[1]][])(
		'explains a %s failure and offers Retake and Dismiss',
		(reason, key) => {
			const row = presentDocumentRow(
				'passport',
				assignmentOf([]),
				[upload('u9', 'passport', { kind: 'failed', reason })],
				tFor('es'),
				'waiting_for_connection',
			);

			expect(row.statusText).toBe(translate('es', key));
			expect(row.interaction).toEqual({
				dismissLabel: 'Descartar',
				failedActionId: 'u9',
				kind: 'send_failed',
				retakeLabel: 'Tomar otra foto',
			});
		},
	);

	it('labels the action by state', () => {
		expect(passportRow(cases[0], 'es').interaction).toEqual({
			actionLabel: 'Tomar foto',
			kind: 'open',
		});
		expect(passportRow(cases[4], 'en').interaction).toEqual({
			actionLabel: 'Take another photo',
			kind: 'open',
		});
	});

	it('shows the unknown-type name for a document the app does not know', () => {
		const row = presentDocumentRow(
			'work_permit',
			assignmentOf([], ['work_permit']),
			[],
			tFor('en'),
			'waiting_for_connection',
		);

		expect(row.name).toBe('Document');
		expect(documentNameKey('work_permit')).toBe('documents.type.unknown');
	});
});

describe('failedUploadIdFor', () => {
	it('picks the newest failed upload of that document type only', () => {
		const rows = [
			upload('old', 'passport', { kind: 'failed', reason: 'rejected' }, 1),
			upload('new', 'passport', { kind: 'failed', reason: 'too_large' }, 5),
			upload(
				'other',
				'signed_contract',
				{ kind: 'failed', reason: 'rejected' },
				9,
			),
			upload('queued', 'passport', { kind: 'queued' }, 8),
		];

		expect(failedUploadIdFor('passport', rows)).toBe('new');
		expect(failedUploadIdFor('ds160_confirmation', rows)).toBeNull();
	});
});

describe('presentDocumentsContent', () => {
	const cacheOf = (assignment: Assignment): WorkerCache => ({
		assignment,
		fetchedAt: 1,
		lastSeenTermsVersionId: null,
	});

	it('lists one row per required document in catalog order', () => {
		const content = presentDocumentsContent(
			{
				cache: cacheOf(
					assignmentOf([{ documentType: 'passport', state: 'approved' }]),
				),
				kind: 'ready',
			},
			[],
			tFor('es'),
			'waiting_for_connection',
		);

		expect(content.kind).toBe('ready');
		if (content.kind !== 'ready') {
			return;
		}
		expect(content.rows.map((row) => row.documentType)).toEqual([
			'passport',
			'ds160_confirmation',
			'signed_contract',
		]);
		expect(content.rows.map((row) => row.name)).toEqual([
			'Pasaporte',
			'Confirmación DS-160',
			'Contrato firmado',
		]);
		expect(content.noneRequired).toBeNull();
	});

	it('says so when no document is required', () => {
		const content = presentDocumentsContent(
			{ cache: cacheOf(assignmentOf([], [])), kind: 'ready' },
			[],
			tFor('en'),
			'waiting_for_connection',
		);

		expect(content).toEqual({
			kind: 'ready',
			noneRequired: 'No documents are requested right now.',
			rows: [],
		});
	});

	it('says the server is not answering when it failed on the first load', () => {
		expect(
			presentDocumentsContent(
				{ kind: 'server_unavailable' },
				[],
				tFor('es'),
				'waiting_for_connection',
			),
		).toEqual({
			body: translate('es', 'state.server_body'),
			kind: 'empty',
			retryTitle: translate('es', 'error.retry'),
			title: translate('es', 'state.server_title'),
		});
	});

	it('explains the first load needs a connection', () => {
		expect(
			presentDocumentsContent(
				{ kind: 'needs_connection' },
				[],
				tFor('es'),
				'waiting_for_connection',
			),
		).toEqual({
			body: translate('es', 'state.empty_body'),
			kind: 'empty',
			retryTitle: translate('es', 'error.retry'),
			title: translate('es', 'state.empty_title'),
		});
		expect(
			presentDocumentsContent(
				{ kind: 'loading' },
				[],
				tFor('es'),
				'waiting_for_connection',
			),
		).toEqual({
			kind: 'loading',
			text: translate('es', 'state.loading'),
		});
	});
});
