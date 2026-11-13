// Mock state: no document saved.
import { expectCount } from './lib.mjs';

await expectCount('documents', undefined, 0);
