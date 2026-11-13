import {
	type CaptureEvent,
	type CaptureImage,
	type CaptureState,
	captureReducer,
	initialCaptureState,
	submitTarget,
} from '@/features/documents/capture-state';

const image: CaptureImage = {
	height: 3000,
	uri: 'file:///cache/a.jpg',
	width: 4000,
};
const other: CaptureImage = {
	height: 10,
	uri: 'file:///cache/b.jpg',
	width: 10,
};

const states = {
	choosing: { kind: 'choosing' },
	picking: { kind: 'picking', source: 'camera' },
	preparing: { image, kind: 'preparing' },
	previewing: { image, kind: 'previewing' },
	problem: { kind: 'problem', problem: 'too_large' },
} satisfies Record<CaptureState['kind'], CaptureState>;

type Row = [
	name: string,
	from: CaptureState,
	event: CaptureEvent,
	to: CaptureState,
];

const rows: Row[] = [
	[
		'choosing',
		states.choosing,
		{ source: 'gallery', type: 'pick_started' },
		{ kind: 'picking', source: 'gallery' },
	],
	['choosing', states.choosing, { image, type: 'picked' }, states.choosing],
	['choosing', states.choosing, { type: 'pick_cancelled' }, states.choosing],
	['choosing', states.choosing, { type: 'permission_denied' }, states.choosing],
	['choosing', states.choosing, { type: 'pick_failed' }, states.choosing],
	['choosing', states.choosing, { type: 'submit_started' }, states.choosing],
	['choosing', states.choosing, { type: 'prepare_too_large' }, states.choosing],
	['choosing', states.choosing, { type: 'prepare_failed' }, states.choosing],
	['choosing', states.choosing, { type: 'not_saved' }, states.choosing],
	['choosing', states.choosing, { type: 'retake' }, states.choosing],

	[
		'picking',
		states.picking,
		{ source: 'gallery', type: 'pick_started' },
		states.picking,
	],
	['picking', states.picking, { image, type: 'picked' }, states.previewing],
	['picking', states.picking, { type: 'pick_cancelled' }, states.choosing],
	[
		'picking',
		states.picking,
		{ type: 'permission_denied' },
		{ kind: 'problem', problem: 'camera_denied' },
	],
	[
		'picking',
		states.picking,
		{ type: 'pick_failed' },
		{ kind: 'problem', problem: 'picker_failed' },
	],
	['picking', states.picking, { type: 'submit_started' }, states.picking],
	['picking', states.picking, { type: 'prepare_too_large' }, states.picking],
	['picking', states.picking, { type: 'prepare_failed' }, states.picking],
	['picking', states.picking, { type: 'not_saved' }, states.picking],
	['picking', states.picking, { type: 'retake' }, states.picking],

	[
		'previewing',
		states.previewing,
		{ source: 'camera', type: 'pick_started' },
		states.previewing,
	],
	[
		'previewing',
		states.previewing,
		{ image: other, type: 'picked' },
		states.previewing,
	],
	[
		'previewing',
		states.previewing,
		{ type: 'pick_cancelled' },
		states.previewing,
	],
	[
		'previewing',
		states.previewing,
		{ type: 'permission_denied' },
		states.previewing,
	],
	['previewing', states.previewing, { type: 'pick_failed' }, states.previewing],
	[
		'previewing',
		states.previewing,
		{ type: 'submit_started' },
		states.preparing,
	],
	[
		'previewing',
		states.previewing,
		{ type: 'prepare_too_large' },
		states.previewing,
	],
	[
		'previewing',
		states.previewing,
		{ type: 'prepare_failed' },
		states.previewing,
	],
	['previewing', states.previewing, { type: 'not_saved' }, states.previewing],
	['previewing', states.previewing, { type: 'retake' }, states.choosing],

	[
		'preparing',
		states.preparing,
		{ source: 'camera', type: 'pick_started' },
		states.preparing,
	],
	[
		'preparing',
		states.preparing,
		{ image: other, type: 'picked' },
		states.preparing,
	],
	['preparing', states.preparing, { type: 'pick_cancelled' }, states.preparing],
	[
		'preparing',
		states.preparing,
		{ type: 'permission_denied' },
		states.preparing,
	],
	['preparing', states.preparing, { type: 'pick_failed' }, states.preparing],
	['preparing', states.preparing, { type: 'submit_started' }, states.preparing],
	[
		'preparing',
		states.preparing,
		{ type: 'prepare_too_large' },
		{ kind: 'problem', problem: 'too_large' },
	],
	[
		'preparing',
		states.preparing,
		{ type: 'prepare_failed' },
		{ kind: 'problem', problem: 'failed' },
	],
	[
		'preparing',
		states.preparing,
		{ type: 'not_saved' },
		{ kind: 'problem', problem: 'not_saved' },
	],
	['preparing', states.preparing, { type: 'retake' }, states.preparing],

	[
		'problem',
		states.problem,
		{ source: 'camera', type: 'pick_started' },
		states.problem,
	],
	['problem', states.problem, { image, type: 'picked' }, states.problem],
	['problem', states.problem, { type: 'pick_cancelled' }, states.problem],
	['problem', states.problem, { type: 'permission_denied' }, states.problem],
	['problem', states.problem, { type: 'pick_failed' }, states.problem],
	['problem', states.problem, { type: 'submit_started' }, states.problem],
	['problem', states.problem, { type: 'prepare_too_large' }, states.problem],
	['problem', states.problem, { type: 'prepare_failed' }, states.problem],
	['problem', states.problem, { type: 'not_saved' }, states.problem],
	['problem', states.problem, { type: 'retake' }, states.choosing],
];

