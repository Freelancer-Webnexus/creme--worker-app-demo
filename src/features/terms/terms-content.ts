import type { ConfirmState } from '@/features/terms/confirm-state';
import {
	termsRoleFor,
	type TermsScreenState,
	termsScreenState,
} from '@/features/terms/contracts/terms-status';
import { type SummaryLine, summaryLines } from '@/features/terms/terms-summary';
import { formatDate } from '@/services/i18n/format-date';
import type { Language, Translate } from '@/services/i18n/translate';
import type { CacheGate } from '@/services/query/cache-gate';
import {
	type EmptyStateCopy,
	emptyStateCopy,
} from '@/services/query/empty-state-copy';
import {
	type PendingSyncReason,
	pendingSyncLine,
} from '@/services/runtime/pending-sync-line';
import type { QueuedAction } from '@/services/sync/sync-types';
import type { StatusRole } from '@/uikit/tokens/status-role';

export type TermsAction =
	{ kind: 'none' } | { kind: 'confirm'; label: string; busy: boolean };

export type TermsReadyContent = {
	kind: 'ready';
	/** The version shown, handed back to `onConfirm` so the exact one on screen is accepted (M6). */
	versionId: string;
	banner: string | null;
	versionLabel: string;
	publishedLabel: string;
	summary: SummaryLine[];
	statusText: string;
	statusRole: StatusRole;
	notice: string | null;
	action: TermsAction;
};

export type TermsContent =
	| { kind: 'loading'; text: string }
	| ({ kind: 'empty' } & EmptyStateCopy)
	| TermsReadyContent;

export type TermsContentContext = {
	rows: QueuedAction[];
	/** What the worker saw before this visit, see `terms-visit.ts`. */
	seenBeforeId: string | null;
	confirm: ConfirmState;
	language: Language;
	pendingReason: PendingSyncReason;
};

const statusTextFor = (
	state: TermsScreenState,
	reason: PendingSyncReason,
	t: Translate,
): string => {
	switch (state.kind) {
		case 'confirmed':
			return t('terms.confirmed');
		case 'pending_sync':
			return pendingSyncLine(reason, t);
		case 'rejected':
			return t('terms.rejected');
		case 'needs_confirmation':
			return t('terms.needs_confirmation');
		default:
			return state satisfies never;
	}
};

const bannerShown = (state: TermsScreenState): boolean => {
	switch (state.kind) {
		case 'needs_confirmation':
		case 'rejected':
			return state.changedSinceLastSeen;
		case 'pending_sync':
		case 'confirmed':
			return false;
		default:
			return state satisfies never;
	}
};

const actionFor = (
	state: TermsScreenState,
	confirm: ConfirmState,
	t: Translate,
): TermsAction => {
	const busy = confirm.kind === 'saving';
	switch (state.kind) {
		case 'needs_confirmation':
			return {
				busy,
				kind: 'confirm',
				label: busy ? t('terms.saving') : t('terms.confirm'),
			};
		case 'rejected':
			return {
				busy,
				kind: 'confirm',
				label: busy ? t('terms.saving') : t('error.retry'),
			};
		case 'pending_sync':
		case 'confirmed':
			return { kind: 'none' };
		default:
			return state satisfies never;
	}
};

export const presentTermsContent = (
	gate: CacheGate,
	context: TermsContentContext,
	t: Translate,
): TermsContent => {
	switch (gate.kind) {
		case 'loading':
			return { kind: 'loading', text: t('state.loading') };
		case 'needs_connection':
		case 'server_unavailable':
			return { ...emptyStateCopy(gate.kind, t), kind: 'empty' };
		case 'ready': {
			const { assignment } = gate.cache;
			const state = termsScreenState({
				acceptedTermsVersionId: assignment.acceptedTermsVersionId,
				current: assignment.currentTerms,
				lastSeenTermsVersionId: context.seenBeforeId,
				localActions: context.rows,
			});
			const { version } = state;
			const action = actionFor(state, context.confirm, t);
			return {
				action,
				banner: bannerShown(state) ? t('terms.changed') : null,
				kind: 'ready',
				notice:
					action.kind === 'confirm' && context.confirm.kind === 'not_saved'
						? t('terms.save_failed')
						: null,
				publishedLabel: t('terms.published', {
					date: formatDate(version.publishedAt, context.language),
				}),
				statusRole: termsRoleFor(state),
				statusText: statusTextFor(state, context.pendingReason, t),
				summary: summaryLines(version.summary[context.language]),
				versionId: version.id,
				versionLabel: t('terms.version', { version: version.version }),
			};
		}
		default:
			return gate satisfies never;
	}
};
