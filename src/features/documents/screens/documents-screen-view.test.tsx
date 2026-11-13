import { fireEvent, render, within } from '@testing-library/react-native';
import { presentDocumentsContent } from '@/features/documents/documents-content';
import type { DocumentsScreenModel } from '@/features/documents/documents-screen-model';
import DocumentsScreenView from '@/features/documents/screens/documents-screen-view';
import type { Assignment } from '@/services/api/api-types';
import { type Language, translate } from '@/services/i18n/translate';
import type { QueuedAction } from '@/services/sync/sync-types';
import { layoutAnimationConfigSpy } from '@/test/layout-animation-config-spy';

jest.mock('react-native-reanimated', () =>
	require('@/test/layout-animation-config-spy').mockReanimatedWithConfigSpy(),
);

const catalog = [
	'passport',
	'ds160_confirmation',
	'signed_contract',
	'saved_only',
	'not_sent',
	'send_failed',
];

const assignment: Assignment = {
	acceptedTermsVersionId: 'terms-v2',
	currentTerms: {
		id: 'terms-v2',
		publishedAt: '2026-02-10T09:00:00.000Z',
		summary: { en: 'English', es: 'Español' },
		version: 2,
	},
	documents: [
		{ documentType: 'passport', state: 'approved' },
		{ documentType: 'ds160_confirmation', state: 'pending_review' },
		{
			documentType: 'signed_contract',
			reason: 'Foto borrosa, vuelva a tomarla',
			state: 'correction_requested',
		},
	],
	flags: {},
	order: {
		employer: 'Valle Verde Farms',
		id: 'JO-2026-0142',
		seasonEnd: '2026-07-31',
		seasonStart: '2026-03-01',
		worksite: 'Yuma, AZ',
	},
	requiredDocuments: catalog,
};

const upload = (
	id: string,
	documentType: string,
	status: QueuedAction['status'],
): QueuedAction => ({
	attempts: 0,
	clientActionId: id,
	createdAt: 1,
	kind: {
		documentType,
		fileUri: `file:///uploads/${id}.jpg`,
		type: 'document_upload',
	},
	nextAttemptAt: 0,
	status,
	workerId: 'w1',
});

const rows = [
	upload('u1', 'saved_only', { kind: 'queued' }),
	upload('u2', 'send_failed', { kind: 'failed', reason: 'too_large' }),
];

const modelFor = (language: Language): DocumentsScreenModel => {
	const t = (
		key: Parameters<typeof translate>[1],
		params?: Record<string, string | number>,
	) => translate(language, key, params);
	return {
		content: presentDocumentsContent(
			{
				cache: { assignment, fetchedAt: 1, lastSeenTermsVersionId: null },
				kind: 'ready',
			},
			rows,
			t,
			'waiting_for_connection',
		),
		onDismissFailed: jest.fn(),
		onOpenCapture: jest.fn(),
		onRefresh: jest.fn(),
		refreshing: false,
		title: t('documents.title'),
	};
};

const expectedStatus: Record<Language, Record<string, string>> = {
	en: {
		ds160_confirmation: 'Sent, waiting for staff review',
		not_sent: 'Not sent',
		passport: 'Approved',
		saved_only: 'Saved on this phone. Not sent yet. Waiting for connection.',
		send_failed: 'Could not send: the photo is too big. Take another one.',
		signed_contract: 'Needs a correction',
	},
	es: {
		ds160_confirmation: 'Enviado, esperando revisión del personal',
		not_sent: 'Sin enviar',
		passport: 'Aprobado',
		saved_only:
			'Guardado en este teléfono. Todavía no se envió. Esperando conexión.',
		send_failed: 'No se pudo enviar: la foto pesa demasiado. Toma otra.',
		signed_contract: 'Hay que corregirlo',
	},
};

