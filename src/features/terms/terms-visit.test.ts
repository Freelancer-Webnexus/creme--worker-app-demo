import { termsScreenState } from '@/features/terms/contracts/terms-status';
import {
	baselineSeenId,
	initialTermsVisit,
	type TermsVisit,
	type TermsVisitEvent,
	termsVisitReducer,
	versionToMarkSeen,
} from '@/features/terms/terms-visit';

const away: TermsVisit = { kind: 'away' };
const waiting: TermsVisit = { kind: 'waiting' };
const watchingV2: TermsVisit = {
	baselineId: null,
	kind: 'watching',
	shownId: 'terms-v2',
};

const displayed = (
	versionId: string,
	lastSeenId: string | null = null,
): TermsVisitEvent => ({ lastSeenId, type: 'displayed', versionId });

describe('termsVisitReducer', () => {
	it.each([
		['away', away, { type: 'focused' } as const, waiting],
		['away', away, { type: 'blurred' } as const, away],
		['away', away, displayed('terms-v2'), away],
		['waiting', waiting, { type: 'focused' } as const, waiting],
		['waiting', waiting, { type: 'blurred' } as const, away],
		[
			'waiting',
			waiting,
			displayed('terms-v2', 'terms-v1'),
			{ baselineId: 'terms-v1', kind: 'watching', shownId: 'terms-v2' },
		],
		[
			'waiting',
			waiting,
			displayed('terms-v2'),
			{ baselineId: null, kind: 'watching', shownId: 'terms-v2' },
		],
		['watching', watchingV2, { type: 'focused' } as const, watchingV2],
		['watching', watchingV2, { type: 'blurred' } as const, away],
		['watching', watchingV2, displayed('terms-v2', 'terms-v2'), watchingV2],
		[
			'watching',
			watchingV2,
			displayed('terms-v3', 'terms-v2'),
			{ baselineId: 'terms-v2', kind: 'watching', shownId: 'terms-v3' },
		],
	] as const)('%s + %j', (_name, from, event, expected) => {
		expect(termsVisitReducer(from, event)).toEqual(expected);
	});

	it('returns the same object when nothing changes', () => {
		expect(termsVisitReducer(watchingV2, displayed('terms-v2'))).toBe(
			watchingV2,
		);
	});

	it('starts away', () => {
		expect(initialTermsVisit).toEqual(away);
	});
});

describe('baselineSeenId', () => {
	it('uses the value captured at the start of the visit, not the stored one', () => {
		expect(
			baselineSeenId({ ...watchingV2, baselineId: 'terms-v1' }, 'terms-v2'),
		).toBe('terms-v1');
	});

	it.each([away, waiting])(
		'uses the stored value outside a visit (%j)',
		(visit) => {
			expect(baselineSeenId(visit, 'terms-v1')).toBe('terms-v1');
		},
	);
});

describe('versionToMarkSeen', () => {
	it('marks the shown version once the visit watches it', () => {
		expect(versionToMarkSeen(watchingV2, null)).toBe('terms-v2');
		expect(versionToMarkSeen(watchingV2, 'terms-v1')).toBe('terms-v2');
	});

	it('does not write what the store already has', () => {
		expect(versionToMarkSeen(watchingV2, 'terms-v2')).toBeNull();
	});

	it.each([away, waiting])('writes nothing outside a visit (%j)', (visit) => {
		expect(versionToMarkSeen(visit, null)).toBeNull();
	});
});

describe('a visit through scenario 4', () => {
	const version = (id: string, number: number) => ({
		id,
		publishedAt: '2026-05-04T09:00:00.000Z',
		summary: { en: 'English', es: 'Español' },
		version: number,
	});
	const changedFor = (visit: TermsVisit, stored: string | null, id: string) => {
		const state = termsScreenState({
			acceptedTermsVersionId: null,
			current: version(id, 3),
			lastSeenTermsVersionId: baselineSeenId(visit, stored),
			localActions: [],
		});
		return state.kind === 'needs_confirmation' && state.changedSinceLastSeen;
	};

	it('shows the banner for v3 on a first visit that started on v2, and keeps it', () => {
		let visit = termsVisitReducer(initialTermsVisit, { type: 'focused' });
		visit = termsVisitReducer(visit, displayed('terms-v2', null));
		expect(changedFor(visit, null, 'terms-v2')).toBe(false);

		visit = termsVisitReducer(visit, displayed('terms-v3', 'terms-v2'));
		expect(changedFor(visit, 'terms-v2', 'terms-v3')).toBe(true);

		visit = termsVisitReducer(visit, displayed('terms-v3', 'terms-v3'));
		expect(changedFor(visit, 'terms-v3', 'terms-v3')).toBe(true);
	});

	it('shows no banner on the next visit, after v3 was seen', () => {
		let visit = termsVisitReducer(watchingV2, { type: 'blurred' });
		visit = termsVisitReducer(visit, { type: 'focused' });
		visit = termsVisitReducer(visit, displayed('terms-v3', 'terms-v3'));
		expect(changedFor(visit, 'terms-v3', 'terms-v3')).toBe(false);
	});

	it('shows the banner on a visit that starts after a version changed while away', () => {
		let visit = termsVisitReducer(initialTermsVisit, { type: 'focused' });
		visit = termsVisitReducer(visit, displayed('terms-v3', 'terms-v2'));
		expect(changedFor(visit, 'terms-v2', 'terms-v3')).toBe(true);
	});
});
