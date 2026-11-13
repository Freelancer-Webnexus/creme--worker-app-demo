#!/usr/bin/env bun
/**
 * House rule 5: no signing keys, store credentials or API keys in the
 * repository. Fails on credential file names and on common key patterns in any
 * file git would commit.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const FORBIDDEN_NAMES = [
	/(^|\/)\.env(\..+)?$/,
	/\.(jks|keystore|p12|p8|pem|mobileprovision)$/,
	/(^|\/)google-services\.json$/,
	/(^|\/)GoogleService-Info\.plist$/,
	/(^|\/)service-account.*\.json$/,
	/(^|\/)credentials\.json$/,
];

const KEY_PATTERNS: { name: string; pattern: RegExp }[] = [
	{ name: 'private key block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
	{ name: 'AWS access key', pattern: /AKIA[0-9A-Z]{16}/ },
	{ name: 'Google API key', pattern: /AIza[0-9A-Za-z_-]{35}/ },
	{ name: 'GitHub token', pattern: /gh[pousr]_[A-Za-z0-9]{36}/ },
	{ name: 'Stripe live key', pattern: /sk_live_[0-9a-zA-Z]{10,}/ },
	{ name: 'Slack token', pattern: /xox[baprs]-[0-9A-Za-z-]{10,}/ },
];

const MAX_SCAN_BYTES = 1_000_000;

const listed = spawnSync('git', [
	'ls-files',
	'--cached',
	'--others',
	'--exclude-standard',
	'-z',
]);

if (listed.status !== 0) {
	console.error(listed.stderr.toString());
	process.exit(1);
}

const files = listed.stdout.toString().split('\0').filter(Boolean);
const problems: string[] = [];

for (const file of files) {
	if (FORBIDDEN_NAMES.some((pattern) => pattern.test(file))) {
		problems.push(`${file}: credential file name`);
		continue;
	}

	let size: number;
	try {
		size = statSync(file).size;
	} catch {
		// Listed by git but deleted in the working tree.
		continue;
	}
	if (size > MAX_SCAN_BYTES) {
		continue;
	}

	const text = readFileSync(file, 'utf8');
	for (const { name, pattern } of KEY_PATTERNS) {
		if (pattern.test(text)) {
			problems.push(`${file}: looks like a ${name}`);
		}
	}
}

if (problems.length > 0) {
	console.error(`secrets:check failed (house rule 5):\n${problems.join('\n')}`);
	process.exit(1);
}

console.log(`secrets:check: ${files.length} files, no credentials found.`);
