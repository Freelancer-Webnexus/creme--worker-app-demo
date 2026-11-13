import { createPendingSignInStore } from '@/features/session/pending-sign-in';

describe('pending sign-in store', () => {
	it('starts idle, remembers the number, and clears', () => {
		const store = createPendingSignInStore();
		expect(store.get()).toEqual({ kind: 'idle' });

		store.codeRequested('+525510000001');
		expect(store.get()).toEqual({
			kind: 'code_requested',
			phone: '+525510000001',
		});

		store.clear();
		expect(store.get()).toEqual({ kind: 'idle' });
	});

	it('notifies on a change and not on a clear that changes nothing', () => {
		const store = createPendingSignInStore();
		let calls = 0;
		const stop = store.subscribe(() => {
			calls += 1;
		});

		store.clear();
		store.codeRequested('+525510000001');
		store.clear();
		stop();
		store.codeRequested('+525510000002');

		expect(calls).toBe(2);
	});
});
