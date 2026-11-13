import { useReducer } from 'react';
import { authStepOf, lastKnownPhone } from '@/features/session/auth-step';
import { pendingSignIn } from '@/features/session/pending-sign-in';
import {
	initialPhoneForm,
	phoneFormReducer,
} from '@/features/session/phone-form';
import { checkPhone } from '@/features/session/phone-number';
import type { PhoneScreenModel } from '@/features/session/phone-screen-model';
import { sessionNoticeFor } from '@/features/session/session-notice';
import { phoneProblemKey } from '@/features/session/sign-in-copy';
import { useTranslation } from '@/services/i18n/use-translation';
import useAppRouter from '@/services/navigation/use-app-router';
import { useAppRuntime } from '@/services/runtime/use-app-runtime';
import { useEngineState } from '@/services/runtime/use-engine-state';
import { useAuthSession } from '@/services/session/use-auth-session';

const usePhoneScreen = (): PhoneScreenModel => {
	const { api } = useAppRuntime();
	const { state: session } = useAuthSession();
	const engineState = useEngineState();
	const { language, setLanguage, t } = useTranslation();
	const router = useAppRouter();
	const [form, dispatch] = useReducer(
		phoneFormReducer,
		lastKnownPhone(session),
		initialPhoneForm,
	);

	const submit = async (): Promise<void> => {
		if (form.status.kind === 'sending') {
			return;
		}
		const check = checkPhone(form.text);
		if (check.kind !== 'valid') {
			dispatch({ problem: 'invalid_phone', type: 'send_failed' });
			return;
		}

		dispatch({ type: 'send_started' });
		const result = await api.requestOtp(check.phone);
		switch (result.kind) {
			case 'ok':
				pendingSignIn.codeRequested(check.phone);
				dispatch({ type: 'code_sent' });
				router.push('/(auth)/code');
				return;
			case 'network_error':
				dispatch({ problem: 'needs_connection', type: 'send_failed' });
				return;
			case 'server_error':
				dispatch({ problem: 'server_unavailable', type: 'send_failed' });
				return;
			default:
				return result satisfies never;
		}
	};

	const isSending = form.status.kind === 'sending';

	return {
		buttonTitle: isSending ? t('signin.sending_code') : t('signin.continue'),
		error:
			form.status.kind === 'problem'
				? t(phoneProblemKey(form.status.problem))
				: undefined,
		hint: t('signin.phone_hint'),
		isBusy: isSending,
		label: t('signin.phone_label'),
		language,
		languageLabel: t('language.label'),
		languageOptions: [
			{ label: t('language.es'), value: 'es' },
			{ label: t('language.en'), value: 'en' },
		],
		notice: sessionNoticeFor(authStepOf(session, engineState), t),
		onChangeText: (text) => {
			dispatch({ text, type: 'edited' });
		},
		onLanguageChange: setLanguage,
		onSubmit: () => {
			void submit();
		},
		title: t('signin.title'),
		value: form.text,
	};
};

export default usePhoneScreen;
