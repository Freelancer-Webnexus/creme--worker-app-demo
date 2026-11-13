import { useWindowDimensions } from 'react-native';
import {
	resolveFocusedIndex,
	resolveTabItems,
	type TabItem,
	type TabRoute,
} from '@/uikit/navigation/tab-bar-model';
import useTabSelection from '@/uikit/navigation/use-tab-selection';
import { resolveTabBarWidth, resolveTabWidth } from '@/uikit/tokens/tab-bar';

type TabBarNavigation = {
	emitLongPress: (key: string) => void;
	/** Returns false when a listener prevented the default tab press. */
	emitPress: (key: string) => boolean;
	navigate: (item: TabItem) => void;
};

type UseTabBarInput = {
	focusedKey: string;
	navigation: TabBarNavigation;
	routes: TabRoute[];
};

type UseTabBar = {
	barWidth: number;
	fontScale: number;
	items: TabItem[];
	onLongPress: (item: TabItem) => void;
	onPress: (item: TabItem, index: number) => void;
	selectionStyle: ReturnType<typeof useTabSelection>['selectionStyle'];
	tabWidth: number;
};

/**
 * Turns a navigator's route state into everything the bar renders. The
 * navigation surface is narrowed to three calls so this hook stays free of any
 * one router's types, and any router can hand it its own adapter.
 */
const useTabBar = ({
	focusedKey,
	navigation,
	routes,
}: UseTabBarInput): UseTabBar => {
	const { fontScale, width } = useWindowDimensions();
	const barWidth = resolveTabBarWidth(width, fontScale);
	const tabWidth = resolveTabWidth(barWidth, routes.length);
	const focusedIndex = resolveFocusedIndex(routes, focusedKey);
	const { moveSelection, selectionStyle, visualKey } = useTabSelection(
		focusedIndex,
		focusedKey,
		tabWidth,
	);

	return {
		barWidth,
		fontScale,
		items: resolveTabItems({ focusedKey, routes, visualKey }),
		onLongPress: (item) => {
			navigation.emitLongPress(item.key);
		},
		onPress: (item, index) => {
			const allowed = navigation.emitPress(item.key);
			if (item.isFocused || !allowed) {
				return;
			}
			moveSelection(index, item.key);
			navigation.navigate(item);
		},
		selectionStyle,
		tabWidth,
	};
};

export default useTabBar;
export type { TabBarNavigation, UseTabBar, UseTabBarInput };
