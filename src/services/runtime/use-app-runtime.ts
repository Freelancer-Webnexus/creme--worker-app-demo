import { useContext } from 'react';
import type { AppRuntime } from '@/services/runtime/app-runtime';
import { AppRuntimeContext } from '@/services/runtime/app-runtime-context';

/**
 * The runtime built at app start. Screens render only after it is ready, so a
 * missing runtime means a provider is missing from the tree: fail loudly.
 */
export const useAppRuntime = (): AppRuntime => {
	const runtime = useContext(AppRuntimeContext);
	if (runtime === null) {
		throw new Error('useAppRuntime needs the AppRuntimeProvider above it.');
	}
	return runtime;
};
