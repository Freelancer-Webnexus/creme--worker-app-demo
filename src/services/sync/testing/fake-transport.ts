import type { Transport } from '@/services/sync/sync-ports';
import type { QueuedAction, SendResult } from '@/services/sync/sync-types';

export type SendCall = {
	clientActionId: string;
	workerId: string;
	token: string;
};

export type ScriptedResult = SendResult | { kind: 'throws' };

export type FakeTransport = Transport & {
	calls: SendCall[];
	/** Results for the next sends, one per send. Once used up, every send is delivered. */
	script: (...results: ScriptedResult[]) => void;
	/**
	 * The next send stays pending until `release` gives it a result.
	 * `sendStarted` resolves when the engine has called that send.
	 */
	holdNextSend: () => {
		sendStarted: Promise<void>;
		release: (result: SendResult) => void;
	};
};

type HeldSend = { result: Promise<SendResult>; markStarted: () => void };

const recordCall = (calls: SendCall[], action: QueuedAction, token: string) => {
	calls.push({
		clientActionId: action.clientActionId,
		workerId: action.workerId,
		token,
	});
};

export const createFakeTransport = (): FakeTransport => {
	const calls: SendCall[] = [];
	let scripted: ScriptedResult[] = [];
	let held: HeldSend | null = null;

	return {
		calls,

		script: (...results) => {
			scripted = [...scripted, ...results];
		},

		holdNextSend: () => {
			let release: (result: SendResult) => void = () => undefined;
			let markStarted: () => void = () => undefined;
			const sendStarted = new Promise<void>((resolve) => {
				markStarted = resolve;
			});
			const result = new Promise<SendResult>((resolve) => {
				release = resolve;
			});
			held = { result, markStarted };
			return { sendStarted, release };
		},

		send: async (action, token) => {
			recordCall(calls, action, token);

			if (held !== null) {
				const pending = held;
				held = null;
				pending.markStarted();
				return pending.result;
			}

			const next = scripted.shift();
			if (next === undefined) {
				return { kind: 'delivered', replay: false };
			}
			if (next.kind === 'throws') {
				throw new Error('network down');
			}
			return next;
		},
	};
};

export type FakeServerTransport = Transport & {
	calls: SendCall[];
	/** clientActionIds the fake server has saved, one entry per record. */
	savedIds: () => string[];
	/** The server saves the next new action, then the response never arrives. */
	loseNextResponse: () => void;
};

/**
 * A server that deduplicates by clientActionId like the real one (M3): a known
 * id answers `delivered` with `replay: true` and saves nothing. With `files`,
 * it also models the real transport: an upload whose file is not in the set is
 * `rejected` before anything is sent.
 */
export const createFakeServerTransport = (
	files?: Set<string>,
): FakeServerTransport => {
	const calls: SendCall[] = [];
	const saved: string[] = [];
	let losingNext = false;

	return {
		calls,

		savedIds: () => [...saved],

		loseNextResponse: () => {
			losingNext = true;
		},

		send: async (action, token) => {
			recordCall(calls, action, token);

			if (
				files !== undefined &&
				action.kind.type === 'document_upload' &&
				!files.has(action.kind.fileUri)
			) {
				return { kind: 'rejected', reason: 'rejected' };
			}

			if (saved.includes(action.clientActionId)) {
				return { kind: 'delivered', replay: true };
			}
			saved.push(action.clientActionId);

			if (losingNext) {
				losingNext = false;
				return { kind: 'unreachable' };
			}
			return { kind: 'delivered', replay: false };
		},
	};
};
