import { Appearance, Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import useTheme from '@/uikit/hooks/use-theme';
import { getSemanticColors, type ColorScheme } from '@/uikit/tokens/colors';

const ThemeProbe = () => {
	const { scheme, semanticColors } = useTheme();
	const matches = semanticColors === getSemanticColors(scheme);
	return (
		<Text>{`${scheme} ${matches ? 'colors-match' : 'colors-differ'}`}</Text>
	);
};

describe('useTheme', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('follows the system color scheme while mounted', async () => {
		let systemScheme: ColorScheme = 'dark';
		let notify = (): void => undefined;
		jest
			.spyOn(Appearance, 'getColorScheme')
			.mockImplementation(() => systemScheme);
		jest
			.spyOn(Appearance, 'addChangeListener')
			.mockImplementation((listener) => {
				notify = () => {
					listener({ colorScheme: systemScheme });
				};
				return { remove: jest.fn() };
			});

		const view = await render(<ThemeProbe />);
		expect(view.getByText('dark colors-match')).toBeTruthy();

		systemScheme = 'light';
		await act(async () => {
			notify();
		});
		expect(view.getByText('light colors-match')).toBeTruthy();
	});
});
