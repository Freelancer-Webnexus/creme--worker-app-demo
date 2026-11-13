#!/usr/bin/env bun
/**
 * House rule 1 on CI: the pull request branch and every commit in it carry a
 * ticket ID. The local git hooks check the same thing earlier, but a hook can
 * be skipped and CI cannot.
 */
import { spawnSync } from 'node:child_process';

const BRANCH_PATTERN = /^MASNET-\d+-[a-z0-9-]+$/;
const SUBJECT_PATTERN = /^(MASNET-\d+ |Merge |Revert )/;

const headRef = process.env.GITHUB_HEAD_REF;
const baseRef = process.env.GITHUB_BASE_REF;

if (!headRef || !baseRef) {
	console.log('ticket-ids: not a pull request, nothing to check.');
	process.exit(0);
}

const problems: string[] = [];

if (!BRANCH_PATTERN.test(headRef)) {
	problems.push(`Branch "${headRef}" is not named MASNET-<n>-<slug>.`);
}

const log = spawnSync('git', [
	'log',
	'--no-merges',
	'--format=%h %s',
	`origin/${baseRef}..HEAD`,
]);

if (log.status !== 0) {
	console.error(log.stderr.toString());
	process.exit(1);
}

for (const line of log.stdout.toString().split('\n')) {
	if (line.trim() === '') {
		continue;
	}
	const subject = line.slice(line.indexOf(' ') + 1);
	if (!SUBJECT_PATTERN.test(subject)) {
		problems.push(`Commit ${line} does not start with a ticket ID.`);
	}
}

if (problems.length > 0) {
	console.error(problems.join('\n'));
	process.exit(1);
}

console.log('ticket-ids: branch and commits carry a ticket ID.');
