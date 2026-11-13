import { fireEvent, render } from '@testing-library/react-native';
import type { DebugScreenModel } from '@/features/debug/debug-screen-model';
import DebugScreenView from '@/features/debug/screens/debug-screen-view';
import { translate } from '@/services/i18n/translate';

const modelFor = (
	overrides: Partial<DebugScreenModel> = {},
): DebugScreenModel => ({
	apiUrl: 'http://10.0.2.2:4000',
	apiUrlLabel: translate('es', 'debug.api_url'),
	backLabel: translate('es', 'debug.back'),
	compressionDisabled: false,
	compressionHint: translate('es', 'debug.compression_hint'),
	compressionLabel: translate('es', 'debug.disable_compression'),
	onBack: jest.fn(),
	onCompressionDisabledChange: jest.fn(),
	title: translate('es', 'debug.title'),
	...overrides,
});

describe('DebugScreenView', () => {
	it('shows the API URL read-only and the compression switch off by default', async () => {
		const view = await render(<DebugScreenView {...modelFor()} />);

		expect(view.getByTestId('debug-api-url')).toHaveTextContent(
			'http://10.0.2.2:4000',
		);
		expect(view.getByLabelText('Desactivar compresión')).toBeTruthy();
		expect(view.getByTestId('debug-compression').props.value).toBe(false);
	});

	it('reports the new value when the switch is flipped', async () => {
		const model = modelFor();
		const view = await render(<DebugScreenView {...model} />);

		await fireEvent(view.getByTestId('debug-compression'), 'valueChange', true);

		expect(model.onCompressionDisabledChange).toHaveBeenCalledWith(true);
	});

	it('shows the switch on when compression is disabled', async () => {
		const view = await render(
			<DebugScreenView {...modelFor({ compressionDisabled: true })} />,
		);

		expect(view.getByTestId('debug-compression').props.value).toBe(true);
	});

	it('goes back', async () => {
		const model = modelFor();
		const view = await render(<DebugScreenView {...model} />);

		await fireEvent.press(view.getByTestId('debug-back'));

		expect(model.onBack).toHaveBeenCalledTimes(1);
	});
});
