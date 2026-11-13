import type { StaleTermsBody, TermsVersion } from '@/services/api/api-types';
import type { SendResult } from '@/services/sync/sync-types';

export type ActionOutcome =
	| { kind: 'response'; status: number; body: unknown }
	| { kind: 'network_error' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isTermsVersion = (value: unknown): value is TermsVersion =>
	isRecord(value) &&
	typeof value.id === 'string' &&
	typeof value.version === 'number' &&
	typeof value.publishedAt === 'string' &&
	isRecord(value.summary) &&
	typeof value.summary.es === 'string' &&
	typeof value.summary.en === 'string';

const isStaleTermsBody = (value: unknown): value is StaleTermsBody =>
	isRecord(value) &&
	value.error === 'stale_terms' &&
	isTermsVersion(value.currentTerms);

const REJECTED: SendResult = { kind: 'rejected', reason: 'rejected' };
const RETRYABLE: SendResult = { kind: 'retryable' };
const UNREACHABLE: SendResult = { kind: 'unreachable' };

/**
 * The one table from an HTTP outcome to the engine's result (M5, M6, M7).
 * No answer (network error or timeout) is unreachable, so the pass ends. A
 * status outside the table is retryable: the server deduplicates on
 * clientActionId (M3), so a retry can never double a record.
 */
export const sendResultFor = (outcome: ActionOutcome): SendResult => {
	if (outcome.kind === 'network_error') {
		return UNREACHABLE;
	}
	const { status, body } = outcome;
	switch (status) {
		case 201:
			return { kind: 'delivered', replay: false };
		case 200:
			return { kind: 'delivered', replay: true };
		case 409:
			return isStaleTermsBody(body)
				? { kind: 'stale_terms', currentTerms: body.currentTerms }
				: REJECTED;
		case 413:
			return { kind: 'rejected', reason: 'too_large' };
		case 422:
			return { kind: 'rejected', reason: 'unknown_document_type' };
		case 401:
		case 403:
			return { kind: 'unauthorized' };
		case 408:
		case 429:
			return RETRYABLE;
		default:
			if (status >= 500) {
				return RETRYABLE;
			}
			return status >= 400 && status < 500 ? REJECTED : RETRYABLE;
	}
};
