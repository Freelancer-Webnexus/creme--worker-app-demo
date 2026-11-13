import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import TextField from '@/uikit/components/text-field';

let mockFontScale = 1;

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
	__esModule: true,
	default: () => ({
		fontScale: mockFontScale,
		height: 800,
		scale: 2,
		width: 360,
	}),
}));

const messageMinHeight = async (): Promise<number> => {
	const { unmount } = await render(<TextField label="Phone" testID="field" />);
	const style = StyleSheet.flatten(
		screen.getByTestId('field-message').props.style as never,
	) as { minHeight: number };
	await unmount();
	return style.minHeight;
};

describe('TextField message slot', () => {
	it('grows the reserved height with the system font size', async () => {
		mockFontScale = 1;
		const base = await messageMinHeight();
		mockFontScale = 2;
		const large = await messageMinHeight();

		expect(large).toBe(base * 2);
	});
});
