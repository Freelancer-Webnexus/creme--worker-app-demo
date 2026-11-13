import { adb, log } from './lib.mjs';

adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'disable');
log('android: airplane mode off');
