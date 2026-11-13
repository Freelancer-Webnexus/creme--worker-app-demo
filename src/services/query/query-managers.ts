import { AppState } from 'react-native';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { deviceConnectivity } from '@/services/connectivity/connectivity';

/**
 * React Query learns about the phone, not a browser tab. "Focus" is the app
 * coming back to the foreground, and "online" is the OS connectivity signal, so
 * a stale query refetches on foreground and on reconnect, and a fetch started
 * offline waits instead of failing.
 */
export const configureQueryManagers = (): void => {
	focusManager.setEventListener((handleFocus) => {
		const subscription = AppState.addEventListener('change', (next) => {
			handleFocus(next === 'active');
		});
		return () => {
			subscription.remove();
		};
	});
	onlineManager.setEventListener((setOnline) =>
		deviceConnectivity.subscribe(setOnline),
	);
	onlineManager.setOnline(deviceConnectivity.isOnline());
};
