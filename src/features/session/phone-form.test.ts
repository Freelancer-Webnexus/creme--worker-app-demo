import {
	initialPhoneForm,
	phoneFormReducer,
} from '@/features/session/phone-form';

describe('phoneFormReducer', () => {
	it('starts editing with the prefilled number', () => {
		expect(initialPhoneForm('+525510000001')).toEqual({
			status: { kind: 'editing' },
			text: '+525510000001',
		});
	});

	it('clears a problem as soon as the worker types again', () => {
		const failed = phoneFormReducer(initialPhoneForm('55'), {
			problem: 'invalid_phone',
			type: 'send_failed',
		});
		expect(failed.status).toEqual({
			kind: 'problem',
			problem: 'invalid_phone',
		});

		expect(phoneFormReducer(failed, { text: '551', type: 'edited' })).toEqual({
			status: { kind: 'editing' },
			text: '551',
		});
	});

	it('keeps the typed number through a connection problem', () => {
		const sending = phoneFormReducer(initialPhoneForm('+525510000001'), {
			type: 'send_started',
		});
		const failed = phoneFormReducer(sending, {
			problem: 'needs_connection',
			type: 'send_failed',
		});

		expect(failed.text).toBe('+525510000001');
		expect(failed.status).toEqual({
			kind: 'problem',
			problem: 'needs_connection',
		});
	});

	it('keeps the typed number through a server problem', () => {
		const sending = phoneFormReducer(initialPhoneForm('+525510000001'), {
			type: 'send_started',
		});
		const failed = phoneFormReducer(sending, {
			problem: 'server_unavailable',
			type: 'send_failed',
		});

		expect(failed.text).toBe('+525510000001');
		expect(failed.status).toEqual({
			kind: 'problem',
			problem: 'server_unavailable',
		});
	});

	it('ignores typing while the code request is on its way', () => {
		const sending = phoneFormReducer(initialPhoneForm('+525510000001'), {
			type: 'send_started',
		});

		expect(phoneFormReducer(sending, { text: 'x', type: 'edited' })).toBe(
			sending,
		);
	});

	it('goes back to editing once the code was sent', () => {
		const sending = phoneFormReducer(initialPhoneForm('+525510000001'), {
			type: 'send_started',
		});

		expect(phoneFormReducer(sending, { type: 'code_sent' }).status).toEqual({
			kind: 'editing',
		});
	});
});
