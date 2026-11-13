type MotionPreference = 'unread' | 'reduced' | 'full';

type ReduceMotionMode = 'system' | 'always' | 'never';

type ReducedMotionPorts = {
	read: () => Promise<boolean>;
	listen: (onChange: (reduced: boolean) => void) => () => void;
};

/**
 * Reanimated already follows the setting it read at startup, so only a live
 * change needs an override; `system` means no override is mounted.
 */
const reduceMotionModeFor = (
	preference: MotionPreference,
	startupReduced: boolean,
): ReduceMotionMode => {
	switch (preference) {
		case 'reduced':
			return startupReduced ? 'system' : 'always';
		case 'full':
			return startupReduced ? 'never' : 'system';
		case 'unread':
			return 'system';
	}
};

const isMotionReduced = (
	preference: MotionPreference,
	startupReduced: boolean,
): boolean => {
	switch (preference) {
		case 'reduced':
			return true;
		case 'full':
			return false;
		case 'unread':
			return startupReduced;
	}
};

const preferenceFor = (reduced: boolean): MotionPreference =>
	reduced ? 'reduced' : 'full';

type Lifecycle =
	| { kind: 'idle'; cycle: number }
	| { kind: 'listening'; cycle: number; eventSeen: boolean; stop: () => void };

type LifecycleEvent =
	| { kind: 'start'; stop: () => void }
	| { kind: 'stop' }
	| { kind: 'changed' }
	| { kind: 'read'; cycle: number };

const nextLifecycle = (state: Lifecycle, event: LifecycleEvent): Lifecycle => {
	switch (state.kind) {
		case 'idle':
			return event.kind === 'start'
				? {
						cycle: state.cycle + 1,
						eventSeen: false,
						kind: 'listening',
						stop: event.stop,
					}
				: state;
		case 'listening':
			switch (event.kind) {
				case 'stop':
					return { cycle: state.cycle, kind: 'idle' };
				case 'changed':
					return { ...state, eventSeen: true };
				case 'start':
				case 'read':
					return state;
			}
	}
};

const readApplies = (state: Lifecycle, cycle: number): boolean => {
	switch (state.kind) {
		case 'idle':
			return false;
		case 'listening':
			return state.cycle === cycle && !state.eventSeen;
	}
};

const createReducedMotionStore = (ports: ReducedMotionPorts) => {
	const listeners = new Set<() => void>();
	let snapshot: MotionPreference = 'unread';
	let lifecycle: Lifecycle = { cycle: 0, kind: 'idle' };

	const publish = (next: MotionPreference) => {
		if (next === snapshot) return;
		snapshot = next;
		listeners.forEach((listener) => {
			listener();
		});
	};

	const start = () => {
		const stop = ports.listen((reduced) => {
			lifecycle = nextLifecycle(lifecycle, { kind: 'changed' });
			publish(preferenceFor(reduced));
		});
		lifecycle = nextLifecycle(lifecycle, { kind: 'start', stop });
		const { cycle } = lifecycle;
		ports
			.read()
			.then((reduced) => {
				if (readApplies(lifecycle, cycle)) publish(preferenceFor(reduced));
			})
			.catch(() => {});
	};

	const stop = () => {
		if (lifecycle.kind === 'listening') lifecycle.stop();
		lifecycle = nextLifecycle(lifecycle, { kind: 'stop' });
	};

	const subscribe = (listener: () => void) => {
		listeners.add(listener);
		if (listeners.size === 1) start();
		return () => {
			listeners.delete(listener);
			if (listeners.size === 0) stop();
		};
	};

	return { getSnapshot: () => snapshot, subscribe };
};

export { createReducedMotionStore, isMotionReduced, reduceMotionModeFor };
export type { MotionPreference, ReduceMotionMode, ReducedMotionPorts };
