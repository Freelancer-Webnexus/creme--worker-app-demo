import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export const SRC_ROOT = join(import.meta.dirname, '..');

export type SourceFile = {
	/** Path relative to `src`, with forward slashes. */
	path: string;
	text: string;
};

const isTest = (name: string): boolean => /\.test\.tsx?$/.test(name);

/** Every `.ts` and `.tsx` file under the given folders of `src`, tests excluded. */
export const readSourceFiles = (folders: string[]): SourceFile[] => {
	const files: SourceFile[] = [];
	const visit = (directory: string): void => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const full = join(directory, entry.name);
			if (entry.isDirectory()) {
				visit(full);
			} else if (/\.tsx?$/.test(entry.name) && !isTest(entry.name)) {
				files.push({
					path: relative(SRC_ROOT, full).split('\\').join('/'),
					text: readFileSync(full, 'utf8'),
				});
			}
		}
	};
	for (const folder of folders) {
		visit(join(SRC_ROOT, folder));
	}
	return files;
};
