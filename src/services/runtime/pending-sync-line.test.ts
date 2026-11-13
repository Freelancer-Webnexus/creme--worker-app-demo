import { type Language, translate } from '@/services/i18n/translate';
import {
	type PendingSyncReason,
	pendingSyncLine,
	pendingSyncReason,
} from '@/services/runtime/pending-sync-line';
import type { EngineState } from '@/services/sync/sync-types';

const reasonRows: [string, EngineState, boolean, PendingSyncReason][] = [
	['idle and online', { kind: 'idle' }, true, 'sending_now'],
	['syncing and online', { kind: 'syncing' }, true, 'sending_now'],
	[
		'backing off and online',
		{ kind: 'backing_off', until: 5 },
		true,
		'retry_soon',
	],
	['engine offline', { kind: 'offline' }, false, 'waiting_for_connection'],
	['idle but phone offline', { kind: 'idle' }, false, 'waiting_for_connection'],
	[
		'syncing but phone offline',
		{ kind: 'syncing' },
		false,
		'waiting_for_connection',
	],
	[
		'backing off but phone offline',
		{ kind: 'backing_off', until: 5 },
		false,
		'waiting_for_connection',
	],
	['session expired, online', { kind: 'auth_required' }, true, 'sign_in_again'],
	[
		'session expired, offline',
		{ kind: 'auth_required' },
		false,
		'sign_in_again',
	],
];

describe('pendingSyncReason', () => {
	it.each(reasonRows)('%s', (_name, engineState, isOnline, expected) => {
		expect(pendingSyncReason({ engineState, isOnline })).toBe(expected);
	});
});

const lineRows: [PendingSyncReason, Language, string][] = [
	[
		'waiting_for_connection',
		'es',
		'Guardado en este teléfono. Todavía no se envió. Esperando conexión.',
	],
	[
		'sending_now',
		'es',
		'Guardado en este teléfono. Todavía no se envió. Enviando ahora.',
	],
	[
		'retry_soon',
		'es',
		'Guardado en este teléfono. Todavía no se envió. Se reintentará pronto.',
	],
	[
		'sign_in_again',
		'es',
		'Guardado en este teléfono. Todavía no se envió. Entra de nuevo para enviar.',
	],
	[
		'waiting_for_connection',
		'en',
		'Saved on this phone. Not sent yet. Waiting for connection.',
	],
	['sending_now', 'en', 'Saved on this phone. Not sent yet. Sending now.'],
	[
		'retry_soon',
		'en',
		'Saved on this phone. Not sent yet. Will try again soon.',
	],
	[
		'sign_in_again',
		'en',
		'Saved on this phone. Not sent yet. Sign in again to send.',
	],
];

describe('pendingSyncLine', () => {
	it.each(lineRows)('%s in %s', (reason, language, expected) => {
		expect(
			pendingSyncLine(reason, (key, params) =>
				translate(language, key, params),
			),
		).toBe(expected);
	});

	it('never claims a connection wait while the phone is sending', () => {
		const line = pendingSyncLine('sending_now', (key, params) =>
			translate('es', key, params),
		);

		expect(line).not.toContain('conexión');
	});
});
