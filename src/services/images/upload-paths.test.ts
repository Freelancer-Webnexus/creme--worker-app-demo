import {
	fileNameOf,
	isUploadUri,
	orphanNames,
} from '@/services/images/upload-paths';

describe('isUploadUri', () => {
	it.each([
		['file:///data/user/0/app/files/uploads/w_ana/abc.jpg', true],
		['file:///var/mobile/Documents/uploads/w_ana/abc.jpg', true],
		['file:///data/user/0/app/cache/ImagePicker/abc.jpg', false],
		['file:///data/user/0/app/cache/uploads_tmp/abc.jpg', false],
		['file:///data/user/0/app/cache/my-uploads/abc.jpg', false],
		['file:///data/user/0/app/cache/ImagePicker/uploads', false],
		['abc.jpg', false],
		['', false],
	])('%s -> %s', (uri, expected) => {
		expect(isUploadUri(uri)).toBe(expected);
	});
});

describe('fileNameOf', () => {
	it.each([
		['file:///data/uploads/w_ana/abc.jpg', 'abc.jpg'],
		['abc.jpg', 'abc.jpg'],
		['file:///data/uploads/w_ana/', ''],
	])('%s -> %s', (uri, expected) => {
		expect(fileNameOf(uri)).toBe(expected);
	});
});

describe('orphanNames', () => {
	it('returns only files no queue row references', () => {
		expect(
			orphanNames(
				['a.jpg', 'b.jpg', 'c.jpg'],
				['file:///data/uploads/w_ana/b.jpg'],
			),
		).toEqual(['a.jpg', 'c.jpg']);
	});

	it('keeps everything when every file is referenced', () => {
		expect(orphanNames(['a.jpg'], ['file:///other/prefix/a.jpg'])).toEqual([]);
	});

	it('marks everything as orphaned when nothing is referenced', () => {
		expect(orphanNames(['a.jpg', 'b.jpg'], [])).toEqual(['a.jpg', 'b.jpg']);
	});

	it('keeps a file that any worker references, whatever folder the URI names', () => {
		expect(
			orphanNames(
				['ana.jpg', 'orphan.jpg'],
				['file:///docs/uploads/w-bruno/ana.jpg'],
			),
		).toEqual(['orphan.jpg']);
	});

	it('returns nothing for an empty folder', () => {
		expect(orphanNames([], ['file:///x/a.jpg'])).toEqual([]);
	});
});
