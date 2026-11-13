import { useEffect } from 'react';
import {
	type AuthStep,
	authStepOf,
	shouldClearPendingSignIn,
} from '@/features/session/auth-step';
import { pendingSignIn } from '@/features/session/pending-sign-in';
import { useEngineState } from '@/services/runtime/use-engine-state';
import { useAuthSession } from '@/services/session/use-auth-session';

const useAuthStep = (): AuthStep => {
	const { state } = useAuthSession();
	const engineState = useEngineState();
	const step = authStepOf(state, engineState);
	const clearPending = shouldClearPendingSignIn(step);

	useEffect(() => {
		if (clearPending) {
			pendingSignIn.clear();
		}
	}, [clearPending]);

	return step;
};

export default useAuthStep;
