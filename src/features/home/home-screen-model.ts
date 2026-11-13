import type { HomeContent } from '@/features/home/home-body-copy';
import type { SyncIndicatorPresentation } from '@/features/home/sync-indicator-copy';
import type { Language } from '@/services/i18n/translate';

export type LanguageSection = {
	title: string;
	label: string;
	options: { label: string; value: Language }[];
	selected: Language;
	onChange: (language: Language) => void;
};

export type AccountSection = {
	title: string;
	signedInAs: string;
	/** Null when this phone has only one worker. */
	switchWorkerTitle: string | null;
	signOutTitle: string;
};

export type DebugLink = {
	title: string;
	onPress: () => void;
};

/** Everything the Home view prints and every action it can fire. */
export type HomeScreenModel = {
	/** Null in a production build: nothing debug ships. */
	debugLink: DebugLink | null;
	greeting: string;
	indicator: SyncIndicatorPresentation;
	content: HomeContent;
	language: LanguageSection;
	account: AccountSection;
	refreshing: boolean;
	onRefresh: () => void;
	onRetryNow: () => void;
	onSignInAgain: () => void;
	onSwitchWorker: () => void;
	onSignOut: () => void;
};
