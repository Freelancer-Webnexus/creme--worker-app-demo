import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network';
import {
	type ConnectivityEvent,
	type ConnectivityState,
	connectivityTransition,
	initialConnectivityState,
} from '@/services/connectivity/connectivity-model';
import { isOnlineFrom } from '@/services/connectivity/connectivity-state';
import { logger } from '@/services/logger/logger';
import type { Connectivity } from '@/services/sync/sync-ports';

type DeviceConnectivity = Connectivity & {
	start: () => Promise<void>;
	stop: () => void;
};

export const createConnectivity = (): DeviceConnectivity => {
	let state: ConnectivityState = initialConnectivityState;
	let listeners: ((online: boolean) => void)[] = [];
	let subscription: ReturnType<typeof addNetworkStateListener> | undefined;

	const dispatch = (event: ConnectivityEvent): void => {
		const previous = state;
		state = connectivityTransition(previous, event);
		if (state.online !== previous.online) {
			for (const listener of listeners) {
				listener(state.online);
			}
		}
	};

	return {
		isOnline: () => state.online,

		subscribe: (listener) => {
			listeners = [...listeners, listener];
			return () => {
				listeners = listeners.filter((other) => other !== listener);
			};
		},

		start: async () => {
			if (state.kind !== 'stopped') {
				return;
			}
			dispatch({ type: 'start_requested' });
			subscription = addNetworkStateListener((event) => {
				dispatch({ online: isOnlineFrom(event), type: 'event_received' });
			});

			try {
				const initial = await getNetworkStateAsync();
				dispatch({ online: isOnlineFrom(initial), type: 'initial_read' });
			} catch {
				logger.warn('connectivity', 'Could not read the network state.');
			}
		},

		stop: () => {
			subscription?.remove();
			subscription = undefined;
			dispatch({ type: 'stop_requested' });
		},
	};
};

export const deviceConnectivity = createConnectivity();
