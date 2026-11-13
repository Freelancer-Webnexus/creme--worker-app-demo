import Button from '@/uikit/components/button';
import Card from '@/uikit/components/card';
import AppText from '@/uikit/components/text';

type EmptyStateCardProps = {
	body: string;
	onRetry: () => void;
	retrying: boolean;
	retryTitle: string;
	testID: string;
	title: string;
};

/** A screen with nothing loaded yet: what happened, and one way to try again. */
const EmptyStateCard = ({
	body,
	onRetry,
	retrying,
	retryTitle,
	testID,
	title,
}: EmptyStateCardProps) => (
	<Card testID={testID}>
		<AppText accessibilityRole="header" variant="headline">
			{title}
		</AppText>
		<AppText>{body}</AppText>
		<Button
			busy={retrying}
			onPress={onRetry}
			testID={`${testID}-retry`}
			title={retryTitle}
			variant="secondary"
		/>
	</Card>
);

export default EmptyStateCard;
