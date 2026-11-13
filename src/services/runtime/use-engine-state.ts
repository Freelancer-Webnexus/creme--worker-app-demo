import { useSyncExternalStore } from 'react';
import { useAppRuntime } from '@/services/runtime/use-app-runtime';
import type { EngineState } from '@/services/sync/sync-types';

export const useEngineState = (): EngineState => {
	const { engine } = useAppRuntime();
	return useSyncExternalStore(
		engine.subscribe,
		engine.getState,
		engine.getState,
	);
};
