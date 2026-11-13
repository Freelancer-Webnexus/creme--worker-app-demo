import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { getAnimatedStyle as readAnimatedStyle } from 'react-native-reanimated';
import Card from '@/uikit/components/card';
import SegmentedControl from '@/uikit/components/segmented-control';
import TextField from '@/uikit/components/text-field';
import type { StatusRole } from '@/uikit/tokens/status-role';

const tones: (StatusRole | undefined)[] = [
	undefined,
	'approved',
	'correction',
	'failed',
	'neutral',
	'pending_review',
	'pending_sync',
];

const getAnimatedStyle = readAnimatedStyle as unknown as (element: {
	props: Record<string, unknown>;
}) => Record<string, unknown>;

const flat = (node: { props: { style?: unknown } }) =>
	StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

describe('Card', () => {
	it('keeps one border width for every tone', async () => {
		const widths = new Set<unknown>();
		for (const tone of tones) {
			const { unmount } = await render(<Card testID="card" tone={tone} />);
			widths.add(flat(screen.getByTestId('card')).borderWidth);
			await unmount();
		}
		expect(widths.size).toBe(1);
	});
});

describe('TextField', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('keeps one border width across idle, focus and error', async () => {
		const idle = await render(<TextField label="Phone" testID="field" />);
		const idleWidth = flat(screen.getByTestId('field')).borderWidth;
		await idle.unmount();

		const focused = await render(<TextField label="Phone" testID="field" />);
		await fireEvent(screen.getByTestId('field'), 'focus');
		const focusWidth = flat(screen.getByTestId('field')).borderWidth;
		await focused.unmount();

		await render(<TextField error="Bad" label="Phone" testID="field" />);
		const errorWidth = flat(screen.getByTestId('field')).borderWidth;

		expect(focusWidth).toBe(idleWidth);
		expect(errorWidth).toBe(idleWidth);
	});

	it('shows focus and error with a ring of constant width, not colour alone', async () => {
		const ring = () => {
			const node = screen.getByTestId('field-ring');
			return {
				borderColor: getAnimatedStyle(node).borderColor,
				borderWidth: flat(node).borderWidth,
			};
		};

		const idle = await render(<TextField label="Phone" testID="field" />);
		const idleRing = ring();
		await idle.unmount();

		const focused = await render(<TextField label="Phone" testID="field" />);
		await fireEvent(screen.getByTestId('field'), 'focus');
		await act(async () => {
			jest.advanceTimersByTime(500);
		});
		const focusRing = ring();
		await focused.unmount();

		await render(<TextField error="Bad" label="Phone" testID="field" />);
		const errorRing = ring();

		expect(idleRing.borderColor).toBe('transparent');
		expect(focusRing.borderColor).not.toBe('transparent');
		expect(errorRing.borderColor).not.toBe('transparent');
		expect(focusRing.borderWidth).toBe(idleRing.borderWidth);
		expect(errorRing.borderWidth).toBe(idleRing.borderWidth);
	});

	it('always renders the message slot', async () => {
		const { unmount } = await render(
			<TextField label="Phone" testID="field" />,
		);
		expect(screen.getByTestId('field-message')).toBeTruthy();
		await unmount();

		await render(<TextField error="Bad" label="Phone" testID="field" />);
		expect(screen.getByTestId('field-message')).toBeTruthy();
		expect(screen.getByText('Bad')).toBeTruthy();
	});
});

describe('SegmentedControl', () => {
	const options = [
		{ label: 'Español', value: 'es' },
		{ label: 'English', value: 'en' },
	];

	it('keeps font weight and the tick slot for every segment', async () => {
		await render(
			<SegmentedControl
				label="Language"
				onChange={jest.fn()}
				options={options}
				selected="es"
			/>,
		);
		const labels = screen.getAllByTestId('segment-label');
		const ticks = screen.getAllByTestId('segment-tick', {
			includeHiddenElements: true,
		});
		expect(ticks).toHaveLength(2);
		expect(flat(labels[0]).fontWeight).toBe(flat(labels[1]).fontWeight);
		expect(flat(ticks[0]).opacity).toBe(1);
		expect(flat(ticks[1]).opacity).toBe(0);
	});
});
