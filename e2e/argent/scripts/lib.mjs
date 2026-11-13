// Shared helpers for the Argent e2e scripts. Plain Node: no dependencies.
// Device and mock addresses can be overridden with environment variables.
import { execFileSync } from 'node:child_process';

export const PACKAGE = 'com.joaopaulomarra.workerapp';
export const MOCK_URL = process.env.E2E_MOCK_URL ?? 'http://localhost:4000';
export const ANDROID_SERIAL = process.env.E2E_ANDROID_SERIAL ?? 'emulator-5554';
const IOS_REFERENCE_DEVICE = 'iPhone 17e';

const run = (command, args) =>
	execFileSync(command, args, { encoding: 'utf8', timeout: 60_000 });

/** E2E_IOS_UDID, else the only booted simulator, else the booted reference device. */
const findIosUdid = () => {
	if (process.env.E2E_IOS_UDID !== undefined) {
		return process.env.E2E_IOS_UDID;
	}
	const listing = JSON.parse(
		run('xcrun', ['simctl', 'list', 'devices', 'booted', '-j']),
	);
	const booted = Object.values(listing.devices).flat();
	const match =
		booted.length === 1
			? booted[0]
			: booted.find((device) => device.name === IOS_REFERENCE_DEVICE);
	if (match === undefined) {
		throw new Error(
			`Set E2E_IOS_UDID: ${booted.length} booted simulators, none named ${IOS_REFERENCE_DEVICE}`,
		);
	}
	return match.udid;
};

export const iosUdid = findIosUdid;

/** adb sometimes answers "error: closed" for one call, so retry a few times. */
export const adb = (...args) => {
	for (let attempt = 1; ; attempt += 1) {
		try {
			return run('adb', ['-s', ANDROID_SERIAL, ...args]);
		} catch (error) {
			if (attempt === 3) {
				throw error;
			}
		}
	}
};
export const simctl = (...args) => run('xcrun', ['simctl', ...args]);

export const mockPost = async (path, body) => {
	const response = await fetch(`${MOCK_URL}${path}`, {
		body: body === undefined ? undefined : JSON.stringify(body),
		headers: { 'content-type': 'application/json' },
		method: 'POST',
	});
	if (!response.ok) {
		throw new Error(`POST ${path} answered ${response.status}`);
	}
};

export const mockState = async () => {
	const response = await fetch(`${MOCK_URL}/__admin/state`);
	return response.json();
};

export const log = (message) => process.stdout.write(`${message}\n`);

export const fail = (message) => {
	process.stderr.write(`FAIL: ${message}\n`);
	process.exit(1);
};

/** Counts saved records for one worker (or all workers when workerId is omitted). */
export const countRecords = (state, kind, workerId) =>
	state[kind].filter(
		(record) => workerId === undefined || record.workerId === workerId,
	).length;

export const expectCount = async (kind, workerId, expected) => {
	const state = await mockState();
	const actual = countRecords(state, kind, workerId);
	if (actual !== expected) {
		fail(
			`${kind} for ${workerId ?? 'all workers'}: expected ${expected}, found ${actual}`,
		);
	}
	log(`ok: ${kind} for ${workerId ?? 'all workers'} = ${actual}`);
};

export const setSwitches = (switches) =>
	mockPost('/__admin/switches', switches);

export const resetMock = () => mockPost('/__admin/reset');
