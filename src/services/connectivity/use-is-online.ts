import { useSyncExternalStore } from 'react';
import { deviceConnectivity } from '@/services/connectivity/connectivity';

const subscribe = (onChange: () => void): (() => void) =>
	deviceConnectivity.subscribe(onChange);

export const useIsOnline = (): boolean =>
	useSyncExternalStore(
		subscribe,
		deviceConnectivity.isOnline,
		deviceConnectivity.isOnline,
	);
