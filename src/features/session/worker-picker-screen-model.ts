import type { WorkerSummary } from '@/services/api/api-types';

/** Everything the worker picker prints and the one action it can fire. */
export type WorkerPickerModel = {
	title: string;
	subtitle: string;
	workers: WorkerSummary[];
	onChoose: (workerId: string) => void;
};
