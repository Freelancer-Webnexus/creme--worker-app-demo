import { fireEvent, render } from '@testing-library/react-native';
import { presentCapture } from '@/features/documents/capture-content';
import type { CaptureScreenModel } from '@/features/documents/capture-screen-model';
import type { CaptureState } from '@/features/documents/capture-state';
import CaptureScreenView from '@/features/documents/screens/capture-screen-view';
import type { Assignment } from '@/services/api/api-types';
import { type Language, translate } from '@/services/i18n/translate';

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
	requiredDocuments: ['passport'],
};

const image = { height: 3000, uri: 'file:///cache/a.jpg', width: 4000 };

const modelFor = (
	language: Language,
	state: CaptureState,
	documentType = 'passport',
): CaptureScreenModel => {
	const t = (
		key: Parameters<typeof translate>[1],
		params?: Record<string, string | number>,
	) => translate(language, key, params);
	const { content, title } = presentCapture(
		{
			cache: { assignment, fetchedAt: 1, lastSeenTermsVersionId: null },
			documentType,
			rows: [],
			state,
		},
		t,
	);
	return {
		cancelLabel: t('documents.action.cancel'),
		content,
		onCancel: jest.fn(),
		onChooseGallery: jest.fn(),
		onOpenSettings: jest.fn(),
		onRetake: jest.fn(),
		onSubmit: jest.fn(),
		onTakePhoto: jest.fn(),
		title,
	};
};

describe('CaptureScreenView', () => {
	it('offers two big choices under the document name', async () => {
		const model = modelFor('es', { kind: 'choosing' });
		const view = await render(<CaptureScreenView {...model} />);

		expect(view.getByTestId('capture-title')).toHaveTextContent('Pasaporte');
		await fireEvent.press(view.getByText('Tomar foto'));
		await fireEvent.press(view.getByText('Elegir de la galería'));

		expect(model.onTakePhoto).toHaveBeenCalledTimes(1);
		expect(model.onChooseGallery).toHaveBeenCalledTimes(1);
	});

	it('turns the choices off while the picker is open', async () => {
		const model = modelFor('en', { kind: 'picking', source: 'camera' });
		const view = await render(<CaptureScreenView {...model} />);

		expect(view.getByTestId('capture-take-photo')).toBeDisabled();
		expect(view.getByTestId('capture-choose-gallery')).toBeDisabled();
	});

	it('previews the photo and submits or retakes', async () => {
		const model = modelFor('es', { image, kind: 'previewing' });
		const view = await render(<CaptureScreenView {...model} />);

		expect(view.getByTestId('capture-preview')).toBeTruthy();
		await fireEvent.press(view.getByTestId('capture-submit'));
		await fireEvent.press(view.getByTestId('capture-retake'));

		expect(model.onSubmit).toHaveBeenCalledTimes(1);
		expect(model.onRetake).toHaveBeenCalledTimes(1);
	});

	it('shows progress on the button and turns every button off while preparing', async () => {
		const model = modelFor('es', { image, kind: 'preparing' });
		const view = await render(<CaptureScreenView {...model} />);

		expect(view.getByText('Preparando la foto…')).toBeTruthy();
		expect(view.getByTestId('capture-submit')).toBeDisabled();
		expect(view.getByTestId('capture-retake')).toBeDisabled();
		expect(view.getByTestId('capture-cancel')).toBeDisabled();
	});

	it('explains a refused camera and offers the settings', async () => {
		const model = modelFor('es', { kind: 'problem', problem: 'camera_denied' });
		const view = await render(<CaptureScreenView {...model} />);

		expect(view.getByTestId('capture-problem')).toHaveTextContent(
			/Abre los ajustes del teléfono/,
		);
		await fireEvent.press(view.getByTestId('capture-open-settings'));

		expect(model.onOpenSettings).toHaveBeenCalledTimes(1);
	});

	it.each(['too_large', 'failed'] as const)(
		'says the photo was not saved after %s and offers a retake',
		async (problem) => {
			const model = modelFor('en', { kind: 'problem', problem });
			const view = await render(<CaptureScreenView {...model} />);

			expect(view.getByTestId('capture-problem')).toHaveTextContent(
				/The photo was not saved/,
			);
			expect(view.queryByTestId('capture-open-settings')).toBeNull();
			await fireEvent.press(view.getByText('Take another photo'));

			expect(model.onRetake).toHaveBeenCalledTimes(1);
		},
	);

	it('shows an error state, not a crash, for a document that is not in the catalog', async () => {
		const model = modelFor('es', { kind: 'choosing' }, 'work_permit');
		const view = await render(<CaptureScreenView {...model} />);

		expect(view.getByTestId('capture-unavailable')).toHaveTextContent(
			/Este documento no se puede enviar/,
		);
		expect(view.queryByTestId('capture-take-photo')).toBeNull();
		await fireEvent.press(view.getByTestId('capture-cancel'));

		expect(model.onCancel).toHaveBeenCalledTimes(1);
	});
});
