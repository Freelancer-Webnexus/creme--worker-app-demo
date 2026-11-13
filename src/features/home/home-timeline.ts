import type { WorkerCache } from '@/services/storage/worker-cache-store';
import { documentRowState } from '@/services/sync/document-row-state';
import type { QueuedAction } from '@/services/sync/sync-types';
import { termsState } from '@/services/sync/terms-state';

export type TimelineStepId =
	'terms_confirmed' | 'documents_submitted' | 'documents_approved';

/**
 * `saved_on_phone`: the worker did their part and it waits in the queue. It is
 * never `done`, because done means the server has it (M4). `in_review`: the
 * server has everything and staff have not decided yet, so nothing is owed by
 * the worker.
 */
export type TimelineStatus =
	'done' | 'saved_on_phone' | 'in_review' | 'not_done';

export type TimelineStep = {
	id: TimelineStepId;
	status: TimelineStatus;
};

const statusOf = (done: boolean, savedOnPhone: boolean): TimelineStatus => {
	if (done) return 'done';
	return savedOnPhone ? 'saved_on_phone' : 'not_done';
};

const approvalStatus = (
	allApproved: boolean,
	allDelivered: boolean,
): TimelineStatus => {
	if (allApproved) return 'done';
	return allDelivered ? 'in_review' : 'not_done';
};

/**
 * The three steps of onboarding, derived from the cached server facts and the
 * queue. "Submitted" means delivered: a document that is only saved on this
 * phone (`pending_sync`) or failed to send does not count, and neither does
 * terms acceptance that is still waiting to be sent (M4). Those show as saved
 * on the phone instead. A document staff sent back for correction is not
 * submitted either: the worker owes a new photo. A catalog with no documents
 * counts as not done: nothing is known to submit.
 */
export const buildTimeline = (
	cache: WorkerCache,
	localActions: QueuedAction[],
): TimelineStep[] => {
	const { assignment } = cache;

	const terms = termsState({
		acceptedTermsVersionId: assignment.acceptedTermsVersionId,
		current: assignment.currentTerms,
		lastSeenTermsVersionId: cache.lastSeenTermsVersionId,
		localActions,
	});

	const documents = assignment.requiredDocuments.map((documentType) =>
		documentRowState(documentType, assignment.documents, localActions),
	);
	const hasDocuments = documents.length > 0;
	const delivered = documents.map(
		(state) => state.kind === 'pending_review' || state.kind === 'approved',
	);
	const allDelivered = hasDocuments && delivered.every(Boolean);
	const allApproved =
		hasDocuments && documents.every((state) => state.kind === 'approved');
	const restSaved =
		hasDocuments &&
		documents.every(
			(state, index) => delivered[index] || state.kind === 'pending_sync',
		);

	return [
		{
			id: 'terms_confirmed',
			status: statusOf(
				terms.kind === 'confirmed',
				terms.kind === 'pending_sync',
			),
		},
		{
			id: 'documents_submitted',
			status: statusOf(allDelivered, restSaved),
		},
		{
			id: 'documents_approved',
			status: approvalStatus(allApproved, allDelivered),
		},
	];
};
