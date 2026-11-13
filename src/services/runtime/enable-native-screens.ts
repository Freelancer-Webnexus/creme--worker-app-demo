import { enableFreeze, enableScreens } from 'react-native-screens';

// enableScreens is already the library default on native. Call it so the app
// never silently inherits a disable from a host or test harness.
enableScreens(true);
enableFreeze(true);
