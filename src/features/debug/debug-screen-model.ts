export type DebugScreenModel = {
	title: string;
	compressionLabel: string;
	compressionHint: string;
	compressionDisabled: boolean;
	apiUrlLabel: string;
	apiUrl: string;
	backLabel: string;
	onCompressionDisabledChange: (disabled: boolean) => void;
	onBack: () => void;
};
