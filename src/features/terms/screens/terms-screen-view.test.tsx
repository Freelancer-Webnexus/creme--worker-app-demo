import { fireEvent, render } from '@testing-library/react-native';
import type { ConfirmState } from '@/features/terms/confirm-state';
import TermsScreenView from '@/features/terms/screens/terms-screen-view';
import { presentTermsContent } from '@/features/terms/terms-content';
import type { TermsScreenModel } from '@/features/terms/terms-screen-model';
import type { Assignment, TermsVersion } from '@/services/api/api-types';
import { type Language, translate } from '@/services/i18n/translate';
import type { WorkerCache } from '@/services/storage/worker-cache-store';
import type { QueuedAction } from '@/services/sync/sync-types';
import { layoutAnimationConfigSpy } from '@/test/layout-animation-config-spy';

jest.mock('react-native-reanimated', () =>
	require('@/test/layout-animation-config-spy').mockReanimatedWithConfigSpy(),
);

const v3: TermsVersion = {
	id: 'terms-v3',
	publishedAt: '2026-05-04T09:00:00.000Z',
	summary: { en: 'English summary v3', es: 'Resumen en español v3' },
	version: 3,
};

const cacheOf = (acceptedTermsVersionId: string | null): WorkerCache => {
	const assignment: Assignment = {
		acceptedTermsVersionId,
		currentTerms: v3,
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
	return { assignment, fetchedAt: 1, lastSeenTermsVersionId: null };
};

const acceptance = (status: QueuedAction['status']): QueuedAction => ({
	attempts: 0,
	clientActionId: 'a1',
	createdAt: 1,
	kind: { termsVersionId: 'terms-v3', type: 'terms_acceptance' },
	nextAttemptAt: 0,
	status,
	workerId: 'w1',
});

type Options = {
	accepted?: string | null;
	rows?: QueuedAction[];
	seenBeforeId?: string | null;
	confirm?: ConfirmState;
};

const modelFor = (
	language: Language,
	options: Options = {},
): TermsScreenModel => {
	const t = (
		key: Parameters<typeof translate>[1],
		params?: Record<string, string | number>,
	) => translate(language, key, params);
	return {
		content: presentTermsContent(
			{ cache: cacheOf(options.accepted ?? null), kind: 'ready' },
			{
				confirm: options.confirm ?? { kind: 'idle' },
				language,
				pendingReason: 'waiting_for_connection',
				rows: options.rows ?? [],
				seenBeforeId: options.seenBeforeId ?? null,
			},
			t,
		),
		onConfirm: jest.fn(),
		onRefresh: jest.fn(),
		refreshing: false,
		title: t('terms.title'),
	};
};

describe('TermsScreenView', () => {
	beforeEach(() => {
		layoutAnimationConfigSpy.mockClear();
	});

	it('skips entering animations on first render of the ready state', async () => {
		const view = await render(<TermsScreenView {...modelFor('es')} />);

		expect(view.getByTestId('terms-confirm')).toBeTruthy();
		expect(layoutAnimationConfigSpy.mock.calls.at(-1)?.[0]).toEqual({
			skipEntering: true,
		});
	});

	it('reads each term as one screen-reader stop, label and value together', async () => {
		const model = modelFor('es');
		const content = {
			...model.content,
			summary: [{ kind: 'term', label: 'Salario', value: '16,50 USD.' }],
		} as typeof model.content;
		const view = await render(<TermsScreenView {...model} content={content} />);

		expect(view.getByLabelText('Salario: 16,50 USD.')).toBeTruthy();
	});

	it('shows the version, date and summary, and confirms the version on screen', async () => {
		const model = modelFor('es');
		const view = await render(<TermsScreenView {...model} />);

		expect(view.getByTestId('terms-title')).toHaveTextContent('Términos');
		expect(view.getByText('Versión 3')).toBeTruthy();
		expect(view.getByText('Publicada el 4 de mayo de 2026')).toBeTruthy();
		expect(view.getByTestId('terms-summary')).toHaveTextContent(
			'Resumen en español v3',
		);
		expect(view.queryByTestId('terms-banner')).toBeNull();

		await fireEvent.press(view.getByTestId('terms-confirm'));

		expect(model.onConfirm).toHaveBeenCalledTimes(1);
		expect(model.onConfirm).toHaveBeenCalledWith('terms-v3');
	});

	it('puts the changed banner above the text and keeps the button', async () => {
		const view = await render(
			<TermsScreenView {...modelFor('en', { seenBeforeId: 'terms-v2' })} />,
		);

		expect(view.getByTestId('terms-banner')).toHaveTextContent(
			/The terms changed\. Read the new version and confirm again\./,
		);
		expect(view.getByTestId('terms-confirm')).toBeTruthy();
	});

	it('says "saved on this phone" and offers no button while waiting for the connection', async () => {
		const view = await render(
			<TermsScreenView
				{...modelFor('es', { rows: [acceptance({ kind: 'queued' })] })}
			/>,
		);

		expect(view.getByTestId('terms-status-text')).toHaveTextContent(
			'Guardado en este teléfono. Todavía no se envió. Esperando conexión.',
		);
		expect(view.queryByTestId('terms-confirm')).toBeNull();
	});

	it('shows confirmed with no button', async () => {
		const view = await render(
			<TermsScreenView {...modelFor('en', { accepted: 'terms-v3' })} />,
		);

		expect(view.getByTestId('terms-status-text')).toHaveTextContent(
			'You confirmed these terms',
		);
		expect(view.queryByTestId('terms-confirm')).toBeNull();
	});

	it('shows a plain error with Retry after a rejection', async () => {
		const model = modelFor('es', {
			rows: [acceptance({ kind: 'failed', reason: 'rejected' })],
		});
		const view = await render(<TermsScreenView {...model} />);

		expect(view.getByTestId('terms-status-text')).toHaveTextContent(
			'No se pudo enviar tu confirmación. Inténtalo otra vez.',
		);
		await fireEvent.press(view.getByText('Reintentar'));

		expect(model.onConfirm).toHaveBeenCalledWith('terms-v3');
	});

	it('turns the button off while the confirmation is being saved', async () => {
		const model = modelFor('es', { confirm: { kind: 'saving' } });
		const view = await render(<TermsScreenView {...model} />);

		await fireEvent.press(view.getByTestId('terms-confirm'));

		expect(view.getByTestId('terms-confirm')).toBeDisabled();
		expect(view.getByText('Guardando…')).toBeTruthy();
		expect(model.onConfirm).not.toHaveBeenCalled();
	});

	it('says when the confirmation could not be saved on the phone', async () => {
		const view = await render(
			<TermsScreenView
				{...modelFor('en', { confirm: { kind: 'not_saved' } })}
			/>,
		);

		expect(view.getByTestId('terms-notice')).toHaveTextContent(
			'Could not save on this phone. Try again.',
		);
	});

	it('explains that the first load needs a connection', async () => {
		const model = modelFor('es');
		const t = (key: Parameters<typeof translate>[1]) => translate('es', key);
		const view = await render(
			<TermsScreenView
				{...model}
				content={presentTermsContent(
					{ kind: 'needs_connection' },
					{
						confirm: { kind: 'idle' },
						language: 'es',
						pendingReason: 'waiting_for_connection',
						rows: [],
						seenBeforeId: null,
					},
					t,
				)}
			/>,
		);

		expect(view.getByTestId('terms-empty')).toHaveTextContent(
			/La primera vez necesitas internet/,
		);
		expect(view.queryByTestId('terms-text')).toBeNull();
	});
});
