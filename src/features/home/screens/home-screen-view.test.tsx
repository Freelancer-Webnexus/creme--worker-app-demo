import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { presentHomeBody } from '@/features/home/home-body-copy';
import type { HomeBody } from '@/features/home/home-model';
import type { HomeScreenModel } from '@/features/home/home-screen-model';
import HomeScreenView from '@/features/home/screens/home-screen-view';
import { describeSyncIndicator } from '@/features/home/sync-indicator-copy';
import { type Language, translate } from '@/services/i18n/translate';

const ready: HomeBody = {
	kind: 'ready',
	order: {
		employer: 'Valle Verde Farms',
		id: 'JO-2026-0142',
		seasonEnd: '2026-07-31',
		seasonStart: '2026-03-01',
		worksite: 'Yuma, AZ',
	},
	terms: { role: 'approved', textKey: 'home.terms_confirmed' },
	timeline: [
		{ id: 'terms_confirmed', status: 'done' },
		{ id: 'documents_submitted', status: 'not_done' },
		{ id: 'documents_approved', status: 'not_done' },
	],
};

const modelFor = (
	language: Language,
	body: HomeBody,
	overrides: Partial<HomeScreenModel> = {},
): HomeScreenModel => {
	const t = (
		key: Parameters<typeof translate>[1],
		params?: Record<string, string | number>,
	) => translate(language, key, params);
	return {
		account: {
			signOutTitle: t('session.sign_out'),
			signedInAs: t('worker.current', { name: 'Ana López' }),
			switchWorkerTitle: null,
			title: t('home.account_title'),
		},
		content: presentHomeBody(body, language, t),
		debugLink: null,
		greeting: t('home.greeting', { name: 'Ana' }),
		indicator: describeSyncIndicator({ kind: 'nothing_pending' }, t),
		language: {
			label: t('language.label'),
			onChange: jest.fn(),
			options: [
				{ label: t('language.es'), value: 'es' },
				{ label: t('language.en'), value: 'en' },
			],
			selected: language,
			title: t('home.language_title'),
		},
		onRefresh: jest.fn(),
		onRetryNow: jest.fn(),
		onSignInAgain: jest.fn(),
		onSignOut: jest.fn(),
		onSwitchWorker: jest.fn(),
		refreshing: false,
		...overrides,
	};
};

describe('HomeScreenView', () => {
	it('greets the worker and shows the order, terms line and timeline in Spanish', async () => {
		const view = await render(<HomeScreenView {...modelFor('es', ready)} />);

		expect(view.getByTestId('home-greeting')).toHaveTextContent('Hola, Ana');
		expect(view.getByLabelText('Empleador: Valle Verde Farms')).toBeTruthy();
		expect(view.getByLabelText('Lugar de trabajo: Yuma, AZ')).toBeTruthy();
		expect(view.getByTestId('home-terms-line')).toHaveTextContent(
			'Términos confirmados',
		);
		expect(view.getByTestId('home-step-terms_confirmed')).toHaveTextContent(
			/Hecho/,
		);
		expect(view.getByTestId('home-step-documents_submitted')).toHaveTextContent(
			/Falta/,
		);
		expect(view.getByTestId('sync-indicator')).toBeTruthy();
	});

	it('shows the same screen in English', async () => {
		const view = await render(<HomeScreenView {...modelFor('en', ready)} />);

		expect(view.getByTestId('home-greeting')).toHaveTextContent('Hi, Ana');
		expect(view.getByTestId('home-step-documents_approved')).toHaveTextContent(
			/Still to do/,
		);
		expect(view.getByTestId('sync-indicator-headline')).toHaveTextContent(
			'Nothing waiting to be sent from this phone.',
		);
	});

	it('explains that the first load needs a connection, with the indicator still on top', async () => {
		const view = await render(
			<HomeScreenView {...modelFor('es', { kind: 'needs_connection' })} />,
		);

		expect(view.getByTestId('home-empty')).toHaveTextContent(
			/La primera vez necesitas internet/,
		);
		expect(view.getByTestId('sync-indicator')).toBeTruthy();
		expect(view.queryByTestId('home-order')).toBeNull();
	});

	it('retries the first load from a button, not only by pulling the screen', async () => {
		const model = modelFor('es', { kind: 'needs_connection' });
		const view = await render(<HomeScreenView {...model} />);

		await fireEvent.press(view.getByRole('button', { name: 'Reintentar' }));

		expect(model.onRefresh).toHaveBeenCalledTimes(1);
	});

	it('changes the language from the segmented control', async () => {
		const model = modelFor('es', ready);
		const view = await render(<HomeScreenView {...model} />);

		await fireEvent.press(view.getByLabelText('English'));

		expect(model.language.onChange).toHaveBeenCalledWith('en');
	});

	it('shows no debug link in a production build', async () => {
		const view = await render(<HomeScreenView {...modelFor('es', ready)} />);

		expect(view.queryByTestId('home-debug')).toBeNull();
	});

	it('shows the debug link when the model carries one', async () => {
		const onPress = jest.fn();
		const view = await render(
			<HomeScreenView
				{...modelFor('es', ready, {
					debugLink: { onPress, title: 'Depuración' },
				})}
			/>,
		);

		await fireEvent.press(view.getByTestId('home-debug'));

		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it('offers sign out and hides "switch worker" on a one-worker phone', async () => {
		const model = modelFor('es', ready);
		const view = await render(<HomeScreenView {...model} />);

		expect(view.queryByTestId('home-switch-worker')).toBeNull();
		await fireEvent.press(view.getByTestId('home-sign-out'));

		expect(model.onSignOut).toHaveBeenCalledTimes(1);
	});

	it('offers "switch worker" when the phone has several workers', async () => {
		const model = modelFor('es', ready, {
			account: {
				signOutTitle: 'Salir',
				signedInAs: 'Entraste como Bruno Díaz',
				switchWorkerTitle: 'Cambiar de persona',
				title: 'Tu cuenta',
			},
		});
		const view = await render(<HomeScreenView {...model} />);

		await fireEvent.press(view.getByTestId('home-switch-worker'));

		expect(model.onSwitchWorker).toHaveBeenCalledTimes(1);
	});

	it('reserves the ready order card height while loading', async () => {
		const minHeightOf = (id: string) =>
			(
				StyleSheet.flatten(screen.getByTestId(id).props.style as never) as {
					minHeight?: number;
				}
			).minHeight;
		const loading = await render(
			<HomeScreenView {...modelFor('en', { kind: 'loading' })} />,
		);
		const loadingHeight = minHeightOf('home-loading');
		await loading.unmount();
		await render(<HomeScreenView {...modelFor('en', ready)} />);

		expect(loadingHeight).toBeGreaterThan(0);
		expect(minHeightOf('home-order')).toBe(loadingHeight);
	});
});
