import type { Assignment } from '@/services/api/api-types';
import type { AssignmentResult, WorkerApi } from '@/services/api/worker-api';
import {
	refreshAssignment,
	refreshAssignmentRetryingSuperseded,
} from '@/services/query/refresh-assignment';
import type { WorkerCacheStore } from '@/services/storage/worker-cache-store';

const assignment: Assignment = {
	acceptedTermsVersionId: null,
	currentTerms: {
		id: 'terms-v2',
		publishedAt: '2026-02-01',
		summary: { en: 'English', es: 'Español' },
		version: 2,
	},
	documents: [],
	flags: {},
	order: {
		employer: 'Valle Verde Farms',
		id: 'JO-2026-0142',
		seasonEnd: '2026-07-31',
		seasonStart: '2026-03-01',
		worksite: 'Yuma, AZ',
	},
	requiredDocuments: ['passport'],
};

const setup = (
	result: AssignmentResult,
	token: string | null = 'token',
	appliedBySave: boolean[] = [],
) => {
	const saved: { workerId: string; fetchedAt: number }[] = [];
	const events: string[] = [];
	let unauthorized = 0;
	let clock = 40;
	const api: WorkerApi = {
		fetchAssignment: () => {
			events.push('fetch');
			return Promise.resolve(result);
		},
		requestOtp: () => Promise.resolve({ kind: 'ok' }),
		verifyOtp: () => Promise.resolve({ kind: 'bad_code' }),
	};
	const cache = {
		saveAssignment: (
			workerId: string,
			_assignment: Assignment,
			fetchedAt: number,
		) => {
			saved.push({ fetchedAt, workerId });
			return Promise.resolve(appliedBySave.shift() ?? true);
		},
	} as unknown as WorkerCacheStore;
	const ports = {
		api,
		cache,
		now: () => {
			clock += 1;
			events.push('now');
			return clock;
		},
		onUnauthorized: () => {
			unauthorized += 1;
		},
		token: () => token,
	};
	return {
		events,
		run: () => refreshAssignment(ports, 'w1'),
		runRetryingSuperseded: () =>
			refreshAssignmentRetryingSuperseded(ports, 'w1'),
		saved,
		unauthorizedCount: () => unauthorized,
	};
};

describe('refreshAssignment', () => {
	it('saves a fresh assignment into the cache', async () => {
		const { run, saved } = setup({ assignment, kind: 'ok' });

		expect(await run()).toBe('refreshed');
		expect(saved).toEqual([{ fetchedAt: 41, workerId: 'w1' }]);
	});

	it('M3 M4 reads the clock before the request and saves with that time', async () => {
		const { events, run, saved } = setup({ assignment, kind: 'ok' });

		await run();

		expect(events).toEqual(['now', 'fetch']);
		expect(saved[0]?.fetchedAt).toBe(41);
	});

	it('M3 M4 reports superseded when the cache discards the save as older than a local fact', async () => {
		const { run, saved } = setup({ assignment, kind: 'ok' }, 'token', [false]);

		expect(await run()).toBe('superseded');
		expect(saved).toHaveLength(1);
	});

	describe('refreshAssignmentRetryingSuperseded', () => {
		it('fetches once when the first save is applied', async () => {
			const { events, runRetryingSuperseded } = setup({
				assignment,
				kind: 'ok',
			});

			expect(await runRetryingSuperseded()).toBe('refreshed');
			expect(events.filter((event) => event === 'fetch')).toHaveLength(1);
		});

		it('fetches exactly one more time after a superseded save, with a newer start time', async () => {
			const { events, runRetryingSuperseded, saved } = setup(
				{ assignment, kind: 'ok' },
				'token',
				[false, true],
			);

			expect(await runRetryingSuperseded()).toBe('refreshed');
			expect(events.filter((event) => event === 'fetch')).toHaveLength(2);
			expect(saved.map((save) => save.fetchedAt)).toEqual([41, 42]);
		});

		it('stops after one more fetch even if that save is superseded too', async () => {
			const { events, runRetryingSuperseded } = setup(
				{ assignment, kind: 'ok' },
				'token',
				[false, false, true],
			);

			expect(await runRetryingSuperseded()).toBe('superseded');
			expect(events.filter((event) => event === 'fetch')).toHaveLength(2);
		});

		it('does not fetch again after a network error', async () => {
			const { events, runRetryingSuperseded } = setup({
				kind: 'network_error',
			});

			expect(await runRetryingSuperseded()).toBe('kept_cache');
			expect(events.filter((event) => event === 'fetch')).toHaveLength(1);
		});
	});

	it('keeps the cache silently on a network error', async () => {
		const { run, saved, unauthorizedCount } = setup({ kind: 'network_error' });

		expect(await run()).toBe('kept_cache');
		expect(saved).toEqual([]);
		expect(unauthorizedCount()).toBe(0);
	});

	it('keeps the cache and says the server failed on a server error', async () => {
		const { run, saved, unauthorizedCount } = setup({ kind: 'server_error' });

		expect(await run()).toBe('server_error');
		expect(saved).toEqual([]);
		expect(unauthorizedCount()).toBe(0);
	});

	it('reports a 401 to the engine and keeps the cache', async () => {
		const { run, saved, unauthorizedCount } = setup({ kind: 'unauthorized' });

		expect(await run()).toBe('unauthorized');
		expect(saved).toEqual([]);
		expect(unauthorizedCount()).toBe(1);
	});

	it('does not call the server without a token', async () => {
		const { run, saved } = setup({ assignment, kind: 'ok' }, null);

		expect(await run()).toBe('skipped');
		expect(saved).toEqual([]);
	});
});
