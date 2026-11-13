export type OpenWithCleanupPorts<TResource, TResult> = {
	open: () => Promise<TResource>;
	close: (resource: TResource) => Promise<void>;
	setUp: (resource: TResource) => Promise<TResult>;
};

/**
 * M2: boot opens the database and then sets the app up on it. If the setup
 * fails, the database is closed before the error goes on, so a boot retry opens
 * one connection, not a second beside a leaked one. A failing close never hides
 * the setup error.
 */
export const openWithCleanup = async <TResource, TResult>(
	ports: OpenWithCleanupPorts<TResource, TResult>,
): Promise<TResult> => {
	const resource = await ports.open();
	try {
		return await ports.setUp(resource);
	} catch (error) {
		await ports.close(resource).catch(() => undefined);
		throw error;
	}
};
