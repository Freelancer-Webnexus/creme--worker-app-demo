import { convertFormDataAsync } from 'expo/src/winter/fetch/convertFormData';
import { reactNativeFileBody } from '@/services/api/react-native-file-body';

const mockPhotoBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

jest.mock('expo-file-system', () => ({
	File: class {
		readonly uri: string;
		readonly name: string;
		readonly type = 'image/jpeg';
		constructor(uri: string) {
			this.uri = uri;
			this.name = uri.slice(uri.lastIndexOf('/') + 1);
		}
		get exists(): boolean {
			return this.uri.endsWith('.jpg');
		}
		bytes(): Promise<Uint8Array> {
			return Promise.resolve(mockPhotoBytes);
		}
	},
}));

// On the device, Expo's patched FormData yields the appended [name, value] pairs
// unchanged, and expo/fetch (the global fetch) encodes them with this function.
const expoPatchedForm = (parts: [string, unknown][]): FormData =>
	({ entries: () => parts }) as unknown as FormData;

describe('reactNativeFileBody', () => {
	it('builds a part that the runtime fetch can encode', async () => {
		const part = reactNativeFileBody('file:///uploads/worker-ana/a.jpg');
		expect(part).not.toBeNull();

		const { body } = await convertFormDataAsync(
			expoPatchedForm([
				['clientActionId', 'action-1'],
				['image', part],
			]),
			'BOUNDARY',
		);
		const text = new TextDecoder('latin1').decode(body);

		expect(text).toContain('name="image"; filename="a.jpg"');
		expect(text).toContain('content-type: image/jpeg');
		expect(text).toContain(String.fromCharCode(...mockPhotoBytes));
	});

	it('returns null when the file is gone', () => {
		expect(reactNativeFileBody('file:///uploads/worker-ana/gone')).toBeNull();
	});
});
