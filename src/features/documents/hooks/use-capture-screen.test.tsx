import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { CaptureContent } from '@/features/documents/capture-content';
import useCaptureScreen from '@/features/documents/hooks/use-capture-screen';
import { getLanguage } from '@/services/i18n/language-store';
import { translate } from '@/services/i18n/translate';
import type { PrepareUploadResult } from '@/services/images/image-files';
import { setLoggerSink } from '@/services/logger/logger';
import { refreshWorkerView } from '@/services/query/query-options';
import { useActiveWorker } from '@/services/runtime/use-active-worker';

const mockRouter = {
	back: jest.fn(),
	canGoBack: () => true,
	replace: jest.fn(),
};
const mockImages = {
	deleteUpload: jest.fn(),
	discardSource: jest.fn(),
	prepareUpload: jest.fn(),
};
const mockEngine = { enqueue: jest.fn() };

jest.mock('expo-router', () => ({
	useLocalSearchParams: () => ({ documentType: 'passport' }),
	useNavigation: () => ({ isFocused: () => true }),
}));

jest.mock('@/services/navigation/use-app-router', () => ({
	__esModule: true,
	default: () => mockRouter,
}));

jest.mock('expo-crypto', () => ({ randomUUID: () => 'file-1' }));

jest.mock('@/services/images/pick-image', () => ({
	chooseFromGallery: jest.fn(),
	takePhoto: async () => ({
		height: 3000,
		kind: 'picked',
		uri: 'file:///cache/photo.jpg',
		width: 4000,
	}),
}));

jest.mock('@/services/query/query-options', () => ({
	refreshWorkerView: jest.fn(),
}));

jest.mock('@/services/runtime/use-active-worker', () => ({
	useActiveWorker: jest.fn(),
}));

jest.mock('@/services/runtime/use-app-runtime', () => ({
	useAppRuntime: () => ({
		cache: {},
		engine: mockEngine,
		images: mockImages,
		queue: {},
	}),
}));

jest.mock('@/services/query/use-worker-view', () => ({
	useWorkerView: () => ({
		cache: {
			assignment: { documents: [], requiredDocuments: ['passport'] },
		},
		queue: { kind: 'loaded', rows: [] },
	}),
}));

const UPLOAD = 'file:///documents/uploads/w1/file-1.jpg';
const ready: PrepareUploadResult = {
	bytes: 400_000,
	fileUri: UPLOAD,
	kind: 'ready',
};

const asMock = (fn: unknown): jest.Mock => fn as jest.Mock;

const mount = async (worker: { id: string } | null) => {
	asMock(useActiveWorker).mockReturnValue(worker);
	const client = new QueryClient();
	const view = await renderHook(() => useCaptureScreen(), {
		wrapper: ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={client}>{children}</QueryClientProvider>
		),
	});
	await act(async () => {
		view.result.current.onTakePhoto();
	});
	await act(async () => {
		view.result.current.onSubmit();
	});
	return view;
};

const problemBody = (content: CaptureContent): string | null =>
	content.kind === 'problem' ? content.body : null;

const text = (
	key:
		'capture.compression_failed' | 'capture.save_failed' | 'capture.too_large',
) => translate(getLanguage(), key);

beforeEach(() => {
	jest.clearAllMocks();
	setLoggerSink(() => undefined);
	mockImages.prepareUpload.mockResolvedValue(ready);
	mockEngine.enqueue.mockResolvedValue({});
	asMock(refreshWorkerView).mockResolvedValue(undefined);
});

describe('useCaptureScreen submit', () => {
	it('deletes the copied upload and shows the not-saved state when queueing fails', async () => {
		mockEngine.enqueue.mockRejectedValue(new Error('disk full'));

		const view = await mount({ id: 'w1' });

		expect(mockImages.deleteUpload).toHaveBeenCalledWith(UPLOAD);
		expect(problemBody(view.result.current.content)).toBe(
			text('capture.save_failed'),
		);
		expect(mockRouter.back).not.toHaveBeenCalled();
	});

	it('queues the prepared upload for the signed-in worker and leaves the screen', async () => {
		await mount({ id: 'w1' });

		expect(mockEngine.enqueue).toHaveBeenCalledWith({
			kind: {
				documentType: 'passport',
				fileUri: UPLOAD,
				type: 'document_upload',
			},
			workerId: 'w1',
		});
		expect(mockImages.deleteUpload).not.toHaveBeenCalled();
		expect(mockRouter.back).toHaveBeenCalledTimes(1);
	});

	it('shows the too-large state when the photo cannot be made small enough', async () => {
		mockImages.prepareUpload.mockResolvedValue({ kind: 'too_large' });

		const view = await mount({ id: 'w1' });

		expect(problemBody(view.result.current.content)).toBe(
			text('capture.too_large'),
		);
		expect(mockEngine.enqueue).not.toHaveBeenCalled();
	});

	it('shows the compression-failed state when preparing the photo fails', async () => {
		mockImages.prepareUpload.mockResolvedValue({ kind: 'failed' });

		const view = await mount({ id: 'w1' });

		expect(problemBody(view.result.current.content)).toBe(
			text('capture.compression_failed'),
		);
	});

	it('keeps the upload and leaves the screen when only the refresh fails', async () => {
		asMock(refreshWorkerView).mockRejectedValue(new Error('offline'));

		const view = await mount({ id: 'w1' });

		expect(mockImages.deleteUpload).not.toHaveBeenCalled();
		expect(view.result.current.content.kind).not.toBe('problem');
		expect(mockRouter.back).toHaveBeenCalledTimes(1);
	});

	it('does nothing when no worker is signed in', async () => {
		await mount(null);

		expect(mockImages.prepareUpload).not.toHaveBeenCalled();
		expect(mockEngine.enqueue).not.toHaveBeenCalled();
		expect(mockRouter.back).not.toHaveBeenCalled();
	});
});
