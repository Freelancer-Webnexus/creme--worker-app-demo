import {
	createReducedMotionStore,
	isMotionReduced,
	reduceMotionModeFor,
	type ReducedMotionPorts,
} from '@/uikit/motion/reduced-motion-store';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const makePorts = (initial: boolean | Promise<boolean>) => {
	let emit: (reduced: boolean) => void = () => {};
	const stop = jest.fn(() => {});
	const read = jest.fn(() => Promise.resolve(initial));
	const listen = jest.fn((onChange: (reduced: boolean) => void) => {
		emit = onChange;
		return stop;
	});
	const ports: ReducedMotionPorts = { listen, read };
	return {
		emit: (reduced: boolean) => {
			emit(reduced);
		},
		listen,
		ports,
		read,
		stop,
	};
};

describe('createReducedMotionStore', () => {
	it('starts unread', () => {
		const { ports } = makePorts(true);
		expect(createReducedMotionStore(ports).getSnapshot()).toBe('unread');
	});

	it('reads once on first subscribe and applies the result', async () => {
		const { ports, read } = makePorts(true);
		const store = createReducedMotionStore(ports);
		const first = jest.fn(() => {});
		store.subscribe(first);
		store.subscribe(() => {});
		await flush();
		expect(read).toHaveBeenCalledTimes(1);
		expect(store.getSnapshot()).toBe('reduced');
		expect(first).toHaveBeenCalledTimes(1);
	});

	it('notifies subscribers on a change event', async () => {
		const { emit, ports } = makePorts(false);
		const store = createReducedMotionStore(ports);
		const listener = jest.fn(() => {});
		store.subscribe(listener);
		await flush();
		expect(store.getSnapshot()).toBe('full');
		emit(true);
		expect(store.getSnapshot()).toBe('reduced');
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it('keeps an event that arrives before the read resolves', async () => {
		let resolveRead: (reduced: boolean) => void = () => {};
		const pending = new Promise<boolean>((resolve) => {
			resolveRead = resolve;
		});
		const { emit, ports } = makePorts(pending);
		const store = createReducedMotionStore(ports);
		store.subscribe(() => {});
		emit(true);
		resolveRead(false);
		await flush();
		expect(store.getSnapshot()).toBe('reduced');
	});

	it('does not notify when the value is unchanged', async () => {
		const { emit, ports } = makePorts(true);
		const store = createReducedMotionStore(ports);
		const listener = jest.fn(() => {});
		store.subscribe(listener);
		await flush();
		emit(true);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('stops listening on the last unsubscribe', () => {
		const { ports, stop } = makePorts(true);
		const store = createReducedMotionStore(ports);
		const offA = store.subscribe(() => {});
		const offB = store.subscribe(() => {});
		offA();
		expect(stop).toHaveBeenCalledTimes(0);
		offB();
		expect(stop).toHaveBeenCalledTimes(1);
	});

	it('stays unread when the read rejects', async () => {
		const { ports } = makePorts(true);
		const read = jest.fn(() => Promise.reject(new Error('unavailable')));
		const store = createReducedMotionStore({ ...ports, read });
		store.subscribe(() => {});
		await flush();
		expect(read).toHaveBeenCalledTimes(1);
		expect(store.getSnapshot()).toBe('unread');
	});

	it('picks up a changed read result when resubscribed', async () => {
		let current = false;
		const { ports } = makePorts(false);
		const read = jest.fn(() => Promise.resolve(current));
		const store = createReducedMotionStore({ ...ports, read });
		const off = store.subscribe(() => {});
		await flush();
		expect(store.getSnapshot()).toBe('full');
		off();
		current = true;
		store.subscribe(() => {});
		await flush();
		expect(read).toHaveBeenCalledTimes(2);
		expect(store.getSnapshot()).toBe('reduced');
	});

	it('drops a late read from a previous cycle', async () => {
		const resolvers: ((reduced: boolean) => void)[] = [];
		const { emit, ports } = makePorts(false);
		const read = jest.fn(
			() =>
				new Promise<boolean>((resolve) => {
					resolvers.push(resolve);
				}),
		);
		const store = createReducedMotionStore({ ...ports, read });
		const off = store.subscribe(() => {});
		off();
		store.subscribe(() => {});
		emit(true);
		resolvers[0]?.(false);
		await flush();
		expect(store.getSnapshot()).toBe('reduced');
		resolvers[1]?.(false);
		await flush();
		expect(store.getSnapshot()).toBe('reduced');
	});
});

describe('motion helpers', () => {
	it('overrides only a setting that changed since startup', () => {
		expect(reduceMotionModeFor('unread', false)).toBe('system');
		expect(reduceMotionModeFor('full', false)).toBe('system');
		expect(reduceMotionModeFor('reduced', true)).toBe('system');
		expect(reduceMotionModeFor('reduced', false)).toBe('always');
		expect(reduceMotionModeFor('full', true)).toBe('never');
	});

	it('resolves whether motion is reduced', () => {
		expect(isMotionReduced('reduced', false)).toBe(true);
		expect(isMotionReduced('full', true)).toBe(false);
		expect(isMotionReduced('unread', true)).toBe(true);
		expect(isMotionReduced('unread', false)).toBe(false);
	});
});
