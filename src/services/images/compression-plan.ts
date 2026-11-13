/**
 * Strictly under the server's 1.5 MB limit of 1 572 864 bytes, so multipart
 * framing never tips an upload into a 413 (M7).
 */
export const MAX_UPLOAD_BYTES = 1_500_000;

export type CompressionAttempt = {
	maxEdge: number;
	quality: number;
};

export const COMPRESSION_LADDER: readonly CompressionAttempt[] = [
	{ maxEdge: 1600, quality: 0.7 },
	{ maxEdge: 1280, quality: 0.6 },
	{ maxEdge: 1024, quality: 0.5 },
	{ maxEdge: 800, quality: 0.4 },
];

export type Size = { width: number; height: number };

/** Never upscales and keeps the aspect ratio. Sides are whole pixels, at least 1. */
export const resizeFor = (
	width: number,
	height: number,
	maxEdge: number,
): Size => {
	const longest = Math.max(width, height);
	if (longest <= maxEdge) {
		return { width, height };
	}
	const scale = maxEdge / longest;
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
	};
};

/** The attempt to try at this index, or null once the ladder is used up. */
export const planNextAttempt = (
	attemptIndex: number,
): CompressionAttempt | null => COMPRESSION_LADDER[attemptIndex] ?? null;
