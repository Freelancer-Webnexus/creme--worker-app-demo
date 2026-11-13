import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/query/query-keys';
import type { AppRuntime } from '@/services/runtime/app-runtime';

/**
 * Outcomes of a send patch the worker cache in SQLite, so every engine change
 * may have changed what the cache says. One listener for the whole app. A
 * server fact learned from a send also asks for a fresh assignment fetch, so the
 * server's own copy soon replaces the local patch (M3, M4).
 */
export const useInvalidateOnEngineChange = (runtime: AppRuntime): void => {
	const queryClient = useQueryClient();

	useEffect(
		() =>
			runtime.engine.subscribe(() => {
				void queryClient.invalidateQueries({
					queryKey: queryKeys.workerView.all,
				});
			}),
		[queryClient, runtime],
	);

	useEffect(
		() =>
			runtime.serverFacts.subscribe(() => {
				void queryClient.invalidateQueries({
					queryKey: queryKeys.assignment.all,
				});
			}),
		[queryClient, runtime],
	);
};
