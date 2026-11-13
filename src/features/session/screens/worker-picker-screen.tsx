import useWorkerPicker from '@/features/session/hooks/use-worker-picker';
import WorkerPickerView from '@/features/session/screens/worker-picker-view';

const WorkerPickerScreen = () => {
	const model = useWorkerPicker();
	return <WorkerPickerView {...model} />;
};

export default WorkerPickerScreen;
