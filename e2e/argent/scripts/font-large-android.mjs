// The largest font size Android offers (200%), as in the brief's large-text check.
import { adb, log } from './lib.mjs';

adb('shell', 'settings', 'put', 'system', 'font_scale', '2.0');
log('android: font scale 2.0');
