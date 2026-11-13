export type PhoneProblem =
	'invalid_phone' | 'needs_connection' | 'server_unavailable';

export type PhoneFormStatus =
	| { kind: 'editing' }
	| { kind: 'sending' }
	| { kind: 'problem'; problem: PhoneProblem };

export type PhoneFormState = {
	text: string;
	status: PhoneFormStatus;
};

export type PhoneFormEvent =
	| { type: 'edited'; text: string }
	| { type: 'send_started' }
	| { type: 'send_failed'; problem: PhoneProblem }
	| { type: 'code_sent' };

export const initialPhoneForm = (text: string): PhoneFormState => ({
	status: { kind: 'editing' },
	text,
});

export const phoneFormReducer = (
	state: PhoneFormState,
	event: PhoneFormEvent,
): PhoneFormState => {
	switch (event.type) {
		case 'edited':
			return state.status.kind === 'sending'
				? state
				: { status: { kind: 'editing' }, text: event.text };
		case 'send_started':
			return { ...state, status: { kind: 'sending' } };
		case 'send_failed':
			return { ...state, status: { kind: 'problem', problem: event.problem } };
		case 'code_sent':
			return { ...state, status: { kind: 'editing' } };
		default:
			return event satisfies never;
	}
};
