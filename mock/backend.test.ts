import { createMockBackend } from './backend';
import type { MockBackendOptions, MockBody, MockResponse } from './backend';
import type {
	Assignment,
	OtpVerifyResponse,
} from '../src/services/api/api-types';

const ANA = 'worker-ana';
const BRUNO = 'worker-bruno';
const CARLA = 'worker-carla';

function setup(options: MockBackendOptions = {}) {
	const backend = createMockBackend(options);

	async function call(
		method: string,
		path: string,
		init: {
			token?: string;
			workerId?: string;
			body?: MockBody;
		} = {},
	): Promise<MockResponse | 'drop'> {
		const headers: Record<string, string> = {};
		if (init.token !== undefined) {
			headers.authorization = `Bearer ${init.token}`;
		}
		if (init.workerId !== undefined) {
			headers['x-worker-id'] = init.workerId;
		}
		return backend.handle({
			method,
			path,
			headers,
			body: init.body ?? { kind: 'empty' },
		});
	}

	async function ok(
		method: string,
		path: string,
		init?: Parameters<typeof call>[2],
	): Promise<MockResponse> {
		const response = await call(method, path, init);
		if (response === 'drop') {
			throw new Error('unexpected drop');
		}
		return response;
	}

	async function signIn(phone: string): Promise<OtpVerifyResponse> {
		const response = await ok('POST', '/auth/otp/verify', {
			body: { kind: 'json', value: { phone, code: '123456' } },
		});
		expect(response.status).toBe(200);
		return response.body as OtpVerifyResponse;
	}

	async function admin(
		method: string,
		path: string,
		value?: unknown,
	): Promise<MockResponse> {
		return ok(method, path, {
			body: value === undefined ? { kind: 'empty' } : { kind: 'json', value },
		});
	}

	return { backend, call, ok, signIn, admin };
}

describe('mock backend: sign-in', () => {
	it('answers 200 to an OTP request for any number', async () => {
		const { ok } = setup();
		const known = await ok('POST', '/auth/otp/request', {
			body: { kind: 'json', value: { phone: '+52 55 1000 0001' } },
		});
		const unknown = await ok('POST', '/auth/otp/request', {
			body: { kind: 'json', value: { phone: '+1 999 000 0000' } },
		});
		expect(known).toEqual({ status: 200, body: {} });
		expect(unknown).toEqual({ status: 200, body: {} });
	});

	it('lists one worker for the first phone', async () => {
		const { signIn } = setup();
		const session = await signIn('+52 55 1000 0001');
		expect(session.workers).toEqual([{ id: ANA, name: 'Ana López' }]);
		expect(session.token.length).toBeGreaterThan(8);
	});

	it('lists two workers for the shared phone', async () => {
		const { signIn } = setup();
		const session = await signIn('+52 55 1000 0002');
		expect(session.workers).toEqual([
			{ id: BRUNO, name: 'Bruno Díaz' },
			{ id: CARLA, name: 'Carla Díaz' },
		]);
	});

	it('compares phone numbers by digits only', async () => {
		const { signIn } = setup();
		const spaced = await signIn('+52 55 1000 0001');
		const compact = await signIn('+525510000001');
		expect(compact.workers).toEqual(spaced.workers);
	});

	it('sets a 24 hour expiry from the injected clock', async () => {
		const { signIn } = setup({ now: () => 1_000 });
		const session = await signIn('+525510000001');
		expect(session.expiresAt).toBe(1_000 + 24 * 60 * 60 * 1000);
	});

	it('answers 401 bad_code for a wrong code', async () => {
		const { ok } = setup();
		const response = await ok('POST', '/auth/otp/verify', {
			body: {
				kind: 'json',
				value: { phone: '+525510000001', code: '000000' },
			},
		});
		expect(response).toEqual({ status: 401, body: { error: 'bad_code' } });
	});

	it('answers 401 bad_code for an unknown number', async () => {
		const { ok } = setup();
		const response = await ok('POST', '/auth/otp/verify', {
			body: {
				kind: 'json',
				value: { phone: '+1 999 000 0000', code: '123456' },
			},
		});
		expect(response).toEqual({ status: 401, body: { error: 'bad_code' } });
	});

	it('answers 400 for a malformed verify body', async () => {
		const { ok } = setup();
		const response = await ok('POST', '/auth/otp/verify', {
			body: { kind: 'json', value: { phone: 5 } },
		});
		expect(response.status).toBe(400);
	});
});

