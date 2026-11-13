import type { Assignment, TermsVersion } from '@/services/api/api-types';

export function withTermsAccepted(
	assignment: Assignment,
	termsVersionId: string,
): Assignment {
	return { ...assignment, acceptedTermsVersionId: termsVersionId };
}

export function withCurrentTerms(
	assignment: Assignment,
	currentTerms: TermsVersion,
): Assignment {
	return { ...assignment, currentTerms };
}

export function withDocumentPendingReview(
	assignment: Assignment,
	documentType: string,
): Assignment {
	const exists = assignment.documents.some(
		(document) => document.documentType === documentType,
	);
	const pending = { documentType, state: 'pending_review' as const };
	return {
		...assignment,
		documents: exists
			? assignment.documents.map((document) =>
					document.documentType === documentType ? pending : document,
				)
			: [...assignment.documents, pending],
	};
}
