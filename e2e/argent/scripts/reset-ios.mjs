// Baseline for iOS simulator: fresh install state, mock reset.
// Wipes the SQLite database and saved photos in the app container and resets
// the simulator keychain (session token).
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { PACKAGE, iosUdid, log, resetMock, simctl } from './lib.mjs';

const udid = iosUdid();
try {
	simctl('terminate', udid, PACKAGE);
} catch {
	// The app was not running.
}
const container = simctl('get_app_container', udid, PACKAGE, 'data').trim();
for (const folder of ['Documents/SQLite', 'Documents/uploads']) {
	rmSync(join(container, folder), { force: true, recursive: true });
}
// The session token lives in the keychain, which survives a data wipe.
simctl('keychain', udid, 'reset');
await resetMock();
log('ios baseline ready');
