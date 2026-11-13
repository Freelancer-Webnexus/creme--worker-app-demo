import {
	describeSyncIndicator,
	type SyncIndicatorPresentation,
} from '@/features/home/sync-indicator-copy';
import { type Language, translate } from '@/services/i18n/translate';
import type { SyncIndicator } from '@/services/runtime/sync-indicator-model';

const present = (
	indicator: SyncIndicator,
	language: Language,
): SyncIndicatorPresentation =>
	describeSyncIndicator(indicator, (key, params) =>
		translate(language, key, params),
	);

const variants: SyncIndicator[] = [
	{ kind: 'checking' },
	{ kind: 'session_expired', savedCount: 2 },
	{ kind: 'session_expired', savedCount: 0 },
	{ count: 1, kind: 'offline_waiting' },
	{ count: 2, kind: 'offline_waiting' },
	{ kind: 'offline_clear' },
	{ failedCount: 1, isOnline: true, kind: 'needs_attention', queuedCount: 0 },
	{ failedCount: 3, isOnline: true, kind: 'needs_attention', queuedCount: 1 },
	{ failedCount: 1, isOnline: false, kind: 'needs_attention', queuedCount: 2 },
	{ failedCount: 2, isOnline: false, kind: 'needs_attention', queuedCount: 0 },
	{ count: 1, isRetry: false, kind: 'sending' },
	{ count: 4, isRetry: false, kind: 'sending' },
	{ count: 2, isRetry: true, kind: 'sending' },
	{ count: 2, kind: 'retrying', seconds: 12 },
	{ kind: 'nothing_pending' },
];

