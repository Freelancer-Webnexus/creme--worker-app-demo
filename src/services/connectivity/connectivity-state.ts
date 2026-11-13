type NetworkSnapshot = {
	isConnected?: boolean | null;
	isInternetReachable?: boolean | null;
};

/**
 * Offline only when the OS says so. Unknown counts as online: the mock server
 * lives on the emulator host, so a wrong "offline" would block sync for good,
 * while a wrong "online" costs one failed request that backs off (M5).
 */
export const isOnlineFrom = (networkState: NetworkSnapshot): boolean =>
	networkState.isConnected !== false &&
	networkState.isInternetReachable !== false;
