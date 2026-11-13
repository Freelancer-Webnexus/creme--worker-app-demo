import { render } from '@testing-library/react-native';
import GlobalErrorBoundary from '@/services/error-boundary/global-error-boundary';

jest.mock('@/services/logger/logger', () => ({
	logger: { error: jest.fn(), warn: jest.fn() },
}));

const Crash = (): never => {
	throw new Error('first mount crash');
};

describe('GlobalErrorBoundary', () => {
	it('reports a child crash, so the splash lifts and the error screen is visible', async () => {
		const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
		const onError = jest.fn();

		await render(
			<GlobalErrorBoundary onError={onError}>
				<Crash />
			</GlobalErrorBoundary>,
		);

		expect(onError).toHaveBeenCalledTimes(1);
		spy.mockRestore();
	});
});