describe('captureReducer', () => {
	it('covers every state with every event', () => {
		expect(rows).toHaveLength(Object.keys(states).length * 10);
	});

	it.each(rows)('%s + %j gives %j', (_name, from, event, to) => {
		expect(captureReducer(from, event)).toEqual(to);
	});

	it.each([
		['choosing', null],
		['picking', null],
		['previewing', image],
		['preparing', null],
		['problem', null],
	] as const)('%s offers %j to submit', (kind, expected) => {
		expect(submitTarget(states[kind])).toEqual(expected);
	});

	it('cannot submit twice: the second tap finds no photo to send', () => {
		const first = captureReducer(states.previewing, { type: 'submit_started' });
		const second = captureReducer(first, { type: 'submit_started' });

		expect(submitTarget(states.previewing)).toEqual(image);
		expect(second).toBe(first);
		expect(submitTarget(second)).toBeNull();
	});

	it('starts by choosing', () => {
		expect(initialCaptureState).toEqual({ kind: 'choosing' });
	});

	it('keeps the picked photo through preparing, and drops it after a problem', () => {
		const preparing = captureReducer(states.previewing, {
			type: 'submit_started',
		});
		expect(preparing).toEqual({ image, kind: 'preparing' });

		const failed = captureReducer(preparing, { type: 'prepare_failed' });
		expect(failed).toEqual({ kind: 'problem', problem: 'failed' });
		expect(JSON.stringify(failed)).not.toContain('file://');
	});

	it('runs a full retake loop', () => {
		let state = initialCaptureState;
		state = captureReducer(state, { source: 'camera', type: 'pick_started' });
		state = captureReducer(state, { image, type: 'picked' });
		state = captureReducer(state, { type: 'submit_started' });
		state = captureReducer(state, { type: 'prepare_too_large' });
		state = captureReducer(state, { type: 'retake' });
		state = captureReducer(state, { source: 'gallery', type: 'pick_started' });
		state = captureReducer(state, { image: other, type: 'picked' });

		expect(state).toEqual({ image: other, kind: 'previewing' });
	});
});
