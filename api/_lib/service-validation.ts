/**
 * StyledByC — service catalogue validation.
 *
 * Pure, dependency-free validators used by /api/admin/services and by the
 * test suite. Nothing here touches the database, so it can be exercised in
 * CI without DATABASE_URL.
 */

export type ServiceUpsertInput = {
  action?: 'upsert' | 'delete';
  id?: string;
  name?: string;
  category?: string;
  description?: string;
  price?: number;
  duration?: number;
  photoRequired?: boolean;
  tintGuideRequired?: boolean;
  image?: string;
  gallery?: string[];
  active?: boolean;
  sortOrder?: number;
};

export type ValidationError = { ok: false; error: string };
export type ValidatedService = {
  ok: true;
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  duration: number;
  photoRequired: boolean;
  tintGuideRequired: boolean;
  image: string;
  gallery: string[];
  active: boolean;
  sortOrder: number;
};

export function validateServiceInput(input: unknown): ValidatedService | ValidationError {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Invalid request.' };
  }
  const v = input as Record<string, unknown>;

  const id = typeof v.id === 'string' ? v.id.trim() : '';
  const name = typeof v.name === 'string' ? v.name.trim() : '';
  const category = typeof v.category === 'string' ? v.category.trim() : '';
  const description = typeof v.description === 'string' ? v.description.trim() : '';
  const image = typeof v.image === 'string' ? v.image.trim() : '';

  if (!id) return { ok: false, error: 'Missing id.' };
  if (!name) return { ok: false, error: 'Missing name.' };
  if (!category) return { ok: false, error: 'Missing category.' };
  if (!description) return { ok: false, error: 'Missing description.' };
  if (!image) return { ok: false, error: 'Missing image.' };

  // IDs must be URL-safe: lowercase letters, digits, hyphens, underscores.
  if (!/^[a-z0-9][a-z0-9_-]{2,63}$/i.test(id)) {
    return { ok: false, error: 'Invalid service id. Use 3-64 letters, digits, hyphens or underscores.' };
  }

  const price = Number(v.price);
  if (!Number.isFinite(price) || price < 0 || !Number.isInteger(price)) {
    return { ok: false, error: 'Invalid price. Enter a whole number of GHS (>= 0).' };
  }

  const duration = Number(v.duration);
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isInteger(duration)) {
    return { ok: false, error: 'Invalid duration. Enter a whole number of minutes (> 0).' };
  }

  const photoRequired = Boolean(v.photoRequired);
  const tintGuideRequired = Boolean(v.tintGuideRequired);
  const active = v.active === undefined ? true : Boolean(v.active);

  let sortOrder = 0;
  if (v.sortOrder === undefined || v.sortOrder === null || v.sortOrder === '') {
    sortOrder = 0;
  } else {
    const n = Number(v.sortOrder);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return { ok: false, error: 'Invalid sort order. Enter a whole number.' };
    }
    sortOrder = n;
  }

  let gallery: string[] = [];
  if (v.gallery !== undefined && v.gallery !== null) {
    if (!Array.isArray(v.gallery)) {
      return { ok: false, error: 'Invalid gallery. Provide an array of image paths.' };
    }
    gallery = v.gallery.map((x) => String(x)).map((s) => s.trim()).filter(Boolean);
  }

  return {
    ok: true,
    id,
    name,
    category,
    description,
    price,
    duration,
    photoRequired,
    tintGuideRequired,
    image,
    gallery,
    active,
    sortOrder,
  };
}

export function validateDeleteInput(input: unknown): { ok: true; id: string } | ValidationError {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Invalid request.' };
  }
  const v = input as Record<string, unknown>;
  const id = typeof v.id === 'string' ? v.id.trim() : '';
  if (!id) return { ok: false, error: 'Missing id.' };
  return { ok: true, id };
}