import type { Assignment, OtpVerifyResponse } from '@/services/api/api-types';
import type { HttpClient } from '@/services/http/http-client';
import { HttpError, type HttpErrorKind } from '@/services/http/http-error';

/** No response came back: the phone has no connection, or the request timed out. */
type NetworkFailure = { kind: 'network_error' };

/** A response came back and it was not usable: 5xx, 408, 429, other 4xx, or not JSON. */
type ServerFailure = { kind: 'server_error' };

export type RequestOtpResult = { kind: 'ok' } | NetworkFailure | ServerFailure;

export type OtpVerifyResult =
	| { kind: 'ok'; session: OtpVerifyResponse }
	| { kind: 'bad_code' }
	| NetworkFailure
	| ServerFailure;

export type AssignmentResult =
	| { kind: 'ok'; assignment: Assignment }
	| { kind: 'unauthorized' }
	| NetworkFailure
	| ServerFailure;

export type WorkerApi = {
	requestOtp: (phone: string) => Promise<RequestOtpResult>;
	verifyOtp: (phone: string, code: string) => Promise<OtpVerifyResult>;
	fetchAssignment: (
		token: string,
		workerId: string,
	) => Promise<AssignmentResult>;
};

const httpErrorOf = (error: unknown): HttpError => {
	if (!(error instanceof HttpError)) {
		throw error;
	}
	return error;
};

const failureForKind = (
	kind: HttpErrorKind,
): NetworkFailure | ServerFailure => {
	switch (kind) {
		case 'network':
		case 'timeout':
		case 'aborted':
			return { kind: 'network_error' };
		case 'client':
		case 'server':
		case 'parse':
			return { kind: 'server_error' };
		default:
			return kind satisfies never;
	}
};

/** Never logs: a token or a phone number must not reach a log line (house rule 6). */
export const createWorkerApi = ({ http }: { http: HttpClient }): WorkerApi => ({
	requestOtp: async (phone) => {
		try {
			await http.request('/auth/otp/request', {
				method: 'POST',
				body: { phone },
			});
			return { kind: 'ok' };
		} catch (error) {
			return failureForKind(httpErrorOf(error).kind);
		}
	},

	verifyOtp: async (phone, code) => {
		try {
			const session = await http.request<OtpVerifyResponse>(
				'/auth/otp/verify',
				{ method: 'POST', body: { phone, code } },
			);
			return { kind: 'ok', session };
		} catch (error) {
			const failure = httpErrorOf(error);
			return failure.status === 401
				? { kind: 'bad_code' }
				: failureForKind(failure.kind);
		}
	},

	fetchAssignment: async (token, workerId) => {
		try {
			const assignment = await http.request<Assignment>('/me/assignment', {
				headers: {
					authorization: `Bearer ${token}`,
					'x-worker-id': workerId,
				},
			});
			return { kind: 'ok', assignment };
		} catch (error) {
			const failure = httpErrorOf(error);
			return failure.status === 401 || failure.status === 403
				? { kind: 'unauthorized' }
				: failureForKind(failure.kind);
		}
	},
});
