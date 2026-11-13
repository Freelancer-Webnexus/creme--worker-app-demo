import { createServerFactSignal } from '@/services/runtime/server-fact-signal';

describe('server fact signal', () => {
	it('tells every listener on emit', () => {
		const signal = createServerFactSignal();
		const calls: string[] = [];
		signal.subscribe(() => calls.push('a'));
		signal.subscribe(() => calls.push('b'));

		signal.emit();

		expect(calls).toEqual(['a', 'b']);
	});

	it('stops telling a listener after it unsubscribed', () => {
		const signal = createServerFactSignal();
		const calls: string[] = [];
		const unsubscribe = signal.subscribe(() => calls.push('a'));
		signal.subscribe(() => calls.push('b'));

		unsubscribe();
		signal.emit();

		expect(calls).toEqual(['b']);
	});

	it('M2 a listener that throws neither throws out of emit nor hides the event from the others', () => {
		const signal = createServerFactSignal();
		const calls: string[] = [];
		signal.subscribe(() => {
			throw new Error('ui bug');
		});
		signal.subscribe(() => {
			calls.push('b');
		});

		expect(() => {
			signal.emit();
		}).not.toThrow();
		expect(calls).toEqual(['b']);
	});
});
