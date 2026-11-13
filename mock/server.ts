import { createServer } from 'node:http';
import { createMockBackend } from './backend';
import type { DropMode, MockBackend, MockBody } from './backend';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

const MAX_BODY_BYTES = 25 * 1024 * 1024;
const MULTIPART_FIELDS = ['clientActionId', 'documentType'];
const MULTIPART_FILE = 'image';
const ADMIN_ROUTES = [
	'GET /__admin/state',
	'POST /__admin/switches',
	'POST /__admin/publish-terms',
	'POST /__admin/expire-tokens',
	'POST /__admin/reset',
];

export type MockServerOptions = {
	port: number;
	host: string;
	log: (line: string) => void;
	latencyMs?: number;
	errorRate?: number;
	dropResponse?: DropMode;
	publishV3?: boolean;
	/** A backend built by the caller, for example with a seeded `random`. The switch options above are then ignored. */
	backend?: MockBackend;
};

export type RunningMockServer = {
	url: string;
	server: Server;
	close: () => Promise<void>;
};

type ParsedForm = { get: (name: string) => string | { size: number } | null };

function readBody(request: IncomingMessage): Promise<Buffer | 'too_large'> {
	return new Promise((resolve, reject) => {
		if (Number(request.headers['content-length'] ?? 0) > MAX_BODY_BYTES) {
			resolve('too_large');
			return;
		}
		const chunks: Buffer[] = [];
		let total = 0;
		let exceeded = false;
		request.on('data', (chunk: Buffer) => {
			if (exceeded) {
				return;
			}
			total += chunk.length;
			if (total > MAX_BODY_BYTES) {
				exceeded = true;
				chunks.length = 0;
				resolve('too_large');
				return;
			}
			chunks.push(chunk);
		});
		request.on('end', () => {
			if (!exceeded) {
				resolve(Buffer.concat(chunks));
			}
		});
		request.on('error', reject);
	});
}

async function parseMultipart(
	contentType: string,
	raw: Buffer,
): Promise<MockBody> {
	try {
		// React Native's global FormData type has no `get`; the runtime is Bun's.
		const form = (await new Request('http://mock.invalid/', {
			method: 'POST',
			headers: { 'content-type': contentType },
			body: new Uint8Array(raw),
		}).formData()) as unknown as ParsedForm;
		const fields: Record<string, string> = {};
		const files: Record<string, { size: number }> = {};
		for (const name of MULTIPART_FIELDS) {
			const value = form.get(name);
			if (typeof value === 'string') {
				fields[name] = value;
			}
		}
		const image = form.get(MULTIPART_FILE);
		if (image !== null && typeof image !== 'string') {
			files[MULTIPART_FILE] = { size: image.size };
		}
		return { kind: 'multipart', fields, files };
	} catch {
		return { kind: 'empty' };
	}
}

async function parseBody(
	request: IncomingMessage,
	raw: Buffer,
): Promise<MockBody> {
	if (raw.length === 0) {
		return { kind: 'empty' };
	}
	const contentType = request.headers['content-type'] ?? '';
	if (contentType.startsWith('multipart/form-data')) {
		return parseMultipart(contentType, raw);
	}
	try {
		return { kind: 'json', value: JSON.parse(raw.toString('utf8')) as unknown };
	} catch {
		return { kind: 'json', value: undefined };
	}
}

function headersOf(request: IncomingMessage): Record<string, string> {
	const headers: Record<string, string> = {};
	for (const [name, value] of Object.entries(request.headers)) {
		if (value !== undefined) {
			headers[name] = Array.isArray(value) ? value.join(', ') : value;
		}
	}
	return headers;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeJson(response: ServerResponse, status: number, body: unknown) {
	const payload = JSON.stringify(body);
	response.writeHead(status, {
		'content-type': 'application/json',
		'content-length': Buffer.byteLength(payload),
	});
	response.end(payload);
}

async function onRequest(
	backend: MockBackend,
	log: (line: string) => void,
	request: IncomingMessage,
	response: ServerResponse,
): Promise<void> {
	const method = request.method ?? 'GET';
	const path = new URL(request.url ?? '/', 'http://mock.invalid').pathname;
	const raw = await readBody(request);
	if (raw === 'too_large') {
		log(`${method} ${path} 413`);
		const payload = JSON.stringify({ error: 'too_large' });
		response.writeHead(413, {
			'content-type': 'application/json',
			'content-length': Buffer.byteLength(payload),
			connection: 'close',
		});
		response.end(payload, () => request.socket.destroy());
		return;
	}
	const body = await parseBody(request, raw);
	if (!path.startsWith('/__admin/')) {
		await sleep(backend.switches().latencyMs);
	}
	const result = await backend.handle({
		method,
		path,
		headers: headersOf(request),
		body,
	});
	if (result === 'drop') {
		log(`${method} ${path} dropped`);
		request.socket.destroy();
		return;
	}
	log(`${method} ${path} ${result.status}`);
	writeJson(response, result.status, result.body);
}

export function startMockServer(
	options: MockServerOptions,
): Promise<RunningMockServer> {
	const backend =
		options.backend ??
		createMockBackend({
			switches: {
				latencyMs: options.latencyMs,
				errorRate: options.errorRate,
				dropResponse: options.dropResponse,
			},
			publishV3: options.publishV3,
		});
	const server = createServer((request, response) => {
		onRequest(backend, options.log, request, response).catch(() => {
			options.log(`${request.method ?? 'GET'} ${request.url ?? '/'} 500`);
			if (!response.headersSent) {
				writeJson(response, 500, { error: 'mock_error' });
			}
		});
	});
	return new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(options.port, options.host, () => {
			const { port } = server.address() as AddressInfo;
			const shown = options.host === '0.0.0.0' ? 'localhost' : options.host;
			resolve({
				url: `http://${shown}:${port}`,
				server,
				close: () =>
					new Promise<void>((done) => {
						server.closeAllConnections();
						server.close(() => {
							done();
						});
					}),
			});
		});
	});
}

function dropModeFromEnv(value: string | undefined): DropMode {
	return value === 'next' || value === 'always' ? value : 'off';
}

async function main(): Promise<void> {
	const env = process.env;
	const write = (line: string) => process.stdout.write(`${line}\n`);
	const running = await startMockServer({
		port: Number(env.PORT ?? 4000),
		host: '0.0.0.0',
		log: write,
		latencyMs: Number(env.MOCK_LATENCY_MS ?? 0),
		errorRate: Number(env.MOCK_ERROR_RATE ?? 0),
		dropResponse: dropModeFromEnv(env.MOCK_DROP_RESPONSE),
		publishV3: env.MOCK_PUBLISH_V3 === '1',
	});
	write(`mock backend listening on ${running.url} (emulator: 10.0.2.2)`);
	write(`admin routes: ${ADMIN_ROUTES.join(', ')}`);
}

if (import.meta.main) {
	main().catch((error: unknown) => {
		process.stderr.write(`mock backend failed to start: ${String(error)}\n`);
		process.exit(1);
	});
}
