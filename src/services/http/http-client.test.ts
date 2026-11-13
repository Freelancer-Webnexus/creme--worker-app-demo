import { createHttpClient } from '@/services/http/http-client';
import { HttpError } from '@/services/http/http-error';

type Call = { url: string; init: RequestInit };

const jsonResponse = (status: number, body: unknown): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	});

const recordingFetch = (respond: () => Promise<Response>) => {
	const calls: Call[] = [];
	const fetchImpl = (url: string, init: RequestInit) => {
		calls.push({ url, init });
		return respond();
	};
	return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
};

const failureOf = async (work: Promise<unknown>): Promise<HttpError> => {
	try {
		await work;
	} catch (error) {
		if (error instanceof HttpError) {
			return error;
		}
		throw error;
	}
	throw new Error('Expected the request to fail.');
};

describe('http client', () => {
	it('sends JSON with a content type and parses the answer', async () => {
		const { calls, fetchImpl } = recordingFetch(async () =>
			jsonResponse(200, { ok: true }),
		);
		const http = createHttpClient({ baseUrl: 'http://api.test/', fetchImpl });

		const result = await http.request<{ ok: boolean }>('/auth/otp/request', {
			method: 'POST',
			body: { phone: '1' },
		});

		expect(result).toEqual({ ok: true });
		expect(calls[0]?.url).toBe('http://api.test/auth/otp/request');
		expect(calls[0]?.init.body).toBe('{"phone":"1"}');
		expect(calls[0]?.init.headers).toMatchObject({
			'content-type': 'application/json',
		});
	});

	it('keeps the status of a success', async () => {
		const { fetchImpl } = recordingFetch(async () => jsonResponse(201, {}));
		const http = createHttpClient({ baseUrl: 'http://api.test', fetchImpl });

		expect(await http.requestWithStatus('/x', { method: 'POST' })).toEqual({
			status: 201,
			body: {},
		});
	});

	it('passes a FormData body through without a content type', async () => {
		const { calls, fetchImpl } = recordingFetch(async () =>
			jsonResponse(201, {}),
		);
		const http = createHttpClient({ baseUrl: 'http://api.test', fetchImpl });
		const form = new FormData();
		form.append('clientActionId', 'a1');

		await http.request('/me/documents', { method: 'POST', body: form });

		expect(calls[0]?.init.body).toBe(form);
		const headers = calls[0]?.init.headers as Record<string, string>;
		expect(headers['content-type']).toBeUndefined();
	});

	it('merges default and per-request headers', async () => {
		const { calls, fetchImpl } = recordingFetch(async () =>
			jsonResponse(200, {}),
		);
		const http = createHttpClient({
			baseUrl: 'http://api.test',
			defaultHeaders: { 'x-a': '1' },
			fetchImpl,
		});

		await http.request('/x', { headers: { 'x-b': '2' } });

		expect(calls[0]?.init.headers).toMatchObject({ 'x-a': '1', 'x-b': '2' });
	});

	it('keeps the status and parsed body of a rejection', async () => {
		const body = { error: 'stale_terms', currentTerms: { id: 'terms-v3' } };
		const { fetchImpl } = recordingFetch(async () => jsonResponse(409, body));
		const http = createHttpClient({ baseUrl: 'http://api.test', fetchImpl });

		const error = await failureOf(http.request('/x', { method: 'POST' }));

		expect(error.kind).toBe('client');
		expect(error.status).toBe(409);
		expect(error.body).toEqual(body);
	});

	it('marks a 5xx as a server error', async () => {
		const { fetchImpl } = recordingFetch(async () =>
			jsonResponse(503, { error: 'down' }),
		);
		const http = createHttpClient({ baseUrl: 'http://api.test', fetchImpl });

		const error = await failureOf(http.request('/x'));

		expect(error.kind).toBe('server');
		expect(error.status).toBe(503);
	});

	it('leaves the body undefined when the rejection is not JSON', async () => {
		const { fetchImpl } = recordingFetch(
			async () => new Response('<html>', { status: 502 }),
		);
		const http = createHttpClient({ baseUrl: 'http://api.test', fetchImpl });

		const error = await failureOf(http.request('/x'));

		expect(error.status).toBe(502);
		expect(error.body).toBeUndefined();
	});

	it('reports a successful answer that is not JSON as a parse error', async () => {
		const { fetchImpl } = recordingFetch(
			async () => new Response('nope', { status: 200 }),
		);
		const http = createHttpClient({ baseUrl: 'http://api.test', fetchImpl });

		const error = await failureOf(http.request('/x'));

		expect(error.kind).toBe('parse');
	});

	it('reports a failed connection as a network error', async () => {
		const { fetchImpl } = recordingFetch(async () => {
			throw new TypeError('Network request failed');
		});
		const http = createHttpClient({ baseUrl: 'http://api.test', fetchImpl });

		const error = await failureOf(http.request('/x'));

		expect(error.kind).toBe('network');
		expect(error.isRetryable).toBe(true);
	});

	it('reports a slow answer as a timeout', async () => {
		const fetchImpl = ((_url: string, init: RequestInit) =>
			new Promise((_resolve, reject) => {
				init.signal?.addEventListener('abort', () => {
					reject(new Error('aborted'));
				});
			})) as unknown as typeof fetch;
		const http = createHttpClient({
			baseUrl: 'http://api.test',
			timeoutMs: 5,
			fetchImpl,
		});

		const error = await failureOf(http.request('/x'));

		expect(error.kind).toBe('timeout');
	});

	it('lets one request override the client timeout', async () => {
		const fetchImpl = ((_url: string, init: RequestInit) =>
			new Promise<Response>((resolve, reject) => {
				init.signal?.addEventListener('abort', () => {
					reject(new Error('aborted'));
				});
				setTimeout(() => {
					resolve(jsonResponse(200, { done: true }));
				}, 30);
			})) as unknown as typeof fetch;
		const http = createHttpClient({
			baseUrl: 'http://api.test',
			timeoutMs: 5,
			fetchImpl,
		});

		const result = await http.request<{ done: boolean }>('/x', {
			timeoutMs: 1_000,
		});

		expect(result).toEqual({ done: true });
	});

	it('reports a caller abort as aborted, not as a timeout', async () => {
		const fetchImpl = ((_url: string, init: RequestInit) =>
			new Promise((_resolve, reject) => {
				init.signal?.addEventListener('abort', () => {
					reject(new Error('aborted'));
				});
			})) as unknown as typeof fetch;
		const http = createHttpClient({
			baseUrl: 'http://api.test',
			timeoutMs: 5_000,
			fetchImpl,
		});
		const caller = new AbortController();

		const pending = failureOf(http.request('/x', { signal: caller.signal }));
		caller.abort();
		const error = await pending;

		expect(error.kind).toBe('aborted');
		expect(error.isRetryable).toBe(false);
	});

	it('aborts at once when the caller signal is already aborted', async () => {
		const fetchImpl = ((_url: string, init: RequestInit) =>
			init.signal?.aborted === true
				? Promise.reject(new Error('aborted'))
				: new Promise(() => {})) as unknown as typeof fetch;
		const http = createHttpClient({
			baseUrl: 'http://api.test',
			timeoutMs: 5_000,
			fetchImpl,
		});
		const caller = new AbortController();
		caller.abort();

		const error = await failureOf(
			http.request('/x', { signal: caller.signal }),
		);

		expect(error.kind).toBe('aborted');
	});
});