describe('describeSyncIndicator', () => {
	it('says the saved actions are on this phone while offline, in Spanish', () => {
		const text = present({ count: 2, kind: 'offline_waiting' }, 'es');

		expect(`${text.headline}. ${text.detail}`).toBe(
			'Sin conexión. 2 acciones guardadas en este teléfono, esperando conexión.',
		);
		expect(text.role).toBe('pending_sync');
	});

	it('says the same in English', () => {
		const text = present({ count: 1, kind: 'offline_waiting' }, 'en');

		expect(`${text.headline}. ${text.detail}`).toBe(
			'No connection. 1 action saved on this phone, waiting for connection.',
		);
	});

	it('shows the countdown and offers retry now while backing off', () => {
		const text = present({ count: 2, kind: 'retrying', seconds: 12 }, 'es');

		expect(text.headline).toBe('Reintentando en 12 s');
		expect(text.action).toEqual({
			busy: false,
			kind: 'retry_now',
			label: 'Reintentar ahora',
		});
	});

	it('keeps "retry now" in place, busy, while a failed action is sent again', () => {
		const text = present({ count: 2, isRetry: true, kind: 'sending' }, 'es');

		expect(text.action).toEqual({
			busy: true,
			kind: 'retry_now',
			label: 'Reintentar ahora',
		});
	});

	it('offers no button while a fresh action is sent', () => {
		const text = present({ count: 2, isRetry: false, kind: 'sending' }, 'es');

		expect(text.action).toEqual({ kind: 'none' });
	});

	it('keeps the countdown out of what the screen reader says', () => {
		const text = present({ count: 2, kind: 'retrying', seconds: 12 }, 'es');

		expect(text.accessibilityLabel).not.toContain('12');
		expect(text.accessibilityLabel).toContain('Reintentando en unos segundos');
	});

	it.each(['es', 'en'] as const)(
		'never repeats the headline in the detail line (%s)',
		(language) => {
			for (const indicator of variants) {
				const { detail, headline } = present(indicator, language);

				expect(detail ?? '').not.toContain(headline);
			}
		},
	);

	it('offers "sign in again" and says the actions are safe when the session expired', () => {
		const text = present({ kind: 'session_expired', savedCount: 3 }, 'es');

		expect(text.action).toEqual({
			kind: 'sign_in_again',
			label: 'Entrar de nuevo',
		});
		expect(text.detail).toContain('3 acciones');
		expect(text.detail).toContain('no se pierden');
	});

	it('says only that nothing waits on this phone, never that anything arrived (M4)', () => {
		const es = present({ kind: 'nothing_pending' }, 'es');
		const en = present({ kind: 'nothing_pending' }, 'en');

		expect(es.headline).toBe('Nada por enviar en este teléfono.');
		expect(es.detail).toBeNull();
		expect(en.headline).toBe('Nothing waiting to be sent from this phone.');
		expect(en.detail).toBeNull();
		expect(es.role).toBe('neutral');
	});

	it('marks failed actions in the failed role', () => {
		expect(
			present(
				{
					failedCount: 1,
					isOnline: true,
					kind: 'needs_attention',
					queuedCount: 0,
				},
				'es',
			).role,
		).toBe('failed');
	});

	it.each([
		[
			'es',
			'1 acción necesita tu atención. No se pudo enviar. Abre Documentos o Términos para ver qué hacer. 2 acciones guardadas en este teléfono, aún sin enviar.',
		],
		[
			'en',
			'1 action needs your attention. It could not be sent. Open Documents or Terms to see what to do. 2 actions saved on this phone, not sent yet.',
		],
	] as const)(
		'keeps the waiting count next to a failed action online (%s)',
		(language, expected) => {
			const text = present(
				{
					failedCount: 1,
					isOnline: true,
					kind: 'needs_attention',
					queuedCount: 2,
				},
				language,
			);

			expect(`${text.headline}. ${text.detail}`).toBe(expected);
			expect(text.action).toEqual({ kind: 'none' });
		},
	);

	it.each([
		[
			'es',
			'1 acción necesita tu atención. No se pudo enviar. Abre Documentos o Términos para ver qué hacer. Sin conexión. 2 acciones guardadas en este teléfono, esperando conexión.',
		],
		[
			'en',
			'1 action needs your attention. It could not be sent. Open Documents or Terms to see what to do. No connection. 2 actions saved on this phone, waiting for connection.',
		],
	] as const)(
		'says offline and keeps the waiting count next to a failed action (%s)',
		(language, expected) => {
			const text = present(
				{
					failedCount: 1,
					isOnline: false,
					kind: 'needs_attention',
					queuedCount: 2,
				},
				language,
			);

			expect(`${text.headline}. ${text.detail}`).toBe(expected);
		},
	);

	it.each([
		[
			'es',
			'2 acciones necesitan tu atención. No se pudo enviar. Abre Documentos o Términos para ver qué hacer. Sin conexión.',
		],
		[
			'en',
			'2 actions need your attention. It could not be sent. Open Documents or Terms to see what to do. No connection.',
		],
	] as const)(
		'says offline when only failed actions are left (%s)',
		(language, expected) => {
			const text = present(
				{
					failedCount: 2,
					isOnline: false,
					kind: 'needs_attention',
					queuedCount: 0,
				},
				language,
			);

			expect(`${text.headline}. ${text.detail}`).toBe(expected);
			expect(text.accessibilityLabel).not.toContain('..');
		},
	);

	it('keeps the attention detail alone online when nothing else waits', () => {
		const text = present(
			{
				failedCount: 1,
				isOnline: true,
				kind: 'needs_attention',
				queuedCount: 0,
			},
			'es',
		);

		expect(text.detail).toBe(
			'No se pudo enviar. Abre Documentos o Términos para ver qué hacer.',
		);
	});

	it.each(['es', 'en'] as const)(
		'fills every placeholder and offers an action only where one fits (%s)',
		(language) => {
			for (const indicator of variants) {
				const text = present(indicator, language);
				const all = [text.headline, text.detail ?? '', text.accessibilityLabel];

				expect(all.join(' ')).not.toMatch(/\{\w+\}/);
				expect(text.headline).not.toBe('');
				expect(text.accessibilityLabel.length).toBeGreaterThan(
					text.headline.length - 1,
				);
				const hasAction = text.action.kind !== 'none';
				expect(hasAction).toBe(
					indicator.kind === 'retrying' ||
						indicator.kind === 'session_expired' ||
						(indicator.kind === 'sending' && indicator.isRetry),
				);
			}
		},
	);
});
