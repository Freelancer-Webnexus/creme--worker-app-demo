import {
	type ConfirmEvent,
	type ConfirmState,
	confirmReducer,
	confirmTapped,
	initialConfirmState,
} from '@/features/terms/confirm-state';

const idle: ConfirmState = { kind: 'idle' };
const saving: ConfirmState = { kind: 'saving' };
const notSaved: ConfirmState = { kind: 'not_saved' };

describe('confirmReducer', () => {
	it.each([
		['idle', idle, { type: 'tapped' }, saving],
		['idle', idle, { type: 'saved' }, idle],
		['idle', idle, { type: 'save_failed' }, idle],
		['saving', saving, { type: 'tapped' }, saving],
		['saving', saving, { type: 'saved' }, idle],
		['saving', saving, { type: 'save_failed' }, notSaved],
		['not_saved', notSaved, { type: 'tapped' }, saving],
		['not_saved', notSaved, { type: 'saved' }, notSaved],
		['not_saved', notSaved, { type: 'save_failed' }, notSaved],
	] as [string, ConfirmState, ConfirmEvent, ConfirmState][])(
		'%s + %j',
		(_name, from, event, expected) => {
			expect(confirmReducer(from, event)).toEqual(expected);
		},
	);

	it.each([
		['idle', idle, true, saving],
		['saving', saving, false, saving],
		['not_saved', notSaved, true, saving],
	] as [string, ConfirmState, boolean, ConfirmState][])(
		'a tap in %s starts the save: %s',
		(_name, from, start, next) => {
			expect(confirmTapped(from)).toEqual({ next, start });
		},
	);

	it('starts one save for two taps in a row', () => {
		const first = confirmTapped(idle);
		const second = confirmTapped(first.next);

		expect([first.start, second.start]).toEqual([true, false]);
		expect(second.next).toBe(first.next);
	});

	it('moves the reducer on the same decision as confirmTapped', () => {
		for (const state of [idle, saving, notSaved]) {
			expect(confirmReducer(state, { type: 'tapped' })).toEqual(
				confirmTapped(state).next,
			);
		}
	});

	it('ignores a second tap while saving', () => {
		expect(confirmReducer(saving, { type: 'tapped' })).toBe(saving);
	});

	it('starts idle', () => {
		expect(initialConfirmState).toEqual(idle);
	});
});
