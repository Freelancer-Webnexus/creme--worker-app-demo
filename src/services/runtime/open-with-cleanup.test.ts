import { openWithCleanup } from '@/services/runtime/open-with-cleanup';

type Resource = { name: string };

const setup = () => {
	const events: string[] = [];
	const resource: Resource = { name: 'database' };
	return {
		events,
		resource,
		close: async (opened: Resource) => {
			events.push(`close ${opened.name}`);
		},
		open: async () => {
			events.push('open');
			return resource;
		},
	};
};

describe('openWithCleanup', () => {
	it('returns the setup result and leaves the resource open', async () => {
		const { close, events, open, resource } = setup();

		const result = await openWithCleanup({
			close,
			open,
			setUp: async (opened) => {
				events.push('set up');
				return { runtimeOf: opened };
			},
		});

		expect(result).toEqual({ runtimeOf: resource });
		expect(events).toEqual(['open', 'set up']);
	});

	it('closes the resource once and rethrows the same error when setup throws', async () => {
		const { close, events, open } = setup();
		const failure = new Error('migration failed');

		await expect(
			openWithCleanup({
				close,
				open,
				setUp: async () => {
					throw failure;
				},
			}),
		).rejects.toBe(failure);

		expect(events).toEqual(['open', 'close database']);
	});

	it('rethrows the setup error when closing fails too', async () => {
		const { open } = setup();
		const failure = new Error('migration failed');

		await expect(
			openWithCleanup({
				close: async () => {
					throw new Error('already closed');
				},
				open,
				setUp: async () => {
					throw failure;
				},
			}),
		).rejects.toBe(failure);
	});

	it('does not close anything when opening fails', async () => {
		const { events } = setup();
		const failure = new Error('no disk');

		await expect(
			openWithCleanup({
				close: async () => {
					events.push('close');
				},
				open: async () => {
					throw failure;
				},
				setUp: async () => 'unreachable',
			}),
		).rejects.toBe(failure);

		expect(events).toEqual([]);
	});

	it('opens a new resource on every call, so a retry never reuses a closed one', async () => {
		const events: string[] = [];
		let opened = 0;
		const run = (failing: boolean) =>
			openWithCleanup({
				close: async (name: string) => {
					events.push(`close ${name}`);
				},
				open: async () => {
					opened += 1;
					return `db-${opened}`;
				},
				setUp: async (name) => {
					if (failing) {
						throw new Error('boom');
					}
					return name;
				},
			});

		await expect(run(true)).rejects.toThrow('boom');
		expect(await run(false)).toBe('db-2');
		expect(events).toEqual(['close db-1']);
	});
});
