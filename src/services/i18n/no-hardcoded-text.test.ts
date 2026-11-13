import * as ts from 'typescript';
import { readSourceFiles } from '@/test/source-files';

/**
 * M9: every word a worker reads comes from `t(...)`. This scans the screens for
 * JSX text and for string literals in the props that carry words. Dynamic
 * values (`title={props.title}`) are fine: the hook that built them used `t`.
 */
const WORD_PROPS = new Set([
	'accessibilityHint',
	'accessibilityLabel',
	'label',
	'placeholder',
	'title',
]);

/** `path:text` pairs that must stay literal. Keep this list empty unless a literal is not language. */
const ALLOWED_LITERALS = new Set<string>([]);

const HAS_LETTER = /\p{L}/u;

const literalTextOf = (node: ts.Node): string | null => {
	if (ts.isStringLiteralLike(node)) {
		return node.text;
	}
	if (ts.isTemplateExpression(node)) {
		return [
			node.head.text,
			...node.templateSpans.map((span) => span.literal.text),
		].join('');
	}
	return null;
};

const findHardcodedText = (path: string, text: string): string[] => {
	const source = ts.createSourceFile(
		path,
		text,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TSX,
	);
	const found: string[] = [];
	const report = (value: string): void => {
		const trimmed = value.trim();
		if (
			HAS_LETTER.test(trimmed) &&
			!ALLOWED_LITERALS.has(`${path}:${trimmed}`)
		) {
			found.push(`${path}: "${trimmed}"`);
		}
	};

	const visit = (node: ts.Node): void => {
		if (ts.isJsxText(node)) {
			report(node.text);
		} else if (ts.isJsxExpression(node) && ts.isJsxElement(node.parent)) {
			const literal = node.expression ? literalTextOf(node.expression) : null;
			if (literal !== null) {
				report(literal);
			}
		} else if (ts.isJsxAttribute(node) && WORD_PROPS.has(node.name.getText())) {
			const { initializer } = node;
			if (initializer !== undefined) {
				const literal = ts.isJsxExpression(initializer)
					? initializer.expression
						? literalTextOf(initializer.expression)
						: null
					: literalTextOf(initializer);
				if (literal !== null) {
					report(literal);
				}
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	return found;
};

describe('findHardcodedText', () => {
	it.each([
		['<Text>Hello</Text>', 1],
		['<Text>{"Hello"}</Text>', 1],
		['<Button title="Send" />', 1],
		['<Button title={"Send"} />', 1],
		['<Button label={`Send ${x}`} />', 1],
		['<TextField placeholder="Name" accessibilityLabel="Name" />', 2],
		['<Text>{t("a.b")}</Text>', 0],
		['<Button title={t("a.b")} />', 0],
		['<Button title={props.title} />', 0],
		['<Text>{"›"}</Text>', 0],
		['<Text>{`${label} ›`}</Text>', 0],
		['<View testID="home-screen" accessibilityRole="header" />', 0],
	])('%s reports %d', (code, count) => {
		expect(findHardcodedText('x.tsx', `const A = () => ${code};`)).toHaveLength(
			count,
		);
	});
});

describe('screens', () => {
	const files = readSourceFiles(['app', 'features']).filter((file) =>
		file.path.endsWith('.tsx'),
	);

	it('scans the screens', () => {
		expect(files.length).toBeGreaterThan(10);
	});

	it('pass every word through t()', () => {
		const violations = files.flatMap((file) =>
			findHardcodedText(file.path, file.text),
		);

		expect(violations).toEqual([]);
	});
});
