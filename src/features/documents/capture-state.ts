export type CaptureSource = 'camera' | 'gallery';

export type CaptureImage = {
	uri: string;
	width: number;
	height: number;
};

/** Why nothing was saved. Each has its own words and its own next step. */
export type CaptureProblem =
	'camera_denied' | 'failed' | 'not_saved' | 'picker_failed' | 'too_large';

/**
 * The whole capture flow. The photo travels with the state that needs it, and
 * a problem carries none: after one, the worker starts again with a new photo,
 * so an old file name is never reused (M7).
 */
export type CaptureState =
	| { kind: 'choosing' }
	| { kind: 'picking'; source: CaptureSource }
	| { kind: 'previewing'; image: CaptureImage }
	| { kind: 'preparing'; image: CaptureImage }
	| { kind: 'problem'; problem: CaptureProblem };

export type CaptureEvent =
	| { type: 'pick_started'; source: CaptureSource }
	| { type: 'picked'; image: CaptureImage }
	| { type: 'pick_cancelled' }
	| { type: 'permission_denied' }
	| { type: 'pick_failed' }
	| { type: 'submit_started' }
	| { type: 'prepare_too_large' }
	| { type: 'prepare_failed' }
	| { type: 'not_saved' }
	| { type: 'retake' };

export const initialCaptureState: CaptureState = { kind: 'choosing' };

const problem = (value: CaptureProblem): CaptureState => ({
	kind: 'problem',
	problem: value,
});

/** The photo a Submit tap may send. Only a previewed photo can be sent, so a second tap finds none. */
export const submitTarget = (state: CaptureState): CaptureImage | null =>
	state.kind === 'previewing' ? state.image : null;

export const captureReducer = (
	state: CaptureState,
	event: CaptureEvent,
): CaptureState => {
	switch (event.type) {
		case 'pick_started':
			return state.kind === 'choosing'
				? { kind: 'picking', source: event.source }
				: state;
		case 'picked':
			return state.kind === 'picking'
				? { image: event.image, kind: 'previewing' }
				: state;
		case 'pick_cancelled':
			return state.kind === 'picking' ? { kind: 'choosing' } : state;
		case 'permission_denied':
			return state.kind === 'picking' ? problem('camera_denied') : state;
		case 'pick_failed':
			return state.kind === 'picking' ? problem('picker_failed') : state;
		case 'submit_started':
			return state.kind === 'previewing'
				? { image: state.image, kind: 'preparing' }
				: state;
		case 'prepare_too_large':
			return state.kind === 'preparing' ? problem('too_large') : state;
		case 'prepare_failed':
			return state.kind === 'preparing' ? problem('failed') : state;
		case 'not_saved':
			return state.kind === 'preparing' ? problem('not_saved') : state;
		case 'retake':
			return state.kind === 'previewing' || state.kind === 'problem'
				? { kind: 'choosing' }
				: state;
		default:
			return event satisfies never;
	}
};
