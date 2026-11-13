import type { ReactNode } from 'react';
import {
	Pressable,
	type GestureResponderEvent,
	type PressableProps,
	type StyleProp,
	type ViewStyle,
} from 'react-native';
import Animated, {
	interpolate,
	useAnimatedReaction,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/uikit/motion/reduced-motion';
import { motion } from '@/uikit/tokens/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type AppPressableProps = Omit<PressableProps, 'style'> & {
	busy?: boolean;
	children: ReactNode;
	pressedScale?: number;
	style?: StyleProp<Omit<ViewStyle, 'opacity' | 'transform'>>;
};

const AppPressable = (props: AppPressableProps) => {
	const {
		busy = false,
		children,
		disabled,
		onPressIn,
		onPressOut,
		pressedScale = motion.press.scale,
		style,
		...restProps
	} = props;
	const pressed = useSharedValue(0);
	const reducedMotion = useReducedMotion();
	// Busy takes presses away like disabled but keeps full strength: the
	// control is working, not unavailable.
	const inactive = disabled === true || busy;
	const restOpacity = disabled ? motion.press.disabledOpacity : 1;
	const scaleTarget = reducedMotion ? 1 : pressedScale;

	useAnimatedReaction(
		() => inactive,
		(isDisabled) => {
			if (isDisabled) pressed.set(0);
		},
	);

	const animatedStyle = useAnimatedStyle(() => {
		const amount = inactive ? 0 : pressed.get();
		return {
			opacity:
				restOpacity * interpolate(amount, [0, 1], [1, motion.press.opacity]),
			transform: [{ scale: interpolate(amount, [0, 1], [1, scaleTarget]) }],
		};
	});

	const handlePressIn = (event: GestureResponderEvent) => {
		pressed.set(withTiming(1, { duration: motion.duration.fast }));
		onPressIn?.(event);
	};

	const handlePressOut = (event: GestureResponderEvent) => {
		pressed.set(withTiming(0, { duration: motion.duration.fast }));
		onPressOut?.(event);
	};

	return (
		<AnimatedPressable
			{...restProps}
			disabled={busy || disabled}
			onPressIn={handlePressIn}
			onPressOut={handlePressOut}
			style={[style, animatedStyle]}
		>
			{children}
		</AnimatedPressable>
	);
};

export default AppPressable;
export type { AppPressableProps };
