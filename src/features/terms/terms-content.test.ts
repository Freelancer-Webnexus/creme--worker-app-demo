import type { ConfirmState } from '@/features/terms/confirm-state';
import {
	presentTermsContent,
	type TermsContent,
	type TermsContentContext,
	type TermsReadyContent,
} from '@/features/terms/terms-content';
import type { Assignment, TermsVersion } from '@/services/api/api-types';
import { type Language, translate } from '@/services/i18n/translate';
import type { WorkerCache } from '@/services/storage/worker-cache-store';
import type { QueuedAction } from '@/services/sync/sync-types';

const v2: TermsVersion = {
	id: 'terms-v2',
	publishedAt: '2026-02-10T09:00:00.000Z',
	summary: { en: 'English summary v2', es: 'Resumen en español v2' },
	version: 2,
};

const v3: TermsVersion = {
	id: 'terms-v3',
	publishedAt: '2026-05-04T09:00:00.000Z',
	summary: { en: 'English summary v3', es: 'Resumen en español v3' },
	version: 3,
};

const cacheOf = (
	current: TermsVersion,
	acceptedTermsVersionId: string | null,
): WorkerCache => {
	const assignment: Assignment = {
		acceptedTermsVersionId,
		currentTerms: current,
		documents: [],
		flags: {},
		order: {
			employer: 'Valle Verde Farms',
			id: 'JO-2026-0142',
			seasonEnd: '2026-07-31',
			seasonStart: '2026-03-01',
			worksite: 'Yuma, AZ',
		},
		requiredDocuments: ['passport'],
	};
	return { assignment, fetchedAt: 1, lastSeenTermsVersionId: null };
};

const acceptance = (
	termsVersionId: string,
	status: QueuedAction['status'],
): QueuedAction => ({
	attempts: 0,
	clientActionId: `a-${termsVersionId}-${status.kind}`,
	createdAt: 1,
	kind: { termsVersionId, type: 'terms_acceptance' },
	nextAttemptAt: 0,
	status,
	workerId: 'w1',
});

const idle: ConfirmState = { kind: 'idle' };

const contextFor = (
	language: Language,
	overrides: Partial<TermsContentContext> = {},
): TermsContentContext => ({
	confirm: idle,
	language,
	pendingReason: 'waiting_for_connection',
	rows: [],
	seenBeforeId: null,
	...overrides,
});

const present = (
	cache: WorkerCache,
	language: Language,
	overrides: Partial<TermsContentContext> = {},
): TermsReadyContent => {
	const t = (
		key: Parameters<typeof translate>[1],
		params?: Record<string, string | number>,
	) => translate(language, key, params);
	const content: TermsContent = presentTermsContent(
		{ cache, kind: 'ready' },
		contextFor(language, overrides),
		t,
	);
	if (content.kind !== 'ready') {
		throw new Error(`Expected ready content, got ${content.kind}.`);
	}
	return content;
};

