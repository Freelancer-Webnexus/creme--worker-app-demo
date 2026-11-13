import {
	type CaptureInput,
	presentCapture,
	previewAspectRatio,
} from '@/features/documents/capture-content';
import type {
	CaptureImage,
	CaptureProblem,
	CaptureState,
} from '@/features/documents/capture-state';
import type { Assignment } from '@/services/api/api-types';
import { type Language, translate } from '@/services/i18n/translate';
import type { WorkerCache } from '@/services/storage/worker-cache-store';
import type { QueuedAction } from '@/services/sync/sync-types';

const assignment: Assignment = {
	acceptedTermsVersionId: null,
	currentTerms: {
		id: 'terms-v2',
		publishedAt: '2026-02-10T09:00:00.000Z',
		summary: { en: 'English', es: 'Español' },
		version: 2,
	},
	documents: [],
	flags: {},
	order: {
		employer: 'Valle Verde Farms',
		id: 'JO-2026-0142',
		seasonEnd: '2026-07-31',
		seasonStart: '2026-03-01',
		worksite: 'Yuma, AZ',
	},
	requiredDocuments: ['passport', 'signed_contract'],
};

const cache: WorkerCache = {
	assignment,
	fetchedAt: 1,
	lastSeenTermsVersionId: null,
};

const image: CaptureImage = {
	height: 3000,
	uri: 'file:///cache/a.jpg',
	width: 4000,
};

const queuedPassport: QueuedAction = {
	attempts: 0,
	clientActionId: 'a1',
	createdAt: 1,
	kind: {
		documentType: 'passport',
		fileUri: 'file:///uploads/p.jpg',
		type: 'document_upload',
	},
	nextAttemptAt: 0,
	status: { kind: 'queued' },
	workerId: 'worker-ana',
};

const present = (language: Language, overrides: Partial<CaptureInput> = {}) =>
	presentCapture(
		{
			cache,
			documentType: 'passport',
			rows: [],
			state: { kind: 'choosing' },
			...overrides,
		},
		(key, params) => translate(language, key, params),
	);

