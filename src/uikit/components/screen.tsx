import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useTheme from '@/uikit/hooks/use-theme';
import { spacing } from '@/uikit/tokens/spacing';

type ScreenProps = {
	children: ReactNode;
	testID?: string;
};

const Screen = (props: ScreenProps) => {
	const { children, testID } = props;
	const { semanticColors } = useTheme();

	return (
		<SafeAreaView
			edges={['top', 'left', 'right', 'bottom']}
			style={[styles.safeArea, { backgroundColor: semanticColors.background }]}
			testID={testID}
		>
			<View style={styles.content}>{children}</View>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	content: {
		flex: 1,
		padding: spacing.lg,
	},
	safeArea: {
		flex: 1,
	},
});

export default Screen;
export type { ScreenProps };
