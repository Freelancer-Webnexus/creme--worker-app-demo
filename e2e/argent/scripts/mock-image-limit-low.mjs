// Any photo is now over the limit, so the next upload answers 413. Scenario 5
// on a release build, where the debug switch that skips compression is absent.
import { setSwitches, log } from './lib.mjs';

await setSwitches({ maxImageBytes: 1024 });
log('mock: maxImageBytes 1024');