describe('mock backend: assignment', () => {
	it('matches the seed for Ana', async () => {
		const { signIn, ok } = setup();
		const { token } = await signIn('+525510000001');
		const response = await ok('GET', '/me/assignment', {
			token,
			workerId: ANA,
		});
		const assignment = response.body as Assignment;
		expect(response.status).toBe(200);
		expect(assignment.order.id).toBe('JO-2026-0142');
		expect(assignment.currentTerms.id).toBe('terms-v2');
		expect(assignment.acceptedTermsVersionId).toBeNull();
		expect(assignment.requiredDocuments).toEqual([
			'passport',
			'ds160_confirmation',
			'signed_contract',
		]);
		expect(assignment.documents).toEqual([]);
		expect(assignment.flags).toEqual({});
	});

	it('matches the seed for Bruno', async () => {
		const { signIn, ok } = setup();
		const { token } = await signIn('+525510000002');
		const response = await ok('GET', '/me/assignment', {
			token,
			workerId: BRUNO,
		});
		const assignment = response.body as Assignment;
		expect(assignment.acceptedTermsVersionId).toBe('terms-v2');
		expect(assignment.documents).toEqual([
			{ documentType: 'passport', state: 'approved' },
		]);
	});

	it('matches the seed for Carla', async () => {
		const { signIn, ok } = setup();
		const { token } = await signIn('+525510000002');
		const response = await ok('GET', '/me/assignment', {
			token,
			workerId: CARLA,
		});
		const assignment = response.body as Assignment;
		expect(assignment.acceptedTermsVersionId).toBeNull();
		expect(assignment.documents).toEqual([
			{
				documentType: 'passport',
				state: 'correction_requested',
				reason: 'Foto borrosa, vuelva a tomarla',
			},
		]);
	});

	it('has terms v2 and v3 texts in both languages, v3 different', async () => {
		const { signIn, ok } = setup();
		const { token } = await signIn('+525510000001');
		const v2 = (
			(await ok('GET', '/me/assignment', { token, workerId: ANA }))
				.body as Assignment
		).currentTerms;
		expect(v2.summary.es.length).toBeGreaterThan(0);
		expect(v2.summary.en.length).toBeGreaterThan(0);
	});

	it('answers 403 when the worker is not on the token phone', async () => {
		const { signIn, ok } = setup();
		const { token } = await signIn('+525510000001');
		const response = await ok('GET', '/me/assignment', {
			token,
			workerId: BRUNO,
		});
		expect(response).toEqual({
			status: 403,
			body: { error: 'forbidden_worker' },
		});
	});

	it('answers 403 when the worker header is missing', async () => {
		const { signIn, ok } = setup();
		const { token } = await signIn('+525510000001');
		const response = await ok('GET', '/me/assignment', { token });
		expect(response.status).toBe(403);
	});

	it('answers 401 for a missing or unknown token', async () => {
		const { ok } = setup();
		const missing = await ok('GET', '/me/assignment', { workerId: ANA });
		const unknown = await ok('GET', '/me/assignment', {
			token: 'nope',
			workerId: ANA,
		});
		expect(missing).toEqual({
			status: 401,
			body: { error: 'session_expired' },
		});
		expect(unknown.status).toBe(401);
	});

	it('answers 401 once the token is older than 24 hours', async () => {
		let clock = 0;
		const { signIn, ok } = setup({ now: () => clock });
		const { token } = await signIn('+525510000001');
		clock = 24 * 60 * 60 * 1000;
		const response = await ok('GET', '/me/assignment', {
			token,
			workerId: ANA,
		});
		expect(response.status).toBe(401);
	});

	it('answers 404 for an unknown route', async () => {
		const { ok } = setup();
		const response = await ok('GET', '/nope');
		expect(response.status).toBe(404);
	});
});

type AdminState = {
	currentTermsVersionId: string;
	switches: { latencyMs: number; errorRate: number; dropResponse: string };
	termsAcceptances: { clientActionId: string; workerId: string }[];
	documents: {
		clientActionId: string;
		workerId: string;
		documentType: string;
	}[];
	workers: {
		id: string;
		acceptedTermsVersionId: string | null;
		documents: unknown[];
	}[];
};

function acceptance(clientActionId: string, termsVersionId: string): MockBody {
	return { kind: 'json', value: { clientActionId, termsVersionId } };
}

function upload(
	clientActionId: string,
	documentType: string,
	size = 1000,
): MockBody {
	return {
		kind: 'multipart',
		fields: { clientActionId, documentType },
		files: { image: { size } },
	};
}

