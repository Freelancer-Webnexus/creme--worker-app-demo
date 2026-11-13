import { StyleSheet, Switch, View } from 'react-native';
import AppText from '@/uikit/components/text';
import useTheme from '@/uikit/hooks/use-theme';
import { spacing } from '@/uikit/tokens/spacing';

type SwitchRowProps = {
	label: string;
	onValueChange: (value: boolean) => void;
	testID?: string;
	value: boolean;
};

/** A label and a switch in one 56 dp row. The label wraps instead of clipping at a large font. */
const SwitchRow = ({ label, onValueChange, testID, value }: SwitchRowProps) => {
	const { semanticColors } = useTheme();

	return (
		<View style={styles.row}>
			<AppText style={styles.label}>{label}</AppText>
			<Switch
				accessibilityLabel={label}
				onValueChange={onValueChange}
				testID={testID}
				thumbColor={semanticColors.surface}
				trackColor={{
					false: semanticColors.borderStrong,
					true: semanticColors.primary,
				}}
				value={value}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	label: {
		flex: 1,
		flexShrink: 1,
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: spacing.md,
		minHeight: 56,
	},
});

export default SwitchRow;
export type { SwitchRowProps };