describe('DocumentsScreenView', () => {
	beforeEach(() => {
		layoutAnimationConfigSpy.mockClear();
	});

	it('skips entering animations on first render of the rows', async () => {
		const view = await render(<DocumentsScreenView {...modelFor('es')} />);

		expect(view.getByTestId('documents-screen')).toBeTruthy();
		expect(layoutAnimationConfigSpy.mock.calls.at(-1)?.[0]).toEqual({
			skipEntering: true,
		});
	});

	it.each(['es', 'en'] as const)(
		'renders all six states in %s',
		async (language) => {
			const view = await render(
				<DocumentsScreenView {...modelFor(language)} />,
			);

			for (const documentType of catalog) {
				expect(
					view.getByTestId(`document-status-${documentType}`),
				).toHaveTextContent(expectedStatus[language][documentType]);
			}
			expect(
				view.getByTestId('document-reason-signed_contract'),
			).toHaveTextContent(
				language === 'es'
					? 'Motivo: Foto borrosa, vuelva a tomarla'
					: 'Reason: Foto borrosa, vuelva a tomarla',
			);
		},
	);

	it('lists the rows in catalog order under the title', async () => {
		const view = await render(<DocumentsScreenView {...modelFor('es')} />);

		expect(view.getByTestId('documents-title')).toHaveTextContent('Documentos');
		const ids = view
			.getAllByTestId(/^document-row-/)
			.map((node) => node.props.testID as string);
		expect(ids).toEqual(catalog.map((type) => `document-row-${type}`));
	});

	it.each(['passport', 'ds160_confirmation', 'saved_only'])(
		'gives the %s row no button role, because nothing can be submitted',
		async (documentType) => {
			const model = modelFor('es');
			const view = await render(<DocumentsScreenView {...model} />);
			const row = view.getByTestId(`document-row-${documentType}`);

			expect(within(row).queryByRole('button')).toBeNull();
			expect(row).not.toHaveProp('accessibilityRole', 'button');
			await fireEvent.press(row);

			expect(model.onOpenCapture).not.toHaveBeenCalled();
		},
	);

	it('labels each row with its name and state for a screen reader', async () => {
		const view = await render(<DocumentsScreenView {...modelFor('es')} />);

		expect(view.getByLabelText('Pasaporte: Aprobado')).toBeTruthy();
		expect(
			view.getByLabelText(
				'Documento: Guardado en este teléfono. Todavía no se envió. Esperando conexión.',
			),
		).toBeTruthy();
	});

	it.each(['not_sent', 'signed_contract'])(
		'opens capture when the %s row is tapped',
		async (documentType) => {
			const model = modelFor('es');
			const view = await render(<DocumentsScreenView {...model} />);
			const row = view.getByTestId(`document-row-${documentType}`);

			expect(row).toHaveProp('accessibilityRole', 'button');
			await fireEvent.press(row);

			expect(model.onOpenCapture).toHaveBeenCalledWith(documentType);
		},
	);

	it.each([
		['not_sent', 'Tomar foto'],
		['signed_contract', 'Tomar otra foto'],
	])(
		'tells a screen reader what tapping the %s row does',
		async (documentType, actionLabel) => {
			const view = await render(<DocumentsScreenView {...modelFor('es')} />);

			expect(view.getByTestId(`document-row-${documentType}`)).toHaveProp(
				'accessibilityHint',
				actionLabel,
			);
		},
	);

	it('offers Retake and Dismiss on a send-failed row', async () => {
		const model = modelFor('en');
		const view = await render(<DocumentsScreenView {...model} />);

		await fireEvent.press(view.getByTestId('document-retake-send_failed'));
		await fireEvent.press(view.getByTestId('document-dismiss-send_failed'));

		expect(model.onOpenCapture).toHaveBeenCalledWith('send_failed');
		expect(model.onDismissFailed).toHaveBeenCalledWith('u2');
	});

	it('explains that the first load needs a connection', async () => {
		const t = (key: Parameters<typeof translate>[1]) => translate('es', key);
		const view = await render(
			<DocumentsScreenView
				{...modelFor('es')}
				content={presentDocumentsContent(
					{ kind: 'needs_connection' },
					[],
					t,
					'waiting_for_connection',
				)}
			/>,
		);

		expect(view.getByTestId('documents-empty')).toHaveTextContent(
			/La primera vez necesitas internet/,
		);
	});
});