async function signedIn(
	context: ReturnType<typeof setup>,
	phone: string,
	workerId: string,
) {
	const { token } = await context.signIn(phone);
	return { token, workerId };
}

async function stateOf(context: ReturnType<typeof setup>) {
	const response = await context.admin('GET', '/__admin/state');
	return response.body as AdminState;
}

async function assignmentOf(
	context: ReturnType<typeof setup>,
	auth: { token: string; workerId: string },
) {
	const response = await context.ok('GET', '/me/assignment', auth);
	return response.body as Assignment;
}

describe('mock backend: terms acceptance', () => {
	it('accepts v2 with 201 and replays with 200 and one record (M3)', async () => {
		const context = setup();
		const auth = await signedIn(context, '+525510000001', ANA);
		const first = await context.ok('POST', '/me/terms-acceptances', {
			...auth,
			body: acceptance('act-1', 'terms-v2'),
		});
		const replay = await context.ok('POST', '/me/terms-acceptances', {
			...auth,
			body: acceptance('act-1', 'terms-v2'),
		});
		expect(first.status).toBe(201);
		expect(replay.status).toBe(200);
		expect(replay.body).toEqual(first.body);
		const state = await stateOf(context);
		expect(state.termsAcceptances).toHaveLength(1);
		expect(state.termsAcceptances[0]?.clientActionId).toBe('act-1');
		expect((await assignmentOf(context, auth)).acceptedTermsVersionId).toBe(
			'terms-v2',
		);
	});

	it("M10 worker B reusing worker A's clientActionId is not served A's response", async () => {
		const context = setup();
		const ana = await signedIn(context, '+525510000001', ANA);
		const bruno = await signedIn(context, '+525510000002', BRUNO);
		await context.ok('POST', '/me/terms-acceptances', {
			...ana,
			body: acceptance('shared-id', 'terms-v2'),
		});

		const response = await context.ok('POST', '/me/terms-acceptances', {
			...bruno,
			body: acceptance('shared-id', 'terms-v2'),
		});

		expect(response.status).toBe(201);
		const state = await stateOf(context);
		expect(state.termsAcceptances.map((row) => row.workerId)).toEqual([
			ANA,
			BRUNO,
		]);
		expect(
			state.workers.find((w) => w.id === BRUNO)?.acceptedTermsVersionId,
		).toBe('terms-v2');
	});

	it('the same clientActionId on another route is a new action', async () => {
		const context = setup();
		const auth = await signedIn(context, '+525510000001', ANA);
		await context.ok('POST', '/me/terms-acceptances', {
			...auth,
			body: acceptance('same-id', 'terms-v2'),
		});

		const response = await context.ok('POST', '/me/documents', {
			...auth,
			body: upload('same-id', 'passport'),
		});

		expect(response.status).toBe(201);
		expect((await stateOf(context)).documents).toHaveLength(1);
	});

	it('answers 409 with the current terms after publish and saves nothing (M6)', async () => {
		const context = setup();
		const auth = await signedIn(context, '+525510000001', ANA);
		await context.admin('POST', '/__admin/publish-terms');
		const response = await context.ok('POST', '/me/terms-acceptances', {
			...auth,
			body: acceptance('act-2', 'terms-v2'),
		});
		const body = response.body as {
			error: string;
			currentTerms: { id: string; version: number };
		};
		expect(response.status).toBe(409);
		expect(body.error).toBe('stale_terms');
		expect(body.currentTerms.id).toBe('terms-v3');
		const state = await stateOf(context);
		expect(state.termsAcceptances).toHaveLength(0);
		expect(
			state.workers.find((w) => w.id === ANA)?.acceptedTermsVersionId,
		).toBeNull();
	});

	it('accepts v3 after publish', async () => {
		const context = setup();
		const auth = await signedIn(context, '+525510000001', ANA);
		await context.admin('POST', '/__admin/publish-terms');
		const response = await context.ok('POST', '/me/terms-acceptances', {
			...auth,
			body: acceptance('act-3', 'terms-v3'),
		});
		expect(response.status).toBe(201);
	});

	it('replays a saved acceptance even when its version is now stale', async () => {
		const context = setup();
		const auth = await signedIn(context, '+525510000001', ANA);
		await context.ok('POST', '/me/terms-acceptances', {
			...auth,
			body: acceptance('act-4', 'terms-v2'),
		});
		await context.admin('POST', '/__admin/publish-terms');
		const replay = await context.ok('POST', '/me/terms-acceptances', {
			...auth,
			body: acceptance('act-4', 'terms-v2'),
		});
		expect(replay.status).toBe(200);
	});

	it('serves different v2 and v3 texts in both languages', async () => {
		const context = setup();
		const auth = await signedIn(context, '+525510000001', ANA);
		const before = (await assignmentOf(context, auth)).currentTerms;
		await context.admin('POST', '/__admin/publish-terms');
		const after = (await assignmentOf(context, auth)).currentTerms;
		expect(before.version).toBe(2);
		expect(after.version).toBe(3);
		expect(after.summary.es).not.toBe(before.summary.es);
		expect(after.summary.en).not.toBe(before.summary.en);
	});

	it('answers 400 for a malformed body', async () => {
		const context = setup();
		const auth = await signedIn(context, '+525510000001', ANA);
		const response = await context.ok('POST', '/me/terms-acceptances', {
			...auth,
			body: { kind: 'json', value: { clientActionId: 'x' } },
		});
		expect(response.status).toBe(400);
	});
});

