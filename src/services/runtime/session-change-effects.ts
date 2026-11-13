import { activeWorkerIdOf } from '@/services/runtime/active-worker';
import type { SessionState } from '@/services/session/session-state';

export type SessionChangeEffect =
	| { type: 'set_active_worker'; workerId: string | null }
	| { type: 'refresh_queue'; workerId: string | null };

/**
 * What the runtime does when the session changes. The engine hears about every
 * change, even a new token for the same worker, because that is how a renewed
 * login restarts sending.
 */
export const sessionChangeEffects = (
	previous: SessionState,
	next: SessionState,
): SessionChangeEffect[] => {
	if (previous === next) {
		return [];
	}
	const workerId = activeWorkerIdOf(next);
	return [
		{ type: 'set_active_worker', workerId },
		{ type: 'refresh_queue', workerId },
	];
};
