// Mock state: exactly one document saved.
import { expectCount } from './lib.mjs';

await expectCount('documents', undefined, 1);
