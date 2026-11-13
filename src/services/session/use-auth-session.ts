import { useSyncExternalStore } from 'react';
import {
	type AuthSessionStatus,
	authStatusOf,
	type SessionEvent,
	type SessionState,
} from '@/services/session/session-state';
import {
	dispatchSession,
	getSession,
	subscribe,
	tokenFor,
} from '@/services/session/session-store';

export type AuthSession = {
	status: AuthSessionStatus;
	state: SessionState;
	dispatch: (event: SessionEvent) => SessionState;
	tokenFor: (workerId: string) => string | null;
};

export const useAuthSession = (): AuthSession => {
	const state = useSyncExternalStore(subscribe, getSession, getSession);

	return {
		status: authStatusOf(state),
		state,
		dispatch: dispatchSession,
		tokenFor,
	};
};
