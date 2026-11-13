import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import useAuthStep from '@/features/session/hooks/use-auth-step';
import { useTranslation } from '@/services/i18n/use-translation';
import useTheme from '@/uikit/hooks/use-theme';
import { useReducedMotion } from '@/uikit/motion/reduced-motion';
import AppTabBar from '@/uikit/navigation/app-tab-bar';

/**
 * The tab shell is the signed-in area, and the redirect lives here so one route
 * owns "/". A worker whose session expired (a 401) stays in the tabs: their
 * saved actions are on the phone and Home offers "sign in again".
 */
const TabsLayout = () => {
	const { semanticColors } = useTheme();
	const { t } = useTranslation();
	const step = useAuthStep();
	const reducedMotion = useReducedMotion();

	if (step === 'enter_phone') {
		return <Redirect href="/(auth)/phone" />;
	}
	if (step === 'choose_worker') {
		return <Redirect href="/(auth)/worker" />;
	}

	return (
		<Tabs
			screenOptions={{
				// The JS tabs ignore the system Reduce Motion setting, so it is read here.
				animation: reducedMotion ? 'none' : 'fade',
				headerShown: false,
				sceneStyle: { backgroundColor: semanticColors.background },
			}}
			tabBar={(props) => <AppTabBar {...props} />}
		>
			<Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
			<Tabs.Screen name="documents" options={{ title: t('tabs.documents') }} />
			<Tabs.Screen name="terms" options={{ title: t('tabs.terms') }} />
		</Tabs>
	);
};

export default TabsLayout;
