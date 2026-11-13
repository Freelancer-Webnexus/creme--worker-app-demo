import {
	configureLanguagePersistence,
	getLanguage,
	hydrateLanguage,
	resetLanguageStoreForTests,
	setLanguage,
	subscribe,
} from '@/services/i18n/language-store';
import type { Language } from '@/services/i18n/translate';
import { resetLoggerSink, setLoggerSink } from '@/services/logger/logger';

beforeEach(() => {
	resetLanguageStoreForTests();
	setLoggerSink(() => {});
});

afterEach(() => {
	resetLoggerSink();
});

describe('language store', () => {
	it('defaults to Spanish (M9)', () => {
		expect(getLanguage()).toBe('es');
	});

	it('notifies subscribers once per change and not on a repeat', () => {
		let calls = 0;
		subscribe(() => {
			calls += 1;
		});
		setLanguage('en');
		setLanguage('en');
		expect(getLanguage()).toBe('en');
		expect(calls).toBe(1);
	});

	it('stops notifying after unsubscribe', () => {
		let calls = 0;
		const unsubscribe = subscribe(() => {
			calls += 1;
		});
		unsubscribe();
		setLanguage('en');
		expect(calls).toBe(0);
	});

	it('writes a change through the injected persistence', () => {
		const written: Language[] = [];
		configureLanguagePersistence(async (language) => {
			written.push(language);
		});
		setLanguage('en');
		expect(written).toEqual(['en']);
	});

	it('keeps the change when saving fails', async () => {
		configureLanguagePersistence(() => Promise.reject(new Error('disk full')));
		setLanguage('en');
		await Promise.resolve();
		expect(getLanguage()).toBe('en');
	});

	it('hydrates a saved language without writing it back', async () => {
		const written: Language[] = [];
		configureLanguagePersistence(async (language) => {
			written.push(language);
		});
		await hydrateLanguage(async () => 'en');
		expect(getLanguage()).toBe('en');
		expect(written).toEqual([]);
	});

	it('a boot retry configures and hydrates again: only the newest writer is used and the language stays', async () => {
		const first: Language[] = [];
		const second: Language[] = [];
		configureLanguagePersistence(async (language) => {
			first.push(language);
		});
		await hydrateLanguage(async () => 'en');

		configureLanguagePersistence(async (language) => {
			second.push(language);
		});
		await hydrateLanguage(async () => 'en');
		setLanguage('es');

		expect(getLanguage()).toBe('es');
		expect(first).toEqual([]);
		expect(second).toEqual(['es']);
	});

	it.each([[null], ['fr'], ['']])(
		'ignores the saved value %j',
		async (saved) => {
			await hydrateLanguage(async () => saved);
			expect(getLanguage()).toBe('es');
		},
	);

	it('keeps the default when reading fails', async () => {
		await hydrateLanguage(() => Promise.reject(new Error('locked')));
		expect(getLanguage()).toBe('es');
	});
});
