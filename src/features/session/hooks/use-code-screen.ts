import { useReducer } from 'react';
import { authStepOf, verifiedOutcomeOf } from '@/features/session/auth-step';
import { codeFormReducer, initialCodeForm } from '@/features/session/code-form';
import type { CodeScreenModel } from '@/features/session/code-screen-model';
import usePendingSignIn from '@/features/session/hooks/use-pending-sign-in';
import { isCompleteCode, sanitizeCode } from '@/features/session/otp-code';
import { pendingSignIn } from '@/features/session/pending-sign-in';
import { displayPhone } from '@/features/session/phone-number';
import { sessionNoticeFor } from '@/features/session/session-notice';
import { codeProblemKey } from '@/features/session/sign-in-copy';
import { useTranslation } from '@/services/i18n/use-translation';
import useAppRouter from '@/services/navigation/use-app-router';
import { useAppRuntime } from '@/services/runtime/use-app-runtime';
import { useEngineState } from '@/services/runtime/use-engine-state';
import { useAuthSession } from '@/services/session/use-auth-session';

const useCodeScreen = (): CodeScreenModel => {
	const { api } = useAppRuntime();
	const { dispatch: dispatchSession, state: session } = useAuthSession();
	const engineState = useEngineState();
	const pending = usePendingSignIn();
	const { t } = useTranslation();
	const router = useAppRouter();
	const [form, dispatch] = useReducer(codeFormReducer, initialCodeForm);

	const phone = pending.kind === 'code_requested' ? pending.phone : null;

	const verify = async (code: string): Promise<void> => {
		if (phone === null || form.status.kind === 'verifying') {
			return;
		}
		dispatch({ type: 'verify_started' });
		const result = await api.verifyOtp(phone, code);
		switch (result.kind) {
			case 'ok':
				const next = dispatchSession({
					phone,
					session: result.session,
					type: 'otp_verified',
				});
				if (verifiedOutcomeOf(next) === 'no_workers') {
					dispatch({ type: 'wrong_code' });
				}
				return;
			case 'bad_code':
				dispatch({ type: 'wrong_code' });
				return;
			case 'network_error':
				dispatch({ type: 'no_connection' });
				return;
			case 'server_error':
				dispatch({ type: 'server_unavailable' });
				return;
			default:
				return result satisfies never;
		}
	};

	const error =
		form.status.kind === 'problem'
			? t(codeProblemKey(form.status.problem))
			: undefined;

	const isVerifying = form.status.kind === 'verifying';

	return {
		buttonTitle: isVerifying ? t('signin.verifying') : t('signin.verify'),
		changeNumberTitle: t('signin.change_number'),
		error,
		hint: t('signin.code_hint'),
		intro: t('signin.code_sent_to', {
			phone: phone === null ? '' : displayPhone(phone),
		}),
		isBusy: isVerifying,
		label: t('signin.code_label'),
		needsPhone: phone === null,
		notice: sessionNoticeFor(authStepOf(session, engineState), t),
		onChangeNumber: () => {
			pendingSignIn.clear();
			router.back();
		},
		onChangeText: (text) => {
			dispatch({ text, type: 'edited' });
			const code = sanitizeCode(text);
			if (isCompleteCode(code)) {
				void verify(code);
			}
		},
		onSubmit: () => {
			if (isCompleteCode(form.text)) {
				void verify(form.text);
			} else {
				dispatch({ type: 'incomplete' });
			}
		},
		title: t('signin.code_title'),
		value: form.text,
	};
};

export default useCodeScreen;
