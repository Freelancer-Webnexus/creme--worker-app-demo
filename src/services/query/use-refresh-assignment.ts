import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
	assignmentRefreshOptions,
	pullRefetchOptions,
} from '@/services/query/query-options';
import type { RefreshOutcome } from '@/services/query/refresh-assignment';
import { refreshStateOf, resultOf } from '@/services/query/refresh-state';
import { useAppRuntime } from '@/services/runtime/use-app-runtime';
import { tokenFor } from '@/services/session/session-store';
import { useAuthSession } from '@/services/session/use-auth-session';

export type AssignmentRefresh = {
	/** Pull to refresh. Does nothing while offline: the indicator already says so. */
	refresh: () => void;
	/** True only while a pull the worker started is running. */
	isPulling: boolean;
	/** What the last finished fetch did. `undefined` means no fetch has finished yet. */
	outcome: RefreshOutcome | undefined;
};

type PullState = 'idle' | 'pulling';

/**
 * Fetches GET /me/assignment for the signed-in worker: on mount, on reconnect
 * and when the app returns to the foreground (the query client is wired to both,
 * see query-managers.ts), plus on pull to refresh. A fresh copy lands in
 * SQLite and the worker-view query is invalidated so screens re-read it.
 */
export const useRefreshAssignment = (): AssignmentRefresh => {
	const { api, cache, connectivity, engine } = useAppRuntime();
	const { state } = useAuthSession();
	const workerId = state.kind === 'signed_in' ? state.worker.id : null;
	const expiresAt = state.kind === 'signed_in' ? state.expiresAt : null;
	const queryClient = useQueryClient();
	const [pull, setPull] = useState<PullState>('idle');

	const query = useQuery(
		assignmentRefreshOptions({
			expiresAt,
			ports: {
				api,
				cache,
				now: Date.now,
				onUnauthorized: engine.reportUnauthorized,
				token: tokenFor,
			},
			queryClient,
			workerId,
		}),
	);

	const refreshState = refreshStateOf({
		fetchPhase: query.fetchStatus,
		hasWorker: workerId !== null,
		outcome: query.data,
		pull,
	});

	return {
		isPulling: refreshState.kind === 'pulling',
		outcome: resultOf(refreshState),
		refresh: () => {
			if (workerId === null || !connectivity.isOnline()) {
				return;
			}
			setPull('pulling');
			void query.refetch(pullRefetchOptions).finally(() => {
				setPull('idle');
			});
		},
	};
};
