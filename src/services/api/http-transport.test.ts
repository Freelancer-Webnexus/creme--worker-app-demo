import { createHttpTransport } from '@/services/api/http-transport';
import { createHttpClient, type HttpClient } from '@/services/http/http-client';
import type { QueuedAction } from '@/services/sync/sync-types';

type Call = { url: string; init: RequestInit };

const transportWith = (respond: () => Promise<Response>) => {
	const calls: Call[] = [];
	const fetchImpl = ((url: string, init: RequestInit) => {
		calls.push({ url, init });
		return respond();
	}) as unknown as typeof fetch;
	const http = createHttpClient({ baseUrl: 'http://api.test', fetchImpl });
	const transport = createHttpTransport({
		http,
		fileBody: (fileUri) => new Blob([fileUri], { type: 'image/jpeg' }),
	});
	return { calls, transport };
};

const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), { status });

const terms: QueuedAction = {
	clientActionId: 'a1',
	workerId: 'worker-ana',
	kind: { type: 'terms_acceptance', termsVersionId: 'terms-v2' },
	status: { kind: 'queued' },
	createdAt: 1,
	attempts: 0,
	nextAttemptAt: 0,
};

const upload: QueuedAction = {
	...terms,
	clientActionId: 'a2',
	kind: {
		type: 'document_upload',
		documentType: 'passport',
		fileUri: 'file:///uploads/p.jpg',
	},
};

describe('http transport', () => {
	it('posts a terms acceptance as JSON with the session headers', async () => {
		const { transport, calls } = transportWith(async () => json(201, {}));

		const result = await transport.send(terms, 'tok');

		expect(result).toEqual({ kind: 'delivered', replay: false });
		expect(calls[0]?.url).toBe('http://api.test/me/terms-acceptances');
		expect(calls[0]?.init.method).toBe('POST');
		expect(JSON.parse(calls[0]?.init.body as string)).toEqual({
			clientActionId: 'a1',
			termsVersionId: 'terms-v2',
		});
		expect(calls[0]?.init.headers).toMatchObject({
			authorization: 'Bearer tok',
			'x-worker-id': 'worker-ana',
		});
	});

	it('posts a document as multipart with the three parts', async () => {
		const { transport, calls } = transportWith(async () =>
			json(201, { state: 'pending_review' }),
		);

		const result = await transport.send(upload, 'tok');

		expect(result).toEqual({ kind: 'delivered', replay: false });
		expect(calls[0]?.url).toBe('http://api.test/me/documents');
		const form = calls[0]?.init.body as FormData;
		expect(form.get('clientActionId')).toBe('a2');
		expect(form.get('documentType')).toBe('passport');
		const image = form.get('image') as unknown as Blob;
		expect(await image.text()).toBe('file:///uploads/p.jpg');
		const headers = calls[0]?.init.headers as Record<string, string>;
		expect(headers['content-type']).toBeUndefined();
	});

	it('M5 rejects an upload whose local file is gone instead of retrying forever', async () => {
		const calls: Call[] = [];
		const fetchImpl = ((url: string, init: RequestInit) => {
			calls.push({ url, init });
			return Promise.resolve(json(201, {}));
		}) as unknown as typeof fetch;
		const transport = createHttpTransport({
			http: createHttpClient({ baseUrl: 'http://api.test', fetchImpl }),
			fileBody: () => null,
		});

		expect(await transport.send(upload, 'tok')).toEqual({
			kind: 'rejected',
			reason: 'rejected',
		});
		expect(calls).toHaveLength(0);
	});

	it('maps a replay to delivered with replay true', async () => {
		const { transport } = transportWith(async () => json(200, {}));

		expect(await transport.send(terms, 'tok')).toEqual({
			kind: 'delivered',
			replay: true,
		});
	});

	it('M2 retries a 2xx with a body that is not JSON instead of trusting it', async () => {
		const { transport } = transportWith(
			async () => new Response('<html>Wi-Fi login</html>', { status: 200 }),
		);

		expect(await transport.send(upload, 'tok')).toEqual({ kind: 'retryable' });
	});

	it('maps a 409 body to stale_terms', async () => {
		const currentTerms = {
			id: 'terms-v3',
			version: 3,
			publishedAt: 'x',
			summary: { es: 'a', en: 'b' },
		};
		const { transport } = transportWith(async () =>
			json(409, { error: 'stale_terms', currentTerms }),
		);

		expect(await transport.send(terms, 'tok')).toEqual({
			kind: 'stale_terms',
			currentTerms,
		});
	});

	it('maps statuses through the table', async () => {
		const expected: [number, string][] = [
			[413, 'rejected'],
			[401, 'unauthorized'],
			[500, 'retryable'],
		];
		for (const [status, kind] of expected) {
			const { transport } = transportWith(async () => json(status, {}));

			expect((await transport.send(upload, 'tok')).kind).toBe(kind);
		}
	});

	it('maps a dropped connection to unreachable', async () => {
		const { transport } = transportWith(async () => {
			throw new TypeError('Network request failed');
		});

		expect(await transport.send(terms, 'tok')).toEqual({ kind: 'unreachable' });
	});

	it('asks for the upload timeout on an upload only', async () => {
		const seen: (number | undefined)[] = [];
		const http = {
			requestWithStatus: async (
				_path: string,
				options: { timeoutMs?: number },
			) => {
				seen.push(options.timeoutMs);
				return { status: 201, body: {} };
			},
		} as unknown as HttpClient;
		const transport = createHttpTransport({
			http,
			fileBody: () => new Blob(['x']),
			uploadTimeoutMs: 60_000,
		});

		await transport.send(terms, 't');
		await transport.send(upload, 't');

		expect(seen).toEqual([undefined, 60_000]);
	});
});
