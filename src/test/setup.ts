// The library ships its own mock. The hand-rolled version supplied two of the
// exports it provides, so any component calling useSafeAreaInsets crashed.
jest.mock(
	'react-native-safe-area-context',
	() => require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('react-native-keyboard-controller', () =>
	require('react-native-keyboard-controller/jest'),
);
