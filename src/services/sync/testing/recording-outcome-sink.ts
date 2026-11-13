import type { TermsVersion } from '@/services/api/api-types';
import type { OutcomeSink } from '@/services/sync/sync-ports';
import type { FailureReason, QueuedAction } from '@/services/sync/sync-types';

export type RecordingOutcomeSink = OutcomeSink & {
	deliveredActions: QueuedAction[];
	staleTermsCalls: { action: QueuedAction; currentTerms: TermsVersion }[];
	rejectedCalls: { action: QueuedAction; reason: FailureReason }[];
	discardedActions: QueuedAction[];
};

export const createRecordingOutcomeSink = (): RecordingOutcomeSink => {
	const sink: RecordingOutcomeSink = {
		deliveredActions: [],
		staleTermsCalls: [],
		rejectedCalls: [],
		discardedActions: [],

		delivered: async (action) => {
			sink.deliveredActions.push(action);
		},
		staleTerms: async (action, currentTerms) => {
			sink.staleTermsCalls.push({ action, currentTerms });
		},
		rejected: async (action, reason) => {
			sink.rejectedCalls.push({ action, reason });
		},
		discarded: async (action) => {
			sink.discardedActions.push(action);
		},
	};
	return sink;
};
