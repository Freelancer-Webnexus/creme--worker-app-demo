import { codeFormReducer, initialCodeForm } from '@/features/session/code-form';

describe('codeFormReducer', () => {
	it('keeps only digits, at most six', () => {
		expect(
			codeFormReducer(initialCodeForm, { text: '12 34 56 78', type: 'edited' })
				.text,
		).toBe('123456');
	});

	it('clears the field and says so after a wrong code', () => {
		const verifying = codeFormReducer(
			codeFormReducer(initialCodeForm, { text: '999999', type: 'edited' }),
			{ type: 'verify_started' },
		);

		expect(codeFormReducer(verifying, { type: 'wrong_code' })).toEqual({
			status: { kind: 'problem', problem: 'wrong_code' },
			text: '',
		});
	});

	it('keeps the digits through a connection problem so the worker can retry', () => {
		const verifying = codeFormReducer(
			codeFormReducer(initialCodeForm, { text: '123456', type: 'edited' }),
			{ type: 'verify_started' },
		);

		const failed = codeFormReducer(verifying, { type: 'no_connection' });

		expect(failed.text).toBe('123456');
		expect(failed.status).toEqual({
			kind: 'problem',
			problem: 'needs_connection',
		});
	});

	it('keeps the digits and names the server when it does not answer', () => {
		const verifying = codeFormReducer(
			codeFormReducer(initialCodeForm, { text: '123456', type: 'edited' }),
			{ type: 'verify_started' },
		);

		const failed = codeFormReducer(verifying, { type: 'server_unavailable' });

		expect(failed.text).toBe('123456');
		expect(failed.status).toEqual({
			kind: 'problem',
			problem: 'server_unavailable',
		});
	});

	it('keeps the digits typed so far when the button is tapped too early', () => {
		const typed = codeFormReducer(initialCodeForm, {
			text: '123',
			type: 'edited',
		});

		const early = codeFormReducer(typed, { type: 'incomplete' });

		expect(early.text).toBe('123');
		expect(early.status).toEqual({ kind: 'problem', problem: 'wrong_code' });
	});

	it('hides the problem when the worker types again', () => {
		const wrong = codeFormReducer(initialCodeForm, { type: 'wrong_code' });

		expect(
			codeFormReducer(wrong, { text: '1', type: 'edited' }).status,
		).toEqual({ kind: 'editing' });
	});

	it('ignores typing while the code is being checked', () => {
		const verifying = codeFormReducer(initialCodeForm, {
			type: 'verify_started',
		});

		expect(codeFormReducer(verifying, { text: '1', type: 'edited' })).toBe(
			verifying,
		);
	});
});
