import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import {
	MAX_UPLOAD_BYTES,
	planNextAttempt,
	resizeFor,
} from '@/services/images/compression-plan';
import { isUploadUri, orphanNames } from '@/services/images/upload-paths';
import { logger } from '@/services/logger/logger';

export type PrepareUploadInput = {
	sourceUri: string;
	width: number;
	height: number;
	workerId: string;
	clientFileId: string;
};

export type PrepareUploadResult =
	| { kind: 'ready'; fileUri: string; bytes: number }
	| { kind: 'too_large' }
	| { kind: 'failed' };

export type ImageFiles = {
	prepareUpload: (input: PrepareUploadInput) => Promise<PrepareUploadResult>;
	deleteUpload: (fileUri: string) => void;
	/** Best-effort delete of the full-size original from the picker. Never throws, never touches `uploads/` (M7). */
	discardSource: (uri: string) => void;
	sweepOrphans: (workerId: string, keepFileUris: string[]) => void;
};

type ImageFilesOptions = {
	compressionEnabled: () => boolean;
};

const deleteQuietly = (uri: string): void => {
	try {
		const file = new File(uri);
		if (file.exists) {
			file.delete();
		}
	} catch {
		logger.warn('images', 'Could not delete a file.');
	}
};

/** The document directory, not the cache: the OS may empty the cache while the upload is queued (M2). */
const uploadDirectory = (workerId: string): Directory =>
	new Directory(Paths.document, 'uploads', workerId);

const destinationFor = (workerId: string, clientFileId: string): File => {
	const directory = uploadDirectory(workerId);
	directory.create({ idempotent: true, intermediates: true });
	return new File(directory, `${clientFileId}.jpg`);
};

const render = async (
	input: PrepareUploadInput,
	maxEdge: number,
	quality: number,
): Promise<string> => {
	const known = input.width > 0 && input.height > 0;
	const size = known ? resizeFor(input.width, input.height, maxEdge) : null;
	const context = ImageManipulator.manipulate(input.sourceUri, {
		maxHeight: size?.height ?? maxEdge,
		maxWidth: size?.width ?? maxEdge,
	});
	const image = await (
		size === null ? context : context.resize(size)
	).renderAsync();
	const saved = await image.saveAsync({
		compress: quality,
		format: SaveFormat.JPEG,
	});
	return saved.uri;
};

const copyAsIs = (input: PrepareUploadInput): PrepareUploadResult => {
	const destination = destinationFor(input.workerId, input.clientFileId);
	new File(input.sourceUri).copySync(destination, { overwrite: true });
	deleteQuietly(input.sourceUri);
	return { bytes: destination.size, fileUri: destination.uri, kind: 'ready' };
};

const compress = async (
	input: PrepareUploadInput,
): Promise<PrepareUploadResult> => {
	const intermediates: string[] = [];
	try {
		for (let index = 0; ; index += 1) {
			const attempt = planNextAttempt(index);
			if (attempt === null) {
				return { kind: 'too_large' };
			}

			const uri = await render(input, attempt.maxEdge, attempt.quality);
			intermediates.push(uri);

			const candidate = new File(uri);
			if (candidate.size > 0 && candidate.size <= MAX_UPLOAD_BYTES) {
				const destination = destinationFor(input.workerId, input.clientFileId);
				candidate.moveSync(destination, { overwrite: true });
				deleteQuietly(input.sourceUri);
				return {
					bytes: destination.size,
					fileUri: destination.uri,
					kind: 'ready',
				};
			}
		}
	} catch {
		logger.error('images', 'Compression failed.');
		return { kind: 'failed' };
	} finally {
		for (const uri of intermediates) {
			deleteQuietly(uri);
		}
	}
};

const discardSource = (uri: string): void => {
	if (!isUploadUri(uri)) {
		deleteQuietly(uri);
	}
};

const prepare = async (
	options: ImageFilesOptions,
	input: PrepareUploadInput,
): Promise<PrepareUploadResult> => {
	if (!options.compressionEnabled()) {
		try {
			return copyAsIs(input);
		} catch {
			logger.error('images', 'Copying the photo failed.');
			return { kind: 'failed' };
		}
	}
	return compress(input);
};

export const createImageFiles = (options: ImageFilesOptions): ImageFiles => ({
	prepareUpload: async (input) => {
		const result = await prepare(options, input);
		if (result.kind !== 'ready') {
			discardSource(input.sourceUri);
		}
		return result;
	},

	deleteUpload: deleteQuietly,

	discardSource,

	sweepOrphans: (workerId, keepFileUris) => {
		try {
			const directory = uploadDirectory(workerId);
			if (!directory.exists) {
				return;
			}
			const files = directory
				.list()
				.filter((entry): entry is File => entry instanceof File);
			const orphans = orphanNames(
				files.map((file) => file.name),
				keepFileUris,
			);
			for (const file of files) {
				if (orphans.includes(file.name)) {
					deleteQuietly(file.uri);
				}
			}
		} catch {
			logger.warn('images', 'Sweeping orphan uploads failed.');
		}
	},
});
