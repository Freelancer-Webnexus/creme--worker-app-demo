// Mock state: one terms acceptance, for version 3 (never for version 2).
import { expectCount, fail, mockState, log } from './lib.mjs';

await expectCount('termsAcceptances', undefined, 1);
const state = await mockState();
const accepted = state.termsAcceptances[0].termsVersionId;
if (accepted !== 'terms-v3') {
	fail(`accepted terms version is ${accepted}, expected terms-v3`);
}
log('ok: accepted terms-v3');
