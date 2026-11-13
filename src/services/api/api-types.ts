/**
 * Wire shapes of the mock backend. `docs/api-contract.md` is the source of
 * truth; a change here needs backend sign-off (house rule 2).
 */

export type WorkerSummary = {
	id: string;
	name: string;
};

export type OtpVerifyResponse = {
	token: string;
	/** Epoch milliseconds. */
	expiresAt: number;
	workers: WorkerSummary[];
};

export type TermsVersion = {
	id: string;
	/** Display number: 2 for "v2". */
	version: number;
	publishedAt: string;
	/** Terms text by language, written by staff. */
	summary: { es: string; en: string };
};

export type JobOrder = {
	id: string;
	employer: string;
	worksite: string;
	/** ISO dates, YYYY-MM-DD. */
	seasonStart: string;
	seasonEnd: string;
};

/** Staff-side document states only. Device-only states never come from here (M4). */
export type ServerDocumentState =
	| { state: 'pending_review' }
	| { state: 'approved' }
	| { state: 'correction_requested'; reason: string };

export type ServerDocument = ServerDocumentState & {
	documentType: string;
};

export type Assignment = {
	order: JobOrder;
	currentTerms: TermsVersion;
	/** Null until the worker has accepted a version. */
	acceptedTermsVersionId: string | null;
	/** Catalog for this assignment, in display order (M7). */
	requiredDocuments: string[];
	/** Only documents that have been submitted at least once. */
	documents: ServerDocument[];
	/** Stand-in for a remote feature-flag service (house rule 7). */
	flags: Record<string, boolean>;
};

export type StaleTermsBody = {
	error: 'stale_terms';
	currentTerms: TermsVersion;
};
