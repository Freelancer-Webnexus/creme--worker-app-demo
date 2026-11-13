import { logger } from '@/services/logger/logger';
import {
	parseSession,
	serializeSession,
} from '@/services/session/session-codec';
import {
	initialSessionState,
	type SessionEvent,
	type SessionState,
	tokenForWorker,
	transition,
} from '@/services/session/session-state';

/** Where the session JSON lives. The app passes the device keystore in. */
export type SessionPersistence = {
	read: () => string | null;
	write: (value: string) => void;
};

export type SessionStore = {
	getSession: () => SessionState;
	/** Returns the state the event led to, so a caller never re-reads the store. */
	dispatchSession: (event: SessionEvent) => SessionState;
	subscribe: (listener: () => void) => () => void;
	tokenFor: (workerId: string) => string | null;
	attachPersistence: (persistence: SessionPersistence) => void;
};

const readState = (persistence: SessionPersistence): SessionState => {
	try {
		return parseSession(persistence.read());
	} catch {
		logger.warn('session', 'Could not read the saved session.');
		return initialSessionState;
	}
};

export const createSessionStore = (
	initialPersistence: SessionPersistence,
): SessionStore => {
	let persistence = initialPersistence;
	let state = readState(persistence);
	let listeners: (() => void)[] = [];

	const notify = (): void => {
		for (const listener of listeners) {
			listener();
		}
	};

	const save = (): void => {
		try {
			persistence.write(serializeSession(state));
		} catch {
			logger.error('session', 'Could not save the session.');
		}
	};

	return {
		getSession: () => state,

		dispatchSession: (event) => {
			const next = transition(state, event);
			if (next === state) {
				return state;
			}
			state = next;
			save();
			notify();
			return next;
		},

		subscribe: (listener) => {
			listeners = [...listeners, listener];
			return () => {
				listeners = listeners.filter((other) => other !== listener);
			};
		},

		tokenFor: (workerId) => tokenForWorker(state, workerId),

		attachPersistence: (next) => {
			if (next === persistence) {
				return;
			}
			persistence = next;
			state = readState(persistence);
			notify();
		},
	};
};

const store = createSessionStore({ read: () => null, write: () => {} });

export const getSession = store.getSession;
export const dispatchSession = store.dispatchSession;
export const subscribe = store.subscribe;
export const tokenFor = store.tokenFor;
export const configureSessionPersistence = store.attachPersistence;
