import {
	ReduceMotion,
	ReducedMotionConfig,
	useReducedMotion as useStartupReducedMotion,
} from 'react-native-reanimated';
import { useMotionPreference } from '@/uikit/motion/reduced-motion';
import {
	reduceMotionModeFor,
	type ReduceMotionMode,
} from '@/uikit/motion/reduced-motion-store';

const reanimatedModes: Record<ReduceMotionMode, ReduceMotion> = {
	always: ReduceMotion.Always,
	never: ReduceMotion.Never,
	system: ReduceMotion.System,
};

const MotionConfig = () => {
	const preference = useMotionPreference();
	const startupReduced = useStartupReducedMotion();
	const mode = reduceMotionModeFor(preference, startupReduced);

	// Reanimated warns in dev whenever the config mounts, so it mounts only for
	// a live change; unmounting restores the startup setting.
	return mode === 'system' ? null : (
		<ReducedMotionConfig mode={reanimatedModes[mode]} />
	);
};

export default MotionConfig;
