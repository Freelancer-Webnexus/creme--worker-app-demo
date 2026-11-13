import type {
	OtpVerifyResponse,
	WorkerSummary,
} from '@/services/api/api-types';
import { assertNever } from '@/services/sync/sync-step';

/**
 * Who is signed in on this phone. A 401 is not a state here: the engine owns
 * `auth_required`, and re-verifying the code as the same phone brings the
 * session back without losing the worker choice.
 */
export type SessionState =
	| { kind: 'signed_out'; lastPhone: string | null }
	| {
			kind: 'choosing_worker';
			phone: string;
			token: string;
			expiresAt: number;
			workers: WorkerSummary[];
	  }
	| {
			kind: 'signed_in';
			phone: string;
			token: string;
			expiresAt: number;
			worker: WorkerSummary;
			workers: WorkerSummary[];
	  };

export type SessionEvent =
	| { type: 'otp_verified'; phone: string; session: OtpVerifyResponse }
	| { type: 'worker_chosen'; workerId: string }
	| { type: 'switch_worker_requested' }
	| { type: 'signed_out' };

export type AuthSessionStatus = 'signed-out' | 'in-app';

export const initialSessionState: SessionState = {
	kind: 'signed_out',
	lastPhone: null,
};

/** The server compares numbers by digits only (api-contract.md). */
const digitsOf = (phone: string): string => phone.replace(/\D/g, '');

const onVerified = (
	state: SessionState,
	phone: string,
	session: OtpVerifyResponse,
): SessionState => {
	const { token, expiresAt, workers } = session;

	if (state.kind === 'signed_in' && digitsOf(state.phone) === digitsOf(phone)) {
		const keptWorker = workers.find((worker) => worker.id === state.worker.id);
		if (keptWorker !== undefined) {
			return { ...state, phone, token, expiresAt, worker: keptWorker, workers };
		}
	}

	const [only, ...others] = workers;
	if (only === undefined) {
		return { kind: 'signed_out', lastPhone: phone };
	}
	if (others.length === 0) {
		return {
			kind: 'signed_in',
			phone,
			token,
			expiresAt,
			worker: only,
			workers,
		};
	}
	return { kind: 'choosing_worker', phone, token, expiresAt, workers };
};

const lastPhoneOf = (state: SessionState): string | null =>
	state.kind === 'signed_out' ? state.lastPhone : state.phone;

export const transition = (
	state: SessionState,
	event: SessionEvent,
): SessionState => {
	switch (event.type) {
		case 'otp_verified':
			return onVerified(state, event.phone, event.session);

		case 'worker_chosen': {
			if (state.kind !== 'choosing_worker') {
				return state;
			}
			const worker = state.workers.find((other) => other.id === event.workerId);
			return worker === undefined
				? state
				: {
						kind: 'signed_in',
						phone: state.phone,
						token: state.token,
						expiresAt: state.expiresAt,
						worker,
						workers: state.workers,
					};
		}

		case 'switch_worker_requested':
			return state.kind === 'signed_in' && state.workers.length > 1
				? {
						kind: 'choosing_worker',
						phone: state.phone,
						token: state.token,
						expiresAt: state.expiresAt,
						workers: state.workers,
					}
				: state;

		case 'signed_out':
			return state.kind === 'signed_out'
				? state
				: { kind: 'signed_out', lastPhone: lastPhoneOf(state) };

		default:
			return assertNever(event);
	}
};

/** What the engine's `SessionSource` port returns: only the active worker's token. */
export const tokenForWorker = (
	state: SessionState,
	workerId: string,
): string | null =>
	state.kind === 'signed_in' && state.worker.id === workerId
		? state.token
		: null;

export const authStatusOf = (state: SessionState): AuthSessionStatus =>
	state.kind === 'signed_in' ? 'in-app' : 'signed-out';
