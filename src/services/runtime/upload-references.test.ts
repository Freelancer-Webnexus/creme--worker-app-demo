import { referencedUploadUris } from '@/services/runtime/upload-references';
import type { QueuedAction } from '@/services/sync/sync-types';

const base = {
	attempts: 0,
	createdAt: 1,
	nextAttemptAt: 0,
	workerId: 'w1',
};

describe('referencedUploadUris', () => {
	it('keeps the file of queued and failed uploads and skips terms', () => {
		const rows: QueuedAction[] = [
			{
				...base,
				clientActionId: 'a',
				kind: {
					documentType: 'passport',
					fileUri: 'file:///u/a.jpg',
					type: 'document_upload',
				},
				status: { kind: 'queued' },
			},
			{
				...base,
				clientActionId: 'b',
				kind: {
					documentType: 'ds160_confirmation',
					fileUri: 'file:///u/b.jpg',
					type: 'document_upload',
				},
				status: { kind: 'failed', reason: 'too_large' },
			},
			{
				...base,
				clientActionId: 'c',
				kind: { termsVersionId: 'v2', type: 'terms_acceptance' },
				status: { kind: 'queued' },
			},
		];

		expect(referencedUploadUris(rows)).toEqual([
			'file:///u/a.jpg',
			'file:///u/b.jpg',
		]);
	});

	it('returns nothing for an empty queue', () => {
		expect(referencedUploadUris([])).toEqual([]);
	});
});
