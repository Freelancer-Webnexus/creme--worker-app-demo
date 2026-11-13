import { fireEvent, render } from '@testing-library/react-native';
import BootFailedView from '@/services/runtime/boot-failed-view';

describe('BootFailedView', () => {
	it('shows the message and a retry button that calls back', async () => {
		const onRetry = jest.fn();
		const view = await render(
			<BootFailedView
				onRetry={onRetry}
				retryTitle="Reintentar"
				title="Algo salió mal. Inténtalo otra vez."
			/>,
		);

		expect(view.getByText('Algo salió mal. Inténtalo otra vez.')).toBeTruthy();

		await fireEvent.press(view.getByTestId('boot-retry'));

		expect(onRetry).toHaveBeenCalledTimes(1);
	});
});
