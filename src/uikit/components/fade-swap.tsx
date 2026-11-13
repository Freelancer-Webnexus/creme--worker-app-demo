import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { motion } from '@/uikit/tokens/motion';

type FadeSwapProps = {
	children: ReactNode;
	style?: StyleProp<ViewStyle>;
	swapKey: string;
};

/**
 * Cross-fades its children whenever `swapKey` changes. Everything inside leaves
 * together, so a fading block never mixes old and new words.
 */
const FadeSwap = ({ children, style, swapKey }: FadeSwapProps) => (
	<Animated.View
		entering={FadeIn.duration(motion.duration.base)}
		exiting={FadeOut.duration(motion.duration.fast)}
		key={swapKey}
		style={style}
	>
		{children}
	</Animated.View>
);

export default FadeSwap;
export type { FadeSwapProps };
