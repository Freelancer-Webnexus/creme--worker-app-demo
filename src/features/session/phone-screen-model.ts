import type { SessionNotice } from '@/features/session/session-notice';
import type { Language } from '@/services/i18n/translate';

/** Everything the phone view prints and every action it can fire. */
export type PhoneScreenModel = {
	title: string;
	label: string;
	hint: string;
	value: string;
	error: string | undefined;
	buttonTitle: string;
	isBusy: boolean;
	notice: SessionNotice | null;
	languageLabel: string;
	languageOptions: { label: string; value: Language }[];
	language: Language;
	onChangeText: (text: string) => void;
	onSubmit: () => void;
	onLanguageChange: (language: Language) => void;
};
