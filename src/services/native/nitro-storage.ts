import {
	AccessControl,
	createStorageItem,
	StorageScope,
} from 'react-native-nitro-storage';

/**
 * The session JSON in the device keystore (iOS Keychain, Android Keystore).
 * Empty string means nothing saved. "After first unlock" lets a background
 * sync read the token while the phone is locked, and "this device only" keeps
 * it out of backups.
 */
export const secureSessionItem = createStorageItem<string>({
	accessControl: AccessControl.AfterFirstUnlockThisDeviceOnly,
	defaultValue: '',
	key: 'session',
	namespace: 'auth',
	scope: StorageScope.Secure,
});
