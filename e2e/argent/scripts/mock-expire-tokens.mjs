import { mockPost, log } from './lib.mjs';

await mockPost('/__admin/expire-tokens');
log('mock: tokens expired');
