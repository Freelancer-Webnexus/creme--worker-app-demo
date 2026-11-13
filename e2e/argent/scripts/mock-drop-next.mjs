// Save the next action, then close the socket without answering.
import { setSwitches, log } from './lib.mjs';

await setSwitches({ dropResponse: 'next' });
log('mock: dropResponse next');
