import { createBootStore } from '@/services/runtime/boot-store';

type Runtime = { name: string };

type Deferred = {
	promise: Promise<Runtime>;
	reject: (error: unknown) => void;
	resolve: (runtime: Runtime) => void;
};

const deferred = (): Deferred => {
	let resolve: Deferred['resolve'] = () => undefined;
	let reject: Deferred['reject'] = () => undefined;
	const promise = new Promise<Runtime>((onResolve, onReject) => {
		resolve = onResolve;
		reject = onReject;
	});
	return { promise, reject, resolve };
};

const setup = () => {
	const boots: Deferred[] = [];
	const calls: string[] = [];
	const store = createBootStore<Runtime>({
		boot: () => {
			const next = deferred();
			boots.push(next);
			return next.promise;
		},
		splash: {
			release: () => {
				calls.push('release');
			},
		},
	});
	return { boots, calls, store };
};

const settle = async (): Promise<void> => {
	await Promise.resolve();
	await Promise.resolve();
};

describe('createBootStore', () => {
	it('boots at once and keeps the splash while booting', () => {
		const { boots, calls, store } = setup();

		expect(store.getState()).toEqual({ kind: 'booting' });
		expect(boots).toHaveLength(1);
		expect(calls).toEqual([]);
	});

	it('becomes ready but keeps the splash until the ready tree has laid out', async () => {
		const { boots, calls, store } = setup();

		boots[0]?.resolve({ name: 'a' });
		await settle();

		expect(store.getState()).toEqual({
			kind: 'ready',
			runtime: { name: 'a' },
		});
		expect(calls).toEqual([]);

		store.markLaidOut();

		expect(calls).toEqual(['release']);
	});

	it('lifts the splash once however often the layout signal repeats', async () => {
		const { boots, calls, store } = setup();
		boots[0]?.resolve({ name: 'a' });
		await settle();

		store.markLaidOut();
		store.markLaidOut();

		expect(calls).toEqual(['release']);
	});

	it('ignores a layout signal while still booting', () => {
		const { calls, store } = setup();

		store.markLaidOut();

		expect(calls).toEqual([]);
	});

	it('becomes failed and lifts the splash once the failure screen has laid out', async () => {
		const { boots, calls, store } = setup();

		boots[0]?.reject(new Error('no disk'));
		await settle();

		const state = store.getState();
		expect(state.kind).toBe('failed');
		expect(state.kind === 'failed' && state.error.message).toBe('no disk');
		expect(calls).toEqual([]);

		store.markLaidOut();

		expect(calls).toEqual(['release']);
	});

	it('wraps a thrown value that is not an Error', async () => {
		const { boots, store } = setup();

		boots[0]?.reject('boom');
		await settle();

		const state = store.getState();
		expect(state.kind === 'failed' && state.error).toBeInstanceOf(Error);
	});

	it('retries after the splash is gone without bringing it back', async () => {
		const { boots, calls, store } = setup();
		boots[0]?.reject(new Error('no disk'));
		await settle();
		store.markLaidOut();

		store.retry();

		expect(store.getState()).toEqual({ kind: 'booting' });
		expect(boots).toHaveLength(2);

		boots[1]?.resolve({ name: 'b' });
		await settle();
		store.markLaidOut();

		expect(store.getState().kind).toBe('ready');
		expect(calls).toEqual(['release']);
	});

	it('keeps waiting for the first layout when a retry comes before it', async () => {
		const { boots, calls, store } = setup();
		boots[0]?.reject(new Error('no disk'));
		await settle();

		store.retry();
		boots[1]?.resolve({ name: 'b' });
		await settle();

		expect(calls).toEqual([]);

		store.markLaidOut();

		expect(calls).toEqual(['release']);
	});

	it('lifts the splash when the app tree crashes before its first layout', () => {
		const { calls, store } = setup();

		store.releaseSplashOnError();
		store.releaseSplashOnError();

		expect(calls).toEqual(['release']);
	});

	it('cannot start a second boot with a second retry tap', async () => {
		const { boots, store } = setup();
		boots[0]?.reject(new Error('no disk'));
		await settle();

		store.retry();
		store.retry();

		expect(boots).toHaveLength(2);
	});

	it('ignores retry while booting and when ready', async () => {
		const { boots, store } = setup();

		store.retry();
		expect(boots).toHaveLength(1);

		boots[0]?.resolve({ name: 'a' });
		await settle();
		store.retry();

		expect(boots).toHaveLength(1);
		expect(store.getState().kind).toBe('ready');
	});

	it('tells subscribers about every change and stops after unsubscribe', async () => {
		const { boots, store } = setup();
		let notified = 0;
		const unsubscribe = store.subscribe(() => {
			notified += 1;
		});

		boots[0]?.reject(new Error('x'));
		await settle();
		store.retry();
		unsubscribe();
		boots[1]?.resolve({ name: 'b' });
		await settle();

		expect(notified).toBe(2);
	});
});
