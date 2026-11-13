const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 60_000;
const JITTER = 0.2;

/**
 * How long to wait after the given number of failed attempts: 1 s, 2 s, 4 s,
 * and so on, capped at 60 s, then spread by plus or minus 20 percent so many
 * phones do not retry at the same moment (M5).
 */
export const nextDelayMs = (attempts: number, random: () => number): number => {
	const base = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempts);
	const factor = 1 - JITTER + random() * 2 * JITTER;
	return Math.round(base * factor);
};
