import { useState } from 'react';
import {
	StyleSheet,
	TextInput,
	type TextInputProps,
	useWindowDimensions,
	View,
} from 'react-native';
import Animated, {
	useAnimatedStyle,
	withTiming,
} from 'react-native-reanimated';
import AppText from '@/uikit/components/text';
import useTheme from '@/uikit/hooks/use-theme';
import { borderRadius } from '@/uikit/tokens/border-radius';
import { motion } from '@/uikit/tokens/motion';
import { spacing } from '@/uikit/tokens/spacing';
import { inputText, typography } from '@/uikit/tokens/typography';

type TextFieldProps = Pick<
	TextInputProps,
	| 'autoComplete'
	| 'autoFocus'
	| 'editable'
	| 'inputMode'
	| 'keyboardType'
	| 'maxLength'
	| 'onChangeText'
	| 'onSubmitEditing'
	| 'returnKeyType'
	| 'textContentType'
	| 'value'
> & {
	/** Shown when set, with a word, so the problem is never colour alone. */
	error?: string;
	hint?: string;
	label: string;
	testID?: string;
};

const ERROR_LINES = 2;

/**
 * A labelled input for one value. Large type, a 56 dp minimum and no fixed
 * height, so a big system font grows the box instead of clipping the text.
 */
const TextField = ({
	error,
	hint,
	label,
	testID,
	...inputProps
}: TextFieldProps) => {
	const { semanticColors } = useTheme();
	const { fontScale } = useWindowDimensions();
	const [isFocused, setIsFocused] = useState(false);
	const hasError = error !== undefined && error !== '';
	// Room for the hint and a two-line error, so the usual errors appear
	// without moving the button under the worker's thumb.
	const messageMinHeight =
		fontScale *
		(ERROR_LINES * typography.label.lineHeight +
			(hint === undefined ? 0 : typography.caption.lineHeight + spacing.sm));
	let borderColor = semanticColors.borderStrong;
	let ringColor = 'transparent';
	if (hasError) {
		borderColor = semanticColors.danger;
		ringColor = semanticColors.danger;
	} else if (isFocused) {
		borderColor = semanticColors.primary;
		ringColor = semanticColors.primary;
	}
	const ringStyle = useAnimatedStyle(() => ({
		borderColor: withTiming(ringColor, { duration: motion.duration.fast }),
	}));

	return (
		<View style={styles.field}>
			<AppText variant="label">{label}</AppText>
			<Animated.View
				style={[styles.ring, ringStyle]}
				testID={testID === undefined ? undefined : `${testID}-ring`}
			>
				<TextInput
					{...inputProps}
					accessibilityHint={hint}
					accessibilityLabel={label}
					onBlur={() => {
						setIsFocused(false);
					}}
					onFocus={() => {
						setIsFocused(true);
					}}
					placeholderTextColor={semanticColors.textMuted}
					selectionColor={semanticColors.primary}
					style={[
						styles.input,
						{
							backgroundColor: semanticColors.surface,
							borderColor,
							color: semanticColors.text,
						},
					]}
					testID={testID}
				/>
			</Animated.View>
			<View
				style={[styles.message, { minHeight: messageMinHeight }]}
				testID={testID === undefined ? undefined : `${testID}-message`}
			>
				{hint === undefined ? null : (
					<AppText
						style={{ color: semanticColors.textMuted }}
						variant="caption"
					>
						{hint}
					</AppText>
				)}
				{hasError ? (
					<AppText
						accessibilityLiveRegion="polite"
						style={{ color: semanticColors.danger }}
						variant="label"
					>
						{error}
					</AppText>
				) : null}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	field: {
		gap: spacing.sm,
	},
	input: {
		...inputText,
		borderRadius: borderRadius.md,
		borderWidth: 2,
		minHeight: 60,
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
	},
	message: {
		gap: spacing.sm,
	},
	// Focus and error thicken the outline without moving anything: the ring is
	// always 2 dp wide and only its colour changes.
	ring: {
		borderRadius: borderRadius.md + 2,
		borderWidth: 2,
	},
});

export default TextField;
export type { TextFieldProps };
