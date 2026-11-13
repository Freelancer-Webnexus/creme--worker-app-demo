import { StyleSheet, View } from 'react-native';
import { LayoutAnimationConfig } from 'react-native-reanimated';
import type { DocumentRowContent } from '@/features/documents/documents-content';
import type { DocumentsScreenModel } from '@/features/documents/documents-screen-model';
import Button from '@/uikit/components/button';
import Card from '@/uikit/components/card';
import EmptyStateCard from '@/uikit/components/empty-state-card';
import FadeSwap from '@/uikit/components/fade-swap';
import Presence from '@/uikit/components/presence';
import AppPressable from '@/uikit/components/pressables';
import ScrollScreen from '@/uikit/components/scroll-screen';
import StatusMark from '@/uikit/components/status-mark';
import AppText from '@/uikit/components/text';
import { spacing } from '@/uikit/tokens/spacing';

type DocumentsScreenViewProps = DocumentsScreenModel;

type RowProps = {
	row: DocumentRowContent;
	onOpenCapture: (documentType: string) => void;
	onDismissFailed: (failedActionId: string) => void;
};

const RowWords = ({ row }: { row: DocumentRowContent }) => (
	<View style={styles.markRow}>
		<FadeSwap swapKey={row.role}>
			<StatusMark role={row.role} />
		</FadeSwap>
		<View style={styles.grow}>
			<AppText variant="headline">{row.name}</AppText>
			<AppText testID={`document-status-${row.documentType}`} tone={row.role}>
				{row.statusText}
			</AppText>
			<Presence when={row.reason}>
				{(reason) => (
					<AppText testID={`document-reason-${row.documentType}`}>
						{reason}
					</AppText>
				)}
			</Presence>
		</View>
	</View>
);

const DocumentRow = ({ row, onDismissFailed, onOpenCapture }: RowProps) => {
	const { interaction } = row;
	const testID = `document-row-${row.documentType}`;

	switch (interaction.kind) {
		case 'none':
			return (
				<Card
					accessible
					accessibilityLabel={row.accessibilityLabel}
					testID={testID}
				>
					<RowWords row={row} />
				</Card>
			);
		case 'open':
			return (
				<AppPressable
					accessibilityHint={interaction.actionLabel}
					accessibilityLabel={row.accessibilityLabel}
					accessibilityRole="button"
					onPress={() => {
						onOpenCapture(row.documentType);
					}}
					testID={testID}
				>
					<Card>
						<RowWords row={row} />
						<AppText variant="button">{`${interaction.actionLabel} ›`}</AppText>
					</Card>
				</AppPressable>
			);
		case 'send_failed':
			return (
				<Card testID={testID}>
					<View accessible accessibilityLabel={row.accessibilityLabel}>
						<RowWords row={row} />
					</View>
					<Button
						onPress={() => {
							onOpenCapture(row.documentType);
						}}
						testID={`document-retake-${row.documentType}`}
						title={interaction.retakeLabel}
					/>
					<Button
						onPress={() => {
							onDismissFailed(interaction.failedActionId);
						}}
						testID={`document-dismiss-${row.documentType}`}
						title={interaction.dismissLabel}
						variant="outline"
					/>
				</Card>
			);
		default:
			return interaction satisfies never;
	}
};

const Body = ({
	content,
	onDismissFailed,
	onOpenCapture,
	onRefresh,
	refreshing,
}: Pick<
	DocumentsScreenViewProps,
	'content' | 'onDismissFailed' | 'onOpenCapture' | 'onRefresh' | 'refreshing'
>) => {
	switch (content.kind) {
		case 'loading':
			return (
				<Card testID="documents-loading">
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
					testID="documents-empty"
					title={content.title}
				/>
			);
		case 'ready':
			return (
				<LayoutAnimationConfig skipEntering>
					{content.noneRequired === null ? null : (
						<AppText testID="documents-none">{content.noneRequired}</AppText>
					)}
					{content.rows.map((row) => (
						<DocumentRow
							key={row.documentType}
							onDismissFailed={onDismissFailed}
							onOpenCapture={onOpenCapture}
							row={row}
						/>
					))}
				</LayoutAnimationConfig>
			);
		default:
			return content satisfies never;
	}
};

const DocumentsScreenView = (props: DocumentsScreenViewProps) => (
	<ScrollScreen
		onRefresh={props.onRefresh}
		refreshing={props.refreshing}
		testID="documents-screen"
	>
		<AppText
			accessibilityRole="header"
			testID="documents-title"
			variant="title"
		>
			{props.title}
		</AppText>
		<Body
			content={props.content}
			onDismissFailed={props.onDismissFailed}
			onOpenCapture={props.onOpenCapture}
			onRefresh={props.onRefresh}
			refreshing={props.refreshing}
		/>
	</ScrollScreen>
);

const styles = StyleSheet.create({
	grow: {
		flex: 1,
		flexShrink: 1,
		gap: spacing.xs,
	},
	markRow: {
		alignItems: 'flex-start',
		flexDirection: 'row',
		gap: spacing.md,
	},
});

export default DocumentsScreenView;
export type { DocumentsScreenViewProps };
