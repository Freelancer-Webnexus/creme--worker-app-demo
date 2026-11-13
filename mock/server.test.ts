import { convertFormDataAsync } from 'expo/src/winter/fetch/convertFormData';
import { createMockBackend } from './backend';
import { startMockServer } from './server';
import type { RunningMockServer } from './server';
import type { OtpVerifyResponse } from '../src/services/api/api-types';

let running: RunningMockServer | null = null;

afterEach(async () => {
	if (running !== null) {
		await running.close();
		running = null;
	}
});

async function start(): Promise<string> {
	running = await startMockServer({
		port: 0,
		host: '127.0.0.1',
		log: () => {},
	});
	return running.url;
}

async function signIn(url: string): Promise<OtpVerifyResponse> {
	const response = await fetch(`${url}/auth/otp/verify`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ phone: '+52 55 1000 0001', code: '123456' }),
	});
	return (await response.json()) as OtpVerifyResponse;
}

function documentForm(clientActionId: string, size: number): FormData {
	const form = new FormData();
	form.append('clientActionId', clientActionId);
	form.append('documentType', 'passport');
	form.append(
		'image',
		new Blob([new Uint8Array(size)], { type: 'image/jpeg' }),
		'photo.jpg',
	);
	return form;
}

describe('mock http adapter', () => {
	it('serves the backend that the caller injects', async () => {
		running = await startMockServer({
			port: 0,
			host: '127.0.0.1',
			log: () => {},
			backend: createMockBackend({ now: () => 1_000, random: () => 0 }),
		});

		const session = await signIn(running.url);

		expect(session.expiresAt).toBe(1_000 + 24 * 60 * 60 * 1000);
		expect(session.token).toBe('mock-1-0');
	});

	it('round-trips JSON', async () => {
		const url = await start();
		const session = await signIn(url);
		expect(session.workers).toEqual([{ id: 'worker-ana', name: 'Ana López' }]);
		const assignment = await fetch(`${url}/me/assignment`, {
			headers: {
				authorization: `Bearer ${session.token}`,
				'x-worker-id': 'worker-ana',
			},
		});
		expect(assignment.status).toBe(200);
	});

	it('accepts a multipart upload and replays it', async () => {
		const url = await start();
		const session = await signIn(url);
		const headers = {
			authorization: `Bearer ${session.token}`,
			'x-worker-id': 'worker-ana',
		};
		const first = await fetch(`${url}/me/documents`, {
			method: 'POST',
			headers,
			body: documentForm('doc-http-1', 2048),
		});
		expect(first.status).toBe(201);
		expect(await first.json()).toEqual({ state: 'pending_review' });
		const replay = await fetch(`${url}/me/documents`, {
			method: 'POST',
			headers,
			body: documentForm('doc-http-1', 2048),
		});
		expect(replay.status).toBe(200);
		const state = (await (await fetch(`${url}/__admin/state`)).json()) as {
			documents: unknown[];
		};
		expect(state.documents).toHaveLength(1);
	});

	it('accepts the multipart bytes that expo/fetch encodes on the device', async () => {
		const url = await start();
		const session = await signIn(url);
		const photo = new Uint8Array(3_000).fill(0xff);
		// The expo-file-system File the app appends: bytes(), name and type, not a Blob.
		const devicePart = {
			name: 'a.jpg',
			type: 'image/jpeg',
			bytes: () => Promise.resolve(photo),
		};
		// Expo's patched FormData yields the appended pairs unchanged.
		const form = {
			entries: () => [
				['clientActionId', 'doc-device-1'],
				['documentType', 'passport'],
				['image', devicePart],
			],
		} as unknown as FormData;
		const { body, boundary } = await convertFormDataAsync(form);

		const response = await fetch(`${url}/me/documents`, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${session.token}`,
				'x-worker-id': 'worker-ana',
				'content-type': `multipart/form-data; boundary=${boundary}`,
			},
			body: new Uint8Array(body),
		});

		expect(response.status).toBe(201);
		const state = (await (await fetch(`${url}/__admin/state`)).json()) as {
			documents: { clientActionId: string; imageBytes: number }[];
		};
		expect(state.documents).toEqual([
			expect.objectContaining({
				clientActionId: 'doc-device-1',
				imageBytes: photo.length,
			}),
		]);
	});

	it('answers 413 for an oversized image', async () => {
		const url = await start();
		const session = await signIn(url);
		const response = await fetch(`${url}/me/documents`, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${session.token}`,
				'x-worker-id': 'worker-ana',
			},
			body: documentForm('doc-http-2', 1_572_865),
		});
		expect(response.status).toBe(413);
	});

	it('surfaces a dropped response as a network error', async () => {
		const url = await start();
		const session = await signIn(url);
		await fetch(`${url}/__admin/switches`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ dropResponse: 'next' }),
		});
		await expect(
			fetch(`${url}/me/terms-acceptances`, {
				method: 'POST',
				headers: {
					authorization: `Bearer ${session.token}`,
					'x-worker-id': 'worker-ana',
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					clientActionId: 'act-http-1',
					termsVersionId: 'terms-v2',
				}),
			}),
		).rejects.toThrow();
		const state = (await (await fetch(`${url}/__admin/state`)).json()) as {
			termsAcceptances: unknown[];
		};
		expect(state.termsAcceptances).toHaveLength(1);
	});
});
