import { memo, useMemo } from 'react';
import { Image as ExpoImage } from 'expo-image';
import type { ImageProps as ExpoImageProps } from 'expo-image';

type CdnTransformOptions = {
	fit?: 'contain' | 'cover' | 'fill';
	format?: 'avif' | 'jpeg' | 'png' | 'webp';
	height?: number;
	quality?: number;
	width?: number;
};

type ImageProps = Omit<ExpoImageProps, 'cachePolicy' | 'contentFit'> & {
	cachePolicy?: NonNullable<ExpoImageProps['cachePolicy']>;
	cdnTransform?: CdnTransformOptions;
	contentFit?: NonNullable<ExpoImageProps['contentFit']>;
};

type UriSource = {
	uri: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return typeof value === 'object' && value !== null;
};

const isUriSource = (value: unknown): value is UriSource => {
	return isRecord(value) && typeof value.uri === 'string';
};

const applyTransformToUri = (
	uri: string,
	options: CdnTransformOptions,
): string => {
	try {
		const url = new URL(uri);

		if (typeof options.width === 'number') {
			url.searchParams.set('w', String(options.width));
		}

		if (typeof options.height === 'number') {
			url.searchParams.set('h', String(options.height));
		}

		if (typeof options.quality === 'number') {
			url.searchParams.set('q', String(options.quality));
		}

		if (options.fit) {
			url.searchParams.set('fit', options.fit);
		}

		if (options.format) {
			url.searchParams.set('fm', options.format);
		}

		return url.toString();
	} catch {
		return uri;
	}
};

const Image = memo((props: ImageProps) => {
	const {
		// 'memory-disk' keeps the decoded bitmap, which is what removes re-decode
		// jank when a list recycles a cell back into view. 'disk' re-decodes.
		cachePolicy = 'memory-disk',
		cdnTransform,
		contentFit = 'cover',
		source,
		// Without a recycling key, a recycled cell briefly shows the previous
		// image while the new one loads. Pass the item id when used inside a List.
		recyclingKey,
		// Default is a hard pop-in; a short fade is the standard polish default.
		transition = 150,
		...restProps
	} = props;

	const resolvedSource = useMemo(() => {
		if (!source || !cdnTransform || typeof source !== 'object') {
			return source;
		}

		if (isUriSource(source)) {
			return {
				...source,
				uri: applyTransformToUri(source.uri, cdnTransform),
			};
		}

		return source;
	}, [cdnTransform, source]);

	return (
		<ExpoImage
			cachePolicy={cachePolicy}
			contentFit={contentFit}
			recyclingKey={recyclingKey}
			source={resolvedSource}
			transition={transition}
			{...restProps}
		/>
	);
});

Image.displayName = 'Image';

export default Image;
export type { CdnTransformOptions, ImageProps };
