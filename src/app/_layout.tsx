import { StyleSheet } from 'react-native';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import GlobalErrorBoundary from '@/services/error-boundary/global-error-boundary';
import AppProviders from '@/services/runtime/app-providers';
import { releaseSplashOnError } from '@/services/runtime/use-boot-app-runtime';
import MotionConfig from '@/uikit/components/motion-config';
import useSystemBackground from '@/uikit/hooks/use-system-background';
import useTheme from '@/uikit/hooks/use-theme';
import { useReducedMotion } from '@/uikit/motion/reduced-motion';
import { screenAnimation } from '@/uikit/motion/screen-animation';
import { navigationThemeFor } from '@/uikit/tokens/navigation-theme';

const RootLayout = () => {
	const { scheme, semanticColors } = useTheme();
	useSystemBackground(semanticColors.background);
	const navigationTheme = navigationThemeFor(scheme);
	const reducedMotion = useReducedMotion();

	return (
		<GlobalErrorBoundary onError={releaseSplashOnError}>
			<GestureHandlerRootView
				style={[styles.root, { backgroundColor: semanticColors.background }]}
			>
				<SafeAreaProvider>
					<KeyboardProvider>
						<ThemeProvider value={navigationTheme}>
							<AppProviders>
								<MotionConfig />
								<StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
								<Stack
									screenOptions={{
										animation: screenAnimation('step', reducedMotion),
										contentStyle: {
											backgroundColor: semanticColors.background,
										},
										headerShown: false,
									}}
								>
									<Stack.Screen
										name="(tabs)"
										options={{
											animation: screenAnimation('switch', reducedMotion),
										}}
									/>
									<Stack.Screen
										name="(auth)"
										options={{
											animation: screenAnimation('switch', reducedMotion),
										}}
									/>
									<Stack.Screen name="capture/[documentType]" />
									<Stack.Protected guard={__DEV__}>
										<Stack.Screen name="debug" />
									</Stack.Protected>
								</Stack>
							</AppProviders>
						</ThemeProvider>
					</KeyboardProvider>
				</SafeAreaProvider>
			</GestureHandlerRootView>
		</GlobalErrorBoundary>
	);
};

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
});

export default RootLayout;
