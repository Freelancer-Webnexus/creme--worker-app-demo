// Every request outside /__admin answers 500.
import { setSwitches, log } from './lib.mjs';

await setSwitches({ errorRate: 1 });
log('mock: errorRate 1');
