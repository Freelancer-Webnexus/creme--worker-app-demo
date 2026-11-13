import { StyleSheet, View } from 'react-native';
import { LayoutAnimationConfig } from 'react-native-reanimated';
import type { TermsReadyContent } from '@/features/terms/terms-content';
import type { TermsScreenModel } from '@/features/terms/terms-screen-model';
import Button from '@/uikit/components/button';
import Card from '@/uikit/components/card';
import EmptyStateCard from '@/uikit/components/empty-state-card';
import FadeSwap from '@/uikit/components/fade-swap';
import Presence from '@/uikit/components/presence';
import ScrollScreen from '@/uikit/components/scroll-screen';
import StatusMark from '@/uikit/components/status-mark';
import AppText from '@/uikit/components/text';
import { skeletonMinHeight } from '@/uikit/tokens/skeleton';
import { spacing } from '@/uikit/tokens/spacing';

type TermsScreenViewProps = TermsScreenModel;

type ReadyProps = {
	content: TermsReadyContent;
	onConfirm: (versionId: string) => void;
};

const ChangedBanner = ({ text }: { text: string }) => (
	<Card testID="terms-banner" tone="correction">
		<View style={styles.markRow}>
			<StatusMark role="correction" size={36} />
			<AppText
				accessibilityRole="alert"
				style={styles.grow}
				tone="correction"
				variant="headline"
			>
				{text}
			</AppText>
		</View>
	</Card>
);

const Ready = ({ content, onConfirm }: ReadyProps) => {
	const { action, banner, notice } = content;

	return (
		<LayoutAnimationConfig skipEntering>
			<Presence when={banner}>
				{(text) => <ChangedBanner text={text} />}
			</Presence>
			<Card style={styles.skeleton} testID="terms-text">
				<AppText accessibilityRole="header" variant="headline">
					{content.versionLabel}
				</AppText>
				<AppText tone="muted" variant="caption">
					{content.publishedLabel}
				</AppText>
				<View style={styles.summary} testID="terms-summary">
					{content.summary.map((line) =>
						line.kind === 'term' ? (
							<View
								accessible
								accessibilityLabel={`${line.label}: ${line.value}`}
								key={line.label}
								style={styles.term}
							>
								<AppText tone="muted" variant="caption">
									{line.label}
								</AppText>
								<AppText variant="label">{line.value}</AppText>
							</View>
						) : (
							<AppText key={line.text}>{line.text}</AppText>
						),
					)}
				</View>
			</Card>
			<Card testID="terms-status" tone={content.statusRole}>
				<View style={styles.markRow}>
					<FadeSwap swapKey={content.statusRole}>
						<StatusMark role={content.statusRole} />
					</FadeSwap>
					<AppText
						accessibilityLiveRegion="polite"
						style={styles.grow}
						testID="terms-status-text"
						tone={content.statusRole}
					>
						{content.statusText}
					</AppText>
				</View>
				<Presence when={notice}>
					{(text) => (
						<AppText testID="terms-notice" tone="failed">
							{text}
						</AppText>
					)}
				</Presence>
				<Presence when={action.kind === 'confirm' ? action : null}>
					{(confirm) => (
						<Button
							busy={confirm.busy}
							onPress={() => {
								onConfirm(content.versionId);
							}}
							testID="terms-confirm"
							title={confirm.label}
						/>
					)}
				</Presence>
			</Card>
		</LayoutAnimationConfig>
	);
};

const Body = ({
	content,
	onConfirm,
	onRefresh,
	refreshing,
}: Pick<
	TermsScreenViewProps,
	'content' | 'onConfirm' | 'onRefresh' | 'refreshing'
>) => {
	switch (content.kind) {
		case 'loading':
			return (
				<Card style={styles.skeleton} testID="terms-loading">
					<AppText>{content.text}</AppText>
				</Card>
			);
		case 'empty':
			return (
				<EmptyStateCard
					body={content.body}
					onRetry={onRefresh}
					retrying={refreshing}
					retryTitle={content.retryTitle}
					testID="terms-empty"
					title={content.title}
				/>
			);
		case 'ready':
			return <Ready content={content} onConfirm={onConfirm} />;
		default:
			return content satisfies never;
	}
};

const TermsScreenView = (props: TermsScreenViewProps) => (
	<ScrollScreen
		onRefresh={props.onRefresh}
		refreshing={props.refreshing}
		testID="terms-screen"
	>
		<AppText accessibilityRole="header" testID="terms-title" variant="title">
			{props.title}
		</AppText>
		<Body
			content={props.content}
			onConfirm={props.onConfirm}
			onRefresh={props.onRefresh}
			refreshing={props.refreshing}
		/>
	</ScrollScreen>
);

const styles = StyleSheet.create({
	grow: {
		flex: 1,
		flexShrink: 1,
	},
	skeleton: {
		minHeight: skeletonMinHeight,
	},
	summary: {
		gap: spacing.md,
	},
	term: {
		gap: spacing.xs,
	},
	markRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: spacing.md,
	},
});

export default TermsScreenView;
export type { TermsScreenViewProps };
