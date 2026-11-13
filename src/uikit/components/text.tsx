import {
	Text as NativeText,
	type StyleProp,
	type TextProps,
	type TextStyle,
} from 'react-native';
import useTheme from '@/uikit/hooks/use-theme';
import { type StatusRole, statusColorsFor } from '@/uikit/tokens/status-role';
import { headingMaxFontScale, typography } from '@/uikit/tokens/typography';

type AppTextVariant =
	'body' | 'button' | 'caption' | 'headline' | 'label' | 'title';

/** `muted` is secondary text; a status role takes that status's text colour. */
type AppTextTone = 'default' | 'muted' | StatusRole;

type AppTextProps = TextProps & {
	tone?: AppTextTone;
	variant?: AppTextVariant;
	style?: StyleProp<TextStyle>;
};

const AppText = (props: AppTextProps) => {
	const { style, tone = 'default', variant = 'body', ...restProps } = props;
	const { semanticColors } = useTheme();

	let color = semanticColors.text;
	if (tone === 'muted') {
		color = semanticColors.textMuted;
	} else if (tone !== 'default') {
		color = statusColorsFor(semanticColors, tone).foreground;
	}

	return (
		<NativeText
			maxFontSizeMultiplier={
				variant === 'title' || variant === 'headline'
					? headingMaxFontScale[variant]
					: undefined
			}
			{...restProps}
			style={[typography[variant], { color }, style]}
		/>
	);
};

export default AppText;
export type { AppTextProps, AppTextTone, AppTextVariant };
