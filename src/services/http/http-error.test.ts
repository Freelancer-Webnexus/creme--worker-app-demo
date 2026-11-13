import { HttpError, kindForStatus } from './http-error';

describe('kindForStatus', () => {
	it('separates client and server failures', () => {
		expect(kindForStatus(404)).toBe('client');
		expect(kindForStatus(422)).toBe('client');
		expect(kindForStatus(500)).toBe('server');
		expect(kindForStatus(503)).toBe('server');
	});
});

describe('HttpError', () => {
	it('marks transient failures retryable', () => {
		for (const kind of ['network', 'timeout', 'server'] as const) {
			expect(new HttpError({ kind, message: 'x', url: '/x' }).isRetryable).toBe(
				true,
			);
		}
	});

	it('does not retry a request the server already rejected', () => {
		for (const kind of ['client', 'parse', 'aborted'] as const) {
			expect(new HttpError({ kind, message: 'x', url: '/x' }).isRetryable).toBe(
				false,
			);
		}
	});
});
