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

function canvasToPhoto(canvas: HTMLCanvasElement, file: File, quality: number): ProcessedPhoto {
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const dataBase64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return { name: normalizeFileName(file), mimeType: 'image/jpeg', dataBase64 };
}

async function drawFromBitmap(file: File): Promise<{ canvas: HTMLCanvasElement }> {
  if (typeof createImageBitmap !== 'function') throw new Error('bitmap-unavailable');
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Could not process that photo on this device. Please choose from gallery instead.');
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
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process that photo on this device. Please choose from gallery instead.');
    ctx.drawImage(image, 0, 0, width, height);
    return { canvas };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function processImage(
  file: File,
  options: { quality?: number } = {}
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
      throw new Error('Could not read that photo. Please try a different image or choose from gallery.');
    }
  }

  const result = canvasToPhoto(canvas, file, quality);
  if (result.dataBase64.length > MAX_PHOTO_BASE64_CHARS && quality > 0.35) {
    return processImage(file, { quality: Math.max(0.35, quality - 0.2) });
  }

  return result;
}
