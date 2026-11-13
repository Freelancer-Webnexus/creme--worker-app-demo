import { sanitizeCode } from '@/features/session/otp-code';

export type CodeProblem =
	'wrong_code' | 'needs_connection' | 'server_unavailable';

export type CodeFormStatus =
	| { kind: 'editing' }
	| { kind: 'verifying' }
	| { kind: 'problem'; problem: CodeProblem };

export type CodeFormState = {
	text: string;
	status: CodeFormStatus;
};

export type CodeFormEvent =
	| { type: 'edited'; text: string }
	| { type: 'verify_started' }
	/** The worker tapped the button before typing all six digits. */
	| { type: 'incomplete' }
	| { type: 'wrong_code' }
	| { type: 'no_connection' }
	| { type: 'server_unavailable' };

export const initialCodeForm: CodeFormState = {
	status: { kind: 'editing' },
	text: '',
};

export const codeFormReducer = (
	state: CodeFormState,
	event: CodeFormEvent,
): CodeFormState => {
	switch (event.type) {
		case 'edited':
			return state.status.kind === 'verifying'
				? state
				: { status: { kind: 'editing' }, text: sanitizeCode(event.text) };
		case 'verify_started':
			return { ...state, status: { kind: 'verifying' } };
		case 'incomplete':
			return { ...state, status: { kind: 'problem', problem: 'wrong_code' } };
		case 'wrong_code':
			return { status: { kind: 'problem', problem: 'wrong_code' }, text: '' };
		case 'no_connection':
			return {
				...state,
				status: { kind: 'problem', problem: 'needs_connection' },
			};
		case 'server_unavailable':
			return {
				...state,
				status: { kind: 'problem', problem: 'server_unavailable' },
			};
		default:
			return event satisfies never;
	}
};
