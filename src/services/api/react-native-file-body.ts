import { File } from 'expo-file-system';

/**
 * The app's global `fetch` is `expo/fetch`, which encodes a FormData part only
 * when it has `bytes()`. React Native's `{ uri, name, type }` part is rejected
 * with "Unsupported FormDataPart implementation". The expo-file-system `File`
 * has `bytes()`, `name` and `type`. `null` when the file is gone: the transport
 * rejects that upload instead of retrying it forever.
 */
export const reactNativeFileBody = (fileUri: string): File | null => {
	const file = new File(fileUri);
	return file.exists ? file : null;
};
