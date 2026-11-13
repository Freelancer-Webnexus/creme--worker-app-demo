import type { QueuedAction } from '@/services/sync/sync-types';

/**
 * Photo files a queue row still points at, queued or failed. A failed row keeps
 * its file so the worker can retake or dismiss it (M5, M7), so the orphan sweep
 * must never delete it.
 */
export const referencedUploadUris = (rows: QueuedAction[]): string[] =>
	rows.flatMap((row) =>
		row.kind.type === 'document_upload' ? [row.kind.fileUri] : [],
	);
