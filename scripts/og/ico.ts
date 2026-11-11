// Minimal ICO writer and reader, no dependency. An ICO can hold PNG data directly (Windows Vista+, every current
// browser): a 6-byte header, one 16-byte directory entry per image, then the PNG files themselves.

import { readPngSize } from './png.ts';

export class IcoError extends Error {}

export interface IcoEntry {
  width: number;
  height: number;
  png: Buffer;
}

const HEADER = 6;
const ENTRY = 16;

/** An ICO holding these PNGs, in order. Sizes come from each PNG's IHDR (at most 256). */
export function writeIco(pngs: Buffer[]): Buffer {
  const header = Buffer.alloc(HEADER + ENTRY * pngs.length);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach((png, i) => {
    const { width, height } = readPngSize(png);
    if (width > 256 || height > 256) throw new IcoError(`${width}×${height} is too large for an ICO entry`);
    const at = HEADER + ENTRY * i;
    header.writeUInt8(width % 256, at); // 0 means 256
    header.writeUInt8(height % 256, at + 1);
    header.writeUInt8(0, at + 2); // no palette
    header.writeUInt8(0, at + 3); // reserved
    header.writeUInt16LE(1, at + 4); // color planes
    header.writeUInt16LE(32, at + 6); // bits per pixel
    header.writeUInt32LE(png.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...pngs]);
}

/** The directory of an ICO: each entry's size and its image data. */
export function readIco(ico: Buffer): IcoEntry[] {
  if (ico.length < HEADER || ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1) {
    throw new IcoError('not an ICO (bad header)');
  }
  const count = ico.readUInt16LE(4);
  if (ico.length < HEADER + ENTRY * count) throw new IcoError('the ICO directory is truncated');
  return Array.from({ length: count }, (_, i) => {
    const at = HEADER + ENTRY * i;
    const size = ico.readUInt32LE(at + 8);
    const offset = ico.readUInt32LE(at + 12);
    if (offset + size > ico.length) throw new IcoError(`entry ${i} points past the end of the file`);
    return {
      width: ico.readUInt8(at) || 256,
      height: ico.readUInt8(at + 1) || 256,
      png: ico.subarray(offset, offset + size),
    };
  });
}
