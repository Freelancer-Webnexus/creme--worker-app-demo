import type { SessionNotice } from '@/features/session/session-notice';

/** Everything the code view prints and every action it can fire. */
export type CodeScreenModel = {
	/** No number was entered first (the app restarted here): go back to the phone screen. */
	needsPhone: boolean;
	title: string;
	intro: string;
	label: string;
	hint: string;
	value: string;
	error: string | undefined;
	buttonTitle: string;
	changeNumberTitle: string;
	isBusy: boolean;
	notice: SessionNotice | null;
	onChangeText: (text: string) => void;
	onSubmit: () => void;
	onChangeNumber: () => void;
};
