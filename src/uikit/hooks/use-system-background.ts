import { useEffect } from 'react';
import * as SystemUI from 'expo-system-ui';

/**
 * Paints the native root view with the page colour. Without it the window
 * behind React stays white, and a dark-mode worker sees white flashes during
 * screen transitions and while the keyboard resizes the view.
 */
const useSystemBackground = (color: string): void => {
	useEffect(() => {
		SystemUI.setBackgroundColorAsync(color).catch(() => {
			// Cosmetic only: React already paints every screen with the same colour.
		});
	}, [color]);
};

export default useSystemBackground;
