import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import AppRuntimeProvider from '@/services/runtime/app-runtime-provider';
import {
	markBootLaidOut,
	useBootAppRuntime,
} from '@/services/runtime/use-boot-app-runtime';

jest.mock('@/services/runtime/use-boot-app-runtime', () => ({
	markBootLaidOut: jest.fn(),
	retryBoot: jest.fn(),
	useBootAppRuntime: jest.fn(),
}));

jest.mock('@/services/runtime/use-invalidate-on-engine-change', () => ({
	useInvalidateOnEngineChange: jest.fn(),
}));

const mockedBoot = jest.mocked(useBootAppRuntime);

const layoutEvent = {
	nativeEvent: { layout: { height: 10, width: 10, x: 0, y: 0 } },
};

const fireLayout = (view: Awaited<ReturnType<typeof render>>): void => {
	const hosts = view.container.queryAll(
		(node) => node.props.onLayout === markBootLaidOut,
	);
	expect(hosts.length).toBeGreaterThan(0);
	hosts[0]?.props.onLayout(layoutEvent);
};

describe('AppRuntimeProvider', () => {
	beforeEach(() => {
		jest.mocked(markBootLaidOut).mockClear();
	});

	it('renders nothing while booting', async () => {
		mockedBoot.mockReturnValue({ kind: 'booting' });

		const view = await render(
			<AppRuntimeProvider>
				<Text>app</Text>
			</AppRuntimeProvider>,
		);

		expect(view.queryByText('app')).toBeNull();
		expect(markBootLaidOut).not.toHaveBeenCalled();
	});

	it('reports the first layout of the ready tree', async () => {
		mockedBoot.mockReturnValue({ kind: 'ready', runtime: {} as never });

		const view = await render(
			<AppRuntimeProvider>
				<Text>app</Text>
			</AppRuntimeProvider>,
		);
		fireLayout(view);

		expect(markBootLaidOut).toHaveBeenCalledTimes(1);
	});

	it('reports the first layout of the failure screen', async () => {
		mockedBoot.mockReturnValue({ error: new Error('x'), kind: 'failed' });

		const view = await render(<AppRuntimeProvider>{null}</AppRuntimeProvider>);
		fireLayout(view);

		expect(view.getByTestId('boot-retry')).toBeTruthy();
		expect(markBootLaidOut).toHaveBeenCalledTimes(1);
	});
});
