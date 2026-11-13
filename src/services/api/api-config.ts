import { Platform } from 'react-native';

export const JSON_TIMEOUT_MS = 10_000;
export const UPLOAD_TIMEOUT_MS = 60_000;

/** The emulator reaches the host machine at 10.0.2.2 (docs/api-contract.md). */
export const apiBaseUrl = (): string => {
	const fromEnv = process.env.EXPO_PUBLIC_API_URL;
	if (fromEnv !== undefined && fromEnv !== '') {
		return fromEnv;
	}
	return Platform.OS === 'android'
		? 'http://10.0.2.2:4000'
		: 'http://localhost:4000';
};
