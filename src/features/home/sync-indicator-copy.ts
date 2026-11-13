import { pluralKey, type Translate } from '@/services/i18n/translate';
import type { SyncIndicator } from '@/services/runtime/sync-indicator-model';
import type { StatusRole } from '@/uikit/tokens/status-role';

export type SyncIndicatorAction =
	| { kind: 'none' }
	/**
	 * `busy` while a failed action is sent again: the button stays in place, so
	 * the card keeps its height between attempts.
	 */
	| { kind: 'retry_now'; label: string; busy: boolean }
	| { kind: 'sign_in_again'; label: string };

/** Everything the view prints for one indicator state, already translated. */
export type SyncIndicatorPresentation = {
	role: StatusRole;
	headline: string;
	/** A full sentence under the headline, or null when the headline says it all. */
	detail: string | null;
	/**
	 * What a screen reader says. The retry countdown is left out on purpose: the
	 * indicator is a polite live region and a number that changes every second
	 * would be read out every second.
	 */
	accessibilityLabel: string;
	action: SyncIndicatorAction;
};

type Words = { headline: string; detail: string | null; spoken?: string };

const countParams = (count: number) => ({ count });

/**
 * What failed comes first, then what still waits and whether the phone is
 * offline, so a failed row never hides the rest of the queue.
 */
const attentionDetail = (
	{
		isOnline,
		queuedCount,
	}: Extract<SyncIndicator, { kind: 'needs_attention' }>,
	t: Translate,
): string => {
	const waiting =
		queuedCount === 0
			? null
			: t(
					isOnline
						? pluralKey(queuedCount, 'sync.saved_one', 'sync.saved_other')
						: pluralKey(
								queuedCount,
								'sync.offline_waiting_one',
								'sync.offline_waiting_other',
							),
					countParams(queuedCount),
				);
	return [
		t('sync.attention_detail'),
		isOnline ? null : `${t('sync.offline')}.`,
		waiting,
	]
		.filter((part): part is string => part !== null)
		.join(' ');
};

const wordsFor = (indicator: SyncIndicator, t: Translate): Words => {
	switch (indicator.kind) {
		case 'checking':
			return {
				detail: t('sync.checking_detail'),
				headline: t('sync.checking'),
			};
		case 'session_expired':
			return {
				detail:
					indicator.savedCount === 0
						? t('sync.session_expired')
						: t(
								pluralKey(
									indicator.savedCount,
									'sync.session_expired_saved_one',
									'sync.session_expired_saved_other',
								),
								countParams(indicator.savedCount),
							),
				headline: t('sync.session_expired_title'),
			};
		case 'offline_waiting':
			return {
				detail: t(
					pluralKey(
						indicator.count,
						'sync.offline_waiting_one',
						'sync.offline_waiting_other',
					),
					countParams(indicator.count),
				),
				headline: t('sync.offline'),
			};
		case 'offline_clear':
			return { detail: t('sync.offline_clear'), headline: t('sync.offline') };
		case 'needs_attention':
			return {
				detail: attentionDetail(indicator, t),
				headline: t(
					pluralKey(
						indicator.failedCount,
						'sync.attention_one',
						'sync.attention_other',
					),
					countParams(indicator.failedCount),
				),
			};
		case 'sending':
			return {
				detail: t(
					pluralKey(
						indicator.count,
						'sync.sending_detail_one',
						'sync.sending_detail_other',
					),
					countParams(indicator.count),
				),
				headline: t('sync.sending'),
			};
		case 'retrying':
			return {
				detail: t(
					pluralKey(indicator.count, 'sync.saved_one', 'sync.saved_other'),
					countParams(indicator.count),
				),
				headline: t('sync.retrying', { seconds: indicator.seconds }),
				spoken: t('sync.retrying_soon'),
			};
		case 'nothing_pending':
			return { detail: null, headline: t('sync.nothing_pending') };
		default:
			return indicator satisfies never;
	}
};

const roleFor = (indicator: SyncIndicator): StatusRole => {
	switch (indicator.kind) {
		case 'checking':
		case 'offline_clear':
		case 'nothing_pending':
			return 'neutral';
		case 'session_expired':
		case 'offline_waiting':
		case 'sending':
		case 'retrying':
			return 'pending_sync';
		case 'needs_attention':
			return 'failed';
		default:
			return indicator satisfies never;
	}
};

const actionFor = (
	indicator: SyncIndicator,
	t: Translate,
): SyncIndicatorAction => {
	switch (indicator.kind) {
		case 'retrying':
			return { busy: false, kind: 'retry_now', label: t('sync.retry_now') };
		case 'sending':
			return indicator.isRetry
				? { busy: true, kind: 'retry_now', label: t('sync.retry_now') }
				: { kind: 'none' };
		case 'session_expired':
			return { kind: 'sign_in_again', label: t('reauth.button') };
		case 'checking':
		case 'offline_waiting':
		case 'offline_clear':
		case 'needs_attention':
		case 'nothing_pending':
			return { kind: 'none' };
		default:
			return indicator satisfies never;
	}
};

/**
 * Words, colour role and action for the sync indicator. "Nothing waiting to be
 * sent" is neutral and only about the queue: it says nothing about steps still
 * to do, delivery or staff review (M4).
 */
export const describeSyncIndicator = (
	indicator: SyncIndicator,
	t: Translate,
): SyncIndicatorPresentation => {
	const { detail, headline, spoken } = wordsFor(indicator, t);
	const sentence = [spoken ?? headline, detail]
		.filter((part): part is string => part !== null)
		.join('. ');

	return {
		accessibilityLabel: t('a11y.sync_indicator', { status: sentence }),
		action: actionFor(indicator, t),
		detail,
		headline,
		role: roleFor(indicator),
	};
};
