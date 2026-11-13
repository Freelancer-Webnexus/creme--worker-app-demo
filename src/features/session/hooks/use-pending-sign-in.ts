import { useSyncExternalStore } from 'react';
import {
	type PendingSignIn,
	pendingSignIn,
} from '@/features/session/pending-sign-in';

const usePendingSignIn = (): PendingSignIn =>
	useSyncExternalStore(
		pendingSignIn.subscribe,
		pendingSignIn.get,
		pendingSignIn.get,
	);

export default usePendingSignIn;
