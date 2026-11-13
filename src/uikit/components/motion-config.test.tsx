import * as React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, render } from '@testing-library/react-native';

const reactNative: unknown = jest.requireActual('react-native');
let mockMountedMode: string | null = null;

jest.mock('react-native-reanimated', () => ({
	...jest.requireActual('react-native-reanimated'),
	ReducedMotionConfig: ({ mode }: { mode: string }) => {
		mockMountedMode = mode;
		require('react').useEffect(
			() => () => {
				mockMountedMode = null;
			},
			[],
		);
		return null;
	},
}));

const loadFreshMotionConfig = () => {
	mockMountedMode = null;
	const loaded: { MotionConfig?: React.ComponentType } = {};
	jest.isolateModules(() => {
		jest.doMock('react', () => React);
		jest.doMock('react-native', () => reactNative);
		loaded.MotionConfig = require('@/uikit/components/motion-config').default;
	});
	return loaded.MotionConfig ?? (() => null);
};

const stubAccessibility = (reduced: boolean) => {
	let emit: (enabled: boolean) => void = () => {};
	jest
		.spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
		.mockResolvedValue(reduced);
	jest
		.spyOn(AccessibilityInfo, 'addEventListener')
		.mockImplementation((_name, handler) => {
			emit = handler;
			return { remove: jest.fn() };
		});
	return (enabled: boolean) => {
		emit(enabled);
	};
};

describe('MotionConfig', () => {
	it('overrides a setting that differs from startup and drops the override when it matches again', async () => {
		const emit = stubAccessibility(true);
		const MotionConfig = loadFreshMotionConfig();

		await render(<MotionConfig />);
		expect(mockMountedMode).toBe('always');

		await act(async () => {
			emit(false);
		});
		expect(mockMountedMode).toBeNull();
	});

	it('mounts no override while the setting matches startup', async () => {
		stubAccessibility(false);
		const MotionConfig = loadFreshMotionConfig();

		await render(<MotionConfig />);
		expect(mockMountedMode).toBeNull();
	});
});
