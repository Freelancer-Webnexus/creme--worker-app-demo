export type SummaryLine =
	| { kind: 'text'; text: string }
	| { kind: 'term'; label: string; value: string };

/** A short label before the colon, like "Salario" or "Wage"; a long one is a sentence. */
const TERM = /^([^:]{1,24}):\s*(.+)$/;

/** The value now starts its own line, so it starts with a capital. */
const asSentence = (value: string): string =>
	value.charAt(0).toLocaleUpperCase() + value.slice(1);

/**
 * The server sends the terms summary as lines of text. A "Label: value" line
 * becomes a label above its value, the way Home shows the job order.
 */
export const summaryLines = (summary: string): SummaryLine[] =>
	summary
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line !== '')
		.map((line): SummaryLine => {
			const match = TERM.exec(line);
			return match?.[1] !== undefined && match[2] !== undefined
				? { kind: 'term', label: match[1], value: asSentence(match[2]) }
				: { kind: 'text', text: line };
		});
