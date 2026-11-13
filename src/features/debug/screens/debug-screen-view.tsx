import type { DebugScreenModel } from '@/features/debug/debug-screen-model';
import Button from '@/uikit/components/button';
import Card from '@/uikit/components/card';
import FormScreen from '@/uikit/components/form-screen';
import SwitchRow from '@/uikit/components/switch-row';
import AppText from '@/uikit/components/text';

type DebugScreenViewProps = DebugScreenModel;

const DebugScreenView = (props: DebugScreenViewProps) => (
	<FormScreen testID="debug-screen">
		<AppText accessibilityRole="header" variant="title">
			{props.title}
		</AppText>
		<Card>
			<SwitchRow
				label={props.compressionLabel}
				onValueChange={props.onCompressionDisabledChange}
				testID="debug-compression"
				value={props.compressionDisabled}
			/>
			<AppText tone="muted" variant="caption">
				{props.compressionHint}
			</AppText>
		</Card>
		<Card>
			<AppText tone="muted" variant="caption">
				{props.apiUrlLabel}
			</AppText>
			<AppText selectable testID="debug-api-url">
				{props.apiUrl}
			</AppText>
		</Card>
		<Button
			onPress={props.onBack}
			testID="debug-back"
			title={props.backLabel}
			variant="outline"
		/>
	</FormScreen>
);

export default DebugScreenView;
export type { DebugScreenViewProps };
