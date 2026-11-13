import { StyleSheet, View } from 'react-native';
import type { CaptureContent } from '@/features/documents/capture-content';
import type { CaptureScreenModel } from '@/features/documents/capture-screen-model';
import Button from '@/uikit/components/button';
import Card from '@/uikit/components/card';
import FormScreen from '@/uikit/components/form-screen';
import Image from '@/uikit/components/image';
import StatusMark from '@/uikit/components/status-mark';
import AppText from '@/uikit/components/text';
import { borderRadius } from '@/uikit/tokens/border-radius';
import { spacing } from '@/uikit/tokens/spacing';

type CaptureScreenViewProps = CaptureScreenModel;

type BodyProps = Pick<
	CaptureScreenViewProps,
	| 'content'
	| 'onChooseGallery'
	| 'onOpenSettings'
	| 'onRetake'
	| 'onSubmit'
	| 'onTakePhoto'
>;

const Body = ({
	content,
	onChooseGallery,
	onOpenSettings,
	onRetake,
	onSubmit,
	onTakePhoto,
}: BodyProps) => {
	switch (content.kind) {
		case 'loading':
			return (
				<Card testID="capture-loading">
					<AppText>{content.text}</AppText>
				</Card>
			);
		case 'unavailable':
			return (
				<Card testID="capture-unavailable">
					<AppText accessibilityRole="header" variant="headline">
						{content.title}
					</AppText>
					<AppText>{content.body}</AppText>
				</Card>
			);
		case 'choosing':
			return (
				<>
					<AppText testID="capture-hint">{content.hint}</AppText>
					<Button
						disabled={content.busy}
						onPress={onTakePhoto}
						testID="capture-take-photo"
						title={content.takePhotoLabel}
					/>
					<Button
						disabled={content.busy}
						onPress={onChooseGallery}
						testID="capture-choose-gallery"
						title={content.chooseGalleryLabel}
						variant="secondary"
					/>
				</>
			);
		case 'preview':
			return (
				<>
					<AppText accessibilityRole="header" variant="headline">
						{content.heading}
					</AppText>
					<Card style={styles.previewFrame} testID="capture-preview">
						<Image
							accessibilityLabel={content.heading}
							contentFit="contain"
							source={{ uri: content.image.uri }}
							style={[styles.preview, { aspectRatio: content.aspectRatio }]}
							transition={0}
						/>
					</Card>
					<Button
						busy={content.busy}
						onPress={onSubmit}
						testID="capture-submit"
						title={content.submitLabel}
					/>
					<Button
						disabled={content.busy}
						onPress={onRetake}
						testID="capture-retake"
						title={content.retakeLabel}
						variant="outline"
					/>
				</>
			);
		case 'problem':
			return (
				<Problem
					content={content}
					onOpenSettings={onOpenSettings}
					onRetake={onRetake}
				/>
			);
		default:
			return content satisfies never;
	}
};

type ProblemProps = {
	content: Extract<CaptureContent, { kind: 'problem' }>;
	onOpenSettings: () => void;
	onRetake: () => void;
};

const Problem = ({ content, onOpenSettings, onRetake }: ProblemProps) => (
	<>
		<Card testID="capture-problem" tone="failed">
			<View style={styles.markRow}>
				<StatusMark role="failed" size={36} />
				<View accessibilityLiveRegion="polite" style={styles.grow}>
					<AppText tone="failed" variant="headline">
						{content.title}
					</AppText>
					<AppText tone="failed">{content.body}</AppText>
				</View>
			</View>
		</Card>
		{content.settingsLabel === null ? null : (
			<Button
				onPress={onOpenSettings}
				testID="capture-open-settings"
				title={content.settingsLabel}
			/>
		)}
		<Button
			onPress={onRetake}
			testID="capture-try-again"
			title={content.retryLabel}
			variant={content.settingsLabel === null ? 'primary' : 'secondary'}
		/>
	</>
);

const CaptureScreenView = (props: CaptureScreenViewProps) => (
	<FormScreen testID="capture-screen">
		<AppText accessibilityRole="header" testID="capture-title" variant="title">
			{props.title}
		</AppText>
		<Body
			content={props.content}
			onChooseGallery={props.onChooseGallery}
			onOpenSettings={props.onOpenSettings}
			onRetake={props.onRetake}
			onSubmit={props.onSubmit}
			onTakePhoto={props.onTakePhoto}
		/>
		<Button
			disabled={props.content.kind === 'preview' && props.content.busy}
			onPress={props.onCancel}
			testID="capture-cancel"
			title={props.cancelLabel}
			variant="outline"
		/>
	</FormScreen>
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
	preview: {
		borderRadius: borderRadius.md,
		width: '100%',
	},
	previewFrame: {
		padding: spacing.sm,
	},
});

export default CaptureScreenView;
export type { CaptureScreenViewProps };
