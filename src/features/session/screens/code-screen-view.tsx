import type { CodeScreenModel } from '@/features/session/code-screen-model';
import { CODE_LENGTH } from '@/features/session/otp-code';
import SessionNoticeView from '@/features/session/screens/session-notice-view';
import Button from '@/uikit/components/button';
import FormScreen from '@/uikit/components/form-screen';
import AppText from '@/uikit/components/text';
import TextField from '@/uikit/components/text-field';

type CodeScreenViewProps = CodeScreenModel;

const CodeScreenView = (props: CodeScreenViewProps) => (
	<FormScreen testID="code-screen">
		<AppText variant="title">{props.title}</AppText>
		{props.notice === null ? null : <SessionNoticeView notice={props.notice} />}
		<AppText>{props.intro}</AppText>
		<TextField
			autoComplete="sms-otp"
			autoFocus
			editable={!props.isBusy}
			error={props.error}
			hint={props.hint}
			inputMode="numeric"
			keyboardType="number-pad"
			label={props.label}
			maxLength={CODE_LENGTH}
			onChangeText={props.onChangeText}
			onSubmitEditing={props.onSubmit}
			returnKeyType="done"
			testID="code-input"
			textContentType="oneTimeCode"
			value={props.value}
		/>
		<Button
			busy={props.isBusy}
			onPress={props.onSubmit}
			testID="code-verify"
			title={props.buttonTitle}
		/>
		<Button
			disabled={props.isBusy}
			onPress={props.onChangeNumber}
			testID="code-change-number"
			title={props.changeNumberTitle}
			variant="outline"
		/>
	</FormScreen>
);

export default CodeScreenView;
