import {
	COMPRESSION_LADDER,
	MAX_UPLOAD_BYTES,
	planNextAttempt,
	resizeFor,
} from '@/services/images/compression-plan';

describe('MAX_UPLOAD_BYTES', () => {
	it('is strictly under the server limit of 1 572 864 bytes (M7)', () => {
		expect(MAX_UPLOAD_BYTES).toBe(1_500_000);
		expect(MAX_UPLOAD_BYTES).toBeLessThan(1_572_864);
	});
});

describe('resizeFor', () => {
	it.each([
		[4000, 3000, 1600, { width: 1600, height: 1200 }],
		[3000, 4000, 1600, { width: 1200, height: 1600 }],
		[4000, 3000, 800, { width: 800, height: 600 }],
		[1600, 1200, 1600, { width: 1600, height: 1200 }],
		[800, 600, 1600, { width: 800, height: 600 }],
		[1000, 1000, 1024, { width: 1000, height: 1000 }],
		[4032, 3024, 1280, { width: 1280, height: 960 }],
		[3001, 2001, 1600, { width: 1600, height: 1067 }],
		[10_000, 10, 800, { width: 800, height: 1 }],
	])('%d x %d at %d -> %j', (width, height, maxEdge, expected) => {
		expect(resizeFor(width, height, maxEdge)).toEqual(expected);
	});

	it('returns whole numbers', () => {
		const { width, height } = resizeFor(3001, 1999, 1280);
		expect(Number.isInteger(width)).toBe(true);
		expect(Number.isInteger(height)).toBe(true);
	});

	it('never upscales', () => {
		const { width, height } = resizeFor(500, 300, 1600);
		expect(width).toBeLessThanOrEqual(500);
		expect(height).toBeLessThanOrEqual(300);
	});
});

describe('planNextAttempt', () => {
	it('walks the ladder from sharpest to smallest', () => {
		expect(COMPRESSION_LADDER).toEqual([
			{ maxEdge: 1600, quality: 0.7 },
			{ maxEdge: 1280, quality: 0.6 },
			{ maxEdge: 1024, quality: 0.5 },
			{ maxEdge: 800, quality: 0.4 },
		]);
		expect(planNextAttempt(0)).toEqual({ maxEdge: 1600, quality: 0.7 });
		expect(planNextAttempt(3)).toEqual({ maxEdge: 800, quality: 0.4 });
	});

	it('returns null when the ladder is used up or the index is invalid', () => {
		expect(planNextAttempt(4)).toBeNull();
		expect(planNextAttempt(-1)).toBeNull();
	});
});
