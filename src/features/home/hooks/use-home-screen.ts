import { Alert } from 'react-native';
import { useIsFocused } from 'expo-router';
import { presentHomeBody } from '@/features/home/home-body-copy';
import { buildHomeBody, firstNameOf } from '@/features/home/home-model';
import type { HomeScreenModel } from '@/features/home/home-screen-model';
import { describeSyncIndicator } from '@/features/home/sync-indicator-copy';
import { useTranslation } from '@/services/i18n/use-translation';
import useAppRouter from '@/services/navigation/use-app-router';
import { useRefreshAssignment } from '@/services/query/use-refresh-assignment';
import { useWorkerView } from '@/services/query/use-worker-view';
import {
	buildSyncIndicator,
	showsCountdown,
} from '@/services/runtime/sync-indicator-model';
import { useAppRuntime } from '@/services/runtime/use-app-runtime';
import { useNow } from '@/services/runtime/use-now';
import { useSyncStatus } from '@/services/runtime/use-sync-status';
import { useAuthSession } from '@/services/session/use-auth-session';

const useHomeScreen = (): HomeScreenModel => {
	const { engine } = useAppRuntime();
	const { dispatch, state } = useAuthSession();
	const { language, setLanguage, t } = useTranslation();
	const status = useSyncStatus();
	const view = useWorkerView();
	const refresh = useRefreshAssignment();
	const isFocused = useIsFocused();
	const router = useAppRouter();
	const indicatorInput = {
		engineState: status.engineState,
		isOnline: status.isOnline,
		queue: view.queue,
	};
	const now = useNow(isFocused && showsCountdown(indicatorInput));

	const workerName = state.kind === 'signed_in' ? state.worker.name : '';
	const firstName = firstNameOf(workerName);
	const hasSeveralWorkers =
		state.kind === 'signed_in' && state.workers.length > 1;

	const indicator = buildSyncIndicator({ ...indicatorInput, now });
	const body = buildHomeBody({
		cache: view.cache,
		isOnline: status.isOnline,
		queue: view.queue,
		refreshOutcome: refresh.outcome,
	});

	const nothingSaved =
		view.queue.kind === 'loaded' && view.queue.rows.length === 0;

	const confirmSignOut = (): void => {
		Alert.alert(
			t('session.sign_out_confirm_title'),
			t(
				nothingSaved
					? 'session.sign_out_confirm_body_clear'
					: 'session.sign_out_confirm_body',
			),
			[
				{ style: 'cancel', text: t('session.sign_out_confirm_no') },
				{
					onPress: () => {
						dispatch({ type: 'signed_out' });
					},
					style: 'destructive',
					text: t('session.sign_out_confirm_yes'),
				},
			],
		);
	};

	return {
		debugLink: __DEV__
			? {
					onPress: () => {
						router.push('/debug');
					},
					title: t('debug.title'),
				}
			: null,
		account: {
			signOutTitle: t('session.sign_out'),
			signedInAs: t('worker.current', { name: workerName }),
			switchWorkerTitle: hasSeveralWorkers ? t('worker.switch') : null,
			title: t('home.account_title'),
		},
		content: presentHomeBody(body, language, t),
		greeting:
			firstName === ''
				? t('tabs.home')
				: t('home.greeting', { name: firstName }),
		indicator: describeSyncIndicator(indicator, t),
		language: {
			label: t('language.label'),
			onChange: setLanguage,
			options: [
				{ label: t('language.es'), value: 'es' },
				{ label: t('language.en'), value: 'en' },
			],
			selected: language,
			title: t('home.language_title'),
		},
		onRefresh: refresh.refresh,
		onRetryNow: engine.retryNow,
		onSignInAgain: () => {
			router.push('/(auth)/phone');
		},
		onSignOut: confirmSignOut,
		onSwitchWorker: () => {
			dispatch({ type: 'switch_worker_requested' });
		},
		refreshing: refresh.isPulling,
	};
};

export default useHomeScreen;
