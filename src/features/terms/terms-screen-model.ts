import type { TermsContent } from '@/features/terms/terms-content';

/** Everything the Terms view prints and every action it can fire. */
export type TermsScreenModel = {
	title: string;
	content: TermsContent;
	refreshing: boolean;
	onRefresh: () => void;
	/** Takes the id of the version on screen, so that exact version is accepted (M6). */
	onConfirm: (versionId: string) => void;
};
