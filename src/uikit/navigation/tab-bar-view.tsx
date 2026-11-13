import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useTheme from '@/uikit/hooks/use-theme';
import TabBarItem from '@/uikit/navigation/tab-bar-item';
import type { TabItem } from '@/uikit/navigation/tab-bar-model';
import type { TabSelection } from '@/uikit/navigation/use-tab-selection';
import { spacing } from '@/uikit/tokens/spacing';
import { tabBar } from '@/uikit/tokens/tab-bar';

type TabBarViewProps = {
	barWidth: number;
	fontScale: number;
	items: TabItem[];
	onLongPress: (item: TabItem) => void;
	onPress: (item: TabItem, index: number) => void;
	selectionStyle: TabSelection['selectionStyle'];
	tabWidth: number;
};

/**
 * Floating tab bar. It sits above the screen rather than in the layout flow, so
 * screens pad their scroll content by `tabBar.contentClearance` to clear it.
 * A scrim fades the content out under the bar, so no cut-off line shows
 * between the bar and the system navigation.
 */
const TabBarView = ({
	barWidth,
	fontScale,
	items,
	onLongPress,
	onPress,
	selectionStyle,
	tabWidth,
}: TabBarViewProps) => {
	const { semanticColors } = useTheme();
	const insets = useSafeAreaInsets();

	return (
		<View
			pointerEvents="box-none"
			style={[
				styles.container,
				{ paddingBottom: Math.max(insets.bottom, spacing.sm) },
			]}
		>
			<View
				pointerEvents="none"
				style={[
					StyleSheet.absoluteFill,
					{
						backgroundImage: `linear-gradient(to bottom, ${semanticColors.background}00, ${semanticColors.background} 50%)`,
					},
				]}
				testID="tab-bar-scrim"
			/>
			<View
				style={[
					styles.bar,
					{
						backgroundColor: semanticColors.surface,
						borderColor: semanticColors.border,
						// RN 0.76+ takes a real box shadow; the legacy shadow*/elevation
						// props are deprecated and never matched across platforms.
						boxShadow: [
							{
								blurRadius: 12,
								color: semanticColors.shadow,
								offsetX: 0,
								offsetY: 4,
							},
						],
						height: tabBar.outerHeight,
						width: barWidth,
					},
				]}
			>
				<Animated.View
					pointerEvents="none"
					style={[
						styles.selection,
						{
							backgroundColor: semanticColors.secondary,
							height: tabBar.tabHeight,
							width: tabWidth,
						},
						selectionStyle,
					]}
				/>
				{items.map((item, index) => (
					<TabBarItem
						fontScale={fontScale}
						item={item}
						key={item.key}
						onLongPress={() => {
							onLongPress(item);
						}}
						onPress={() => {
							onPress(item, index);
						}}
						tabHeight={tabBar.tabHeight}
					/>
				))}
			</View>
		</View>
	);
};

export default TabBarView;
export type { TabBarViewProps };

const styles = StyleSheet.create({
	bar: {
		borderRadius: tabBar.outerRadius,
		borderWidth: tabBar.borderWidth,
		flexDirection: 'row',
		padding: tabBar.padding,
	},
	container: {
		alignItems: 'center',
		bottom: 0,
		left: 0,
		paddingTop: spacing.xs,
		position: 'absolute',
		right: 0,
	},
	selection: {
		borderRadius: tabBar.innerRadius,
		left: 0,
		position: 'absolute',
		top: tabBar.padding,
	},
});
