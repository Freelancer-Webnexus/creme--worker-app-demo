import { adb, log } from './lib.mjs';

adb('shell', 'settings', 'put', 'system', 'font_scale', '1.0');
log('android: font scale 1.0');
