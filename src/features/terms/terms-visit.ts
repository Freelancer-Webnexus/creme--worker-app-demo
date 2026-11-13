/**
 * One visit to the Terms screen. The banner "the terms changed" compares the
 * version on screen with the one the worker saw before this visit, so that
 * value is captured when the visit starts and moves only when a newer version
 * replaces the one on screen mid-visit (offline confirm, 409, new version).
 * Marking a version as seen can then happen the moment it is shown without
 * hiding the banner for the visit in which the change is first shown (M6).
 */
export type TermsVisit =
	| { kind: 'away' }
	| { kind: 'waiting' }
	| { kind: 'watching'; baselineId: string | null; shownId: string };

export type TermsVisitEvent =
	| { type: 'focused' }
	| { type: 'blurred' }
	| { type: 'displayed'; versionId: string; lastSeenId: string | null };

export const initialTermsVisit: TermsVisit = { kind: 'away' };

export const termsVisitReducer = (
	visit: TermsVisit,
	event: TermsVisitEvent,
): TermsVisit => {
	switch (event.type) {
		case 'focused':
			return visit.kind === 'away' ? { kind: 'waiting' } : visit;
		case 'blurred':
			return visit.kind === 'away' ? visit : { kind: 'away' };
		case 'displayed':
			switch (visit.kind) {
				case 'away':
					return visit;
				case 'waiting':
					return {
						baselineId: event.lastSeenId,
						kind: 'watching',
						shownId: event.versionId,
					};
				case 'watching':
					return visit.shownId === event.versionId
						? visit
						: {
								baselineId: visit.shownId,
								kind: 'watching',
								shownId: event.versionId,
							};
				default:
					return visit satisfies never;
			}
		default:
			return event satisfies never;
	}
};

/** The "last seen" id the banner compares against. Outside a visit, the stored one. */
export const baselineSeenId = (
	visit: TermsVisit,
	storedLastSeenId: string | null,
): string | null =>
	visit.kind === 'watching' ? visit.baselineId : storedLastSeenId;

/** The version to store as seen, or null when the store already has it. */
export const versionToMarkSeen = (
	visit: TermsVisit,
	storedLastSeenId: string | null,
): string | null =>
	visit.kind === 'watching' && visit.shownId !== storedLastSeenId
		? visit.shownId
		: null;
