import { useCallback, useEffect, useState } from 'react';
import { AppState, type ViewStyle } from 'react-native';
import {
	Easing,
	ReduceMotion,
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withSpring,
	withTiming,
} from 'react-native-reanimated';
import { tabBar } from '@/uikit/tokens/tab-bar';

/** Extra width the pill takes on mid-travel, then gives back. */
const STRETCH = 10;
const SPRING = {
	damping: 22,
	mass: 0.72,
	overshootClamping: true,
	reduceMotion: ReduceMotion.System,
	stiffness: 240,
} as const;

type TabSelection = {
	moveSelection: (index: number, key: string) => void;
	selectionStyle: ReturnType<typeof useAnimatedStyle<ViewStyle>>;
	visualKey: string;
};

/**
 * Drives the selection pill on the UI thread. `visualKey` moves on press rather
 * than on navigation, so the bar never waits for a screen to mount. Every
 * animation defers to the system Reduce Motion setting.
 */
const useTabSelection = (
	focusedIndex: number,
	focusedKey: string,
	tabWidth: number,
): TabSelection => {
	const position = useSharedValue(Math.max(focusedIndex, 0));
	const stretch = useSharedValue(0);
	const opacity = useSharedValue(focusedIndex >= 0 ? 1 : 0);
	const [visualKey, setVisualKey] = useState(focusedKey);

	// The stretch is a scale, not a width, so the pill never relayouts mid-flight.
	const selectionStyle = useAnimatedStyle<ViewStyle>(() => ({
		opacity: opacity.value,
		transform: [
			{ translateX: tabBar.padding + position.value * tabWidth },
			{ scaleX: tabWidth > 0 ? 1 + (stretch.value * STRETCH) / tabWidth : 1 },
		],
	}));

	useEffect(() => {
		setVisualKey(focusedKey);
		opacity.set(
			withTiming(focusedIndex >= 0 ? 1 : 0, {
				duration: 120,
				reduceMotion: ReduceMotion.System,
			}),
		);
		if (focusedIndex < 0) {
			return;
		}
		position.set(withSpring(focusedIndex, SPRING));
	}, [focusedIndex, focusedKey, opacity, position]);

	// Returning from the background can leave a spring mid-flight. Snap instead.
	useEffect(() => {
		const subscription = AppState.addEventListener('change', (next) => {
			if (next !== 'active') {
				return;
			}
			stretch.set(0);
			opacity.set(focusedIndex >= 0 ? 1 : 0);
			if (focusedIndex >= 0) {
				position.set(focusedIndex);
			}
			setVisualKey(focusedKey);
		});
		return () => {
			subscription.remove();
		};
	}, [focusedIndex, focusedKey, opacity, position, stretch]);

	const moveSelection = useCallback(
		(index: number, key: string) => {
			setVisualKey(key);
			opacity.set(1);
			stretch.set(
				withSequence(
					withTiming(1, {
						duration: 90,
						easing: Easing.out(Easing.quad),
						reduceMotion: ReduceMotion.System,
					}),
					withTiming(0, {
						duration: 210,
						easing: Easing.out(Easing.cubic),
						reduceMotion: ReduceMotion.System,
					}),
				),
			);
			position.set(withSpring(index, SPRING));
		},
		[opacity, position, stretch],
	);

	return { moveSelection, selectionStyle, visualKey };
};

export default useTabSelection;
export type { TabSelection };
