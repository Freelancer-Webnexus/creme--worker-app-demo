// Mock state: exactly one terms acceptance saved.
import { expectCount } from './lib.mjs';

await expectCount('termsAcceptances', undefined, 1);
