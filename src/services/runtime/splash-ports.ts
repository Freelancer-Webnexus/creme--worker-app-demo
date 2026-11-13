export type SplashPortDependencies = {
	hide: () => void;
	logger: { warn: (scope: string, message: string) => void };
	pageColor: () => string;
	setBackground: (color: string) => Promise<void>;
};

/**
 * The native window behind React is painted with the page colour before the
 * splash fades, so the first visible frame never shows the default colour. A
 * failed paint is cosmetic and never keeps the splash up.
 */
export const createSplashPorts = ({
	hide,
	logger,
	pageColor,
	setBackground,
}: SplashPortDependencies): { release: () => void } => ({
	release: () => {
		setBackground(pageColor()).then(
			() => {
				hide();
			},
			() => {
				logger.warn('splash', 'Could not paint the window background.');
				hide();
			},
		);
	},
});
