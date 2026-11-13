import { referencedUploadUris } from '@/services/runtime/upload-references';
import type { QueuedAction } from '@/services/sync/sync-types';

export type OrphanSweepPorts = {
	listRows: () => Promise<QueuedAction[]>;
	sweep: (workerId: string, keepFileUris: string[]) => void;
	warn: () => void;
	workerId: string;
};

/**
 * One pass at app start for one worker. It skips the pass when the queue cannot
 * be read: with no list of kept files, everything would look like an orphan (M2).
 */
export const runOrphanSweep = async (
	ports: OrphanSweepPorts,
): Promise<void> => {
	try {
		const rows = await ports.listRows();
		ports.sweep(ports.workerId, referencedUploadUris(rows));
	} catch {
		ports.warn();
	}
};
