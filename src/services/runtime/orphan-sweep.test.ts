import { runOrphanSweep } from '@/services/runtime/orphan-sweep';
import type { QueuedAction } from '@/services/sync/sync-types';

const upload = (
	id: string,
	workerId: string,
	fileUri: string,
	status: QueuedAction['status'] = { kind: 'queued' },
): QueuedAction => ({
	attempts: 0,
	clientActionId: id,
	createdAt: 1,
	kind: { documentType: 'passport', fileUri, type: 'document_upload' },
	nextAttemptAt: 0,
	status,
	workerId,
});

const terms: QueuedAction = {
	attempts: 0,
	clientActionId: 't',
	createdAt: 1,
	kind: { termsVersionId: 'v2', type: 'terms_acceptance' },
	nextAttemptAt: 0,
	status: { kind: 'queued' },
	workerId: 'w-ana',
};

const setup = (listRows: () => Promise<QueuedAction[]>) => {
	const swept: { workerId: string; keep: string[] }[] = [];
	const warnings: string[] = [];
	return {
		run: (workerId: string) =>
			runOrphanSweep({
				listRows,
				sweep: (id, keep) => {
					swept.push({ keep, workerId: id });
				},
				warn: () => {
					warnings.push('skipped');
				},
				workerId,
			}),
		swept,
		warnings,
	};
};

describe('runOrphanSweep', () => {
	it('keeps the file of every queued and failed upload and ignores terms rows', async () => {
		const { run, swept } = setup(() =>
			Promise.resolve([
				upload('a', 'w-ana', 'file:///docs/uploads/w-ana/a.jpg'),
				upload('b', 'w-ana', 'file:///docs/uploads/w-ana/b.jpg', {
					kind: 'failed',
					reason: 'too_large',
				}),
				terms,
			]),
		);

		await run('w-ana');

		expect(swept).toEqual([
			{
				keep: [
					'file:///docs/uploads/w-ana/a.jpg',
					'file:///docs/uploads/w-ana/b.jpg',
				],
				workerId: 'w-ana',
			},
		]);
	});

	it('sweeps the folder of the worker it was asked for, nobody else', async () => {
		const { run, swept } = setup(() => Promise.resolve([]));

		await run('w-bruno');

		expect(swept).toEqual([{ keep: [], workerId: 'w-bruno' }]);
	});

	it('never sweeps when the queue cannot be read, so nothing looks orphaned (M2)', async () => {
		const { run, swept, warnings } = setup(() =>
			Promise.reject(new Error('locked')),
		);

		await run('w-ana');

		expect(swept).toEqual([]);
		expect(warnings).toEqual(['skipped']);
	});
});
