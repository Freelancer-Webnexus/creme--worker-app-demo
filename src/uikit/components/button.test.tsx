import { fireEvent, render, screen } from '@testing-library/react-native';
import Button from '@/uikit/components/button';

describe('Button', () => {
	it('is found by role and fires onPress once', async () => {
		const onPress = jest.fn();
		await render(<Button onPress={onPress} testID="go" title="Go" />);

		expect(screen.getByTestId('go')).toBeTruthy();
		await fireEvent.press(screen.getByRole('button', { name: 'Go' }));

		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it('does not fire when disabled and reports the state', async () => {
		const onPress = jest.fn();
		await render(<Button disabled onPress={onPress} title="Go" />);

		const button = screen.getByRole('button', { name: 'Go' });
		await fireEvent.press(button);

		expect(onPress).not.toHaveBeenCalled();
		expect(button.props.accessibilityState).toEqual({
			busy: false,
			disabled: true,
		});
	});

	it('does not fire while busy and shows a spinner instead of dimming', async () => {
		const onPress = jest.fn();
		await render(
			<Button busy onPress={onPress} testID="go" title="Sending…" />,
		);

		const button = screen.getByRole('button', { name: 'Sending…' });
		await fireEvent.press(button);

		expect(onPress).not.toHaveBeenCalled();
		expect(button.props.accessibilityState).toEqual({
			busy: true,
			disabled: true,
		});
		expect(screen.getByTestId('go-busy')).toBeTruthy();
	});
});
