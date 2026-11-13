import { mockPost, log } from './lib.mjs';

await mockPost('/__admin/publish-terms');
log('mock: terms v3 published');
