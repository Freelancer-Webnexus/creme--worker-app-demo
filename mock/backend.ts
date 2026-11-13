import {
	REQUIRED_DOCUMENTS,
	SEED_CODE,
	SEED_ORDER,
	SEED_WORKERS,
	TERMS_V2,
	TERMS_V3,
} from './seed';
import type { SeedWorker } from './seed';
import type {
	Assignment,
	OtpVerifyResponse,
	ServerDocument,
	StaleTermsBody,
	TermsVersion,
} from '../src/services/api/api-types';

export type MockBody =
	| { kind: 'empty' }
	| { kind: 'json'; value: unknown }
	| {
			kind: 'multipart';
			fields: Record<string, string>;
			files: Record<string, { size: number }>;
	  };

export type MockRequest = {
	method: string;
	path: string;
	/** Header names in lower case. */
	headers: Record<string, string>;
	body: MockBody;
};

export type MockResponse = { status: number; body: unknown };

export type DropMode = 'off' | 'next' | 'always';

export type Switches = {
	latencyMs: number;
	errorRate: number;
	dropResponse: DropMode;
	/** Largest accepted image. Lowering it forces a 413 without a large photo. */
	maxImageBytes: number;
};

export type MockBackendOptions = {
	random?: () => number;
	now?: () => number;
	switches?: Partial<Switches>;
	publishV3?: boolean;
};

export type MockBackend = {
	handle: (request: MockRequest) => Promise<MockResponse | 'drop'>;
	switches: () => Switches;
};

const SESSION_MS = 24 * 60 * 60 * 1000;

type Session = { phoneDigits: string; expiresAt: number };

type Authenticated =
	| { kind: 'denied'; response: MockResponse }
	| { kind: 'allowed'; worker: SeedWorker };

type TermsAcceptanceRecord = {
	clientActionId: string;
	workerId: string;
	termsVersionId: string;
	acceptedAt: string;
};

type DocumentRecord = {
	clientActionId: string;
	workerId: string;
	documentType: string;
	imageBytes: number;
	submittedAt: string;
};

/** `saved` is true only when the request created a new record. */
type Outcome = { response: MockResponse; saved: boolean };

const MAX_IMAGE_BYTES = 1_572_864;

function reply(status: number, body: unknown): MockResponse {
	return { status, body };
}

function unsaved(response: MockResponse): Outcome {
	return { response, saved: false };
}

function clientActionIdOf(request: MockRequest): string | null {
	switch (request.body.kind) {
		case 'json': {
			const value = request.body.value;
			return isRecord(value) && typeof value.clientActionId === 'string'
				? value.clientActionId
				: null;
		}
		case 'multipart':
			return request.body.fields.clientActionId ?? null;
		case 'empty':
			return null;
	}
}

