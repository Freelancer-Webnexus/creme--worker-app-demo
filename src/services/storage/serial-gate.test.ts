import { createSerialGate } from '@/services/storage/serial-gate';

describe('serial gate', () => {
	it('runs tasks one at a time in call order and returns their results', async () => {
		const gate = createSerialGate();
		const events: string[] = [];
		const task = (name: string) => async () => {
			events.push(`${name} start`);
			await Promise.resolve();
			await Promise.resolve();
			events.push(`${name} end`);
			return name;
		};

		const results = await Promise.all([gate(task('a')), gate(task('b'))]);

		expect(results).toEqual(['a', 'b']);
		expect(events).toEqual(['a start', 'a end', 'b start', 'b end']);
	});

	it('keeps running tasks after one rejected', async () => {
		const gate = createSerialGate();
		const failing = gate(async () => {
			throw new Error('boom');
		});
		const next = gate(async () => 'ok');

		await expect(failing).rejects.toThrow('boom');
		expect(await next).toBe('ok');
	});
});
