import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { getLanguage } from '@/services/i18n/language-store';
import { translate } from '@/services/i18n/translate';
import type { AppRuntime } from '@/services/runtime/app-runtime';
import { AppRuntimeContext } from '@/services/runtime/app-runtime-context';
import BootFailedView from '@/services/runtime/boot-failed-view';
import {
	markBootLaidOut,
	retryBoot,
	useBootAppRuntime,
} from '@/services/runtime/use-boot-app-runtime';
import { useInvalidateOnEngineChange } from '@/services/runtime/use-invalidate-on-engine-change';

type RuntimeScopeProps = PropsWithChildren<{ runtime: AppRuntime }>;

const RuntimeScope = ({ children, runtime }: RuntimeScopeProps) => {
	useInvalidateOnEngineChange(runtime);

	return (
		<AppRuntimeContext.Provider value={runtime}>
			{children}
		</AppRuntimeContext.Provider>
	);
};

/**
 * Renders nothing while the runtime boots (the native splash screen is still
 * up). A failed boot shows its own screen with a retry that boots again and no
 * network is needed to try again. The splash cannot return, so a retry shows
 * the empty page colour until boot ends.
 */
const AppRuntimeProvider = ({ children }: PropsWithChildren) => {
	const boot = useBootAppRuntime();

	switch (boot.kind) {
		case 'booting':
			return null;
		case 'failed': {
			const language = getLanguage();
			return (
				<View onLayout={markBootLaidOut} style={styles.fill}>
					<BootFailedView
						onRetry={retryBoot}
						retryTitle={translate(language, 'error.retry')}
						title={translate(language, 'error.generic')}
					/>
				</View>
			);
		}
		case 'ready':
			return (
				<View onLayout={markBootLaidOut} style={styles.fill}>
					<RuntimeScope runtime={boot.runtime}>{children}</RuntimeScope>
				</View>
			);
		default:
			return boot satisfies never;
	}
};

const styles = StyleSheet.create({
	fill: {
		flex: 1,
	},
});

export default AppRuntimeProvider;
