import type { ReactNode } from 'react';
import Animated, {
	FadeIn,
	FadeOut,
	LinearTransition,
} from 'react-native-reanimated';
import { motion } from '@/uikit/tokens/motion';

type PresenceProps<T> = {
	children: (value: T) => ReactNode;
	when: T | null | undefined | false;
};

const Presence = <T,>({ children, when }: PresenceProps<T>) => {
	if (when === null || when === undefined || when === false) return null;

	return (
		<Animated.View
			entering={FadeIn.duration(motion.duration.base)}
			exiting={FadeOut.duration(motion.duration.fast)}
			layout={LinearTransition.duration(motion.duration.base)}
		>
			{children(when)}
		</Animated.View>
	);
};

export default Presence;
export type { PresenceProps };
