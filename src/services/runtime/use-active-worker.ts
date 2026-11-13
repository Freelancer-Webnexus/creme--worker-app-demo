import type { WorkerSummary } from '@/services/api/api-types';
import { useAuthSession } from '@/services/session/use-auth-session';

/** The signed-in worker, or null while signed out or choosing a worker. */
export const useActiveWorker = (): WorkerSummary | null => {
	const { state } = useAuthSession();
	return state.kind === 'signed_in' ? state.worker : null;
};
