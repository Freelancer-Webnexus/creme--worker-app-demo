import { useEffect, useReducer, useRef } from 'react';
import { Linking } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { presentCapture } from '@/features/documents/capture-content';
import type { CaptureScreenModel } from '@/features/documents/capture-screen-model';
import {
	type CaptureImage,
	type CaptureSource,
	captureReducer,
	initialCaptureState,
	submitTarget,
} from '@/features/documents/capture-state';
import { useTranslation } from '@/services/i18n/use-translation';
import { chooseFromGallery, takePhoto } from '@/services/images/pick-image';
import { logger } from '@/services/logger/logger';
import useAppRouter, {
	type AppRouter,
} from '@/services/navigation/use-app-router';
import { refreshWorkerView } from '@/services/query/query-options';
import { useWorkerView } from '@/services/query/use-worker-view';
import { rowsOf } from '@/services/runtime/queue-status';
import { useActiveWorker } from '@/services/runtime/use-active-worker';
import { useAppRuntime } from '@/services/runtime/use-app-runtime';

const documentTypeOf = (value: string | string[] | undefined): string =>
	(Array.isArray(value) ? value[0] : value) ?? '';

const leaveCapture = (router: AppRouter): void => {
	if (router.canGoBack()) {
		router.back();
	} else {
		router.replace('/(tabs)/documents');
	}
};

const useCaptureScreen = (): CaptureScreenModel => {
	const { cache, engine, images, queue } = useAppRuntime();
	const workerId = useActiveWorker()?.id ?? null;
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const view = useWorkerView();
	const params = useLocalSearchParams<{ documentType?: string | string[] }>();
	const documentType = documentTypeOf(params.documentType);
	const navigation = useNavigation();
	const router = useAppRouter();
	const [state, dispatch] = useReducer(captureReducer, initialCaptureState);
	const previewUri = state.kind === 'previewing' ? state.image.uri : null;
	const previewUriRef = useRef<string | null>(null);

	useEffect(() => {
		previewUriRef.current = previewUri;
	}, [previewUri]);

	useEffect(
		() => () => {
			const uri = previewUriRef.current;
			if (uri !== null) {
				images.discardSource(uri);
			}
		},
		[images],
	);

	const pick = async (source: CaptureSource): Promise<void> => {
		dispatch({ source, type: 'pick_started' });
		const picker = source === 'camera' ? takePhoto : chooseFromGallery;
		try {
			const result = await picker();
			switch (result.kind) {
				case 'picked':
					dispatch({
						image: {
							height: result.height,
							uri: result.uri,
							width: result.width,
						},
						type: 'picked',
					});
					return;
				case 'cancelled':
					dispatch({ type: 'pick_cancelled' });
					return;
				case 'permission_denied':
					dispatch({ type: 'permission_denied' });
					return;
				default:
					return result satisfies never;
			}
		} catch {
			logger.warn('capture', 'The photo picker failed.');
			dispatch({ type: 'pick_failed' });
		}
	};

	const submit = async (image: CaptureImage): Promise<void> => {
		if (workerId === null) {
			return;
		}
		dispatch({ type: 'submit_started' });
		try {
			const prepared = await images.prepareUpload({
				clientFileId: randomUUID(),
				height: image.height,
				sourceUri: image.uri,
				width: image.width,
				workerId,
			});
			switch (prepared.kind) {
				case 'too_large':
					dispatch({ type: 'prepare_too_large' });
					return;
				case 'failed':
					dispatch({ type: 'prepare_failed' });
					return;
				case 'ready':
					try {
						await engine.enqueue({
							kind: {
								documentType,
								fileUri: prepared.fileUri,
								type: 'document_upload',
							},
							workerId,
						});
					} catch {
						logger.warn('capture', 'Could not queue the upload.');
						images.deleteUpload(prepared.fileUri);
						dispatch({ type: 'not_saved' });
						return;
					}
					try {
						await refreshWorkerView(queryClient, cache, queue, workerId);
					} catch {
						logger.warn('capture', 'Could not refresh the saved upload.');
					}
					if (navigation.isFocused()) {
						leaveCapture(router);
					}
					return;
				default:
					return prepared satisfies never;
			}
		} catch {
			logger.warn('capture', 'Preparing the photo failed.');
			images.discardSource(image.uri);
			dispatch({ type: 'prepare_failed' });
		}
	};

	const { content, title } = presentCapture(
		{ cache: view.cache, documentType, rows: rowsOf(view.queue), state },
		t,
	);

	return {
		cancelLabel: t('documents.action.cancel'),
		content,
		onCancel: () => {
			leaveCapture(router);
		},
		onChooseGallery: () => {
			void pick('gallery');
		},
		onOpenSettings: () => {
			Linking.openSettings().catch(() => {
				logger.warn('capture', 'Could not open the settings.');
			});
		},
		onRetake: () => {
			if (previewUri !== null) {
				images.discardSource(previewUri);
			}
			dispatch({ type: 'retake' });
		},
		onSubmit: () => {
			const target = submitTarget(state);
			if (target !== null) {
				void submit(target);
			}
		},
		onTakePhoto: () => {
			void pick('camera');
		},
		title,
	};
};

export default useCaptureScreen;
