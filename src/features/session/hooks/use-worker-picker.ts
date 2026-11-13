import type { WorkerPickerModel } from '@/features/session/worker-picker-screen-model';
import type { WorkerSummary } from '@/services/api/api-types';
import { useTranslation } from '@/services/i18n/use-translation';
import { useAuthSession } from '@/services/session/use-auth-session';

const noWorkers: WorkerSummary[] = [];

const useWorkerPicker = (): WorkerPickerModel => {
	const { dispatch, state } = useAuthSession();
	const { t } = useTranslation();

	return {
		onChoose: (workerId) => {
			dispatch({ type: 'worker_chosen', workerId });
		},
		subtitle: t('picker.subtitle'),
		title: t('picker.title'),
		workers: state.kind === 'choosing_worker' ? state.workers : noWorkers,
	};
};

export default useWorkerPicker;
