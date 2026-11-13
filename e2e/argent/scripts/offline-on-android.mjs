import { adb, log } from './lib.mjs';

adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'enable');
log('android: airplane mode on');
