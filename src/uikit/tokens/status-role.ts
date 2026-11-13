import type { SemanticColors } from '@/uikit/tokens/colors';

/** The one list of statuses the UI can show. Every switch over it is exhaustive. */
export type StatusRole =
	| 'approved'
	| 'correction'
	| 'failed'
	| 'neutral'
	| 'pending_review'
	| 'pending_sync';

export type StatusColors = {
	background: string;
	foreground: string;
};

export const statusColorsFor = (
	palette: SemanticColors,
	role: StatusRole,
): StatusColors => {
	switch (role) {
		case 'approved':
			return {
				background: palette.statusApprovedBackground,
				foreground: palette.statusApprovedForeground,
			};
		case 'correction':
			return {
				background: palette.statusCorrectionBackground,
				foreground: palette.statusCorrectionForeground,
			};
		case 'failed':
			return {
				background: palette.statusFailedBackground,
				foreground: palette.statusFailedForeground,
			};
		case 'neutral':
			return {
				background: palette.statusNeutralBackground,
				foreground: palette.statusNeutralForeground,
			};
		case 'pending_review':
			return {
				background: palette.statusPendingReviewBackground,
				foreground: palette.statusPendingReviewForeground,
			};
		case 'pending_sync':
			return {
				background: palette.statusPendingSyncBackground,
				foreground: palette.statusPendingSyncForeground,
			};
		default:
			return role satisfies never;
	}
};
