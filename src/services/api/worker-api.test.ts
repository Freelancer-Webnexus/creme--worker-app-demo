import type { Assignment, OtpVerifyResponse } from '@/services/api/api-types';
import { createWorkerApi } from '@/services/api/worker-api';
import { createHttpClient } from '@/services/http/http-client';

type Call = { url: string; init: RequestInit };

const apiWith = (respond: () => Promise<Response>) => {
	const calls: Call[] = [];
	const fetchImpl = ((url: string, init: RequestInit) => {
		calls.push({ url, init });
		return respond();
	}) as unknown as typeof fetch;
	const http = createHttpClient({ baseUrl: 'http://api.test', fetchImpl });
	return { calls, api: createWorkerApi({ http }) };
};

const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), { status });

const session: OtpVerifyResponse = {
	token: 'tok',
	expiresAt: 5,
	workers: [{ id: 'worker-ana', name: 'Ana López' }],
};

describe('worker api', () => {
	it('requests a code', async () => {
		const { api, calls } = apiWith(async () => json(200, {}));

		expect(await api.requestOtp('+52 55 1000 0001')).toEqual({ kind: 'ok' });
		expect(calls[0]?.url).toBe('http://api.test/auth/otp/request');
		expect(calls[0]?.init.body).toBe('{"phone":"+52 55 1000 0001"}');
	});

	it('reports a code request that got no response as a network error', async () => {
		const { api } = apiWith(async () => {
			throw new TypeError('Network request failed');
		});

		expect(await api.requestOtp('1')).toEqual({ kind: 'network_error' });
	});

	it('reports a failed code request as a server error, not a network error', async () => {
		const { api } = apiWith(async () => json(503, {}));

		expect(await api.requestOtp('1')).toEqual({ kind: 'server_error' });
	});

	it('verifies a code and returns the session', async () => {
		const { api, calls } = apiWith(async () => json(200, session));

		const result = await api.verifyOtp('+52 55 1000 0001', '123456');

		expect(result).toEqual({ kind: 'ok', session });
		expect(calls[0]?.url).toBe('http://api.test/auth/otp/verify');
		expect(calls[0]?.init.body).toBe(
			'{"phone":"+52 55 1000 0001","code":"123456"}',
		);
	});

	it('maps a 401 on verify to bad_code', async () => {
		const { api } = apiWith(async () => json(401, { error: 'bad_code' }));

		expect(await api.verifyOtp('1', '0')).toEqual({ kind: 'bad_code' });
	});

	it('maps a connection failure on verify to network_error', async () => {
		const { api } = apiWith(async () => {
			throw new TypeError('Network request failed');
		});

		expect(await api.verifyOtp('1', '0')).toEqual({ kind: 'network_error' });
	});

	it.each([500, 502, 408, 429])(
		'maps a %i on verify to server_error',
		async (status) => {
			const { api } = apiWith(async () => json(status, {}));

			expect(await api.verifyOtp('1', '0')).toEqual({ kind: 'server_error' });
		},
	);

	it('maps a 200 that is not JSON to server_error on every call', async () => {
		const html = () => Promise.resolve(new Response('<html>', { status: 200 }));

		expect(await apiWith(html).api.requestOtp('1')).toEqual({
			kind: 'server_error',
		});
		expect(await apiWith(html).api.verifyOtp('1', '0')).toEqual({
			kind: 'server_error',
		});
		expect(await apiWith(html).api.fetchAssignment('t', 'w')).toEqual({
			kind: 'server_error',
		});
	});

	it('fetches the assignment with the token and worker id', async () => {
		const assignment = { flags: {} } as unknown as Assignment;
		const { api, calls } = apiWith(async () => json(200, assignment));

		const result = await api.fetchAssignment('tok', 'worker-ana');

		expect(result).toEqual({ kind: 'ok', assignment });
		expect(calls[0]?.url).toBe('http://api.test/me/assignment');
		expect(calls[0]?.init.headers).toMatchObject({
			authorization: 'Bearer tok',
			'x-worker-id': 'worker-ana',
		});
	});

	it('maps 401 and 403 on the assignment to unauthorized', async () => {
		for (const status of [401, 403]) {
			const { api } = apiWith(async () => json(status, {}));

			expect(await api.fetchAssignment('tok', 'w')).toEqual({
				kind: 'unauthorized',
			});
		}
	});

	it.each([500, 502, 408, 429])(
		'maps a %i on the assignment to server_error',
		async (status) => {
			const { api } = apiWith(async () => json(status, {}));

			expect(await api.fetchAssignment('tok', 'w')).toEqual({
				kind: 'server_error',
			});
		},
	);

	it('maps a missing connection on the assignment to network_error', async () => {
		const { api } = apiWith(async () => {
			throw new TypeError('Network request failed');
		});

		expect(await api.fetchAssignment('tok', 'w')).toEqual({
			kind: 'network_error',
		});
	});
});
