import { nextDelayMs } from '@/services/sync/backoff';

const noJitter = () => 0.5;

describe('nextDelayMs', () => {
	const cases: { attempts: number; expectedMs: number }[] = [
		{ attempts: 0, expectedMs: 1_000 },
		{ attempts: 1, expectedMs: 2_000 },
		{ attempts: 2, expectedMs: 4_000 },
		{ attempts: 5, expectedMs: 32_000 },
		{ attempts: 6, expectedMs: 60_000 },
		{ attempts: 10, expectedMs: 60_000 },
		{ attempts: 1_000, expectedMs: 60_000 },
	];

	it.each(cases)(
		'attempt $attempts waits $expectedMs ms before jitter',
		({ attempts, expectedMs }) => {
			expect(nextDelayMs(attempts, noJitter)).toBe(expectedMs);
		},
	);

	it('lowest jitter is 20 percent under the base delay', () => {
		expect(nextDelayMs(1, () => 0)).toBe(1_600);
	});

	it('highest jitter stays under 20 percent over the base delay', () => {
		const delay = nextDelayMs(1, () => 0.999999);
		expect(delay).toBeGreaterThan(2_000);
		expect(delay).toBeLessThanOrEqual(2_400);
	});

	it('applies the jitter to the capped delay too', () => {
		expect(nextDelayMs(20, () => 0)).toBe(48_000);
	});
});
