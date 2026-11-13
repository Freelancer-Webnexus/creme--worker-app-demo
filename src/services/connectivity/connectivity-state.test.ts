import { isOnlineFrom } from '@/services/connectivity/connectivity-state';

describe('isOnlineFrom', () => {
	it.each([
		[{ isConnected: true, isInternetReachable: true }, true],
		[{ isConnected: false, isInternetReachable: false }, false],
		[{ isConnected: false, isInternetReachable: true }, false],
		[{ isConnected: true, isInternetReachable: false }, false],
		[{ isConnected: false }, false],
		[{ isInternetReachable: false }, false],
		[{ isConnected: true }, true],
		[{ isInternetReachable: true }, true],
		[{ isConnected: null, isInternetReachable: null }, true],
		[{ isConnected: true, isInternetReachable: null }, true],
		[{ isConnected: null, isInternetReachable: false }, false],
		[{}, true],
	])('%j -> %s', (state, expected) => {
		expect(isOnlineFrom(state)).toBe(expected);
	});
});
