// StyledByC — browser-side image processing for brow photos.
//
// Photos are resized so the longest side is at most 1280px, converted to JPEG
// at ~0.75 quality, and re-oriented from EXIF metadata (createImageBitmap
// applies the image orientation by default) so phone photos are never sideways.
// Each photo targets under 400KB; quality steps down automatically if needed.

export const MAX_IMAGE_SIDE = 1280;
export const DEFAULT_QUALITY = 0.75;
// ~400KB binary as base64 characters (base64 is ~4/3 of binary size).
export const MAX_PHOTO_BASE64_CHARS = 530_000;
export const MAX_PAYLOAD_BYTES = 4_000_000;

export type ProcessedPhoto = {
  name: string;
  mimeType: string;
  dataBase64: string; // base64 without the "data:..." prefix
};

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  const arrayBuffer = await file.arrayBuffer();
  return createImageBitmap(new Blob([arrayBuffer], { type: file.type }));
}

export async function processImage(
  file: File,
  options: { quality?: number } = {}
): Promise<ProcessedPhoto> {
  if (!isImageFile(file)) {
    throw new Error('Please choose an image file (JPEG, PNG, or WebP).');
  }

  const quality = options.quality ?? DEFAULT_QUALITY;
  const bitmap = await loadBitmap(file); // applies EXIF orientation automatically

  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const dataBase64 = dataUrl.slice(dataUrl.indexOf(',') + 1);

  if (dataBase64.length > MAX_PHOTO_BASE64_CHARS && quality > 0.35) {
    return processImage(file, { quality: Math.max(0.35, quality - 0.2) });
  }

  return { name: file.name, mimeType: 'image/jpeg', dataBase64 };
}
