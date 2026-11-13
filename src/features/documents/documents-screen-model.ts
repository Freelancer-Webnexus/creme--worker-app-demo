import type { DocumentsContent } from '@/features/documents/documents-content';

/** Everything the Documents view prints and every action it can fire. */
export type DocumentsScreenModel = {
	title: string;
	content: DocumentsContent;
	refreshing: boolean;
	onRefresh: () => void;
	onOpenCapture: (documentType: string) => void;
	onDismissFailed: (failedActionId: string) => void;
};