describe('presentCapture', () => {
	it.each(['es', 'en'] as const)(
		'offers two big choices for a listed document (%s)',
		(language) => {
			const { content, title } = present(language);

			expect(title).toBe(translate(language, 'documents.type.passport'));
			expect(content).toEqual({
				busy: false,
				chooseGalleryLabel: translate(
					language,
					'documents.action.choose_gallery',
				),
				hint: translate(language, 'capture.choose_hint'),
				kind: 'choosing',
				takePhotoLabel: translate(language, 'documents.action.take_photo'),
			});
		},
	);

	it('keeps the choices but turns them off while the picker is open', () => {
		const { content } = present('es', {
			state: { kind: 'picking', source: 'camera' },
		});

		expect(content).toMatchObject({ busy: true, kind: 'choosing' });
	});

	it('previews the photo with a submit button', () => {
		const { content } = present('es', { state: { image, kind: 'previewing' } });

		expect(content).toEqual({
			aspectRatio: 4 / 3,
			busy: false,
			heading: 'Revisa tu foto',
			image,
			kind: 'preview',
			retakeLabel: 'Tomar otra foto',
			submitLabel: 'Usar esta foto',
		});
	});

	it('shows progress on the button itself while the photo is prepared', () => {
		const { content } = present('en', { state: { image, kind: 'preparing' } });

		expect(content).toMatchObject({
			busy: true,
			kind: 'preview',
			submitLabel: 'Getting the photo ready…',
		});
	});

	it.each(['es', 'en'] as const)(
		'explains a refused camera and how to fix it (%s)',
		(language) => {
			const { content } = present(language, {
				state: { kind: 'problem', problem: 'camera_denied' },
			});

			expect(content).toEqual({
				body: translate(language, 'capture.permission_denied_body'),
				kind: 'problem',
				retryLabel: translate(language, 'capture.try_again'),
				settingsLabel: translate(language, 'capture.open_settings'),
				title: translate(language, 'capture.permission_denied_title'),
			});
		},
	);

	it.each(['es', 'en'] as const)(
		'asks to try the picker again with the button it names (%s)',
		(language) => {
			const { content } = present(language, {
				state: { kind: 'problem', problem: 'picker_failed' },
			});

			expect(content).toEqual({
				body: translate(language, 'capture.picker_failed'),
				kind: 'problem',
				retryLabel: translate(language, 'capture.try_again'),
				settingsLabel: null,
				title: translate(language, 'capture.problem_title'),
			});
			if (content.kind !== 'problem') {
				throw new Error('expected the problem content');
			}
			expect(content.body).toContain(content.retryLabel);
		},
	);

	it.each([
		['too_large', 'capture.too_large'],
		['failed', 'capture.compression_failed'],
		['not_saved', 'capture.save_failed'],
	] as [CaptureProblem, Parameters<typeof translate>[1]][])(
		'says %s plainly and offers a retake, never "sent"',
		(problem, key) => {
			for (const language of ['es', 'en'] as const) {
				const { content } = present(language, {
					state: { kind: 'problem', problem },
				});

				expect(content).toEqual({
					body: translate(language, key),
					kind: 'problem',
					retryLabel: translate(language, 'documents.action.retake'),
					settingsLabel: null,
					title: translate(language, 'capture.problem_title'),
				});
			}
		},
	);

	it.each(['work_permit', ''])(
		'shows an error state for the unknown document %j',
		(documentType) => {
			const { content } = present('es', { documentType });

			expect(content).toEqual({
				body: translate('es', 'capture.unavailable_body'),
				kind: 'unavailable',
				title: translate('es', 'capture.unavailable_title'),
			});
		},
	);

	it('M3 refuses a second photo for a document already sent or saved', () => {
		const inReview: WorkerCache = {
			...cache,
			assignment: {
				...assignment,
				documents: [{ documentType: 'passport', state: 'pending_review' }],
			},
		};
		const notNeeded = {
			body: translate('es', 'capture.not_needed_body'),
			kind: 'unavailable',
			title: translate('es', 'capture.not_needed_title'),
		};

		expect(present('es', { cache: inReview }).content).toEqual(notNeeded);
		expect(present('es', { rows: [queuedPassport] }).content).toEqual(
			notNeeded,
		);
	});

	it('keeps the preview while its own photo is being saved', () => {
		const state: CaptureState = { image, kind: 'preparing' };

		expect(present('es', { rows: [queuedPassport], state }).content.kind).toBe(
			'preview',
		);
	});

	it('shows an error state when nothing is cached', () => {
		expect(present('en', { cache: null }).content.kind).toBe('unavailable');
	});

	it('waits while the cache is being read', () => {
		expect(present('es', { cache: undefined }).content).toEqual({
			kind: 'loading',
			text: translate('es', 'state.loading'),
		});
	});

	it('covers every capture state', () => {
		const states: CaptureState[] = [
			{ kind: 'choosing' },
			{ kind: 'picking', source: 'gallery' },
			{ image, kind: 'previewing' },
			{ image, kind: 'preparing' },
			{ kind: 'problem', problem: 'too_large' },
		];
		const kinds = states.map((state) => present('es', { state }).content.kind);

		expect(kinds).toEqual([
			'choosing',
			'choosing',
			'preview',
			'preview',
			'problem',
		]);
	});
});

describe('previewAspectRatio', () => {
	it.each([
		[4000, 3000, 4 / 3],
		[3000, 4000, 0.75],
		[1000, 4000, 0.6],
		[4000, 1000, 1.8],
		[0, 0, 4 / 3],
		[100, 0, 4 / 3],
		[Number.NaN, 100, 4 / 3],
	])('%d by %d gives %d', (width, height, expected) => {
		expect(
			previewAspectRatio({ height, uri: 'file:///x.jpg', width }),
		).toBeCloseTo(expected);
	});
});
