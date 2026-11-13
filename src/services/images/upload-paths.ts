export const fileNameOf = (uri: string): string =>
	uri.slice(uri.lastIndexOf('/') + 1);

/** Whether a file sits in an `uploads/` folder: a queued photo, never to be discarded as a source. */
export const isUploadUri = (uri: string): boolean => {
	const folders = uri.split('/').slice(0, -1);
	return folders.includes('uploads');
};

/**
 * Files in a worker's upload folder that no queue row references. Matches by
 * file name, not by full URI: a URI that differs only in encoding or scheme
 * must never make a queued upload look orphaned (M2).
 */
export const orphanNames = (
	presentNames: string[],
	keepUris: string[],
): string[] => {
	const kept = new Set(keepUris.map(fileNameOf));
	return presentNames.filter((name) => !kept.has(name));
};
