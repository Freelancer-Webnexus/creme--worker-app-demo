const tryWithoutCatch = {
	selector: 'TryStatement[handler=null]',
	message:
		'Never write try/finally without catch inside a React component or hook. The compiler cannot lower it ("Handle TryStatement without a catch clause") and skips the whole function. Use promise.finally() for async cleanup, or a real catch that handles or reports the error. try/catch/finally is not this bailout.',
};

function withNoTryWithoutCatch(configs) {
	for (const config of configs) {
		const rule = config.rules && config.rules['no-restricted-syntax'];
		if (Array.isArray(rule)) {
			rule.push(tryWithoutCatch);
		}
	}

	return [
		{
			name: 'app/react-compiler-try-without-catch',
			files: ['**/*.{js,jsx,ts,tsx}'],
			rules: {
				'no-restricted-syntax': ['error', tryWithoutCatch],
			},
		},
		...configs,
	];
}

// A lifecycle is one closed union, so a switch over it must handle every state.
// A JavaScript app has no tsconfig and no types, so it skips this.
function withExhaustiveState(configs) {
	if (!fs.existsSync(path.join(__dirname, 'tsconfig.json'))) {
		return configs;
	}

	return [
		...configs,
		{
			name: 'app/exhaustive-state',
			files: ['**/*.{ts,tsx}'],
			rules: {
				'@typescript-eslint/switch-exhaustiveness-check': [
					'error',
					{ requireDefaultForNonUnion: true },
				],
			},
		},
	];
}

const fs = require('node:fs');
const path = require('node:path');
const { createConfig } = require('eslint-config-expo-magic');
const {
	createArchitectureConfig,
} = require('eslint-config-expo-magic/architecture');

const imageMessage = 'Import images from src/uikit/components/image.tsx.';

const sourceFiles = 'src/**/*.{ts,tsx,js,jsx,mts,cts}';
const testFiles = ['src/**/*.{test,spec}.*', 'src/test/**'];

const httpMessage =
	'fetch and XMLHttpRequest belong in src/services/http. Call the HTTP client instead.';

const stateAndEffectHooks = new Set([
	'useEffect',
	'useInsertionEffect',
	'useLayoutEffect',
	'useReducer',
	'useState',
]);

function calleeName(callee) {
	if (callee.type === 'Identifier') {
		return callee.name;
	}
	if (
		callee.type === 'MemberExpression' &&
		!callee.computed &&
		callee.property.type === 'Identifier'
	) {
		return callee.property.name;
	}
	return undefined;
}

const noStateOrEffectsInViews = {
	meta: {
		type: 'problem',
		schema: [],
		messages: {
			banned:
				'Views and routes render props. Move {{name}} into a use-*.ts hook.',
		},
	},
	create(context) {
		return {
			CallExpression(node) {
				const name = calleeName(node.callee);
				if (name !== undefined && stateAndEffectHooks.has(name)) {
					context.report({ node, messageId: 'banned', data: { name } });
				}
			},
		};
	},
};

const noImperativeRouter = {
	meta: {
		type: 'problem',
		schema: [],
		messages: {
			banned:
				'Use useRouter() from expo-router. The shared `router` breaks after Android recreates the activity.',
		},
	},
	create(context) {
		return {
			ImportSpecifier(node) {
				if (
					node.parent.source.value === 'expo-router' &&
					node.imported.name === 'router'
				) {
					context.report({ node, messageId: 'banned' });
				}
			},
		};
	},
};

module.exports = withExhaustiveState(
	withNoTryWithoutCatch(
		createConfig({
			prettier: true,
			reactCompiler: true,
			testing: true,
			nativeUi: {
				allowFiles: [
					'**/src/uikit/components/*.tsx',
					'**/src/services/navigation/use-app-router.ts',
				],
				additionalRestrictions: [{ name: 'expo-image', message: imageMessage }],
			},
			semanticColors: {
				allowFiles: ['**/src/uikit/tokens/colors.ts'],
				tokenModule: 'uikit/tokens/colors',
			},
			extraIgnores: [
				'.cache/**',
				'.expo/**',
				'android/**',
				'ios/**',
				'assets/**',
				'scripts/**',
				'app.config.ts',
				'expo-env.d.ts',
			],
		})
			.concat(
				createArchitectureConfig({
					layers: {
						routes: 'app',
						ui: 'uikit',
						tokens: 'uikit/tokens',
						components: 'uikit/components',
					},
					nativeWrappers: [
						'src/uikit/components/*.tsx',
						'src/services/navigation/use-app-router.ts',
					],
					extraNativeLibPatterns: [
						{ group: ['expo-image', 'expo-image/*'], message: imageMessage },
					],
				}),
			)
			// The jest plugin's globals cover *.test.* files; the shared setup module
			// also runs under jest and needs them.
			.concat([
				{
					name: 'app/test-setup-globals',
					files: ['src/test/**/*.{ts,tsx,js,jsx}'],
					languageOptions: {
						globals: {
							afterEach: 'readonly',
							beforeEach: 'readonly',
							jest: 'readonly',
						},
					},
				},
				{
					name: 'app/fetch-only-in-http',
					files: [sourceFiles],
					ignores: ['src/services/http/**', ...testFiles],
					rules: {
						'no-restricted-globals': [
							'error',
							{ name: 'fetch', message: httpMessage },
							{ name: 'XMLHttpRequest', message: httpMessage },
						],
					},
				},
				{
					name: 'app/no-state-or-effects-in-views',
					files: ['src/**/*-view.{tsx,jsx}', 'src/app/**/*.{tsx,jsx}'],
					ignores: testFiles,
					plugins: {
						app: {
							rules: {
								'no-state-or-effects-in-views': noStateOrEffectsInViews,
							},
						},
					},
					rules: { 'app/no-state-or-effects-in-views': 'error' },
				},
				{
					name: 'app/no-imperative-router',
					files: [sourceFiles],
					plugins: {
						'app-router': {
							rules: { 'no-imperative-router': noImperativeRouter },
						},
					},
					rules: { 'app-router/no-imperative-router': 'error' },
				},
			]),
	),
);
