import type { ReactNode } from 'react';
import { RefreshControl, StyleSheet } from 'react-native';
import {
	SafeAreaView,
	useSafeAreaInsets,
} from 'react-native-safe-area-context';
import AppScrollView from '@/uikit/components/scroll-view';
import useTheme from '@/uikit/hooks/use-theme';
import { spacing } from '@/uikit/tokens/spacing';
import { tabBar } from '@/uikit/tokens/tab-bar';

type ScrollScreenProps = {
	children: ReactNode;
	onRefresh?: () => void;
	refreshing?: boolean;
	testID?: string;
};

/**
 * A scrolling tab screen. The floating tab bar sits above the content, so the
 * bottom padding clears it. Content scrolls at any system font size and the
 * screen never clips a line.
 */
const ScrollScreen = ({
	children,
	onRefresh,
	refreshing = false,
	testID,
}: ScrollScreenProps) => {
	const { semanticColors } = useTheme();
	const insets = useSafeAreaInsets();
	const clearance =
		tabBar.contentClearance + Math.max(insets.bottom - spacing.sm, 0);

	return (
		<SafeAreaView
			edges={['top', 'left', 'right']}
			style={[styles.safeArea, { backgroundColor: semanticColors.background }]}
			testID={testID}
		>
			<AppScrollView
				contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
				refreshControl={
					onRefresh === undefined ? undefined : (
						<RefreshControl
							colors={[semanticColors.primary]}
							onRefresh={onRefresh}
							progressBackgroundColor={semanticColors.surface}
							refreshing={refreshing}
							tintColor={semanticColors.text}
						/>
					)
				}
			>
				{children}
			</AppScrollView>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	content: {
		gap: spacing.lg,
		padding: spacing.lg,
	},
	safeArea: {
		flex: 1,
	},
});

export default ScrollScreen;
export type { ScrollScreenProps };
