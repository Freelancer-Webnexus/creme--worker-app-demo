import { StyleSheet, View } from 'react-native';
import Button from '@/uikit/components/button';
import Screen from '@/uikit/components/screen';
import AppText from '@/uikit/components/text';
import { spacing } from '@/uikit/tokens/spacing';

type BootFailedViewProps = {
	title: string;
	retryTitle: string;
	onRetry: () => void;
};

const BootFailedView = ({
	onRetry,
	retryTitle,
	title,
}: BootFailedViewProps) => (
	<Screen testID="boot-failed">
		<View style={styles.stack}>
			<AppText variant="title">{title}</AppText>
			<Button onPress={onRetry} testID="boot-retry" title={retryTitle} />
		</View>
	</Screen>
);

const styles = StyleSheet.create({
	stack: {
		gap: spacing.md,
	},
});

export default BootFailedView;
export type { BootFailedViewProps };
