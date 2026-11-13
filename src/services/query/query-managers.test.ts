import { focusManager, onlineManager } from '@tanstack/react-query';

type AppStateListener = (next: string) => void;

let appStateListeners: AppStateListener[] = [];
let connectivityListeners: ((online: boolean) => void)[] = [];
let deviceOnline = true;

jest.mock('react-native', () => ({
	AppState: {
		addEventListener: (_event: string, listener: AppStateListener) => {
			appStateListeners = [...appStateListeners, listener];
			return {
				remove: () => {
					appStateListeners = appStateListeners.filter(
						(other) => other !== listener,
					);
				},
			};
		},
	},
}));

jest.mock('@/services/connectivity/connectivity', () => ({
	deviceConnectivity: {
		isOnline: () => deviceOnline,
		subscribe: (listener: (online: boolean) => void) => {
			connectivityListeners = [...connectivityListeners, listener];
			return () => {
				connectivityListeners = connectivityListeners.filter(
					(other) => other !== listener,
				);
			};
		},
	},
}));

const { configureQueryManagers } =
	await import('@/services/query/query-managers');

const changeAppState = (next: string): void => {
	for (const listener of appStateListeners) {
		listener(next);
	}
};

const changeConnectivity = (online: boolean): void => {
	deviceOnline = online;
	for (const listener of connectivityListeners) {
		listener(online);
	}
};

beforeEach(() => {
	appStateListeners = [];
	connectivityListeners = [];
	deviceOnline = true;
});

afterEach(() => {
	focusManager.setEventListener(() => () => undefined);
	focusManager.setFocused(undefined);
	onlineManager.setEventListener(() => () => undefined);
	onlineManager.setOnline(true);
});

describe('configureQueryManagers', () => {
	it('starts offline when the device is offline at launch', () => {
		deviceOnline = false;

		configureQueryManagers();

		expect(onlineManager.isOnline()).toBe(false);
	});

	it('follows the device when it loses and regains connectivity', () => {
		configureQueryManagers();

		changeConnectivity(false);
		expect(onlineManager.isOnline()).toBe(false);

		changeConnectivity(true);
		expect(onlineManager.isOnline()).toBe(true);
	});

	it('treats the app as focused only while it is active', () => {
		configureQueryManagers();

		changeAppState('background');
		expect(focusManager.isFocused()).toBe(false);

		changeAppState('active');
		expect(focusManager.isFocused()).toBe(true);

		changeAppState('inactive');
		expect(focusManager.isFocused()).toBe(false);
	});

	it('notifies focus subscribers when the app returns to the foreground', () => {
		configureQueryManagers();
		changeAppState('background');
		const seen: boolean[] = [];
		const unsubscribe = focusManager.subscribe((focused) => {
			seen.push(focused);
		});

		changeAppState('active');
		unsubscribe();

		expect(seen).toEqual([true]);
	});
});
