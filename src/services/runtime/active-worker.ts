import type { SessionState } from '@/services/session/session-state';

/**
 * The worker whose queue the engine sends. Only a signed-in worker counts: a
 * phone that is signed out or still choosing a worker has no active worker, and
 * the saved actions of every worker wait on the device (M2, M10).
 */
export const activeWorkerIdOf = (state: SessionState): string | null =>
	state.kind === 'signed_in' ? state.worker.id : null;
