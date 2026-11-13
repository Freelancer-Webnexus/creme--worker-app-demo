import type { WorkerSummary } from '@/services/api/api-types';
import {
	initialSessionState,
	type SessionState,
} from '@/services/session/session-state';

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const parseWorker = (value: unknown): WorkerSummary | null =>
	isRecord(value) &&
	typeof value.id === 'string' &&
	value.id !== '' &&
	typeof value.name === 'string'
		? { id: value.id, name: value.name }
		: null;

const parseWorkers = (value: unknown): WorkerSummary[] | null => {
	if (!Array.isArray(value)) {
		return null;
	}
	const workers = value.map(parseWorker);
	return workers.every((worker) => worker !== null) ? workers : null;
};

const parseState = (value: unknown): SessionState | null => {
	if (!isRecord(value)) {
		return null;
	}

	if (value.kind === 'signed_out') {
		return typeof value.lastPhone === 'string' || value.lastPhone === null
			? { kind: 'signed_out', lastPhone: value.lastPhone }
			: null;
	}

	const workers = parseWorkers(value.workers);
	if (
		workers === null ||
		typeof value.phone !== 'string' ||
		typeof value.token !== 'string' ||
		value.token === '' ||
		typeof value.expiresAt !== 'number' ||
		!Number.isFinite(value.expiresAt)
	) {
		return null;
	}
	const phone = value.phone;
	const token = value.token;
	const expiresAt = value.expiresAt;

	if (value.kind === 'choosing_worker') {
		return workers.length > 1
			? { kind: 'choosing_worker', phone, token, expiresAt, workers }
			: null;
	}

	if (value.kind === 'signed_in') {
		const worker = parseWorker(value.worker);
		return worker !== null && workers.some((other) => other.id === worker.id)
			? { kind: 'signed_in', phone, token, expiresAt, worker, workers }
			: null;
	}

	return null;
};

export const serializeSession = (state: SessionState): string =>
	JSON.stringify(state);

/** Anything missing, unparseable or malformed means signed out, never a crash. */
export const parseSession = (raw: string | null): SessionState => {
	if (raw === null || raw === '') {
		return initialSessionState;
	}
	try {
		return parseState(JSON.parse(raw)) ?? initialSessionState;
	} catch {
		return initialSessionState;
	}
};
