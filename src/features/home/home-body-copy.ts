import type { HomeBody } from '@/features/home/home-model';
import type {
	TimelineStatus,
	TimelineStepId,
} from '@/features/home/home-timeline';
import { formatDate } from '@/services/i18n/format-date';
import type {
	Language,
	Translate,
	TranslationKey,
} from '@/services/i18n/translate';
import {
	type EmptyStateCopy,
	emptyStateCopy,
} from '@/services/query/empty-state-copy';
import type { StatusRole } from '@/uikit/tokens/status-role';

export type OrderRow = { label: string; value: string };

export type TimelineStepPresentation = {
	id: TimelineStepId;
	label: string;
	status: string;
	role: StatusRole;
	accessibilityLabel: string;
};

/** What the Home body prints, already translated. */
export type HomeContent =
	| { kind: 'loading'; text: string }
	| ({ kind: 'empty' } & EmptyStateCopy)
	| {
			kind: 'ready';
			orderTitle: string;
			orderRows: OrderRow[];
			termsText: string;
			termsRole: StatusRole;
			timelineTitle: string;
			timelineSteps: TimelineStepPresentation[];
	  };

const stepLabelKey = (id: TimelineStepId): TranslationKey => {
	switch (id) {
		case 'terms_confirmed':
			return 'timeline.terms_confirmed';
		case 'documents_submitted':
			return 'timeline.documents_submitted';
		case 'documents_approved':
			return 'timeline.documents_approved';
		default:
			return id satisfies never;
	}
};

const stepStatusCopy = (
	status: TimelineStatus,
): { role: StatusRole; statusKey: TranslationKey } => {
	switch (status) {
		case 'done':
			return { role: 'approved', statusKey: 'timeline.done' };
		case 'saved_on_phone':
			return { role: 'pending_sync', statusKey: 'timeline.saved_on_phone' };
		case 'in_review':
			return { role: 'pending_review', statusKey: 'timeline.in_review' };
		case 'not_done':
			return { role: 'neutral', statusKey: 'timeline.todo' };
		default:
			return status satisfies never;
	}
};

export const presentHomeBody = (
	body: HomeBody,
	language: Language,
	t: Translate,
): HomeContent => {
	switch (body.kind) {
		case 'loading':
			return { kind: 'loading', text: t('state.loading') };
		case 'needs_connection':
		case 'server_unavailable':
			return { ...emptyStateCopy(body.kind, t), kind: 'empty' };
		case 'ready':
			return {
				kind: 'ready',
				orderRows: [
					{ label: t('home.employer'), value: body.order.employer },
					{ label: t('home.worksite'), value: body.order.worksite },
					{
						label: t('home.season'),
						value: t('home.season_range', {
							end: formatDate(body.order.seasonEnd, language),
							start: formatDate(body.order.seasonStart, language),
						}),
					},
				],
				orderTitle: t('home.order_title'),
				termsRole: body.terms.role,
				termsText: t(body.terms.textKey),
				timelineSteps: body.timeline.map((step) => {
					const label = t(stepLabelKey(step.id));
					const { role, statusKey } = stepStatusCopy(step.status);
					const status = t(statusKey);
					return {
						accessibilityLabel: t('a11y.timeline_step', {
							status,
							step: label,
						}),
						id: step.id,
						label,
						role,
						status,
					};
				}),
				timelineTitle: t('home.timeline_title'),
			};
		default:
			return body satisfies never;
	}
};
