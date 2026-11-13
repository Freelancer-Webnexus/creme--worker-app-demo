// 4-second latency, long enough to kill the app while a request is in flight.
import { setSwitches, log } from './lib.mjs';

await setSwitches({ latencyMs: 4000 });
log('mock: latency 4000 ms');
