import { HttpError, kindForStatus } from '@/services/http/http-error';

export type HttpClientOptions = {
	baseUrl: string;
	defaultHeaders?: Record<string, string>;
	/** Milliseconds before a request is aborted. */
	timeoutMs?: number;
	fetchImpl?: typeof fetch;
};

export type RequestOptions = {
	body?: unknown;
	headers?: Record<string, string>;
	method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
	signal?: AbortSignal;
	timeoutMs?: number;
};

/** A success keeps its status: 201 and 200 (a replay) mean different things. */
export type HttpResult<TResponse> = { status: number; body: TResponse };

const DEFAULT_TIMEOUT_MS = 15_000;

const joinUrl = (baseUrl: string, path: string): string => {
	if (/^https?:\/\//.test(path)) {
		return path;
	}
	return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
};

const encodeBody = (body: unknown): BodyInit | undefined => {
	if (body === undefined) {
		return undefined;
	}
	return body instanceof FormData ? body : JSON.stringify(body);
};

const contentTypeFor = (body: unknown): Record<string, string> => {
	if (body === undefined || body instanceof FormData) {
		return {};
	}
	return { 'content-type': 'application/json' };
};

const readJson = async (response: Response): Promise<unknown> => {
	try {
		return (await response.json()) as unknown;
	} catch {
		return undefined;
	}
};

/**
 * The one place the app calls the network. ESLint bans `fetch` everywhere else
 * (see ARCHITECTURE.md), so every failure arrives as an HttpError with a kind the
 * caller can branch on instead of an unknown.
 */
export const createHttpClient = (options: HttpClientOptions) => {
	const defaultTimeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const fetchImpl = options.fetchImpl ?? fetch;

	const requestWithStatus = async <TResponse>(
		path: string,
		requestOptions: RequestOptions = {},
	): Promise<HttpResult<TResponse>> => {
		const url = joinUrl(options.baseUrl, path);
		const timeoutMs = requestOptions.timeoutMs ?? defaultTimeoutMs;
		const controller = new AbortController();
		const timeout = setTimeout(() => {
			controller.abort();
		}, timeoutMs);
		const callerSignal = requestOptions.signal;
		const abortFromCaller = () => {
			controller.abort();
		};
		if (callerSignal?.aborted === true) {
			controller.abort();
		}
		callerSignal?.addEventListener('abort', abortFromCaller);

		const exchange = (async (): Promise<HttpResult<TResponse>> => {
			let response: Response;
			try {
				response = await fetchImpl(url, {
					body: encodeBody(requestOptions.body),
					headers: {
						accept: 'application/json',
						...contentTypeFor(requestOptions.body),
						...options.defaultHeaders,
						...requestOptions.headers,
					},
					method: requestOptions.method ?? 'GET',
					signal: controller.signal,
				});
			} catch (reason) {
				// Derived, not stored: the caller's signal says "aborted", our own
				// timer is the only other thing that aborts the controller, and a
				// failure with no abort at all is the network.
				const callerAborted = callerSignal?.aborted === true;
				const timedOut = controller.signal.aborted && !callerAborted;
				if (callerAborted) {
					throw new HttpError({
						kind: 'aborted',
						message: 'Request aborted.',
						reason,
						url,
					});
				}
				throw new HttpError({
					kind: timedOut ? 'timeout' : 'network',
					message: timedOut
						? `Request timed out after ${timeoutMs}ms.`
						: 'Network request failed.',
					reason,
					url,
				});
			}

			if (!response.ok) {
				throw new HttpError({
					kind: kindForStatus(response.status),
					message: `Request failed with ${response.status}.`,
					status: response.status,
					body: await readJson(response),
					url,
				});
			}

			if (response.status === 204) {
				return { status: 204, body: undefined as TResponse };
			}

			try {
				return {
					status: response.status,
					body: (await response.json()) as TResponse,
				};
			} catch (reason) {
				throw new HttpError({
					kind: 'parse',
					message: 'Response was not valid JSON.',
					reason,
					status: response.status,
					url,
				});
			}
		})();

		return exchange.finally(() => {
			clearTimeout(timeout);
			callerSignal?.removeEventListener('abort', abortFromCaller);
		});
	};

	const request = async <TResponse>(
		path: string,
		requestOptions: RequestOptions = {},
	): Promise<TResponse> =>
		(await requestWithStatus<TResponse>(path, requestOptions)).body;

	return { request, requestWithStatus };
};

export type HttpClient = ReturnType<typeof createHttpClient>;
