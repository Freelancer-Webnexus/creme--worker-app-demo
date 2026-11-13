/**
 * One rule for screen motion: a step forward in a task (phone to code, a
 * document to its capture) slides in; a switch between areas (sign-in and the
 * tabs) fades, as the tabs do between themselves. Reduce Motion turns both off.
 */
export type ScreenMotion = 'step' | 'switch';

export const screenAnimation = (
	motion: ScreenMotion,
	reducedMotion: boolean,
): 'none' | 'slide_from_right' | 'fade' => {
	if (reducedMotion) return 'none';
	return motion === 'step' ? 'slide_from_right' : 'fade';
};
