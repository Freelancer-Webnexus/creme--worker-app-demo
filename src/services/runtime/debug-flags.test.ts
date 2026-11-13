import { createDebugFlags } from '@/services/runtime/debug-flags';

describe('createDebugFlags', () => {
	it('starts with compression on', () => {
		expect(createDebugFlags().getSnapshot()).toEqual({
			compressionEnabled: true,
		});
	});

	it('changes the snapshot and tells subscribers', () => {
		const flags = createDebugFlags();
		let notified = 0;
		flags.subscribe(() => {
			notified += 1;
		});
		const before = flags.getSnapshot();

		flags.setCompressionEnabled(false);

		expect(flags.getSnapshot()).toEqual({ compressionEnabled: false });
		expect(flags.getSnapshot()).not.toBe(before);
		expect(notified).toBe(1);
	});

	it('keeps the same snapshot object when nothing changed', () => {
		const flags = createDebugFlags();
		let notified = 0;
		flags.subscribe(() => {
			notified += 1;
		});
		const before = flags.getSnapshot();

		flags.setCompressionEnabled(true);

		expect(flags.getSnapshot()).toBe(before);
		expect(notified).toBe(0);
	});

	it('stops telling a subscriber that unsubscribed', () => {
		const flags = createDebugFlags();
		let notified = 0;
		const unsubscribe = flags.subscribe(() => {
			notified += 1;
		});

		unsubscribe();
		flags.setCompressionEnabled(false);

		expect(notified).toBe(0);
	});
});
