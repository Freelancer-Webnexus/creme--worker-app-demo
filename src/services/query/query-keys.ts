export const queryKeys = {
	assignment: {
		all: ['assignment-refresh'] as const,
		/**
		 * `sessionExpiresAt` changes on every sign-in, so a worker who signs in again
		 * after a 401 fetches fresh facts instead of reusing the answer that failed.
		 */
		detail: (workerId: string | null, sessionExpiresAt: number | null) =>
			['assignment-refresh', workerId, sessionExpiresAt] as const,
	},
	workerView: {
		all: ['worker-view'] as const,
		detail: (workerId: string | null) => ['worker-view', workerId] as const,
	},
};
