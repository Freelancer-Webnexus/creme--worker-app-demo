import { StyleSheet, View } from 'react-native';
import type { HomeContent } from '@/features/home/home-body-copy';
import type { HomeScreenModel } from '@/features/home/home-screen-model';
import SyncIndicatorView from '@/features/home/screens/sync-indicator-view';
import Button from '@/uikit/components/button';
import Card from '@/uikit/components/card';
import EmptyStateCard from '@/uikit/components/empty-state-card';
import ScrollScreen from '@/uikit/components/scroll-screen';
import SegmentedControl from '@/uikit/components/segmented-control';
import StatusMark from '@/uikit/components/status-mark';
import AppText from '@/uikit/components/text';
import {
	skeletonMinHeight,
	timelineSkeletonMinHeight,
} from '@/uikit/tokens/skeleton';
import { spacing } from '@/uikit/tokens/spacing';

type HomeScreenViewProps = HomeScreenModel;

type ReadyContent = Extract<HomeContent, { kind: 'ready' }>;

const OrderCard = ({ content }: { content: ReadyContent }) => (
	<Card style={styles.skeleton} testID="home-order">
		<AppText accessibilityRole="header" variant="headline">
			{content.orderTitle}
		</AppText>
		{content.orderRows.map((row) => (
			<View
				accessible
				accessibilityLabel={`${row.label}: ${row.value}`}
				key={row.label}
				style={styles.fact}
			>
				<AppText tone="muted" variant="caption">
					{row.label}
				</AppText>
				<AppText variant="label">{row.value}</AppText>
			</View>
		))}
		<View style={styles.markRow} testID="home-terms-line">
			<StatusMark role={content.termsRole} />
			<AppText style={styles.grow} tone={content.termsRole}>
				{content.termsText}
			</AppText>
		</View>
	</Card>
);

const TimelineCard = ({ content }: { content: ReadyContent }) => (
	<Card testID="home-timeline">
		<AppText accessibilityRole="header" variant="headline">
			{content.timelineTitle}
		</AppText>
		{content.timelineSteps.map((step) => (
			<View
				accessible
				accessibilityLabel={step.accessibilityLabel}
				key={step.id}
				style={styles.markRow}
				testID={`home-step-${step.id}`}
			>
				<StatusMark role={step.role} />
				<View style={styles.grow}>
					<AppText>{step.label}</AppText>
					<AppText tone={step.role} variant="label">
						{step.status}
					</AppText>
				</View>
			</View>
		))}
	</Card>
);

const Body = ({
	content,
	onRefresh,
	refreshing,
}: Pick<HomeScreenViewProps, 'content' | 'onRefresh' | 'refreshing'>) => {
	switch (content.kind) {
		case 'loading':
			// Both cards keep their place while loading, so the cards below stay put.
			return (
				<>
					<Card style={styles.skeleton} testID="home-loading">
						<AppText>{content.text}</AppText>
					</Card>
					<Card style={styles.timelineSkeleton} />
				</>
			);
		case 'empty':
			return (
				<EmptyStateCard
					body={content.body}
					onRetry={onRefresh}
					retrying={refreshing}
					retryTitle={content.retryTitle}
					testID="home-empty"
					title={content.title}
				/>
			);
		case 'ready':
			return (
				<>
					<OrderCard content={content} />
					<TimelineCard content={content} />
				</>
			);
		default:
			return content satisfies never;
	}
};

const HomeScreenView = (props: HomeScreenViewProps) => (
	<ScrollScreen
		onRefresh={props.onRefresh}
		refreshing={props.refreshing}
		testID="home-screen"
	>
		<AppText accessibilityRole="header" testID="home-greeting" variant="title">
			{props.greeting}
		</AppText>
		<SyncIndicatorView
			onRetryNow={props.onRetryNow}
			onSignInAgain={props.onSignInAgain}
			presentation={props.indicator}
		/>
		<Body
			content={props.content}
			onRefresh={props.onRefresh}
			refreshing={props.refreshing}
		/>
		<Card testID="home-language">
			<AppText accessibilityRole="header" variant="headline">
				{props.language.title}
			</AppText>
			<SegmentedControl
				label={props.language.label}
				onChange={props.language.onChange}
				options={props.language.options}
				selected={props.language.selected}
				testID="home-language-control"
			/>
		</Card>
		<Card testID="home-account">
			<AppText accessibilityRole="header" variant="headline">
				{props.account.title}
			</AppText>
			<AppText>{props.account.signedInAs}</AppText>
			{props.account.switchWorkerTitle === null ? null : (
				<Button
					onPress={props.onSwitchWorker}
					testID="home-switch-worker"
					title={props.account.switchWorkerTitle}
					variant="secondary"
				/>
			)}
			<Button
				onPress={props.onSignOut}
				testID="home-sign-out"
				title={props.account.signOutTitle}
				variant="outline"
			/>
		</Card>
		{props.debugLink === null ? null : (
			<Button
				onPress={props.debugLink.onPress}
				testID="home-debug"
				title={props.debugLink.title}
				variant="outline"
			/>
		)}
	</ScrollScreen>
);

const styles = StyleSheet.create({
	fact: {
		gap: spacing.xs,
	},
	grow: {
		flex: 1,
		flexShrink: 1,
	},
	skeleton: {
		minHeight: skeletonMinHeight,
	},
	timelineSkeleton: {
		minHeight: timelineSkeletonMinHeight,
	},
	markRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: spacing.md,
	},
});

export default HomeScreenView;
export type { HomeScreenViewProps };
