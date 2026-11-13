import {
	type BootEvent,
	type BootState,
	bootTransition,
	initialBootState,
	initialSplashState,
	type SplashEvent,
	type SplashState,
	splashTransition,
} from '@/services/runtime/boot-state';

type Runtime = { name: string };

const runtime: Runtime = { name: 'runtime' };
const error = new Error('disk full');

const booting: BootState<Runtime> = { kind: 'booting' };
const ready: BootState<Runtime> = { kind: 'ready', runtime };
const failed: BootState<Runtime> = { error, kind: 'failed' };

const succeeded: BootEvent<Runtime> = { runtime, type: 'succeeded' };
const failure: BootEvent<Runtime> = { error, type: 'failed' };
const retry: BootEvent<Runtime> = { type: 'retry' };

const rows: [
	string,
	BootState<Runtime>,
	BootEvent<Runtime>,
	BootState<Runtime>,
][] = [
	['booting + succeeded', booting, succeeded, ready],
	['booting + failed', booting, failure, failed],
	['booting + retry is ignored', booting, retry, booting],
	['ready + succeeded is ignored', ready, succeeded, ready],
	['ready + failed is ignored', ready, failure, ready],
	['ready + retry is ignored', ready, retry, ready],
	['failed + retry boots again', failed, retry, booting],
	['failed + succeeded is ignored', failed, succeeded, failed],
	['failed + failed is ignored', failed, failure, failed],
];

const splashRows: [string, SplashState, SplashEvent, SplashState][] = [
	['held + bootSettled', 'held', 'bootSettled', 'awaitingLayout'],
	['held + laidOut is ignored', 'held', 'laidOut', 'held'],
	['held + retried is ignored', 'held', 'retried', 'held'],
	['awaitingLayout + laidOut', 'awaitingLayout', 'laidOut', 'released'],
	['awaitingLayout + retried', 'awaitingLayout', 'retried', 'held'],
	[
		'awaitingLayout + bootSettled is ignored',
		'awaitingLayout',
		'bootSettled',
		'awaitingLayout',
	],
	['held + renderFailed', 'held', 'renderFailed', 'released'],
	[
		'awaitingLayout + renderFailed',
		'awaitingLayout',
		'renderFailed',
		'released',
	],
	['released + retried is ignored', 'released', 'retried', 'released'],
	['released + laidOut is ignored', 'released', 'laidOut', 'released'],
	['released + bootSettled is ignored', 'released', 'bootSettled', 'released'],
	[
		'released + renderFailed is ignored',
		'released',
		'renderFailed',
		'released',
	],
];

describe('splashTransition', () => {
	it('starts held', () => {
		expect(initialSplashState).toBe('held');
	});

	it.each(splashRows)('%s', (_name, state, event, expected) => {
		expect(splashTransition(state, event)).toBe(expected);
	});
});

describe('bootTransition', () => {
	it('starts in booting', () => {
		expect(initialBootState).toEqual({ kind: 'booting' });
	});

	it.each(rows)('%s', (_name, state, event, expected) => {
		expect(bootTransition(state, event)).toEqual(expected);
	});

	it('returns the same object when an event changes nothing', () => {
		expect(bootTransition(ready, retry)).toBe(ready);
		expect(bootTransition(booting, retry)).toBe(booting);
	});
});
