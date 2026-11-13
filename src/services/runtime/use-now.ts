import { useEffect, useState } from 'react';

const TICK_MS = 1000;

/**
 * The current time, ticking once a second while `ticking` is true. Used for a
 * countdown. When it is false the value holds, so a still screen re-renders
 * for no reason.
 */
export const useNow = (ticking: boolean): number => {
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (!ticking) {
			return;
		}
		setNow(Date.now());
		const handle = setInterval(() => {
			setNow(Date.now());
		}, TICK_MS);
		return () => {
			clearInterval(handle);
		};
	}, [ticking]);

	return now;
};
