import { isLanguage, type Language } from '@/services/i18n/translate';
import { logger } from '@/services/logger/logger';

type PersistLanguage = (language: Language) => Promise<void>;

let current: Language = 'es';
let persist: PersistLanguage | null = null;
let listeners: (() => void)[] = [];

const notify = (): void => {
	for (const listener of listeners) {
		listener();
	}
};

export const getLanguage = (): Language => current;

export const subscribe = (listener: () => void): (() => void) => {
	listeners = [...listeners, listener];
	return () => {
		listeners = listeners.filter((other) => other !== listener);
	};
};

/** The store imports no storage; the composition root passes the writer in. */
export const configureLanguagePersistence = (write: PersistLanguage): void => {
	persist = write;
};

export const setLanguage = (language: Language): void => {
	if (language === current) {
		return;
	}
	current = language;
	notify();
	persist?.(language).catch(() => {
		logger.warn('i18n', 'Could not save the language choice.');
	});
};

/** Applies the saved language without writing it back. Unknown values are ignored. */
export const hydrateLanguage = async (
	read: () => Promise<string | null>,
): Promise<void> => {
	try {
		const saved = await read();
		if (isLanguage(saved) && saved !== current) {
			current = saved;
			notify();
		}
	} catch {
		logger.warn('i18n', 'Could not read the saved language.');
	}
};

export const resetLanguageStoreForTests = (): void => {
	current = 'es';
	persist = null;
	listeners = [];
};
