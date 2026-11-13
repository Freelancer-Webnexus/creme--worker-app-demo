// Baseline for Android: fresh install state. Clears the app data (session,
// language, queue, cache, saved photos, secure token), resets the mock, turns
// airplane mode off and restores the font scale. `pm clear` works on a release
// build, where `run-as` is not allowed.
import { PACKAGE, adb, resetMock, log } from './lib.mjs';

adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'disable');
adb('shell', 'settings', 'put', 'system', 'font_scale', '1.0');
adb('shell', 'pm', 'clear', PACKAGE);
await resetMock();
log('android baseline ready');
