import type { Clock } from '@/services/sync/sync-ports';

export type FakeClock = Clock & {
	/** Moves time forward and fires every timer that comes due, earliest first. */
	advance: (ms: number) => void;
	pendingTimers: () => number;
};

type Timer = { id: number; dueAt: number; callback: () => void };

export const createFakeClock = (startAt = 1_000_000): FakeClock => {
	let current = startAt;
	let nextId = 1;
	let timers: Timer[] = [];

	const earliestDueBy = (limit: number): Timer | undefined =>
		timers
			.filter((timer) => timer.dueAt <= limit)
			.sort((a, b) => a.dueAt - b.dueAt || a.id - b.id)[0];

	return {
		now: () => current,

		setTimer: (delayMs, callback) => {
			const timer = { id: nextId, dueAt: current + delayMs, callback };
			nextId += 1;
			timers = [...timers, timer];
			return () => {
				timers = timers.filter((other) => other.id !== timer.id);
			};
		},

		advance: (ms) => {
			const target = current + ms;
			let due = earliestDueBy(target);
			while (due !== undefined) {
				const fired = due;
				timers = timers.filter((other) => other.id !== fired.id);
				current = Math.max(current, fired.dueAt);
				fired.callback();
				due = earliestDueBy(target);
			}
			current = target;
		},

		pendingTimers: () => timers.length,
	};
};
