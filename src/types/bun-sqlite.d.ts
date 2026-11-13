declare module 'bun:sqlite' {
	export class Database {
		constructor(filename: string);
		exec(sql: string): void;
		query(sql: string): {
			all(...params: (string | number | null)[]): unknown[];
			run(...params: (string | number | null)[]): unknown;
		};
		close(): void;
	}
}
