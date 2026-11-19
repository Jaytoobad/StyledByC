// StyledByC — browser-side image processing for brow photos.
//
// Photos are resized so the longest side is at most 1280px, converted to JPEG
// at ~0.75 quality, and re-oriented from EXIF metadata where the browser can
// decode the source image. Each photo targets under 400KB; quality steps down
// automatically if needed.

export const MAX_IMAGE_SIDE = 1280;
export const DEFAULT_QUALITY = 0.75;
// ~400KB binary as base64 characters (base64 is ~4/3 of binary size).
export const MAX_PHOTO_BASE64_CHARS = 530_000;
export const MAX_PAYLOAD_BYTES = 3_400_000;

export type ProcessedPhoto = {
  name: string;
  mimeType: string;
  dataBase64: string; // base64 without the "data:..." prefix
};

function normalizeFileName(file: File): string {
  const cleaned = (file.name || 'photo').replace(/[^a-zA-Z0-9._-]/g, '_');
  const base = cleaned.replace(/\.[^.]+$/, '') || 'photo';
  return `${base}.jpg`;
}

// --- JPEG EXIF orientation --------------------------------------------------
// JPEG APP1 marker contains EXIF data. Orientation tag (0x0112) tells how the
// image should be rotated/flipped for correct display. Values 1-8 per EXIF spec.

const MARKER_SOI = 0xffd8;
const MARKER_APP1 = 0xffe1;
const TAG_ORIENTATION = 0x0112;

function getUint16(data: DataView, offset: number, littleEndian: boolean): number {
  return data.getUint16(offset, littleEndian);
}

function getUint32(data: DataView, offset: number, littleEndian: boolean): number {
  return data.getUint32(offset, littleEndian);
}

function getJpegOrientation(arrayBuffer: ArrayBuffer): number | null {
  const data = new DataView(arrayBuffer);
  if (data.byteLength < 2 || data.getUint16(0) !== MARKER_SOI) return null;

  let offset = 2;
  let littleEndian = true;
  while (offset < data.byteLength - 1) {
    const marker = data.getUint16(offset);
    offset += 2;
    if (marker === MARKER_APP1) {
      if (offset + 2 > data.byteLength) return null;
      offset += 2;
      const app1Data = data.byteLength - offset;
      if (app1Data < 6) return null;
      const exifId = String.fromCharCode(
        data.getUint8(offset),
        data.getUint8(offset + 1),
        data.getUint8(offset + 2),
        data.getUint8(offset + 3),
        data.getUint8(offset + 4),
        data.getUint8(offset + 5),
      );
      if (exifId !== 'Exif\0\0') return null;
      offset += 6;

      const tiffStart = offset;
      const endianness = data.getUint16(offset);
      littleEndian = endianness === 0x4949; // 'II'
      offset += 4; // endianness + magic (42)

      const ifd0Offset = tiffStart + getUint32(data, offset, littleEndian);
      const numEntries = getUint16(data, ifd0Offset, littleEndian);

      for (let i = 0; i < numEntries; i++) {
        const entryOffset = ifd0Offset + 2 + i * 12;
        const tag = getUint16(data, entryOffset, littleEndian);
        if (tag === TAG_ORIENTATION) {
          return getUint16(data, entryOffset + 8, littleEndian);
        }
      }
      return null;
    }
    // Skip to next marker
    if (offset + 2 > data.byteLength) return null;
    const segmentLength = getUint16(data, offset, littleEndian);
    offset += segmentLength;
  }
  return null;
}

function applyOrientation(
  ctx: CanvasRenderingContext2D,
  orientation: number,
  width: number,
  height: number,
): void {
  switch (orientation) {
    case 2:
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      break;
    case 3:
      ctx.translate(width, height);
      ctx.rotate(Math.PI);
      break;
    case 4:
      ctx.translate(0, height);
      ctx.scale(1, -1);
      break;
    case 5:
      ctx.rotate(0.5 * Math.PI);
      ctx.scale(1, -1);
      break;
    case 6:
      ctx.rotate(0.5 * Math.PI);
      ctx.translate(0, -height);
      break;
    case 7:
      ctx.rotate(0.5 * Math.PI);
      ctx.scale(-1, 1);
      ctx.translate(-width, 0);
      break;
    case 8:
      ctx.rotate(-0.5 * Math.PI);
      ctx.translate(-width, 0);
      break;
  }
}

function canvasToPhoto(canvas: HTMLCanvasElement, file: File, quality: number): ProcessedPhoto {
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const dataBase64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return { name: normalizeFileName(file), mimeType: 'image/jpeg', dataBase64 };
}

async function drawFromBitmap(file: File): Promise<{ canvas: HTMLCanvasElement }> {
  if (typeof createImageBitmap !== 'function') throw new Error('bitmap-unavailable');
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  } as ImageBitmapOptions);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error(
      'Could not process that photo on this device. Please choose from gallery instead.',
    );
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { canvas };
}

async function drawFromImageElement(file: File): Promise<{ canvas: HTMLCanvasElement }> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('decode-failed'));
      img.src = url;
    });
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) throw new Error('decode-failed');

    // Read EXIF orientation from JPEG (fallback when createImageBitmap is unavailable)
    let orientation = 1;
    try {
      const arrayBuffer = await file.arrayBuffer();
      orientation = (await getJpegOrientation(arrayBuffer)) ?? 1;
    } catch {
      // ignore EXIF read errors, default to normal orientation
    }

    const [outWidth, outHeight] =
      orientation >= 5 && orientation <= 8
        ? [sourceHeight, sourceWidth]
        : [sourceWidth, sourceHeight];

    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(outWidth, outHeight));
    const width = Math.max(1, Math.round(outWidth * scale));
    const height = Math.max(1, Math.round(outHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error(
        'Could not process that photo on this device. Please choose from gallery instead.',
      );
    }

    applyOrientation(ctx, orientation, width, height);
    ctx.drawImage(image, 0, 0);

    return { canvas };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function processImage(
  file: File,
  options: { quality?: number } = {},
): Promise<ProcessedPhoto> {
  if (!file) {
    throw new Error('Please choose an image file (JPEG, PNG, HEIC, or WebP).');
  }

  const quality = options.quality ?? DEFAULT_QUALITY;
  let canvas: HTMLCanvasElement;
  try {
    ({ canvas } = await drawFromBitmap(file));
  } catch (error) {
    try {
      ({ canvas } = await drawFromImageElement(file));
    } catch {
      console.error('[image] failed to decode image:', error);
      throw new Error(
        'Could not read that photo. Please try a different image or choose from gallery.',
      );
    }
  }

  const result = canvasToPhoto(canvas, file, quality);
  if (result.dataBase64.length > MAX_PHOTO_BASE64_CHARS && quality > 0.35) {
    return processImage(file, { quality: Math.max(0.35, quality - 0.2) });
  }

  return result;
}
