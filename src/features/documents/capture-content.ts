import type {
	CaptureImage,
	CaptureProblem,
	CaptureState,
} from '@/features/documents/capture-state';
import { documentNameKey } from '@/features/documents/documents-content';
import type { Translate, TranslationKey } from '@/services/i18n/translate';
import type { WorkerCache } from '@/services/storage/worker-cache-store';
import {
	canSubmitDocument,
	documentRowState,
} from '@/services/sync/document-row-state';
import type { QueuedAction } from '@/services/sync/sync-types';

export type CaptureContent =
	| { kind: 'loading'; text: string }
	| { kind: 'unavailable'; title: string; body: string }
	| {
			kind: 'choosing';
			hint: string;
			takePhotoLabel: string;
			chooseGalleryLabel: string;
			/** The picker or the permission dialog is open. */
			busy: boolean;
	  }
	| {
			kind: 'preview';
			heading: string;
			image: CaptureImage;
			aspectRatio: number;
			submitLabel: string;
			/** The photo is being made smaller and saved; the buttons are off. */
			busy: boolean;
			retakeLabel: string;
	  }
	| {
			kind: 'problem';
			title: string;
			body: string;
			/** Only for a refused camera permission. */
			settingsLabel: string | null;
			retryLabel: string;
	  };

export type CaptureInput = {
	/** `undefined` while SQLite is read, `null` when nothing is cached. */
	cache: WorkerCache | null | undefined;
	documentType: string;
	/** The worker's queue rows, read with the cache. */
	rows: QueuedAction[];
	state: CaptureState;
};

const DEFAULT_RATIO = 4 / 3;
const MIN_RATIO = 0.6;
const MAX_RATIO = 1.8;

/** A portrait passport and a wide landscape photo both fit the preview without a tall empty frame. */
export const previewAspectRatio = (image: CaptureImage): number => {
	if (!(image.width > 0 && image.height > 0)) {
		return DEFAULT_RATIO;
	}
	return Math.min(Math.max(image.width / image.height, MIN_RATIO), MAX_RATIO);
};

const problemBodyKey = (problem: CaptureProblem): TranslationKey => {
	switch (problem) {
		case 'camera_denied':
			return 'capture.permission_denied_body';
		case 'too_large':
			return 'capture.too_large';
		case 'failed':
			return 'capture.compression_failed';
		case 'not_saved':
			return 'capture.save_failed';
		case 'picker_failed':
			return 'capture.picker_failed';
		default:
			return problem satisfies never;
	}
};

const retryLabelKey = (problem: CaptureProblem): TranslationKey => {
	switch (problem) {
		case 'camera_denied':
		case 'picker_failed':
			return 'capture.try_again';
		case 'too_large':
		case 'failed':
		case 'not_saved':
			return 'documents.action.retake';
		default:
			return problem satisfies never;
	}
};

const presentProblem = (
	problem: CaptureProblem,
	t: Translate,
): CaptureContent => {
	const denied = problem === 'camera_denied';
	return {
		body: t(problemBodyKey(problem)),
		kind: 'problem',
		retryLabel: t(retryLabelKey(problem)),
		settingsLabel: denied ? t('capture.open_settings') : null,
		title: denied
			? t('capture.permission_denied_title')
			: t('capture.problem_title'),
	};
};

const presentState = (state: CaptureState, t: Translate): CaptureContent => {
	switch (state.kind) {
		case 'choosing':
		case 'picking':
			return {
				busy: state.kind === 'picking',
				chooseGalleryLabel: t('documents.action.choose_gallery'),
				hint: t('capture.choose_hint'),
				kind: 'choosing',
				takePhotoLabel: t('documents.action.take_photo'),
			};
		case 'previewing':
		case 'preparing':
			return {
				aspectRatio: previewAspectRatio(state.image),
				busy: state.kind === 'preparing',
				heading: t('capture.preview_title'),
				image: state.image,
				kind: 'preview',
				retakeLabel: t('documents.action.retake'),
				submitLabel:
					state.kind === 'preparing'
						? t('capture.compressing')
						: t('documents.action.submit'),
			};
		case 'problem':
			return presentProblem(state.problem, t);
		default:
			return state satisfies never;
	}
};

/** The route names a document the worker's catalog does not list: say so, never crash. */
export const presentCapture = (
	input: CaptureInput,
	t: Translate,
): { title: string; content: CaptureContent } => {
	const { cache } = input;
	if (cache === undefined) {
		return {
			content: { kind: 'loading', text: t('state.loading') },
			title: t('documents.title'),
		};
	}

	if (!cache?.assignment.requiredDocuments.includes(input.documentType)) {
		return {
			content: {
				body: t('capture.unavailable_body'),
				kind: 'unavailable',
				title: t('capture.unavailable_title'),
			},
			title: t('documents.title'),
		};
	}

	// A second capture screen, a stale back stack or a deep link can open a
	// document that is already saved or sent. Its own save in progress
	// (`preparing`) keeps the preview until the screen closes.
	const row = documentRowState(
		input.documentType,
		cache.assignment.documents,
		input.rows,
	);
	if (input.state.kind !== 'preparing' && !canSubmitDocument(row)) {
		return {
			content: {
				body: t('capture.not_needed_body'),
				kind: 'unavailable',
				title: t('capture.not_needed_title'),
			},
			title: t(documentNameKey(input.documentType)),
		};
	}

	return {
		content: presentState(input.state, t),
		title: t(documentNameKey(input.documentType)),
	};
};
