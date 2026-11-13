/**
 * The number a one-time code was just sent to. It lives here, not in a route
 * parameter: a phone number must not end up in a URL or a navigation log
 * (house rule 6).
 */
export type PendingSignIn =
	{ kind: 'idle' } | { kind: 'code_requested'; phone: string };

export type PendingSignInStore = {
	get: () => PendingSignIn;
	subscribe: (listener: () => void) => () => void;
	codeRequested: (phone: string) => void;
	clear: () => void;
};

export const createPendingSignInStore = (): PendingSignInStore => {
	let state: PendingSignIn = { kind: 'idle' };
	let listeners: (() => void)[] = [];

	const set = (next: PendingSignIn): void => {
		state = next;
		for (const listener of listeners) {
			listener();
		}
	};

	return {
		clear: () => {
			if (state.kind !== 'idle') {
				set({ kind: 'idle' });
			}
		},
		codeRequested: (phone) => {
			set({ kind: 'code_requested', phone });
		},
		get: () => state,
		subscribe: (listener) => {
			listeners = [...listeners, listener];
			return () => {
				listeners = listeners.filter((other) => other !== listener);
			};
		},
	};
};

export const pendingSignIn = createPendingSignInStore();
