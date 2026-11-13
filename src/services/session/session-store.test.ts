import { resetLoggerSink, setLoggerSink } from '@/services/logger/logger';
import { serializeSession } from '@/services/session/session-codec';
import type { SessionEvent } from '@/services/session/session-state';
import {
	createSessionStore,
	type SessionPersistence,
} from '@/services/session/session-store';

const ana = { id: 'w_ana', name: 'Ana López' };

const verified: SessionEvent = {
	type: 'otp_verified',
	phone: '+52 55 1000 0001',
	session: { token: 'tok_1', expiresAt: 1_000, workers: [ana] },
};

const memory = (initial: string | null = null) => {
	const writes: string[] = [];
	let saved = initial;
	const persistence: SessionPersistence = {
		read: () => saved,
		write: (value) => {
			saved = value;
			writes.push(value);
		},
	};
	return { persistence, writes, saved: () => saved };
};

beforeEach(() => {
	setLoggerSink(() => {});
});

afterEach(() => {
	resetLoggerSink();
});

describe('session store', () => {
	it('starts signed out when nothing is saved', () => {
		const store = createSessionStore(memory().persistence);
		expect(store.getSession()).toEqual({ kind: 'signed_out', lastPhone: null });
	});

	it('restores a saved session', () => {
		const first = memory();
		const store = createSessionStore(first.persistence);
		store.dispatchSession(verified);

		const second = createSessionStore(memory(first.saved()).persistence);
		expect(second.getSession().kind).toBe('signed_in');
		expect(second.tokenFor('w_ana')).toBe('tok_1');
	});

	it('returns the state the event led to, so a caller never re-reads the store', () => {
		const store = createSessionStore(memory().persistence);

		const next = store.dispatchSession(verified);

		expect(next).toBe(store.getSession());
		expect(next.kind).toBe('signed_in');
	});

	it('returns the unchanged state for an event that changes nothing', () => {
		const store = createSessionStore(memory().persistence);
		const before = store.getSession();

		expect(store.dispatchSession({ type: 'signed_out' })).toBe(before);
	});

	it('returns signed_out when the number maps to no worker', () => {
		const store = createSessionStore(memory().persistence);

		const next = store.dispatchSession({
			phone: '+52 55 1000 0009',
			session: { expiresAt: 1, token: 't', workers: [] },
			type: 'otp_verified',
		});

		expect(next).toEqual({ kind: 'signed_out', lastPhone: '+52 55 1000 0009' });
	});

	it('starts signed out when the saved JSON is corrupt', () => {
		const store = createSessionStore(memory('{broken').persistence);
		expect(store.getSession().kind).toBe('signed_out');
	});

	it('starts signed out when reading throws', () => {
		const store = createSessionStore({
			read: () => {
				throw new Error('keychain locked');
			},
			write: () => {},
		});
		expect(store.getSession().kind).toBe('signed_out');
	});

	it('saves and notifies on a change, and does neither on a no-op', () => {
		const { persistence, writes } = memory();
		const store = createSessionStore(persistence);
		let calls = 0;
		store.subscribe(() => {
			calls += 1;
		});

		store.dispatchSession({ type: 'signed_out' });
		expect([writes.length, calls]).toEqual([0, 0]);

		store.dispatchSession(verified);
		expect([writes.length, calls]).toEqual([1, 1]);
		expect(writes[0]).toBe(serializeSession(store.getSession()));
	});

	it('keeps the state when saving throws', () => {
		const store = createSessionStore({
			read: () => null,
			write: () => {
				throw new Error('disk full');
			},
		});
		store.dispatchSession(verified);
		expect(store.getSession().kind).toBe('signed_in');
	});

	it('drops the token and worker on sign out and keeps the phone', () => {
		const { persistence, saved } = memory();
		const store = createSessionStore(persistence);
		store.dispatchSession(verified);
		store.dispatchSession({ type: 'signed_out' });

		expect(store.getSession()).toEqual({
			kind: 'signed_out',
			lastPhone: '+52 55 1000 0001',
		});
		expect(store.tokenFor('w_ana')).toBeNull();
		expect(saved()).not.toContain('tok_1');
	});

	it('reloads and notifies when persistence is attached later', () => {
		const first = memory();
		createSessionStore(first.persistence).dispatchSession(verified);

		const store = createSessionStore(memory().persistence);
		let calls = 0;
		store.subscribe(() => {
			calls += 1;
		});
		store.attachPersistence(memory(first.saved()).persistence);

		expect(store.getSession().kind).toBe('signed_in');
		expect(calls).toBe(1);
	});

	it('attaching the same persistence again reads and notifies nothing, so a boot retry is safe', () => {
		const store = createSessionStore(memory().persistence);
		const keystore = memory();
		store.attachPersistence(keystore.persistence);
		store.dispatchSession(verified);
		let calls = 0;
		store.subscribe(() => {
			calls += 1;
		});

		store.attachPersistence(keystore.persistence);

		expect(calls).toBe(0);
		expect(store.getSession().kind).toBe('signed_in');
	});

	it('stops notifying after unsubscribe', () => {
		const store = createSessionStore(memory().persistence);
		let calls = 0;
		const unsubscribe = store.subscribe(() => {
			calls += 1;
		});
		unsubscribe();
		store.dispatchSession(verified);
		expect(calls).toBe(0);
	});
});
