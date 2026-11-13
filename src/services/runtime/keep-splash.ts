import { Platform } from 'react-native';
import { preventAutoHideAsync, setOptions } from 'expo-splash-screen';
import { logger } from '@/services/logger/logger';

// Android fades its splash view in only after the app's first frame, so a fade
// shows the screen, then the splash again on top of it. A cut avoids that flicker.
setOptions(
	Platform.OS === 'ios' ? { duration: 200, fade: true } : { duration: 0 },
);

/**
 * Runs at import time, before the first render: calling it from a component is
 * too late and the native splash would already be gone.
 */
preventAutoHideAsync().catch(() => {
	logger.warn('splash', 'Could not hold the splash screen.');
});
