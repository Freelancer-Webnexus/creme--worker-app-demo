import {
	logger,
	resetLoggerSink,
	setLoggerSink,
} from '@/services/logger/logger';

describe('logger', () => {
	afterEach(() => {
		resetLoggerSink();
	});

	it('writes scoped info messages', () => {
		const info = jest
			.spyOn(console, 'info')
			.mockImplementation(() => undefined);

		logger.info('test', 'hello');

		expect(info).toHaveBeenCalledWith('[test] hello');
		info.mockRestore();
	});

	it('forwards entries to a custom sink', () => {
		const sink = jest.fn();
		setLoggerSink(sink);

		logger.warn('scope', 'custom');

		expect(sink).toHaveBeenCalledWith({
			level: 'warn',
			message: 'custom',
			scope: 'scope',
		});
	});
});
