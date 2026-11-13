import type { Translate, TranslationKey } from '@/services/i18n/translate';
import type { EngineState } from '@/services/sync/sync-types';

/** Why a saved action has not been sent yet, derived from the engine, never stored. */
export type PendingSyncReason =
	'waiting_for_connection' | 'sending_now' | 'retry_soon' | 'sign_in_again';

export const pendingSyncReason = ({
	engineState,
	isOnline,
}: {
	engineState: EngineState;
	isOnline: boolean;
}): PendingSyncReason => {
	switch (engineState.kind) {
		case 'auth_required':
			return 'sign_in_again';
		case 'offline':
			return 'waiting_for_connection';
		case 'backing_off':
			return isOnline ? 'retry_soon' : 'waiting_for_connection';
		case 'syncing':
		case 'idle':
			return isOnline ? 'sending_now' : 'waiting_for_connection';
		default:
			return engineState satisfies never;
	}
};

const reasonKeyFor = (reason: PendingSyncReason): TranslationKey => {
	switch (reason) {
		case 'waiting_for_connection':
			return 'pending.reason_offline';
		case 'sending_now':
			return 'pending.reason_sending';
		case 'retry_soon':
			return 'pending.reason_retry';
		case 'sign_in_again':
			return 'pending.reason_sign_in';
		default:
			return reason satisfies never;
	}
};

/** The same fact on Terms and Documents: saved on this phone, not sent, and why (M4). */
export const pendingSyncLine = (
	reason: PendingSyncReason,
	t: Translate,
): string => `${t('pending.base')} ${t(reasonKeyFor(reason))}`;
