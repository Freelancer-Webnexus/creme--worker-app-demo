import { setSwitches, log } from './lib.mjs';

await setSwitches({ latencyMs: 0 });
log('mock: latency 0');
