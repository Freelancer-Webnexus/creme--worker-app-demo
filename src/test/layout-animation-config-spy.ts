import { createElement } from 'react';

type ConfigProps = { skipEntering?: boolean };

export const layoutAnimationConfigSpy = jest.fn<void, [ConfigProps]>();

export const mockReanimatedWithConfigSpy = () => {
	const actual = jest.requireActual('react-native-reanimated');
	const wrapped = (props: ConfigProps) => {
		layoutAnimationConfigSpy({ skipEntering: props.skipEntering });
		return createElement(actual.LayoutAnimationConfig, props);
	};
	return new Proxy(actual, {
		get: (target, key) =>
			key === 'LayoutAnimationConfig' ? wrapped : target[key],
	});
};
