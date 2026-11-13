import { StyleSheet } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { getAnimatedStyle as readAnimatedStyle } from 'react-native-reanimated';
import Card from '@/uikit/components/card';
import { lightSemanticColors } from '@/uikit/tokens/colors';
import { statusColorsFor } from '@/uikit/tokens/status-role';

const getAnimatedStyle = readAnimatedStyle as unknown as (element: {
	props: Record<string, unknown>;
}) => Record<string, unknown>;

const advance = async (ms: number) => {
	await act(async () => {
		jest.advanceTimersByTime(ms);
	});
};

const toRgba = (hex: string) => {
	const [red, green, blue] = [1, 3, 5].map((start) =>
		Number.parseInt(hex.slice(start, start + 2), 16),
	);
	return `rgba(${red}, ${green}, ${blue}, 1)`;
};

const approved = statusColorsFor(lightSemanticColors, 'approved');
const pendingSync = statusColorsFor(lightSemanticColors, 'pending_sync');

describe('Card layout', () => {
	it('clips children so an exiting child never draws past a shrinking card', async () => {
		await render(<Card testID="card" />);
		const style = StyleSheet.flatten(
			screen.getByTestId('card').props.style as never,
		) as { overflow?: string };

		expect(style.overflow).toBe('hidden');
	});
});

describe('Card tone animation', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('starts on the tone colours without animating', async () => {
		await render(<Card testID="card" tone="approved" />);

		expect(getAnimatedStyle(screen.getByTestId('card'))).toMatchObject({
			backgroundColor: approved.background,
			borderColor: approved.foreground,
		});
	});

	it('moves to the new tone colours after a tone change', async () => {
		const { rerender } = await render(<Card testID="card" tone="approved" />);
		await rerender(<Card testID="card" tone="pending_sync" />);
		await advance(500);

		expect(getAnimatedStyle(screen.getByTestId('card'))).toMatchObject({
			backgroundColor: toRgba(pendingSync.background),
			borderColor: toRgba(pendingSync.foreground),
		});
	});

	it('is between the two colours partway through', async () => {
		const { rerender } = await render(<Card testID="card" tone="approved" />);
		await rerender(<Card testID="card" tone="pending_sync" />);
		await advance(100);

		const { backgroundColor } = getAnimatedStyle(screen.getByTestId('card'));
		expect(backgroundColor).not.toBe(approved.background);
		expect(backgroundColor).not.toBe(pendingSync.background);
	});
});
