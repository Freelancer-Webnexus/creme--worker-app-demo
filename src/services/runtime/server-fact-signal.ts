export type ServerFactSignal = {
	emit: () => void;
	/** Returns an unsubscribe function. */
	subscribe: (listener: () => void) => () => void;
};

/**
 * M3, M4: "the cache just learned a server fact from a send". The outcome sink
 * emits it, and the app asks for a fresh assignment fetch. A listener is UI
 * code: its bug must never fail a delivery, which would keep its row queued.
 */
export const createServerFactSignal = (): ServerFactSignal => {
	let listeners: (() => void)[] = [];
	return {
		emit: () => {
			for (const listener of listeners) {
				try {
					listener();
				} catch {
					continue;
				}
			}
		},
		subscribe: (listener) => {
			listeners = [...listeners, listener];
			return () => {
				listeners = listeners.filter((other) => other !== listener);
			};
		},
	};
};
