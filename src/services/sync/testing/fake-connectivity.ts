import type { Connectivity } from '@/services/sync/sync-ports';

export type FakeConnectivity = Connectivity & {
	setOnline: (online: boolean) => void;
};

export const createFakeConnectivity = (online = false): FakeConnectivity => {
	let current = online;
	let listeners: ((online: boolean) => void)[] = [];

	return {
		isOnline: () => current,

		subscribe: (listener) => {
			listeners = [...listeners, listener];
			return () => {
				listeners = listeners.filter((other) => other !== listener);
			};
		},

		setOnline: (next) => {
			current = next;
			for (const listener of listeners) {
				listener(next);
			}
		},
	};
};
