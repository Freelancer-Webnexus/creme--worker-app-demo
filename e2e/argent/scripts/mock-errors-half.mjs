// Random 500s on half of the requests (scenario 6).
import { setSwitches, log } from './lib.mjs';

await setSwitches({ errorRate: 0.5 });
log('mock: errorRate 0.5');
