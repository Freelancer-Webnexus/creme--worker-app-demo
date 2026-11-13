import { useMemo, useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';
import {
	getSemanticColors,
	type ColorScheme,
	type SemanticColors,
} from '@/uikit/tokens/colors';

const subscribeToAppearance = (onStoreChange: () => void): (() => void) => {
	const subscription = Appearance.addChangeListener(onStoreChange);
	return () => {
		subscription.remove();
	};
};

const getSystemScheme = (): ColorScheme => {
	const scheme = Appearance.getColorScheme();
	if (scheme === 'dark' || scheme === 'light') {
		return scheme;
	}
	return 'light';
};

export const getPageColor = (): string =>
	getSemanticColors(getSystemScheme()).background;

const useTheme = (): {
	scheme: ColorScheme;
	semanticColors: SemanticColors;
} => {
	const scheme = useSyncExternalStore(
		subscribeToAppearance,
		getSystemScheme,
		getSystemScheme,
	);
	const semanticColors = useMemo(() => getSemanticColors(scheme), [scheme]);

	return { scheme, semanticColors };
};

export default useTheme;
