import {
	launchCameraAsync,
	launchImageLibraryAsync,
	requestCameraPermissionsAsync,
	type ImagePickerOptions,
	type ImagePickerResult,
} from 'expo-image-picker';

export type PickImageResult =
	| { kind: 'picked'; uri: string; width: number; height: number }
	| { kind: 'cancelled' }
	| { kind: 'permission_denied' };

export type GalleryPickResult = Exclude<
	PickImageResult,
	{ kind: 'permission_denied' }
>;

// quality 1 and no editor: compression is ours, so the picker must not recompress (M7).
const PICKER_OPTIONS: ImagePickerOptions = {
	allowsEditing: false,
	mediaTypes: ['images'],
	quality: 1,
};

const toResult = (result: ImagePickerResult): GalleryPickResult => {
	const asset = result.canceled ? undefined : result.assets[0];
	return asset === undefined
		? { kind: 'cancelled' }
		: {
				height: asset.height,
				kind: 'picked',
				uri: asset.uri,
				width: asset.width,
			};
};

export const takePhoto = async (): Promise<PickImageResult> => {
	const permission = await requestCameraPermissionsAsync();
	if (!permission.granted) {
		return { kind: 'permission_denied' };
	}
	return toResult(await launchCameraAsync(PICKER_OPTIONS));
};

/**
 * No permission request: the system photo picker (Android 13 and later, and the
 * iOS picker) hands over only the photo the worker chooses. Asking for the
 * media library first would let a refusal block a gallery that needs no access.
 */
export const chooseFromGallery = async (): Promise<GalleryPickResult> =>
	toResult(await launchImageLibraryAsync(PICKER_OPTIONS));
