import {
	ActivityIndicator,
	StyleSheet,
	type StyleProp,
	type ViewStyle,
} from 'react-native';
import AppPressable from '@/uikit/components/pressables';
import AppText from '@/uikit/components/text';
import useTheme from '@/uikit/hooks/use-theme';
import { borderRadius } from '@/uikit/tokens/border-radius';
import { spacing } from '@/uikit/tokens/spacing';

type ButtonVariant = 'outline' | 'primary' | 'secondary';

type ButtonProps = {
	accessibilityHint?: string;
	accessibilityLabel?: string;
	/** Working on the press: no new presses, a spinner, and no dimming. */
	busy?: boolean;
	disabled?: boolean;
	onPress: () => void;
	style?: StyleProp<ViewStyle>;
	testID?: string;
	title: string;
	variant?: ButtonVariant;
};

const Button = (props: ButtonProps) => {
	const {
		accessibilityHint,
		accessibilityLabel,
		busy = false,
		disabled = false,
		onPress,
		style,
		testID,
		title,
		variant = 'primary',
	} = props;
	const { semanticColors } = useTheme();
	const variantStyles = {
		outline: {
			container: {
				backgroundColor: 'transparent',
				borderColor: semanticColors.borderStrong,
				borderWidth: 2,
			},
			text: {
				color: semanticColors.text,
			},
		},
		primary: {
			container: {
				backgroundColor: semanticColors.primary,
			},
			text: {
				color: semanticColors.primaryText,
			},
		},
		secondary: {
			container: {
				backgroundColor: semanticColors.secondary,
			},
			text: {
				color: semanticColors.secondaryText,
			},
		},
	} as const;

	return (
		<AppPressable
			accessibilityHint={accessibilityHint}
			accessibilityLabel={accessibilityLabel ?? title}
			accessibilityRole="button"
			accessibilityState={{ busy, disabled: disabled || busy }}
			busy={busy}
			disabled={disabled}
			onPress={onPress}
			style={[styles.container, variantStyles[variant].container, style]}
			testID={testID}
		>
			{busy ? (
				<ActivityIndicator
					color={variantStyles[variant].text.color}
					testID={testID === undefined ? undefined : `${testID}-busy`}
				/>
			) : null}
			<AppText
				style={[styles.title, variantStyles[variant].text]}
				variant="button"
			>
				{title}
			</AppText>
		</AppPressable>
	);
};

const styles = StyleSheet.create({
	container: {
		alignItems: 'center',
		borderRadius: borderRadius.md,
		flexDirection: 'row',
		gap: spacing.sm,
		justifyContent: 'center',
		minHeight: 56,
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
	},
	title: {
		flexShrink: 1,
		textAlign: 'center',
	},
});

export default Button;
export type { ButtonProps, ButtonVariant };
