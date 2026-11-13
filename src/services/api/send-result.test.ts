import type { TermsVersion } from '@/services/api/api-types';
import { sendResultFor } from '@/services/api/send-result';
import type { SendResult } from '@/services/sync/sync-types';

const terms: TermsVersion = {
	id: 'terms-v3',
	version: 3,
	publishedAt: '2026-05-04T09:00:00.000Z',
	summary: { es: 'v3', en: 'v3' },
};

const response = (status: number, body: unknown = {}) =>
	({ kind: 'response', status, body }) as const;

const rows: {
	name: string;
	outcome: Parameters<typeof sendResultFor>[0];
	result: SendResult;
}[] = [
	{
		name: '201',
		outcome: response(201),
		result: { kind: 'delivered', replay: false },
	},
	{
		name: '200 replay',
		outcome: response(200),
		result: { kind: 'delivered', replay: true },
	},
	{
		name: '409 stale terms',
		outcome: response(409, { error: 'stale_terms', currentTerms: terms }),
		result: { kind: 'stale_terms', currentTerms: terms },
	},
	{
		name: '409 with an invalid body',
		outcome: response(409, { error: 'stale_terms' }),
		result: { kind: 'rejected', reason: 'rejected' },
	},
	{
		name: '409 with a different error',
		outcome: response(409, { error: 'other', currentTerms: terms }),
		result: { kind: 'rejected', reason: 'rejected' },
	},
	{
		name: '409 with a malformed terms version',
		outcome: response(409, {
			error: 'stale_terms',
			currentTerms: { id: 'terms-v3' },
		}),
		result: { kind: 'rejected', reason: 'rejected' },
	},
	{
		name: '409 with no body',
		outcome: response(409, undefined),
		result: { kind: 'rejected', reason: 'rejected' },
	},
	{
		name: '413',
		outcome: response(413),
		result: { kind: 'rejected', reason: 'too_large' },
	},
	{
		name: '422',
		outcome: response(422),
		result: { kind: 'rejected', reason: 'unknown_document_type' },
	},
	{ name: '401', outcome: response(401), result: { kind: 'unauthorized' } },
	{ name: '403', outcome: response(403), result: { kind: 'unauthorized' } },
	{ name: '408', outcome: response(408), result: { kind: 'retryable' } },
	{ name: '429', outcome: response(429), result: { kind: 'retryable' } },
	{ name: '500', outcome: response(500), result: { kind: 'retryable' } },
	{ name: '503', outcome: response(503), result: { kind: 'retryable' } },
	{
		name: '400',
		outcome: response(400),
		result: { kind: 'rejected', reason: 'rejected' },
	},
	{
		name: '404',
		outcome: response(404),
		result: { kind: 'rejected', reason: 'rejected' },
	},
	{
		name: 'an unexpected 204',
		outcome: response(204),
		result: { kind: 'retryable' },
	},
	{ name: 'a redirect', outcome: response(302), result: { kind: 'retryable' } },
	{
		name: 'network error or timeout',
		outcome: { kind: 'network_error' },
		result: { kind: 'unreachable' },
	},
];

describe('sendResultFor', () => {
	for (const row of rows) {
		it(`maps ${row.name}`, () => {
			expect(sendResultFor(row.outcome)).toEqual(row.result);
		});
	}
});
