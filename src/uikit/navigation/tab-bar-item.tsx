import { StyleSheet } from 'react-native';
import AppPressable from '@/uikit/components/pressables';
import AppText from '@/uikit/components/text';
import useTheme from '@/uikit/hooks/use-theme';
import type { TabItem } from '@/uikit/navigation/tab-bar-model';
import { spacing } from '@/uikit/tokens/spacing';
import { resolveTabHorizontalPadding, tabBar } from '@/uikit/tokens/tab-bar';

type TabBarItemProps = {
	fontScale: number;
	item: TabItem;
	onLongPress: () => void;
	onPress: () => void;
	tabHeight: number;
};

const TabBarItem = ({
	fontScale,
	item,
	onLongPress,
	onPress,
	tabHeight,
}: TabBarItemProps) => {
	const { semanticColors } = useTheme();
	const color = item.isVisuallyFocused
		? semanticColors.text
		: semanticColors.textMuted;

	return (
		<AppPressable
			accessibilityLabel={item.accessibilityLabel}
			accessibilityRole="tab"
			accessibilityState={{ selected: item.isFocused }}
			android_ripple={{ borderless: true, color: semanticColors.border }}
			onLongPress={onLongPress}
			onPress={onPress}
			style={[
				styles.tab,
				{
					height: tabHeight,
					paddingHorizontal: resolveTabHorizontalPadding(fontScale),
				},
			]}
		>
			<AppText
				adjustsFontSizeToFit
				maxFontSizeMultiplier={tabBar.maxFontScale}
				minimumFontScale={0.5}
				numberOfLines={1}
				style={[styles.label, { color }]}
				variant="caption"
			>
				{item.label}
			</AppText>
		</AppPressable>
	);
};

export default TabBarItem;
export type { TabBarItemProps };

const styles = StyleSheet.create({
	label: {
		textAlign: 'center',
		width: '100%',
	},
	tab: {
		alignItems: 'center',
		borderRadius: tabBar.innerRadius,
		flex: 1,
		justifyContent: 'center',
		paddingVertical: spacing.xs,
	},
});
