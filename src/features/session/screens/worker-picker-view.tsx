import { StyleSheet } from 'react-native';
import type { WorkerPickerModel } from '@/features/session/worker-picker-screen-model';
import Button from '@/uikit/components/button';
import FormScreen from '@/uikit/components/form-screen';
import AppText from '@/uikit/components/text';
import { spacing } from '@/uikit/tokens/spacing';

type WorkerPickerViewProps = WorkerPickerModel;

/** One big button per person, so a thumb in a glove can hit the right name. */
const WorkerPickerView = (props: WorkerPickerViewProps) => (
	<FormScreen testID="worker-picker">
		<AppText accessibilityRole="header" variant="title">
			{props.title}
		</AppText>
		<AppText>{props.subtitle}</AppText>
		{props.workers.map((worker) => (
			<Button
				key={worker.id}
				onPress={() => {
					props.onChoose(worker.id);
				}}
				style={styles.worker}
				testID={`worker-${worker.id}`}
				title={worker.name}
			/>
		))}
	</FormScreen>
);

const styles = StyleSheet.create({
	worker: {
		minHeight: 72,
		paddingVertical: spacing.lg,
	},
});

export default WorkerPickerView;
