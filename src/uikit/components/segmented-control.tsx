import { StyleSheet, View } from 'react-native';
import AppPressable from '@/uikit/components/pressables';
import AppText from '@/uikit/components/text';
import useTheme from '@/uikit/hooks/use-theme';
import { borderRadius } from '@/uikit/tokens/border-radius';
import { spacing } from '@/uikit/tokens/spacing';

type SegmentOption<TValue extends string> = {
	label: string;
	value: TValue;
};

type SegmentedControlProps<TValue extends string> = {
	label: string;
	onChange: (value: TValue) => void;
	options: SegmentOption<TValue>[];
	selected: TValue;
	testID?: string;
};

/**
 * Pick one of a few. The chosen segment is filled and also carries a tick, so
 * the choice does not rest on colour alone.
 */
const SegmentedControl = <TValue extends string>({
	label,
	onChange,
	options,
	selected,
	testID,
}: SegmentedControlProps<TValue>) => {
	const { semanticColors } = useTheme();

	return (
		<View
			accessibilityLabel={label}
			accessibilityRole="radiogroup"
			testID={testID}
		>
			<View style={[styles.row, { borderColor: semanticColors.borderStrong }]}>
				{options.map((option) => {
					const isSelected = option.value === selected;
					return (
						<AppPressable
							accessibilityLabel={option.label}
							accessibilityRole="radio"
							accessibilityState={{ checked: isSelected }}
							android_ripple={{ color: semanticColors.border }}
							key={option.value}
							onPress={() => {
								onChange(option.value);
							}}
							pressedScale={1}
							style={[
								styles.segment,
								isSelected && { backgroundColor: semanticColors.primary },
							]}
						>
							<View style={styles.content}>
								<AppText
									accessibilityElementsHidden
									importantForAccessibility="no-hide-descendants"
									style={{
										color: semanticColors.primaryText,
										opacity: isSelected ? 1 : 0,
									}}
									testID="segment-tick"
									variant="button"
								>
									✓
								</AppText>
								<AppText
									style={{
										color: isSelected
											? semanticColors.primaryText
											: semanticColors.text,
									}}
									testID="segment-label"
									variant="button"
								>
									{option.label}
								</AppText>
							</View>
						</AppPressable>
					);
				})}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	content: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: spacing.xs,
	},
	row: {
		borderRadius: borderRadius.md,
		borderWidth: 2,
		flexDirection: 'row',
		overflow: 'hidden',
	},
	segment: {
		alignItems: 'center',
		flex: 1,
		justifyContent: 'center',
		minHeight: 56,
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.sm,
	},
});

export default SegmentedControl;
export type { SegmentedControlProps, SegmentOption };
