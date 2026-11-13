import { StyleSheet, View } from 'react-native';
import { LayoutAnimationConfig } from 'react-native-reanimated';
import type { SyncIndicatorPresentation } from '@/features/home/sync-indicator-copy';
import Button from '@/uikit/components/button';
import Card from '@/uikit/components/card';
import FadeSwap from '@/uikit/components/fade-swap';
import Presence from '@/uikit/components/presence';
import StatusMark from '@/uikit/components/status-mark';
import AppText from '@/uikit/components/text';
import { spacing } from '@/uikit/tokens/spacing';

type SyncIndicatorViewProps = {
	presentation: SyncIndicatorPresentation;
	onRetryNow: () => void;
	onSignInAgain: () => void;
};

/**
 * The card that always sits at the top of Home. Its words say whether the
 * worker's actions were delivered or are only saved on this phone; its colour
 * and shape repeat that, never alone. The words and the buttons are separate
 * accessibility targets: the words are one polite live region, so a change is
 * announced without stealing focus, and the buttons stay reachable.
 */
const SyncIndicatorView = ({
	onRetryNow,
	onSignInAgain,
	presentation,
}: SyncIndicatorViewProps) => {
	const { action, role } = presentation;

	return (
		<LayoutAnimationConfig skipEntering>
			<Card testID="sync-indicator" tone={role}>
				<View style={styles.row}>
					<FadeSwap swapKey={role}>
						<StatusMark role={role} size={36} />
					</FadeSwap>
					<View
						accessible
						accessibilityLabel={presentation.accessibilityLabel}
						accessibilityLiveRegion="polite"
						style={styles.words}
						testID="sync-indicator-words"
					>
						{/* The live region stays mounted so every change is announced.
						    Inside it, headline and detail swap as one block when the tone
						    changes or the detail comes or goes, so a fading detail never
						    sits under a new headline. */}
						<FadeSwap
							style={styles.wordsInner}
							swapKey={`${role}-${presentation.detail === null ? 'headline' : 'detail'}`}
						>
							<AppText
								testID="sync-indicator-headline"
								tone={role}
								variant="headline"
							>
								{presentation.headline}
							</AppText>
							{presentation.detail === null ? null : (
								<AppText
									style={styles.detail}
									testID="sync-indicator-detail"
									tone={role}
								>
									{presentation.detail}
								</AppText>
							)}
						</FadeSwap>
					</View>
				</View>
				<Presence when={action.kind === 'retry_now' ? action : null}>
					{(retry) => (
						<Button
							busy={retry.busy}
							onPress={onRetryNow}
							testID="sync-retry-now"
							title={retry.label}
							variant="outline"
						/>
					)}
				</Presence>
				<Presence when={action.kind === 'sign_in_again' ? action : null}>
					{(signIn) => (
						<Button
							onPress={onSignInAgain}
							testID="sync-sign-in-again"
							title={signIn.label}
						/>
					)}
				</Presence>
			</Card>
		</LayoutAnimationConfig>
	);
};

const styles = StyleSheet.create({
	// The retry countdown ticks each second; tabular digits keep the line still.
	detail: {
		fontVariant: ['tabular-nums'],
	},
	row: {
		alignItems: 'flex-start',
		flexDirection: 'row',
		gap: spacing.md,
	},
	words: {
		flex: 1,
		flexShrink: 1,
	},
	wordsInner: {
		gap: spacing.xs,
	},
});

export default SyncIndicatorView;
export type { SyncIndicatorViewProps };
