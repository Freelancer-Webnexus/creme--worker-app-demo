export type BootState<TRuntime> =
	| { kind: 'booting' }
	| { kind: 'ready'; runtime: TRuntime }
	| { kind: 'failed'; error: Error };

export type BootEvent<TRuntime> =
	| { type: 'succeeded'; runtime: TRuntime }
	| { type: 'failed'; error: Error }
	| { type: 'retry' };

export const initialBootState: BootState<never> = { kind: 'booting' };

export type SplashState = 'held' | 'awaitingLayout' | 'released';

export type SplashEvent =
	'bootSettled' | 'laidOut' | 'renderFailed' | 'retried';

export const initialSplashState: SplashState = 'held';

/**
 * The splash goes away only after the screen that replaces it has laid out, so
 * the first visible frame is already the page colour. A crash before that
 * layout also releases it, or the error screen would stay hidden behind it.
 * `released` is final: the native splash cannot come back. An event that does
 * not apply returns the same state.
 */
export const splashTransition = (
	state: SplashState,
	event: SplashEvent,
): SplashState => {
	switch (state) {
		case 'held':
			switch (event) {
				case 'bootSettled':
					return 'awaitingLayout';
				case 'renderFailed':
					return 'released';
				case 'laidOut':
				case 'retried':
					return state;
				default:
					return event satisfies never;
			}
		case 'awaitingLayout':
			switch (event) {
				case 'laidOut':
				case 'renderFailed':
					return 'released';
				case 'retried':
					return 'held';
				case 'bootSettled':
					return state;
				default:
					return event satisfies never;
			}
		case 'released':
			return state;
		default:
			return state satisfies never;
	}
};

/** An event that does not apply to the current state returns that same state. */
export const bootTransition = <TRuntime>(
	state: BootState<TRuntime>,
	event: BootEvent<TRuntime>,
): BootState<TRuntime> => {
	switch (state.kind) {
		case 'booting':
			switch (event.type) {
				case 'succeeded':
					return { kind: 'ready', runtime: event.runtime };
				case 'failed':
					return { error: event.error, kind: 'failed' };
				case 'retry':
					return state;
				default:
					return event satisfies never;
			}
		case 'failed':
			switch (event.type) {
				case 'retry':
					return { kind: 'booting' };
				case 'succeeded':
				case 'failed':
					return state;
				default:
					return event satisfies never;
			}
		case 'ready':
			return state;
		default:
			return state satisfies never;
	}
};
