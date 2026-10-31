/**
 * StyledByC — service catalogue validation tests.
 *
 * Pure unit tests for api/_lib/service-validation.ts. No database required.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateServiceInput, validateDeleteInput } from '../api/_lib/service-validation.js';

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    id: 'brow-shaping-blade',
    name: 'Brow Shaping (Blade)',
    category: 'Brows',
    description: 'Precision blade shaping.',
    price: 60,
    duration: 30,
    image: '/images/brow-shaping-blade/01.jpg',
    ...overrides,
  };
}

function assertIsError(r: unknown): asserts r is { ok: false; error: string } {
  assert.ok(r && typeof r === 'object', 'expected an object result');
  assert.strictEqual((r as any).ok, false, 'expected error result');
}

function assertIsOk(r: unknown): asserts r is { ok: true; id: string; price: number; duration: number; active: boolean; sortOrder: number; gallery: string[] } {
  assert.ok(r && typeof r === 'object', 'expected an object result');
  assert.strictEqual((r as any).ok, true, 'expected success result');
}

describe('validateServiceInput', () => {
  it('accepts a fully valid input', () => {
    const r = validateServiceInput(baseInput());
    assertIsOk(r);
    assert.strictEqual(r.id, 'brow-shaping-blade');
    assert.strictEqual(r.price, 60);
    assert.strictEqual(r.duration, 30);
    assert.strictEqual(r.active, true);
    assert.strictEqual(r.sortOrder, 0);
    assert.deepStrictEqual(r.gallery, []);
  });

  it('rejects non-object input', () => {
    assertIsError(validateServiceInput(null));
    assertIsError(validateServiceInput([]));
    assertIsError(validateServiceInput('hi'));
  });

  it('rejects missing required fields', () => {
    for (const field of ['id', 'name', 'category', 'description']) {
      const v = baseInput();
      delete v[field];
      const r = validateServiceInput(v);
      assertIsError(r);
      assert.match(r.error, new RegExp(`Missing ${field}`));
    }
  });

  it('rejects empty/whitespace-only required fields', () => {
    for (const field of ['id', 'name', 'category', 'description']) {
      const v = baseInput({ [field]: '   ' });
      assertIsError(validateServiceInput(v));
    }
  });

  it('rejects invalid id characters', () => {
    for (const bad of ['a b', 'bad/id', '../escape', 'a@b']) {
      assertIsError(validateServiceInput(baseInput({ id: bad })), `expected rejection for id "${bad}"`);
    }
  });

  it('rejects too-short ids', () => {
    assertIsError(validateServiceInput(baseInput({ id: 'ab' })));
  });

  it('accepts valid ids with hyphens, underscores and digits', () => {
    for (const ok of ['brow-shaping-blade', 'service_01', 'abc123']) {
      assertIsOk(validateServiceInput(baseInput({ id: ok })), `expected acceptance for id "${ok}"`);
    }
  });

  it('rejects negative price', () => {
    assertIsError(validateServiceInput(baseInput({ price: -5 })));
  });

  it('rejects non-integer price', () => {
    assertIsError(validateServiceInput(baseInput({ price: 12.5 })));
  });

  it('rejects NaN price', () => {
    assertIsError(validateServiceInput(baseInput({ price: Number('abc') })));
  });

  it('accepts zero price', () => {
    assertIsOk(validateServiceInput(baseInput({ price: 0 })));
  });

  it('rejects zero duration', () => {
    assertIsError(validateServiceInput(baseInput({ duration: 0 })));
  });

  it('rejects negative duration', () => {
    assertIsError(validateServiceInput(baseInput({ duration: -10 })));
  });

  it('rejects non-integer duration', () => {
    assertIsError(validateServiceInput(baseInput({ duration: 22.5 })));
  });

  it('defaults active to true when omitted', () => {
    const r = validateServiceInput(baseInput());
    assertIsOk(r);
    assert.strictEqual(r.active, true);
  });

  it('honours explicit active=false', () => {
    const r = validateServiceInput(baseInput({ active: false }));
    assertIsOk(r);
    assert.strictEqual(r.active, false);
  });

  it('accepts a non-numeric sortOrder and coerces to 0', () => {
    const r = validateServiceInput(baseInput({ sortOrder: undefined }));
    assertIsOk(r);
    assert.strictEqual(r.sortOrder, 0);
  });

  it('rejects non-integer sortOrder', () => {
    assertIsError(validateServiceInput(baseInput({ sortOrder: 1.5 })));
  });

  it('accepts integer sortOrder', () => {
    const r = validateServiceInput(baseInput({ sortOrder: 5 }));
    assertIsOk(r);
    assert.strictEqual(r.sortOrder, 5);
  });

  it('accepts a string gallery array and trims entries', () => {
    const r = validateServiceInput(baseInput({ gallery: [' a.jpg ', 'b.jpg', '  '] }));
    assertIsOk(r);
    assert.deepStrictEqual(r.gallery, ['a.jpg', 'b.jpg']);
  });

  it('rejects a non-array gallery', () => {
    assertIsError(validateServiceInput(baseInput({ gallery: 'not-an-array' })));
  });

  it('coerces boolean flags', () => {
    const r = validateServiceInput(baseInput({ photoRequired: 0, tintGuideRequired: 1 }));
    assertIsOk(r);
    assert.strictEqual(r.photoRequired, false);
    assert.strictEqual(r.tintGuideRequired, true);
  });

  it('rejects missing image', () => {
    const v = baseInput();
    delete v.image;
    assertIsError(validateServiceInput(v));
  });
});

describe('validateDeleteInput', () => {
  it('accepts { id }', () => {
    const r = validateDeleteInput({ id: 'x' });
    assert.strictEqual(r.ok, true);
    if (r.ok) assert.strictEqual(r.id, 'x');
  });

  it('rejects missing id', () => {
    assertIsError(validateDeleteInput({}));
    assertIsError(validateDeleteInput({ id: '' }));
    assertIsError(validateDeleteInput({ id: '   ' }));
  });

  it('rejects non-object input', () => {
    assertIsError(validateDeleteInput(null));
    assertIsError(validateDeleteInput([]));
  });
});