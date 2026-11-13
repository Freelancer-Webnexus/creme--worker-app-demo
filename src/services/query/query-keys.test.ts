import { partialMatchKey } from '@tanstack/react-query';
import { queryKeys } from '@/services/query/query-keys';

describe('queryKeys', () => {
	it('gives each session expiry its own assignment key', () => {
		expect(queryKeys.assignment.detail('w1', 123)).not.toEqual(
			queryKeys.assignment.detail('w1', 124),
		);
	});

	it('keeps workers apart (M10)', () => {
		expect(queryKeys.workerView.detail('w1')).not.toEqual(
			queryKeys.workerView.detail('w2'),
		);
	});

	it('matches every detail key under its all key', () => {
		expect(
			partialMatchKey(
				queryKeys.workerView.detail('w1'),
				queryKeys.workerView.all,
			),
		).toBe(true);
		expect(
			partialMatchKey(
				queryKeys.assignment.detail('w1', 1),
				queryKeys.assignment.all,
			),
		).toBe(true);
		expect(
			partialMatchKey(
				queryKeys.assignment.detail('w1', 1),
				queryKeys.workerView.all,
			),
		).toBe(false);
	});
});
