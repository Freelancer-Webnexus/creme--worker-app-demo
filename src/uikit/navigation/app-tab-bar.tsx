import type { TabRoute } from '@/uikit/navigation/tab-bar-model';
import TabBarView from '@/uikit/navigation/tab-bar-view';
import useTabBar from '@/uikit/navigation/use-tab-bar';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

type AppTabBarProps = BottomTabBarProps;

/**
 * Adapts Expo Router's tab navigator to the router-agnostic bar. This file is
 * the only one in the tab bar that knows which router the app uses.
 */
const AppTabBar = ({
	descriptors,
	emitter,
	navigateToTab,
	state,
}: AppTabBarProps) => {
	const routes: TabRoute[] = state.routes.map((route) => {
		const options = descriptors[route.key]?.options;
		return {
			accessibilityLabel: options?.tabBarAccessibilityLabel,
			key: route.key,
			label:
				typeof options?.title === 'string' && options.title.length > 0
					? options.title
					: route.name,
		};
	});
	const focusedKey = state.routes[state.index]?.key ?? '';

	const {
		barWidth,
		fontScale,
		items,
		onLongPress,
		onPress,
		selectionStyle,
		tabWidth,
	} = useTabBar({
		focusedKey,
		navigation: {
			emitLongPress: (key) => {
				emitter.emit({ target: key, type: 'tabLongPress' });
			},
			emitPress: (key) => {
				const event = emitter.emit({
					canPreventDefault: true,
					target: key,
					type: 'tabPress',
				});
				return !event.defaultPrevented;
			},
			navigate: (item) => {
				navigateToTab(item.key);
			},
		},
		routes,
	});

	return (
		<TabBarView
			barWidth={barWidth}
			fontScale={fontScale}
			items={items}
			onLongPress={onLongPress}
			onPress={onPress}
			selectionStyle={selectionStyle}
			tabWidth={tabWidth}
		/>
	);
};

export default AppTabBar;
export type { AppTabBarProps };
