import { Redirect, Stack } from 'expo-router';
import { isPhoneFlowOpen } from '@/features/session/auth-step';
import useAuthStep from '@/features/session/hooks/use-auth-step';
import SigningInView from '@/features/session/screens/signing-in-view';
import { useReducedMotion } from '@/uikit/motion/reduced-motion';
import { screenAnimation } from '@/uikit/motion/screen-animation';

/**
 * Which sign-in screens are reachable follows the session, not a navigation
 * call: the phone and code screens while someone enters or renews a login, the
 * worker picker while the number maps to several workers. Once signed in again,
 * this group hands the phone back to the tabs.
 */
const AuthGroupLayout = () => {
	const step = useAuthStep();
	const reducedMotion = useReducedMotion();

	if (step === 'signed_in') {
		return (
			<>
				<Redirect href="/(tabs)" />
				<SigningInView />
			</>
		);
	}

	return (
		<Stack
			screenOptions={{
				animation: screenAnimation('step', reducedMotion),
				headerShown: false,
			}}
		>
			<Stack.Protected guard={isPhoneFlowOpen(step)}>
				<Stack.Screen name="phone" />
				<Stack.Screen name="code" />
			</Stack.Protected>
			<Stack.Protected guard={step === 'choose_worker'}>
				<Stack.Screen name="worker" />
			</Stack.Protected>
		</Stack>
	);
};

export default AuthGroupLayout;
