// Minimal PNG helpers, no dependency: the size from the IHDR chunk, and reading/writing a tEXt chunk (the OG
// image's source hash, for the stale check). CRCs use zlib.crc32 (Node 22).

import zlib from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export class PngError extends Error {}

export function isPng(png: Buffer): boolean {
  return png.length >= 8 && png.subarray(0, 8).equals(SIGNATURE);
}

export interface PngChunk {
  type: string;
  data: Buffer;
  /** Offset of the chunk's length field. */
  offset: number;
  crcOk: boolean;
}

export function pngChunks(png: Buffer): PngChunk[] {
  if (!isPng(png)) throw new PngError('not a PNG (bad signature)');
  const result: PngChunk[] = [];
  let offset = 8;
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    const typeAndData = png.subarray(offset + 4, offset + 8 + length);
    const crc = png.readUInt32BE(offset + 8 + length);
    result.push({
      type: typeAndData.subarray(0, 4).toString('latin1'),
      data: typeAndData.subarray(4),
      offset,
      crcOk: zlib.crc32(typeAndData) === crc,
    });
    offset += 12 + length;
  }
  return result;
}

export function readPngSize(png: Buffer): { width: number; height: number } {
  const ihdr = pngChunks(png)[0];
  if (ihdr?.type !== 'IHDR') throw new PngError('the first chunk is not IHDR');
  return { width: ihdr.data.readUInt32BE(0), height: ihdr.data.readUInt32BE(4) };
}

const keywordOf = (data: Buffer) => data.subarray(0, data.indexOf(0)).toString('latin1');

/** The text of the first tEXt chunk with this keyword, or undefined. */
export function readPngText(png: Buffer, keyword: string): string | undefined {
  const chunk = pngChunks(png).find(({ type, data }) => type === 'tEXt' && keywordOf(data) === keyword);
  return chunk?.data.subarray(chunk.data.indexOf(0) + 1).toString('latin1');
}

/** A copy of the PNG with a tEXt chunk right after IHDR (an earlier chunk with this keyword is dropped). */
export function withPngText(png: Buffer, keyword: string, text: string): Buffer {
  const typeAndData = Buffer.from(`tEXt${keyword}\0${text}`, 'latin1');
  const chunk = Buffer.alloc(typeAndData.length + 8);
  chunk.writeUInt32BE(typeAndData.length - 4, 0);
  typeAndData.copy(chunk, 4);
  chunk.writeUInt32BE(zlib.crc32(typeAndData), chunk.length - 4);

  const parts: Buffer[] = [SIGNATURE];
  for (const { type, data, offset } of pngChunks(png)) {
    if (type === 'tEXt' && keywordOf(data) === keyword) continue;
    parts.push(png.subarray(offset, offset + 12 + data.length));
    if (type === 'IHDR') parts.push(chunk);
  }
  return Buffer.concat(parts);
}
