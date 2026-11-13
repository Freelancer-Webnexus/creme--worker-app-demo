export type SerialGate = <T>(task: () => Promise<T>) => Promise<T>;

/**
 * Runs tasks one at a time, in call order. A task that rejects does not stop
 * the tasks behind it.
 */
export const createSerialGate = (): SerialGate => {
	let tail: Promise<unknown> = Promise.resolve();
	return (task) => {
		const result = tail.then(task);
		tail = result.catch(() => undefined);
		return result;
	};
};