describe('presentTermsContent', () => {
	it.each(['es', 'en'] as const)(
		'needs confirmation, first visit (%s)',
		(language) => {
			const content = present(cacheOf(v2, null), language);

			expect(content.banner).toBeNull();
			expect(content.statusRole).toBe('neutral');
			expect(content.action).toEqual({
				busy: false,
				kind: 'confirm',
				label: translate(language, 'terms.confirm'),
			});
			expect(content.summary).toEqual([
				{ kind: 'text', text: v2.summary[language] },
			]);
			expect(content.versionId).toBe('terms-v2');
			expect(content.versionLabel).toBe(
				translate(language, 'terms.version', { version: 2 }),
			);
		},
	);

	it('writes the published date for the language', () => {
		expect(present(cacheOf(v2, null), 'es').publishedLabel).toBe(
			'Publicada el 10 de febrero de 2026',
		);
		expect(present(cacheOf(v2, null), 'en').publishedLabel).toBe(
			'Published on February 10, 2026',
		);
	});

	it.each(['es', 'en'] as const)(
		'shows the banner above a changed version and keeps the confirm button (%s)',
		(language) => {
			const content = present(cacheOf(v3, 'terms-v2'), language, {
				seenBeforeId: 'terms-v2',
			});

			expect(content.banner).toBe(translate(language, 'terms.changed'));
			expect(content.statusRole).toBe('correction');
			expect(content.action.kind).toBe('confirm');
			expect(content.summary).toEqual([
				{ kind: 'text', text: v3.summary[language] },
			]);
		},
	);

	it('shows no banner once the visit started on the current version', () => {
		const content = present(cacheOf(v3, 'terms-v2'), 'es', {
			seenBeforeId: 'terms-v3',
		});

		expect(content.banner).toBeNull();
	});

	it.each(['es', 'en'] as const)(
		'is amber and offers no button while the acceptance is only on the phone (%s)',
		(language) => {
			const content = present(cacheOf(v2, null), language, {
				rows: [acceptance('terms-v2', { kind: 'queued' })],
			});

			expect(content.statusRole).toBe('pending_sync');
			expect(content.statusText).toBe(
				`${translate(language, 'pending.base')} ${translate(language, 'pending.reason_offline')}`,
			);
			expect(content.action).toEqual({ kind: 'none' });
			expect(content.banner).toBeNull();
		},
	);

	it('never calls v3 confirmed or pending because of a queued acceptance of v2 (scenario 4)', () => {
		const content = present(cacheOf(v3, null), 'es', {
			rows: [acceptance('terms-v2', { kind: 'queued' })],
			seenBeforeId: 'terms-v2',
		});

		expect(content.versionId).toBe('terms-v3');
		expect(content.statusRole).toBe('correction');
		expect(content.banner).not.toBeNull();
		expect(content.action.kind).toBe('confirm');
	});

	it.each(['es', 'en'] as const)(
		'is green and offers no button once confirmed (%s)',
		(language) => {
			const content = present(cacheOf(v2, 'terms-v2'), language);

			expect(content.statusRole).toBe('approved');
			expect(content.statusText).toBe(translate(language, 'terms.confirmed'));
			expect(content.action).toEqual({ kind: 'none' });
		},
	);

	it.each(['es', 'en'] as const)(
		'shows a plain error with Retry after a rejection (%s)',
		(language) => {
			const content = present(cacheOf(v2, null), language, {
				rows: [acceptance('terms-v2', { kind: 'failed', reason: 'rejected' })],
			});

			expect(content.statusRole).toBe('failed');
			expect(content.statusText).toBe(translate(language, 'terms.rejected'));
			expect(content.action).toEqual({
				busy: false,
				kind: 'confirm',
				label: translate(language, 'error.retry'),
			});
		},
	);

	it('turns the button off and says it is saving while the enqueue runs', () => {
		const content = present(cacheOf(v2, null), 'es', {
			confirm: { kind: 'saving' },
		});

		expect(content.action).toEqual({
			busy: true,
			kind: 'confirm',
			label: 'Guardando…',
		});
	});

	it('says when the acceptance could not be saved on the phone', () => {
		const content = present(cacheOf(v2, null), 'en', {
			confirm: { kind: 'not_saved' },
		});

		expect(content.notice).toBe('Could not save on this phone. Try again.');
		expect(content.action.kind).toBe('confirm');
	});

	it('names the real reason on the pending line, not always the connection', () => {
		const content = present(cacheOf(v2, null), 'es', {
			pendingReason: 'sending_now',
			rows: [acceptance('terms-v2', { kind: 'queued' })],
		});

		expect(content.statusText).toBe(
			'Guardado en este teléfono. Todavía no se envió. Enviando ahora.',
		);
	});

	it('shows no save error where there is no button', () => {
		const content = present(cacheOf(v2, 'terms-v2'), 'en', {
			confirm: { kind: 'not_saved' },
		});

		expect(content.notice).toBeNull();
	});

	it('explains that the first load needs a connection', () => {
		const t = (key: Parameters<typeof translate>[1]) => translate('es', key);

		expect(
			presentTermsContent({ kind: 'needs_connection' }, contextFor('es'), t),
		).toEqual({
			body: translate('es', 'state.empty_body'),
			kind: 'empty',
			retryTitle: translate('es', 'error.retry'),
			title: translate('es', 'state.empty_title'),
		});
		expect(
			presentTermsContent({ kind: 'loading' }, contextFor('es'), t),
		).toEqual({
			kind: 'loading',
			text: translate('es', 'state.loading'),
		});
	});

	it('says the server is not answering when it failed on the first load', () => {
		const t = (key: Parameters<typeof translate>[1]) => translate('es', key);

		expect(
			presentTermsContent({ kind: 'server_unavailable' }, contextFor('es'), t),
		).toEqual({
			body: translate('es', 'state.server_body'),
			kind: 'empty',
			retryTitle: translate('es', 'error.retry'),
			title: translate('es', 'state.server_title'),
		});
	});

	it('never mixes the words of a saved-only state with a delivered one', () => {
		const pending = present(cacheOf(v2, null), 'es', {
			rows: [acceptance('terms-v2', { kind: 'queued' })],
		});
		const confirmed = present(cacheOf(v2, 'terms-v2'), 'es');

		expect(pending.statusText.toLowerCase()).toContain('teléfono');
		expect(pending.statusText.toLowerCase()).not.toContain('confirmaste');
		expect(confirmed.statusText.toLowerCase()).not.toContain('teléfono');
	});
});