describe('mock backend: documents', () => {
	it('accepts an upload with 201, replays with 200 and keeps one record (M3)', async () => {
		const context = setup();
		const auth = await signedIn(context, '+525510000001', ANA);
		const first = await context.ok('POST', '/me/documents', {
			...auth,
			body: upload('doc-1', 'passport'),
		});
		const replay = await context.ok('POST', '/me/documents', {
			...auth,
			body: upload('doc-1', 'passport'),
		});
		expect(first).toEqual({ status: 201, body: { state: 'pending_review' } });
		expect(replay).toEqual({ status: 200, body: { state: 'pending_review' } });
		const state = await stateOf(context);
		expect(state.documents).toHaveLength(1);
		expect((await assignmentOf(context, auth)).documents).toEqual([
			{ documentType: 'passport', state: 'pending_review' },
		]);
	});

	it('answers 413 for an image over 1 572 864 bytes and saves nothing (M7)', async () => {
		const context = setup();
		const auth = await signedIn(context, '+525510000001', ANA);
		const tooLarge = await context.ok('POST', '/me/documents', {
			...auth,
			body: upload('doc-2', 'passport', 1_572_865),
		});
		const exact = await context.ok('POST', '/me/documents', {
			...auth,
			body: upload('doc-3', 'passport', 1_572_864),
		});
		expect(tooLarge).toEqual({ status: 413, body: { error: 'too_large' } });
		expect(exact.status).toBe(201);
		expect((await stateOf(context)).documents).toHaveLength(1);
	});

	it('answers 422 for a type outside the catalog (M7)', async () => {
		const context = setup();
		const auth = await signedIn(context, '+525510000001', ANA);
		const response = await context.ok('POST', '/me/documents', {
			...auth,
			body: upload('doc-4', 'selfie'),
		});
		expect(response).toEqual({
			status: 422,
			body: { error: 'unknown_document_type' },
		});
		expect((await stateOf(context)).documents).toHaveLength(0);
	});

	it('answers 400 when the image part is missing', async () => {
		const context = setup();
		const auth = await signedIn(context, '+525510000001', ANA);
		const response = await context.ok('POST', '/me/documents', {
			...auth,
			body: {
				kind: 'multipart',
				fields: { clientActionId: 'doc-5', documentType: 'passport' },
				files: {},
			},
		});
		expect(response.status).toBe(400);
	});

	it('creates a new record on resubmission after a correction (M8)', async () => {
		const context = setup();
		const auth = await signedIn(context, '+525510000002', CARLA);
		const response = await context.ok('POST', '/me/documents', {
			...auth,
			body: upload('doc-6', 'passport'),
		});
		expect(response.status).toBe(201);
		const state = await stateOf(context);
		expect(state.documents).toHaveLength(1);
		expect(state.documents[0]?.workerId).toBe(CARLA);
		expect((await assignmentOf(context, auth)).documents).toEqual([
			{ documentType: 'passport', state: 'pending_review' },
		]);
	});

	it('accepts a second upload for an approved document as a new record', async () => {
		const context = setup();
		const auth = await signedIn(context, '+525510000002', BRUNO);
		const response = await context.ok('POST', '/me/documents', {
			...auth,
			body: upload('doc-7', 'passport'),
		});
		expect(response.status).toBe(201);
	});

	it('keeps workers who share a phone separate (M10)', async () => {
		const context = setup();
		const bruno = await signedIn(context, '+525510000002', BRUNO);
		const carla = { token: bruno.token, workerId: CARLA };
		await context.ok('POST', '/me/documents', {
			...carla,
			body: upload('doc-8', 'ds160_confirmation'),
		});
		const brunoDocs = (await assignmentOf(context, bruno)).documents;
		expect(brunoDocs).toEqual([
			{ documentType: 'passport', state: 'approved' },
		]);
	});
});

