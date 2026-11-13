export type LogLevel = 'debug' | 'error' | 'info' | 'warn';

export type LogMetadata = Record<string, unknown>;

export type LogEntry = {
	level: LogLevel;
	message: string;
	metadata?: LogMetadata;
	scope: string;
};

export type LoggerSink = (entry: LogEntry) => void;

const writeToConsole = (entry: LogEntry): void => {
	const consoleWriter = globalThis.console?.[entry.level];
	if (typeof consoleWriter !== 'function') {
		return;
	}

	const prefix = `[${entry.scope}] ${entry.message}`;

	if (entry.metadata) {
		consoleWriter(prefix, entry.metadata);
		return;
	}

	consoleWriter(prefix);
};

let activeLoggerSink: LoggerSink = writeToConsole;

const emitLog = (entry: LogEntry): void => {
	try {
		activeLoggerSink(entry);
	} catch {
		writeToConsole({
			level: 'error',
			message: 'Logger sink threw.',
			metadata: { originalEntry: entry },
			scope: 'logger',
		});
		writeToConsole(entry);
	}
};

export const setLoggerSink = (sink: LoggerSink): void => {
	activeLoggerSink = sink;
};

export const resetLoggerSink = (): void => {
	activeLoggerSink = writeToConsole;
};

export const logger = {
	debug: (scope: string, message: string, metadata?: LogMetadata): void => {
		emitLog({ level: 'debug', message, metadata, scope });
	},
	error: (scope: string, message: string, metadata?: LogMetadata): void => {
		emitLog({ level: 'error', message, metadata, scope });
	},
	info: (scope: string, message: string, metadata?: LogMetadata): void => {
		emitLog({ level: 'info', message, metadata, scope });
	},
	warn: (scope: string, message: string, metadata?: LogMetadata): void => {
		emitLog({ level: 'warn', message, metadata, scope });
	},
};
