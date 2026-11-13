// One-time setup: puts a blank "paper" test photo in the emulator gallery.
// The flows pick it by its time, 8:48:13, so the file gets that timestamp.
// It is generated here, so no real document is ever involved.
import { Buffer } from 'node:buffer';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { adb, log } from './lib.mjs';

const WIDTH = 900;
const HEIGHT = 1200;
const DEVICE_PATH = '/sdcard/Pictures/e2e-paper.png';

const crcTable = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k += 1) {
		c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	}
	return c >>> 0;
});

const crc32 = (bytes) => {
	let c = 0xffffffff;
	for (const byte of bytes) {
		c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
	}
	return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([length, body, crc]);
};

/** Off-white paper with a few grey "text" lines, 8-bit greyscale. */
const pixels = () => {
	const rows = [];
	for (let y = 0; y < HEIGHT; y += 1) {
		const row = Buffer.alloc(WIDTH + 1);
		const isLine = y > 200 && y < 1000 && y % 60 < 10;
		for (let x = 1; x <= WIDTH; x += 1) {
			row[x] = isLine && x > 120 && x < WIDTH - 120 ? 150 : 242;
		}
		rows.push(row);
	}
	return Buffer.concat(rows);
};

const header = Buffer.alloc(13);
header.writeUInt32BE(WIDTH, 0);
header.writeUInt32BE(HEIGHT, 4);
header[8] = 8;
header[9] = 0;

const png = Buffer.concat([
	Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
	chunk('IHDR', header),
	chunk('IDAT', deflateSync(pixels())),
	chunk('IEND', Buffer.alloc(0)),
]);

const local = join(tmpdir(), 'e2e-paper.png');
writeFileSync(local, png);
adb('push', local, DEVICE_PATH);
adb('shell', 'touch', '-t', '202601010848.13', DEVICE_PATH);
adb(
	'shell',
	'content',
	'call',
	'--uri',
	'content://media',
	'--method',
	'scan_volume',
	'--arg',
	'external_primary',
);
log(`gallery: ${DEVICE_PATH} (taken 8:48:13)`);
