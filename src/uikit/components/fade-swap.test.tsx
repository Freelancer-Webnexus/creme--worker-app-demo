import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import FadeSwap from '@/uikit/components/fade-swap';

describe('FadeSwap', () => {
	it('renders the child', async () => {
		await render(
			<FadeSwap swapKey="a">
				<Text>first</Text>
			</FadeSwap>,
		);

		expect(screen.getByText('first')).toBeTruthy();
	});

	it('renders the new child when the key changes', async () => {
		const { rerender } = await render(
			<FadeSwap swapKey="a">
				<Text>first</Text>
			</FadeSwap>,
		);
		await rerender(
			<FadeSwap swapKey="b">
				<Text>second</Text>
			</FadeSwap>,
		);

		expect(screen.getByText('second')).toBeTruthy();
	});
});
