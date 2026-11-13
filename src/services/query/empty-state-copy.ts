import type { Translate } from '@/services/i18n/translate';
import type { CacheGate } from '@/services/query/cache-gate';

export type EmptyStateCopy = {
	title: string;
	body: string;
	retryTitle: string;
};

/**
 * The words for a screen with nothing cached yet. Pull to refresh still works,
 * but the retry button is what the worker sees, so the body never has to teach
 * the gesture.
 */
export const emptyStateCopy = (
	kind: Extract<CacheGate['kind'], 'needs_connection' | 'server_unavailable'>,
	t: Translate,
): EmptyStateCopy => {
	const retryTitle = t('error.retry');
	switch (kind) {
		case 'needs_connection':
			return {
				body: t('state.empty_body'),
				retryTitle,
				title: t('state.empty_title'),
			};
		case 'server_unavailable':
			return {
				body: t('state.server_body'),
				retryTitle,
				title: t('state.server_title'),
			};
		default:
			return kind satisfies never;
	}
};
