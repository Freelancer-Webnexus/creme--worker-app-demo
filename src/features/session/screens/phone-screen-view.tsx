import { StyleSheet, View } from 'react-native';
import type { PhoneScreenModel } from '@/features/session/phone-screen-model';
import SessionNoticeView from '@/features/session/screens/session-notice-view';
import BrandMark from '@/uikit/components/brand-mark';
import Button from '@/uikit/components/button';
import FormScreen from '@/uikit/components/form-screen';
import SegmentedControl from '@/uikit/components/segmented-control';
import AppText from '@/uikit/components/text';
import TextField from '@/uikit/components/text-field';
import { spacing } from '@/uikit/tokens/spacing';

type PhoneScreenViewProps = PhoneScreenModel;

const PhoneScreenView = (props: PhoneScreenViewProps) => (
	<FormScreen testID="phone-screen">
		<BrandMark />
		<AppText variant="title">{props.title}</AppText>
		{props.notice === null ? null : <SessionNoticeView notice={props.notice} />}
		<TextField
			autoComplete="tel"
			autoFocus
			editable={!props.isBusy}
			error={props.error}
			hint={props.hint}
			inputMode="tel"
			keyboardType="phone-pad"
			label={props.label}
			onChangeText={props.onChangeText}
			onSubmitEditing={props.onSubmit}
			returnKeyType="done"
			testID="phone-input"
			textContentType="telephoneNumber"
			value={props.value}
		/>
		<Button
			busy={props.isBusy}
			onPress={props.onSubmit}
			testID="phone-continue"
			title={props.buttonTitle}
		/>
		<View style={styles.language}>
			<SegmentedControl
				label={props.languageLabel}
				onChange={props.onLanguageChange}
				options={props.languageOptions}
				selected={props.language}
				testID="phone-language"
			/>
		</View>
	</FormScreen>
);

const styles = StyleSheet.create({
	language: {
		marginTop: spacing.lg,
	},
});

export default PhoneScreenView;
