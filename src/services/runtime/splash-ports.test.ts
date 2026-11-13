import { createSplashPorts } from '@/services/runtime/splash-ports';
import { darkSemanticColors } from '@/uikit/tokens/colors';

const PAINTED = `background ${darkSemanticColors.background}`;

const setup = (setBackground: (color: string) => Promise<void>) => {
	const calls: string[] = [];
	const warnings: string[] = [];
	const ports = createSplashPorts({
		hide: () => {
			calls.push('hide');
		},
		logger: {
			warn: (_scope, message) => {
				warnings.push(message);
			},
		},
		pageColor: () => darkSemanticColors.background,
		setBackground: (color) => {
			calls.push(`background ${color}`);
			return setBackground(color);
		},
	});
	return { calls, ports, warnings };
};

const settle = async (): Promise<void> => {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
};

describe('createSplashPorts', () => {
	it('paints the window with the page colour, then hides the splash', async () => {
		const { calls, ports, warnings } = setup(() => Promise.resolve());

		ports.release();
		expect(calls).toEqual([PAINTED]);

		await settle();

		expect(calls).toEqual([PAINTED, 'hide']);
		expect(warnings).toEqual([]);
	});

	it('still hides the splash when the window cannot be painted', async () => {
		const { calls, ports, warnings } = setup(() =>
			Promise.reject(new Error('no window')),
		);

		ports.release();
		await settle();

		expect(calls).toEqual([PAINTED, 'hide']);
		expect(warnings).toHaveLength(1);
	});
});