function digitsOf(phone: string): string {
	return phone.replace(/\D/g, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonObject(request: MockRequest): Record<string, unknown> | null {
	if (request.body.kind !== 'json' || !isRecord(request.body.value)) {
		return null;
	}
	return request.body.value;
}

function seedWorkers(): SeedWorker[] {
	return structuredClone(SEED_WORKERS);
}

export function createMockBackend(
	options: MockBackendOptions = {},
): MockBackend {
	const random = options.random ?? Math.random;
	const now = options.now ?? Date.now;

	const sessions = new Map<string, Session>();
	let workers = seedWorkers();
	let currentTerms: TermsVersion = options.publishV3 ? TERMS_V3 : TERMS_V2;
	let switches: Switches = {
		latencyMs: options.switches?.latencyMs ?? 0,
		errorRate: options.switches?.errorRate ?? 0,
		dropResponse: options.switches?.dropResponse ?? 'off',
		maxImageBytes: options.switches?.maxImageBytes ?? MAX_IMAGE_BYTES,
	};
	let tokenCounter = 0;
	let termsAcceptances: TermsAcceptanceRecord[] = [];
	let documentRecords: DocumentRecord[] = [];
	// M3, M10: the saved response body of every (worker, route, clientActionId).
	const dedupe = new Map<string, unknown>();

	function dedupeKey(
		worker: SeedWorker,
		route: string,
		clientActionId: string,
	): string {
		return JSON.stringify([worker.id, route, clientActionId]);
	}

	function newToken(): string {
		tokenCounter += 1;
		const noise = Math.floor(random() * 0xffffffff).toString(16);
		return `mock-${tokenCounter}-${noise}`;
	}

	function requestOtp(): MockResponse {
		return reply(200, {});
	}

	function verifyOtp(request: MockRequest): MockResponse {
		const body = jsonObject(request);
		if (
			body === null ||
			typeof body.phone !== 'string' ||
			typeof body.code !== 'string'
		) {
			return reply(400, { error: 'bad_request' });
		}
		const phoneDigits = digitsOf(body.phone);
		const matches = workers.filter(
			(worker) => worker.phoneDigits === phoneDigits,
		);
		if (body.code !== SEED_CODE || matches.length === 0) {
			return reply(401, { error: 'bad_code' });
		}
		const token = newToken();
		const expiresAt = now() + SESSION_MS;
		sessions.set(token, { phoneDigits, expiresAt });
		const response: OtpVerifyResponse = {
			token,
			expiresAt,
			workers: matches.map((worker) => ({ id: worker.id, name: worker.name })),
		};
		return reply(200, response);
	}

	function authenticate(request: MockRequest): Authenticated {
		const header = request.headers.authorization ?? '';
		const token = header.startsWith('Bearer ') ? header.slice(7) : '';
		const session = sessions.get(token);
		if (session === undefined || now() >= session.expiresAt) {
			return {
				kind: 'denied',
				response: reply(401, { error: 'session_expired' }),
			};
		}
		const workerId = request.headers['x-worker-id'];
		const worker = workers.find(
			(candidate) =>
				candidate.id === workerId &&
				candidate.phoneDigits === session.phoneDigits,
		);
		if (worker === undefined) {
			return {
				kind: 'denied',
				response: reply(403, { error: 'forbidden_worker' }),
			};
		}
		return { kind: 'allowed', worker };
	}

	function assignmentFor(worker: SeedWorker): Assignment {
		const documents: ServerDocument[] = [];
		for (const documentType of REQUIRED_DOCUMENTS) {
			const found = worker.documents.find(
				(document) => document.documentType === documentType,
			);
			if (found !== undefined) {
				documents.push(found);
			}
		}
		return {
			order: SEED_ORDER,
			currentTerms,
			acceptedTermsVersionId: worker.acceptedTermsVersionId,
			requiredDocuments: REQUIRED_DOCUMENTS,
			documents,
			flags: {},
		};
	}

	function replayOf(
		worker: SeedWorker,
		route: string,
		request: MockRequest,
	): Outcome | null {
		const clientActionId = clientActionIdOf(request);
		if (clientActionId === null) {
			return null;
		}
		const key = dedupeKey(worker, route, clientActionId);
		return dedupe.has(key) ? unsaved(reply(200, dedupe.get(key))) : null;
	}

	function remember(
		worker: SeedWorker,
		route: string,
		clientActionId: string,
		status: number,
		body: unknown,
	) {
		dedupe.set(dedupeKey(worker, route, clientActionId), body);
		return { response: reply(status, body), saved: true };
	}

	function acceptTerms(
		worker: SeedWorker,
		route: string,
		request: MockRequest,
	): Outcome {
		const replay = replayOf(worker, route, request);
		if (replay !== null) {
			return replay;
		}
		const body = jsonObject(request);
		if (
			body === null ||
			typeof body.clientActionId !== 'string' ||
			typeof body.termsVersionId !== 'string'
		) {
			return unsaved(reply(400, { error: 'bad_request' }));
		}
		if (body.termsVersionId !== currentTerms.id) {
			const stale: StaleTermsBody = { error: 'stale_terms', currentTerms };
			return unsaved(reply(409, stale));
		}
		termsAcceptances.push({
			clientActionId: body.clientActionId,
			workerId: worker.id,
			termsVersionId: body.termsVersionId,
			acceptedAt: new Date(now()).toISOString(),
		});
		worker.acceptedTermsVersionId = body.termsVersionId;
		return remember(worker, route, body.clientActionId, 201, {});
	}

	function uploadDocument(
		worker: SeedWorker,
		route: string,
		request: MockRequest,
	): Outcome {
		const replay = replayOf(worker, route, request);
		if (replay !== null) {
			return replay;
		}
		if (request.body.kind !== 'multipart') {
			return unsaved(reply(400, { error: 'bad_request' }));
		}
		const { fields, files } = request.body;
		const { clientActionId, documentType } = fields;
		const image = files.image;
		if (
			clientActionId === undefined ||
			documentType === undefined ||
			image === undefined
		) {
			return unsaved(reply(400, { error: 'bad_request' }));
		}
		if (image.size > switches.maxImageBytes) {
			return unsaved(reply(413, { error: 'too_large' }));
		}
		if (!REQUIRED_DOCUMENTS.includes(documentType)) {
			return unsaved(reply(422, { error: 'unknown_document_type' }));
		}
		// The app never uploads over an approved or pending document, but the
		// mock stays simple: any upload is a new record that sets pending_review
		// (M8 for correction_requested).
		documentRecords.push({
			clientActionId,
			workerId: worker.id,
			documentType,
			imageBytes: image.size,
			submittedAt: new Date(now()).toISOString(),
		});
		worker.documents = [
			...worker.documents.filter(
				(document) => document.documentType !== documentType,
			),
			{ documentType, state: 'pending_review' },
		];
		return remember(worker, route, clientActionId, 201, {
			state: 'pending_review',
		});
	}

	function handleMe(route: string, request: MockRequest): Outcome {
		const auth = authenticate(request);
		switch (auth.kind) {
			case 'denied':
				return unsaved(auth.response);
			case 'allowed':
				break;
		}
		switch (route) {
			case 'GET /me/assignment':
				return unsaved(reply(200, assignmentFor(auth.worker)));
			case 'POST /me/terms-acceptances':
				return acceptTerms(auth.worker, route, request);
			case 'POST /me/documents':
				return uploadDocument(auth.worker, route, request);
			default:
				return unsaved(reply(404, { error: 'not_found' }));
		}
	}

	function adminState(): MockResponse {
		return reply(200, {
			currentTermsVersionId: currentTerms.id,
			switches,
			termsAcceptances,
			documents: documentRecords,
			workers: workers.map((worker) => ({
				id: worker.id,
				name: worker.name,
				acceptedTermsVersionId: worker.acceptedTermsVersionId,
				documents: worker.documents,
			})),
		});
	}

	function resetAll(): MockResponse {
		workers = seedWorkers();
		currentTerms = TERMS_V2;
		termsAcceptances = [];
		documentRecords = [];
		dedupe.clear();
		switches = {
			latencyMs: 0,
			errorRate: 0,
			dropResponse: 'off',
			maxImageBytes: MAX_IMAGE_BYTES,
		};
		return reply(200, {});
	}

	function updateSwitches(request: MockRequest): MockResponse {
		const body = jsonObject(request);
		if (body === null) {
			return reply(400, { error: 'bad_request' });
		}
		const next = { ...switches };
		if (body.latencyMs !== undefined) {
			if (typeof body.latencyMs !== 'number' || !(body.latencyMs >= 0)) {
				return reply(400, { error: 'bad_request' });
			}
			next.latencyMs = body.latencyMs;
		}
		if (body.errorRate !== undefined) {
			if (
				typeof body.errorRate !== 'number' ||
				!(body.errorRate >= 0 && body.errorRate <= 1)
			) {
				return reply(400, { error: 'bad_request' });
			}
			next.errorRate = body.errorRate;
		}
		if (body.dropResponse !== undefined) {
			if (
				body.dropResponse !== 'off' &&
				body.dropResponse !== 'next' &&
				body.dropResponse !== 'always'
			) {
				return reply(400, { error: 'bad_request' });
			}
			next.dropResponse = body.dropResponse;
		}
		if (body.maxImageBytes !== undefined) {
			if (
				typeof body.maxImageBytes !== 'number' ||
				!Number.isInteger(body.maxImageBytes) ||
				body.maxImageBytes < 0
			) {
				return reply(400, { error: 'bad_request' });
			}
			next.maxImageBytes = body.maxImageBytes;
		}
		switches = next;
		return reply(200, switches);
	}

	function expireTokens(): MockResponse {
		const expiredAt = now();
		for (const session of sessions.values()) {
			session.expiresAt = Math.min(session.expiresAt, expiredAt);
		}
		return reply(200, {});
	}

	function handleAdmin(route: string, request: MockRequest): MockResponse {
		switch (route) {
			case 'GET /__admin/state':
				return adminState();
			case 'POST /__admin/switches':
				return updateSwitches(request);
			case 'POST /__admin/expire-tokens':
				return expireTokens();
			case 'POST /__admin/publish-terms':
				currentTerms = TERMS_V3;
				return reply(200, {});
			case 'POST /__admin/reset':
				return resetAll();
			default:
				return reply(404, { error: 'not_found' });
		}
	}

	function withDrop(outcome: Outcome): MockResponse | 'drop' {
		if (!outcome.saved) {
			return outcome.response;
		}
		switch (switches.dropResponse) {
			case 'off':
				return outcome.response;
			case 'next':
				switches = { ...switches, dropResponse: 'off' };
				return 'drop';
			case 'always':
				return 'drop';
		}
	}

	async function handle(request: MockRequest): Promise<MockResponse | 'drop'> {
		const route = `${request.method} ${request.path}`;
		if (request.path.startsWith('/__admin/')) {
			return handleAdmin(route, request);
		}
		if (switches.errorRate > 0 && random() < switches.errorRate) {
			return reply(500, { error: 'mock_error' });
		}
		switch (route) {
			case 'POST /auth/otp/request':
				return requestOtp();
			case 'POST /auth/otp/verify':
				return verifyOtp(request);
			default:
				if (request.path.startsWith('/me/')) {
					return withDrop(handleMe(route, request));
				}
				return reply(404, { error: 'not_found' });
		}
	}

	return { handle, switches: () => switches };
}
