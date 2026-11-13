import { StyleSheet, type ViewProps } from 'react-native';
import Animated, {
	LinearTransition,
	useAnimatedStyle,
	withTiming,
} from 'react-native-reanimated';
import useTheme from '@/uikit/hooks/use-theme';
import { borderRadius } from '@/uikit/tokens/border-radius';
import { motion } from '@/uikit/tokens/motion';
import { spacing } from '@/uikit/tokens/spacing';
import { type StatusRole, statusColorsFor } from '@/uikit/tokens/status-role';

type CardProps = ViewProps & {
	/** A status tints the card and its border; without one the card is plain. */
	tone?: StatusRole;
};

const Card = ({ style, tone, ...rest }: CardProps) => {
	const { semanticColors } = useTheme();
	const tint =
		tone === undefined ? null : statusColorsFor(semanticColors, tone);

	const backgroundTarget = tint?.background ?? semanticColors.surface;
	const borderTarget = tint?.foreground ?? semanticColors.border;
	const toneStyle = useAnimatedStyle(() => ({
		backgroundColor: withTiming(backgroundTarget, {
			duration: motion.duration.base,
		}),
		borderColor: withTiming(borderTarget, { duration: motion.duration.base }),
	}));

	return (
		<Animated.View
			{...rest}
			layout={LinearTransition.duration(motion.duration.base)}
			style={[styles.card, style, toneStyle]}
		/>
	);
};

const styles = StyleSheet.create({
	card: {
		borderWidth: 2,
		borderRadius: borderRadius.lg,
		gap: spacing.md,
		// A child fading out keeps its old frame while the card shrinks around it.
		overflow: 'hidden',
		padding: spacing.lg,
	},
});

export default Card;
export type { CardProps };
