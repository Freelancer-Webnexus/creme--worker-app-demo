import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion as useStartupReducedMotion } from 'react-native-reanimated';
import {
	createReducedMotionStore,
	isMotionReduced,
	type MotionPreference,
} from '@/uikit/motion/reduced-motion-store';

const store = createReducedMotionStore({
	listen: (onChange) => {
		const subscription = AccessibilityInfo.addEventListener(
			'reduceMotionChanged',
			onChange,
		);
		return () => {
			subscription.remove();
		};
	},
	read: () => AccessibilityInfo.isReduceMotionEnabled(),
});

const useMotionPreference = (): MotionPreference =>
	useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

const useReducedMotion = (): boolean =>
	isMotionReduced(useMotionPreference(), useStartupReducedMotion());

export { useMotionPreference, useReducedMotion };
