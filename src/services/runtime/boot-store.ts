import {
	type BootEvent,
	type BootState,
	bootTransition,
	initialBootState,
	initialSplashState,
	type SplashEvent,
	type SplashState,
	splashTransition,
} from '@/services/runtime/boot-state';

export type BootPorts<TRuntime> = {
	boot: () => Promise<TRuntime>;
	splash: { release: () => void };
};

export type BootStore<TRuntime> = {
	getState: () => BootState<TRuntime>;
	markLaidOut: () => void;
	releaseSplashOnError: () => void;
	retry: () => void;
	subscribe: (listener: () => void) => () => void;
};

const asError = (value: unknown): Error =>
	value instanceof Error ? value : new Error('The app could not start.');

/**
 * Owns the boot lifecycle: one state, one transition. The splash has its own
 * closed state: it is released once, after the screen that replaces it reports
 * its first layout or the app tree crashes before it, and never comes back. Boot
 * never waits for the network, so a retry works offline (M1).
 */
export const createBootStore = <TRuntime>(
	ports: BootPorts<TRuntime>,
): BootStore<TRuntime> => {
	let state: BootState<TRuntime> = initialBootState;
	let splash: SplashState = initialSplashState;
	const listeners = new Set<() => void>();

	const advanceSplash = (event: SplashEvent): void => {
		const before = splash;
		splash = splashTransition(before, event);
		if (splash === 'released' && before !== 'released') {
			ports.splash.release();
		}
	};

	const dispatch = (event: BootEvent<TRuntime>): void => {
		const previous = state;
		const next = bootTransition(previous, event);
		if (next === previous) {
			return;
		}
		state = next;
		if (previous.kind === 'booting') {
			advanceSplash('bootSettled');
		} else if (next.kind === 'booting') {
			advanceSplash('retried');
		}
		for (const listener of listeners) {
			listener();
		}
	};

	const run = (): void => {
		ports.boot().then(
			(runtime) => {
				dispatch({ runtime, type: 'succeeded' });
			},
			(error: unknown) => {
				dispatch({ error: asError(error), type: 'failed' });
			},
		);
	};

	run();

	return {
		getState: () => state,
		markLaidOut: () => {
			advanceSplash('laidOut');
		},
		releaseSplashOnError: () => {
			advanceSplash('renderFailed');
		},
		retry: () => {
			const before = state;
			dispatch({ type: 'retry' });
			if (state !== before) {
				run();
			}
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
};
