/**
 * Pure tab-bar state. It knows nothing about React Navigation or Expo Router,
 * which is what lets it be tested without mounting a navigator, and what lets
 * every router share the same behaviour.
 */
type TabRoute = {
	/** Stable key from the navigator. */
	key: string;
	/** Visible label; the tabs are words only. */
	label: string;
	/** Screen-reader label. Falls back to the visible label. */
	accessibilityLabel?: string;
};

type TabItem = TabRoute & {
	accessibilityLabel: string;
	/** True when the navigator says this tab owns the screen. */
	isFocused: boolean;
	/**
	 * True when the pill is over this tab. It leads `isFocused` while a press is
	 * still settling, so the bar answers the finger instead of the navigator.
	 */
	isVisuallyFocused: boolean;
};

type ResolveTabItemsInput = {
	focusedKey: string;
	routes: TabRoute[];
	visualKey: string;
};

const resolveTabItems = ({
	focusedKey,
	routes,
	visualKey,
}: ResolveTabItemsInput): TabItem[] => {
	return routes.map((route) => ({
		...route,
		accessibilityLabel: route.accessibilityLabel ?? route.label,
		isFocused: route.key === focusedKey,
		isVisuallyFocused: route.key === visualKey,
	}));
};

/**
 * Index the pill animates to. `-1` means no tab matches, which the bar renders
 * as a hidden pill rather than snapping it to the first tab.
 */
const resolveFocusedIndex = (
	routes: TabRoute[],
	focusedKey: string,
): number => {
	return routes.findIndex((route) => route.key === focusedKey);
};

export { resolveFocusedIndex, resolveTabItems };
export type { ResolveTabItemsInput, TabItem, TabRoute };
