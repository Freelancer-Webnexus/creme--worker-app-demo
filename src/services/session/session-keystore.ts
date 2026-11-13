import { secureSessionItem } from '@/services/native/nitro-storage';
import {
	configureSessionPersistence,
	type SessionPersistence,
} from '@/services/session/session-store';

const keystorePersistence: SessionPersistence = {
	read: () => {
		const saved = secureSessionItem.get();
		return saved === '' ? null : saved;
	},
	write: (value) => {
		secureSessionItem.set(value);
	},
};

/** Call once at app start, before the first screen reads the session. */
export const installSessionKeystore = (): void => {
	configureSessionPersistence(keystorePersistence);
};
