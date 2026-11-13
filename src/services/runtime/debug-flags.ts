export type DebugFlagsSnapshot = { compressionEnabled: boolean };

/**
 * Switches the debug screen flips at run time. The image pipeline reads the
 * snapshot on every call, so a change applies to the next photo without a
 * restart, and the debug screen reads the same snapshot with
 * `useSyncExternalStore`, so there is one source of truth.
 */
export type DebugFlags = {
	getSnapshot: () => DebugFlagsSnapshot;
	subscribe: (listener: () => void) => () => void;
	setCompressionEnabled: (enabled: boolean) => void;
};

export const createDebugFlags = (): DebugFlags => {
	let snapshot: DebugFlagsSnapshot = { compressionEnabled: true };
	const listeners = new Set<() => void>();

	return {
		getSnapshot: () => snapshot,
		setCompressionEnabled: (enabled) => {
			if (snapshot.compressionEnabled === enabled) {
				return;
			}
			snapshot = { compressionEnabled: enabled };
			for (const listener of listeners) {
				listener();
			}
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
};
