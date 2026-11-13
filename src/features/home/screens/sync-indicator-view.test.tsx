import { fireEvent, render } from '@testing-library/react-native';
import SyncIndicatorView from '@/features/home/screens/sync-indicator-view';
import { describeSyncIndicator } from '@/features/home/sync-indicator-copy';
import { type Language, translate } from '@/services/i18n/translate';
import type { SyncIndicator } from '@/services/runtime/sync-indicator-model';
import { layoutAnimationConfigSpy } from '@/test/layout-animation-config-spy';

jest.mock('react-native-reanimated', () =>
	require('@/test/layout-animation-config-spy').mockReanimatedWithConfigSpy(),
);

const variants: SyncIndicator[] = [
	{ kind: 'checking' },
	{ kind: 'session_expired', savedCount: 2 },
	{ count: 2, kind: 'offline_waiting' },
	{ kind: 'offline_clear' },
	{ failedCount: 1, isOnline: true, kind: 'needs_attention', queuedCount: 1 },
	{ failedCount: 1, isOnline: false, kind: 'needs_attention', queuedCount: 0 },
	{ count: 3, isRetry: false, kind: 'sending' },
	{ count: 1, isRetry: true, kind: 'sending' },
	{ count: 1, kind: 'retrying', seconds: 20 },
	{ kind: 'nothing_pending' },
];

const presentationFor = (indicator: SyncIndicator, language: Language) =>
	describeSyncIndicator(indicator, (key, params) =>
		translate(language, key, params),
	);

const renderIndicator = async (
	indicator: SyncIndicator,
	language: Language,
	handlers = { onRetryNow: jest.fn(), onSignInAgain: jest.fn() },
) =>
	render(
		<SyncIndicatorView
			onRetryNow={handlers.onRetryNow}
			onSignInAgain={handlers.onSignInAgain}
			presentation={presentationFor(indicator, language)}
		/>,
	);

describe('SyncIndicatorView', () => {
	beforeEach(() => {
		layoutAnimationConfigSpy.mockClear();
	});

	it('skips entering animations on first render', async () => {
		const view = await renderIndicator({ kind: 'nothing_pending' }, 'es');

		expect(view.getByTestId('sync-indicator')).toBeTruthy();
		expect(layoutAnimationConfigSpy.mock.calls.at(-1)?.[0]).toEqual({
			skipEntering: true,
		});
	});

	describe.each(['es', 'en'] as const)('in %s', (language) => {
		it.each(variants)(
			'renders the %j variant with a live region',
			async (indicator) => {
				const presentation = presentationFor(indicator, language);
				const view = await renderIndicator(indicator, language);

				expect(view.getByTestId('sync-indicator-headline')).toHaveTextContent(
					presentation.headline,
				);
				expect(
					view.queryByTestId('sync-indicator-detail')?.props.children ?? null,
				).toBe(presentation.detail);
				const words = view.getByTestId('sync-indicator-words');
				expect(words.props.accessibilityLiveRegion).toBe('polite');
				expect(words.props.accessibilityLabel).toBe(
					presentation.accessibilityLabel,
				);
				expect(words.props.accessibilityLabel).not.toMatch(/\{\w+\}/);
			},
		);
	});

	it('reads like a sentence when offline with waiting actions', async () => {
		const view = await renderIndicator(
			{ count: 2, kind: 'offline_waiting' },
			'es',
		);

		expect(view.getByTestId('sync-indicator-headline')).toHaveTextContent(
			'Sin conexión',
		);
		expect(view.getByTestId('sync-indicator-detail')).toHaveTextContent(
			'2 acciones guardadas en este teléfono, esperando conexión.',
		);
		expect(view.queryByTestId('sync-retry-now')).toBeNull();
		expect(view.queryByTestId('sync-sign-in-again')).toBeNull();
	});

	it('shows "retry now" only while backing off and fires it', async () => {
		const handlers = { onRetryNow: jest.fn(), onSignInAgain: jest.fn() };
		const view = await renderIndicator(
			{ count: 1, kind: 'retrying', seconds: 20 },
			'en',
			handlers,
		);

		expect(view.getByTestId('sync-indicator-headline')).toHaveTextContent(
			'Trying again in 20 s',
		);
		await fireEvent.press(view.getByTestId('sync-retry-now'));

		expect(handlers.onRetryNow).toHaveBeenCalledTimes(1);
		expect(view.queryByTestId('sync-sign-in-again')).toBeNull();
	});

	it('keeps "retry now" on the card, busy and not pressable, while a failed action is sent again', async () => {
		const handlers = { onRetryNow: jest.fn(), onSignInAgain: jest.fn() };
		const view = await renderIndicator(
			{ count: 1, isRetry: true, kind: 'sending' },
			'es',
			handlers,
		);

		const button = view.getByTestId('sync-retry-now');
		expect(button.props.accessibilityState).toEqual({
			busy: true,
			disabled: true,
		});
		expect(view.getByTestId('sync-retry-now-busy')).toBeTruthy();
		await fireEvent.press(button);

		expect(handlers.onRetryNow).not.toHaveBeenCalled();
	});

	it('shows "sign in again" when the session expired and fires it', async () => {
		const handlers = { onRetryNow: jest.fn(), onSignInAgain: jest.fn() };
		const view = await renderIndicator(
			{ kind: 'session_expired', savedCount: 2 },
			'es',
			handlers,
		);

		await fireEvent.press(view.getByTestId('sync-sign-in-again'));

		expect(handlers.onSignInAgain).toHaveBeenCalledTimes(1);
		expect(view.queryByTestId('sync-retry-now')).toBeNull();
	});

	it('offers no button when nothing is pending', async () => {
		const view = await renderIndicator({ kind: 'nothing_pending' }, 'es');

		expect(view.queryAllByRole('button')).toHaveLength(0);
	});
});
