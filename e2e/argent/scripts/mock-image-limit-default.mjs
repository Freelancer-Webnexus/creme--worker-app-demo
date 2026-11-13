import { setSwitches, log } from './lib.mjs';

await setSwitches({ maxImageBytes: 1_572_864 });
log('mock: maxImageBytes 1572864');
