import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import useTheme from '@/uikit/hooks/use-theme';
import { spacing } from '@/uikit/tokens/spacing';

type FormScreenProps = {
	children: ReactNode;
	testID?: string;
};

/**
 * From a field's bottom edge to the end of the button under it: the hint, the
 * room kept for an error, the gap and the button. Measured at the default text
 * size on iOS 27; it grows with the font.
 */
const FIELD_TO_BUTTON_END = 140;
/** iOS number pads float a Done bar above the keyboard frame the library reports. */
const NUMBER_PAD_DONE_BAR = 24;

/**
 * A screen with fields and no tab bar. The scroll view follows the keyboard
 * frame by frame and keeps the focused field and the button under it in view,
 * and taps on the button still land while the keyboard is up.
 */
const FormScreen = ({ children, testID }: FormScreenProps) => {
	const { semanticColors } = useTheme();
	const { fontScale } = useWindowDimensions();
	const clearance =
		(FIELD_TO_BUTTON_END + spacing.lg) * Math.max(fontScale, 1) +
		NUMBER_PAD_DONE_BAR;

	return (
		<SafeAreaView
			style={[styles.safeArea, { backgroundColor: semanticColors.background }]}
			testID={testID}
		>
			<KeyboardAwareScrollView
				alwaysBounceVertical={false}
				bottomOffset={clearance}
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				{children}
			</KeyboardAwareScrollView>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	content: {
		flexGrow: 1,
		gap: spacing.lg,
		padding: spacing.lg,
	},
	safeArea: {
		flex: 1,
	},
});

export default FormScreen;
export type { FormScreenProps };
