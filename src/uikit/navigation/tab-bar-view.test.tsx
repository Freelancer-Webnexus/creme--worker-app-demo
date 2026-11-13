import type { ViewStyle } from 'react-native';
import { render } from '@testing-library/react-native';
import { useAnimatedStyle } from 'react-native-reanimated';
import type { TabItem } from '@/uikit/navigation/tab-bar-model';
import TabBarView from '@/uikit/navigation/tab-bar-view';

const items: TabItem[] = [
	{
		accessibilityLabel: 'Home',
		isFocused: true,
		isVisuallyFocused: true,
		key: 'home-1',
		label: 'Home',
	},
	{
		accessibilityLabel: 'App settings',
		isFocused: false,
		isVisuallyFocused: false,
		key: 'settings-1',
		label: 'Settings',
	},
];

/**
 * Mounts the bar so a broken primitive or a missing reanimated setup fails here
 * rather than at app start. The selection style is a plain object: the pill's
 * motion belongs to use-tab-selection, not to this view.
 */
const Harness = ({ onPress }: { onPress: () => void }) => {
	const style = useAnimatedStyle<ViewStyle>(() => ({}));
	return (
		<TabBarView
			barWidth={360}
			fontScale={1}
			items={items}
			onLongPress={() => undefined}
			onPress={onPress}
			selectionStyle={style}
			tabWidth={116}
		/>
	);
};

describe('TabBarView', () => {
	it('keeps a label on one line that shrinks to fit, so a word never breaks', async () => {
		const view = await render(<Harness onPress={() => undefined} />);

		const label = view.getByText('Home');

		expect(label.props.numberOfLines).toBe(1);
		expect(label.props.adjustsFontSizeToFit).toBe(true);
		expect(label.props.maxFontSizeMultiplier).toBe(2);
	});

	it('renders one accessible tab per item and marks the selected one', async () => {
		const view = await render(<Harness onPress={() => undefined} />);

		const tabs = view.getAllByRole('tab');
		expect(tabs).toHaveLength(2);
		expect(view.getByText('Home')).toBeTruthy();
		expect(view.getByLabelText('App settings')).toBeTruthy();
		expect(tabs[0]?.props.accessibilityState).toEqual({ selected: true });
		expect(tabs[1]?.props.accessibilityState).toEqual({ selected: false });
	});
});
