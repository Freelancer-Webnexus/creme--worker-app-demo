import { type ActionOutcome, sendResultFor } from '@/services/api/send-result';
import type { HttpClient } from '@/services/http/http-client';
import { HttpError } from '@/services/http/http-error';
import type { Transport } from '@/services/sync/sync-ports';
import { assertNever } from '@/services/sync/sync-step';
import type { QueuedAction } from '@/services/sync/sync-types';

export type HttpTransportOptions = {
	http: HttpClient;
	/**
	 * The file part differs by runtime: React Native sends `{ uri, name, type }`,
	 * tests send a Blob. The app passes the React Native one. `null` means the
	 * local file cannot be read: the upload is rejected, not retried (M5).
	 */
	fileBody: (fileUri: string) => unknown;
	/** Longer than the JSON timeout, because a photo is megabytes on a weak link. */
	uploadTimeoutMs?: number;
};

type Attempt =
	ActionOutcome | { kind: 'file_missing' } | { kind: 'unreadable_success' };

const outcomeOf = async (
	send: () => Promise<{ status: number; body: unknown }>,
): Promise<Attempt> => {
	try {
		const { status, body } = await send();
		return { kind: 'response', status, body };
	} catch (error) {
		if (!(error instanceof HttpError)) {
			throw error;
		}
		// A 2xx whose body is not JSON may come from a captive portal or a
		// proxy, not the server, so it proves nothing was stored.
		if (error.kind === 'parse') {
			return { kind: 'unreadable_success' };
		}
		if (error.status !== undefined) {
			return { kind: 'response', status: error.status, body: error.body };
		}
		return { kind: 'network_error' };
	}
};

export const createHttpTransport = ({
	http,
	fileBody,
	uploadTimeoutMs,
}: HttpTransportOptions): Transport => {
	const send = (action: QueuedAction, token: string): Promise<Attempt> => {
		const headers = {
			authorization: `Bearer ${token}`,
			'x-worker-id': action.workerId,
		};
		const { kind } = action;
		switch (kind.type) {
			case 'terms_acceptance':
				return outcomeOf(() =>
					http.requestWithStatus('/me/terms-acceptances', {
						method: 'POST',
						headers,
						body: {
							clientActionId: action.clientActionId,
							termsVersionId: kind.termsVersionId,
						},
					}),
				);
			case 'document_upload': {
				const image = fileBody(kind.fileUri);
				if (image === null) {
					return Promise.resolve({ kind: 'file_missing' });
				}
				const form = new FormData();
				form.append('clientActionId', action.clientActionId);
				form.append('documentType', kind.documentType);
				form.append('image', image as Blob);
				return outcomeOf(() =>
					http.requestWithStatus('/me/documents', {
						method: 'POST',
						headers,
						body: form,
						timeoutMs: uploadTimeoutMs,
					}),
				);
			}
			default:
				return assertNever(kind);
		}
	};

	return {
		send: async (action, token) => {
			const attempt = await send(action, token);
			switch (attempt.kind) {
				case 'file_missing':
					return { kind: 'rejected', reason: 'rejected' };
				// The server deduplicates on clientActionId (M3), so a retry that
				// reaches it either stores the action or replays the stored one.
				case 'unreadable_success':
					return { kind: 'retryable' };
				case 'network_error':
				case 'response':
					return sendResultFor(attempt);
				default:
					return assertNever(attempt);
			}
		},
	};
};
