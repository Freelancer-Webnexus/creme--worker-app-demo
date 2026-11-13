import { useSyncExternalStore } from 'react';
import {
	getLanguage,
	setLanguage,
	subscribe,
} from '@/services/i18n/language-store';
import {
	type Language,
	translate,
	type TranslationKey,
	type TranslationParams,
} from '@/services/i18n/translate';

type Translation = {
	t: (key: TranslationKey, params?: TranslationParams) => string;
	language: Language;
	setLanguage: (language: Language) => void;
};

export const useTranslation = (): Translation => {
	const language = useSyncExternalStore(subscribe, getLanguage, getLanguage);

	return {
		t: (key, params) => translate(language, key, params),
		language,
		setLanguage,
	};
};
