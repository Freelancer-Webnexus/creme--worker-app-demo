/**
 * One error taxonomy for every network call, so callers branch on a kind
 * rather than inspecting an unknown. Kept pure: no fetch, no React, so it is
 * covered by `domain:check`.
 */
export type HttpErrorKind =
	'network' | 'timeout' | 'client' | 'server' | 'parse' | 'aborted';

export class HttpError extends Error {
	readonly kind: HttpErrorKind;
	/** Parsed JSON of a non-OK response, when it had one (a 409 carries the current terms). */
	readonly body?: unknown;
	readonly reason?: unknown;
	readonly status?: number;
	readonly url: string;

	constructor(options: {
		kind: HttpErrorKind;
		message: string;
		body?: unknown;
		reason?: unknown;
		status?: number;
		url: string;
	}) {
		// Not `new Error(message, { cause })`: the project's TypeScript lib does
		// not include the ES2022 two-argument constructor.
		super(options.message);
		this.name = 'HttpError';
		this.kind = options.kind;
		this.body = options.body;
		this.reason = options.reason;
		this.status = options.status;
		this.url = options.url;
	}

	/** Retrying a 4xx sends the same bad request again. */
	get isRetryable(): boolean {
		return (
			this.kind === 'network' ||
			this.kind === 'timeout' ||
			this.kind === 'server'
		);
	}
}

export const kindForStatus = (status: number): HttpErrorKind => {
	return status >= 500 ? 'server' : 'client';
};
