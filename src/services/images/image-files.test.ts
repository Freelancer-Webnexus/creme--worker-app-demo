import { MAX_UPLOAD_BYTES } from '@/services/images/compression-plan';
import { setLoggerSink } from '@/services/logger/logger';

const disk = new Map<string, number>();
let renderedSizes: number[] = [];
let renderCount = 0;
let renderCalls: { compress: number; maxEdge: number }[] = [];
let failRender = false;

const join = (parts: unknown[]): string =>
	parts
		.map((part) =>
			typeof part === 'string' ? part : (part as { uri: string }).uri,
		)
		.join('/')
		.replace(/\/+/g, '/')
		.replace('file:/', 'file:///');

class FakeFile {
	uri: string;
	constructor(...parts: unknown[]) {
		this.uri = join(parts);
	}
	get exists(): boolean {
		return disk.has(this.uri);
	}
	get size(): number {
		return disk.get(this.uri) ?? 0;
	}
	get name(): string {
		return this.uri.slice(this.uri.lastIndexOf('/') + 1);
	}
	delete(): void {
		disk.delete(this.uri);
	}
	copySync(destination: FakeFile): void {
		disk.set(destination.uri, this.size);
	}
	moveSync(destination: FakeFile): void {
		disk.set(destination.uri, this.size);
		disk.delete(this.uri);
		this.uri = destination.uri;
	}
}

class FakeDirectory {
	uri: string;
	constructor(...parts: unknown[]) {
		this.uri = join(parts);
	}
	create(): void {
		disk.set(`${this.uri}/`, 0);
	}
	get exists(): boolean {
		return disk.has(`${this.uri}/`);
	}
	list(): FakeFile[] {
		return [...disk.keys()]
			.filter((key) => key.startsWith(`${this.uri}/`) && !key.endsWith('/'))
			.map((key) => new FakeFile(key));
	}
}

jest.mock('expo-file-system', () => ({
	Directory: FakeDirectory,
	File: FakeFile,
	Paths: { document: 'file:///documents' },
}));

jest.mock('expo-image-manipulator', () => ({
	ImageManipulator: {
		manipulate: (_uri: string, bounds: { maxWidth: number }) => {
			const context = {
				renderAsync: async () => ({
					saveAsync: async (options: { compress: number }) => {
						if (failRender) {
							throw new Error('render failed');
						}
						renderCalls.push({
							compress: options.compress,
							maxEdge: bounds.maxWidth,
						});
						const uri = `file:///cache/out-${renderCount}.jpg`;
						disk.set(uri, renderedSizes[renderCount] ?? 0);
						renderCount += 1;
						return { uri };
					},
				}),
				resize: () => context,
			};
			return context;
		},
	},
	SaveFormat: { JPEG: 'jpeg' },
}));

const { createImageFiles } = await import('@/services/images/image-files');

const SOURCE = 'file:///cache/ImagePicker/original.jpg';
const input = {
	clientFileId: 'abc',
	height: 3000,
	sourceUri: SOURCE,
	width: 4000,
	workerId: 'w1',
};
const DESTINATION = 'file:///documents/uploads/w1/abc.jpg';
const OVER = MAX_UPLOAD_BYTES + 1;
const intermediatesLeft = (): string[] =>
	[...disk.keys()].filter((key) => key.startsWith('file:///cache/out-'));

beforeEach(() => {
	disk.clear();
	disk.set(SOURCE, 9_000_000);
	renderedSizes = [];
	renderCount = 0;
	renderCalls = [];
	failRender = false;
	setLoggerSink(() => undefined);
});

describe('prepareUpload with compression on', () => {
	const files = createImageFiles({ compressionEnabled: () => true });

	it('keeps the first render that fits under the upload limit', async () => {
		renderedSizes = [900_000];

		const result = await files.prepareUpload(input);

		expect(result).toEqual({
			bytes: 900_000,
			fileUri: DESTINATION,
			kind: 'ready',
		});
		expect(renderCalls).toHaveLength(1);
	});

	it('tries a smaller, lower quality render until one fits', async () => {
		renderedSizes = [OVER, OVER, 1_000_000];

		const result = await files.prepareUpload(input);

		expect(result).toMatchObject({ bytes: 1_000_000, kind: 'ready' });
		expect(renderCalls).toHaveLength(3);
		expect(renderCalls[1].maxEdge).toBeLessThan(renderCalls[0].maxEdge);
		expect(renderCalls[2].compress).toBeLessThan(renderCalls[1].compress);
	});

	it('reports too_large when no render fits', async () => {
		renderedSizes = [OVER, OVER, OVER, OVER, OVER];

		const result = await files.prepareUpload(input);

		expect(result).toEqual({ kind: 'too_large' });
		expect(disk.has(DESTINATION)).toBe(false);
	});

	it('deletes the original after a successful compression', async () => {
		renderedSizes = [800_000];

		await files.prepareUpload(input);

		expect(disk.has(SOURCE)).toBe(false);
	});

	it('removes the originals and every intermediate render when nothing fits', async () => {
		renderedSizes = [OVER, OVER, OVER, OVER];

		await files.prepareUpload(input);

		expect(intermediatesLeft()).toEqual([]);
		expect(disk.has(SOURCE)).toBe(false);
	});

	it('removes the rejected intermediates when a later render fits', async () => {
		renderedSizes = [OVER, 700_000];

		await files.prepareUpload(input);

		expect(intermediatesLeft()).toEqual([]);
		expect(disk.has(DESTINATION)).toBe(true);
	});

	it('treats an empty render as not fitting', async () => {
		renderedSizes = [0, 500_000];

		const result = await files.prepareUpload(input);

		expect(result).toMatchObject({ bytes: 500_000, kind: 'ready' });
		expect(renderCalls).toHaveLength(2);
	});

	it('reports failed and drops the original when rendering throws', async () => {
		failRender = true;

		const result = await files.prepareUpload(input);

		expect(result).toEqual({ kind: 'failed' });
		expect(disk.has(SOURCE)).toBe(false);
	});
});

describe('prepareUpload with compression off', () => {
	const files = createImageFiles({ compressionEnabled: () => false });

	it('copies the photo as it is and deletes the original', async () => {
		const result = await files.prepareUpload(input);

		expect(result).toEqual({
			bytes: 9_000_000,
			fileUri: DESTINATION,
			kind: 'ready',
		});
		expect(disk.has(SOURCE)).toBe(false);
		expect(renderCalls).toEqual([]);
	});
});

describe('discardSource', () => {
	const files = createImageFiles({ compressionEnabled: () => true });

	it('deletes a picker original', () => {
		files.discardSource(SOURCE);

		expect(disk.has(SOURCE)).toBe(false);
	});

	it('never deletes a queued upload', () => {
		disk.set(DESTINATION, 400_000);

		files.discardSource(DESTINATION);

		expect(disk.has(DESTINATION)).toBe(true);
	});
});

describe('sweepOrphans', () => {
	const files = createImageFiles({ compressionEnabled: () => true });

	it('deletes upload files no queue row references and keeps the rest', () => {
		const keep = 'file:///documents/uploads/w1/keep.jpg';
		const orphan = 'file:///documents/uploads/w1/orphan.jpg';
		disk.set('file:///documents/uploads/w1/', 0);
		disk.set(keep, 100);
		disk.set(orphan, 100);

		files.sweepOrphans('w1', [keep]);

		expect(disk.has(keep)).toBe(true);
		expect(disk.has(orphan)).toBe(false);
	});
});
