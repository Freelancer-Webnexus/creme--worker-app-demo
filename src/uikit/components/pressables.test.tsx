import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { getAnimatedStyle as readAnimatedStyle } from 'react-native-reanimated';
import AppPressable from '@/uikit/components/pressables';
import { useReducedMotion } from '@/uikit/motion/reduced-motion';

jest.mock('@/uikit/motion/reduced-motion', () => ({
	useReducedMotion: jest.fn(() => false),
}));

const getAnimatedStyle = readAnimatedStyle as unknown as (element: {
	props: Record<string, unknown>;
}) => Record<string, unknown>;

const mockedReducedMotion = jest.mocked(useReducedMotion);

const settle = async () => {
	await act(async () => {
		jest.advanceTimersByTime(500);
	});
};

describe('AppPressable', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		mockedReducedMotion.mockReturnValue(false);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('scales and dims while pressed', async () => {
		await render(
			<AppPressable accessibilityRole="button" onPress={jest.fn()}>
				{null}
			</AppPressable>,
		);
		const button = screen.getByRole('button');

		await fireEvent(button, 'pressIn');
		await settle();

		expect(getAnimatedStyle(button)).toMatchObject({
			opacity: 0.8,
			transform: [{ scale: 0.97 }],
		});
	});

	it('keeps scale at 1 when motion is reduced', async () => {
		mockedReducedMotion.mockReturnValue(true);
		await render(
			<AppPressable accessibilityRole="button" onPress={jest.fn()}>
				{null}
			</AppPressable>,
		);
		const button = screen.getByRole('button');

		await fireEvent(button, 'pressIn');
		await settle();

		expect(getAnimatedStyle(button)).toMatchObject({
			opacity: 0.8,
			transform: [{ scale: 1 }],
		});
	});

	it('rests dimmed when disabled', async () => {
		await render(
			<AppPressable accessibilityRole="button" disabled onPress={jest.fn()}>
				{null}
			</AppPressable>,
		);

		expect(getAnimatedStyle(screen.getByRole('button'))).toMatchObject({
			opacity: 0.5,
		});
	});

	it('still calls the caller pressIn and pressOut handlers', async () => {
		const onPressIn = jest.fn();
		const onPressOut = jest.fn();
		await render(
			<AppPressable
				accessibilityRole="button"
				onPress={jest.fn()}
				onPressIn={onPressIn}
				onPressOut={onPressOut}
			>
				{null}
			</AppPressable>,
		);
		const button = screen.getByRole('button');

		await fireEvent(button, 'pressIn');
		await fireEvent(button, 'pressOut');

		expect(onPressIn).toHaveBeenCalledTimes(1);
		expect(onPressOut).toHaveBeenCalledTimes(1);
	});

	it('returns to rest when disabled flips during a press', async () => {
		const { rerender } = await render(
			<AppPressable accessibilityRole="button" onPress={jest.fn()}>
				{null}
			</AppPressable>,
		);
		await fireEvent(screen.getByRole('button'), 'pressIn');
		await settle();

		await rerender(
			<AppPressable accessibilityRole="button" disabled onPress={jest.fn()}>
				{null}
			</AppPressable>,
		);
		await settle();

		expect(getAnimatedStyle(screen.getByRole('button'))).toMatchObject({
			opacity: 0.5,
			transform: [{ scale: 1 }],
		});
	});
});
