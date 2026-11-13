import { useSyncExternalStore } from 'react';
import { hide } from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { logger } from '@/services/logger/logger';
import {
	type AppRuntime,
	createAppRuntime,
} from '@/services/runtime/app-runtime';
import type { BootState } from '@/services/runtime/boot-state';
import { createBootStore } from '@/services/runtime/boot-store';
import { createSplashPorts } from '@/services/runtime/splash-ports';
import { getPageColor } from '@/uikit/hooks/use-theme';

export type BootScreenState = BootState<AppRuntime>;

const bootStore = createBootStore<AppRuntime>({
	boot: createAppRuntime,
	splash: createSplashPorts({
		hide,
		logger,
		pageColor: getPageColor,
		setBackground: SystemUI.setBackgroundColorAsync,
	}),
});

export const retryBoot = bootStore.retry;

export const markBootLaidOut = bootStore.markLaidOut;

export const releaseSplashOnError = bootStore.releaseSplashOnError;

export const useBootAppRuntime = (): BootScreenState =>
	useSyncExternalStore(
		bootStore.subscribe,
		bootStore.getState,
		bootStore.getState,
	);