describe('mock backend: reset', () => {
	it('clears records and dedupe, restores seed and terms v2, keeps sessions', async () => {
		const context = setup();
		const auth = await signedIn(context, '+525510000002', CARLA);
		await context.admin('POST', '/__admin/publish-terms');
		await context.ok('POST', '/me/terms-acceptances', {
			...auth,
			body: acceptance('act-9', 'terms-v3'),
		});
		await context.ok('POST', '/me/documents', {
			...auth,
			body: upload('doc-9', 'passport'),
		});
		await context.admin('POST', '/__admin/reset');
		const state = await stateOf(context);
		expect(state.currentTermsVersionId).toBe('terms-v2');
		expect(state.termsAcceptances).toHaveLength(0);
		expect(state.documents).toHaveLength(0);
		const assignment = await assignmentOf(context, auth);
		expect(assignment.acceptedTermsVersionId).toBeNull();
		expect(assignment.documents[0]?.state).toBe('correction_requested');
		const again = await context.ok('POST', '/me/terms-acceptances', {
			...auth,
			body: acceptance('act-9', 'terms-v2'),
		});
		expect(again.status).toBe(201);
	});
});

describe('mock backend: failure switches', () => {
	it('saves the action, drops the response once, and the retry replays with 200 (M3)', async () => {
		const context = setup({ switches: { dropResponse: 'next' } });
		const auth = await signedIn(context, '+525510000001', ANA);
		const dropped = await context.call('POST', '/me/terms-acceptances', {
			...auth,
			body: acceptance('act-d1', 'terms-v2'),
		});
		expect(dropped).toBe('drop');
		expect((await stateOf(context)).termsAcceptances).toHaveLength(1);
		expect((await stateOf(context)).switches.dropResponse).toBe('off');
		const retry = await context.ok('POST', '/me/terms-acceptances', {
			...auth,
			body: acceptance('act-d1', 'terms-v2'),
		});
		expect(retry.status).toBe(200);
		expect((await stateOf(context)).termsAcceptances).toHaveLength(1);
	});

	it('drops a document upload after saving it', async () => {
		const context = setup();
		const auth = await signedIn(context, '+525510000001', ANA);
		await context.admin('POST', '/__admin/switches', { dropResponse: 'next' });
		const dropped = await context.call('POST', '/me/documents', {
			...auth,
			body: upload('doc-d1', 'passport'),
		});
		expect(dropped).toBe('drop');
		expect((await stateOf(context)).documents).toHaveLength(1);
		const retry = await context.ok('POST', '/me/documents', {
			...auth,
			body: upload('doc-d1', 'passport'),
		});
		expect(retry.status).toBe(200);
		expect((await stateOf(context)).documents).toHaveLength(1);
	});

	it('does not arm on GET and keeps next armed', async () => {
		const context = setup({ switches: { dropResponse: 'next' } });
		const auth = await signedIn(context, '+525510000001', ANA);
		const read = await context.ok('GET', '/me/assignment', auth);
		expect(read.status).toBe(200);
		expect((await stateOf(context)).switches.dropResponse).toBe('next');
	});

	it('drops every save with always', async () => {
		const context = setup({ switches: { dropResponse: 'always' } });
		const auth = await signedIn(context, '+525510000001', ANA);
		const first = await context.call('POST', '/me/terms-acceptances', {
			...auth,
			body: acceptance('act-d2', 'terms-v2'),
		});
		const second = await context.call('POST', '/me/documents', {
			...auth,
			body: upload('doc-d2', 'passport'),
		});
		expect(first).toBe('drop');
		expect(second).toBe('drop');
		expect((await stateOf(context)).switches.dropResponse).toBe('always');
	});

	it('never drops a replay or a rejected request', async () => {
		const context = setup();
		const auth = await signedIn(context, '+525510000001', ANA);
		await context.ok('POST', '/me/terms-acceptances', {
			...auth,
			body: acceptance('act-d3', 'terms-v2'),
		});
		await context.admin('POST', '/__admin/switches', { dropResponse: 'next' });
		const replay = await context.call('POST', '/me/terms-acceptances', {
			...auth,
			body: acceptance('act-d3', 'terms-v2'),
		});
		const rejected = await context.call('POST', '/me/documents', {
			...auth,
			body: upload('doc-d3', 'selfie'),
		});
		expect(replay).not.toBe('drop');
		expect(rejected).not.toBe('drop');
		expect((await stateOf(context)).switches.dropResponse).toBe('next');
	});

	it('answers 500 before touching state when errorRate is 1', async () => {
		const context = setup();
		const auth = await signedIn(context, '+525510000001', ANA);
		await context.admin('POST', '/__admin/switches', { errorRate: 1 });
		const response = await context.ok('POST', '/me/terms-acceptances', {
			...auth,
			body: acceptance('act-e1', 'terms-v2'),
		});
		expect(response.status).toBe(500);
		const read = await context.ok('GET', '/me/assignment', auth);
		expect(read.status).toBe(500);
		await context.admin('POST', '/__admin/switches', { errorRate: 0 });
		const state = await stateOf(context);
		expect(state.termsAcceptances).toHaveLength(0);
		expect(
			state.workers.find((w) => w.id === ANA)?.acceptedTermsVersionId,
		).toBeNull();
	});

	it('uses the injected random for errorRate and never fails admin routes', async () => {
		const values = [0.1, 0.9];
		const context = setup({
			random: () => values.shift() ?? 0.5,
			switches: { errorRate: 0.5 },
		});
		const failing = await context.ok('POST', '/auth/otp/request');
		const passing = await context.ok('POST', '/auth/otp/request');
		const admin = await context.admin('GET', '/__admin/state');
		expect(failing.status).toBe(500);
		expect(passing.status).toBe(200);
		expect(admin.status).toBe(200);
	});

	it('exposes latency through switches() and validates switch values', async () => {
		const context = setup({ switches: { latencyMs: 40 } });
		expect(context.backend.switches().latencyMs).toBe(40);
		await context.admin('POST', '/__admin/switches', { latencyMs: 5 });
		expect(context.backend.switches().latencyMs).toBe(5);
		const bad = await context.admin('POST', '/__admin/switches', {
			dropResponse: 'sometimes',
		});
		expect(bad.status).toBe(400);
		const badRate = await context.admin('POST', '/__admin/switches', {
			errorRate: 2,
		});
		expect(badRate.status).toBe(400);
		expect(context.backend.switches().latencyMs).toBe(5);
	});

	it('lowers the image limit with maxImageBytes so a small photo gets 413', async () => {
		const context = setup();
		const auth = await signedIn(context, '+525510000001', ANA);
		await context.admin('POST', '/__admin/switches', { maxImageBytes: 100 });
		const tooLarge = await context.ok('POST', '/me/documents', {
			...auth,
			body: upload('doc-5', 'passport', 101),
		});
		const bad = await context.admin('POST', '/__admin/switches', {
			maxImageBytes: -1,
		});
		expect(tooLarge).toEqual({ status: 413, body: { error: 'too_large' } });
		expect(bad.status).toBe(400);
		expect((await stateOf(context)).documents).toHaveLength(0);
	});

	it('starts on terms v3 when publishV3 is set', async () => {
		const context = setup({ publishV3: true });
		expect((await stateOf(context)).currentTermsVersionId).toBe('terms-v3');
	});

	it('makes every existing token answer 401 session_expired, new tokens still work', async () => {
		const context = setup();
		const auth = await signedIn(context, '+525510000001', ANA);
		await context.admin('POST', '/__admin/expire-tokens');
		const expired = await context.ok('GET', '/me/assignment', auth);
		expect(expired).toEqual({
			status: 401,
			body: { error: 'session_expired' },
		});
		const fresh = await signedIn(context, '+525510000001', ANA);
		const response = await context.ok('GET', '/me/assignment', fresh);
		expect(response.status).toBe(200);
	});

	it('reset restores switches and keeps sessions', async () => {
		const context = setup();
		const auth = await signedIn(context, '+525510000001', ANA);
		await context.admin('POST', '/__admin/switches', {
			latencyMs: 9,
			errorRate: 1,
			dropResponse: 'always',
			maxImageBytes: 10,
		});
		await context.admin('POST', '/__admin/reset');
		expect((await stateOf(context)).switches).toEqual({
			latencyMs: 0,
			errorRate: 0,
			dropResponse: 'off',
			maxImageBytes: 1_572_864,
		});
		expect((await context.ok('GET', '/me/assignment', auth)).status).toBe(200);
	});
});
