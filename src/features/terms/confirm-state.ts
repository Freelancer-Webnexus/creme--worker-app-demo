/**
 * The Confirm button. While the acceptance is being saved on the phone the
 * button is off, so a double tap cannot queue two actions (M3).
 */
export type ConfirmState =
	{ kind: 'idle' } | { kind: 'saving' } | { kind: 'not_saved' };

export type ConfirmEvent =
	{ type: 'tapped' } | { type: 'saved' } | { type: 'save_failed' };

export const initialConfirmState: ConfirmState = { kind: 'idle' };

/** The one decision on a tap: a save starts unless one is already running. */
export const confirmTapped = (
	state: ConfirmState,
): { next: ConfirmState; start: boolean } => {
	switch (state.kind) {
		case 'saving':
			return { next: state, start: false };
		case 'idle':
		case 'not_saved':
			return { next: { kind: 'saving' }, start: true };
		default:
			return state satisfies never;
	}
};

export const confirmReducer = (
	state: ConfirmState,
	event: ConfirmEvent,
): ConfirmState => {
	switch (event.type) {
		case 'tapped':
			return confirmTapped(state).next;
		case 'saved':
			return state.kind === 'saving' ? { kind: 'idle' } : state;
		case 'save_failed':
			return state.kind === 'saving' ? { kind: 'not_saved' } : state;
		default:
			return event satisfies never;
	}
};
