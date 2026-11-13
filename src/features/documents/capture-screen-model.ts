import type { CaptureContent } from '@/features/documents/capture-content';

/** Everything the capture view prints and every action it can fire. */
export type CaptureScreenModel = {
	title: string;
	content: CaptureContent;
	cancelLabel: string;
	onTakePhoto: () => void;
	onChooseGallery: () => void;
	onSubmit: () => void;
	onRetake: () => void;
	onOpenSettings: () => void;
	onCancel: () => void;
};
