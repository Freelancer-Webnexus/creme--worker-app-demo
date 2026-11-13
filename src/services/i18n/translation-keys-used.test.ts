import { es } from '@/services/i18n/es';
import { readSourceFiles } from '@/test/source-files';

const DICTIONARIES = new Set(['services/i18n/en.ts', 'services/i18n/es.ts']);

describe('translation keys', () => {
	const sources = readSourceFiles(['.']).filter(
		(file) => !DICTIONARIES.has(file.path),
	);
	const quoted = (key: string): RegExp =>
		new RegExp(`['"\`]${key.replace(/\./g, '\\.')}['"\`]`);

	it('are all used by the app', () => {
		const unused = Object.keys(es).filter(
			(key) => !sources.some((file) => quoted(key).test(file.text)),
		);

		expect(unused).toEqual([]);
	});
});
