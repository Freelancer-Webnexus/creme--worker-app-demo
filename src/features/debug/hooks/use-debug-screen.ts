import { useSyncExternalStore } from 'react';
import type { DebugScreenModel } from '@/features/debug/debug-screen-model';
import { apiBaseUrl } from '@/services/api/api-config';
import { useTranslation } from '@/services/i18n/use-translation';
import useAppRouter from '@/services/navigation/use-app-router';
import { useAppRuntime } from '@/services/runtime/use-app-runtime';

const useDebugScreen = (): DebugScreenModel => {
	const { debugFlags } = useAppRuntime();
	const { t } = useTranslation();
	const router = useAppRouter();
	const { compressionEnabled } = useSyncExternalStore(
		debugFlags.subscribe,
		debugFlags.getSnapshot,
		debugFlags.getSnapshot,
	);

	return {
		apiUrl: apiBaseUrl(),
		apiUrlLabel: t('debug.api_url'),
		backLabel: t('debug.back'),
		compressionDisabled: !compressionEnabled,
		compressionHint: t('debug.compression_hint'),
		compressionLabel: t('debug.disable_compression'),
		onBack: () => {
			if (router.canGoBack()) {
				router.back();
			} else {
				router.replace('/(tabs)');
			}
		},
		onCompressionDisabledChange: (disabled) => {
			debugFlags.setCompressionEnabled(!disabled);
		},
		title: t('debug.title'),
	};
};

export default useDebugScreen;
