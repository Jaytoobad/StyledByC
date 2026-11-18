import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BROW_QUESTIONNAIRE_ITEMS, BROW_QUESTIONNAIRE_MAX_LENGTH } from '../src/config/booking.js';
import { validateBrowQuestionnaire } from '../api/_lib/questionnaire-validation.js';

describe('validateBrowQuestionnaire', () => {
  it('accepts selected conditions and additional details', () => {
    const result = validateBrowQuestionnaire(
      JSON.stringify({
        conditions: [BROW_QUESTIONNAIRE_ITEMS[0]],
        noneApply: false,
        extra: 'Using a prescription cream.',
      }),
      true,
    );

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.value, {
        conditions: [BROW_QUESTIONNAIRE_ITEMS[0]],
        noneApply: false,
        extra: 'Using a prescription cream.',
      });
    }
  });

  it('accepts an explicit none apply response', () => {
    const result = validateBrowQuestionnaire(
      JSON.stringify({
        conditions: [],
        noneApply: true,
        extra: '',
      }),
      true,
    );

    assert.equal(result.ok, true);
  });

  it('requires an answer for brow services', () => {
    const result = validateBrowQuestionnaire(undefined, true);
    assert.equal(result.ok, false);
  });

  it('rejects no selection, conflicting answers, invalid conditions, and duplicates', () => {
    const invalid = [
      { conditions: [], noneApply: false, extra: '' },
      { conditions: [BROW_QUESTIONNAIRE_ITEMS[0]], noneApply: true, extra: '' },
      { conditions: [BROW_QUESTIONNAIRE_ITEMS[0]], noneApply: false, extra: '' },
      { conditions: ['unlisted condition'], noneApply: false, extra: '' },
      {
        conditions: [BROW_QUESTIONNAIRE_ITEMS[0], BROW_QUESTIONNAIRE_ITEMS[0]],
        noneApply: false,
        extra: '',
      },
    ];

    for (const value of invalid) {
      assert.equal(validateBrowQuestionnaire(JSON.stringify(value), true).ok, false);
    }
  });

  it('limits additional details', () => {
    const result = validateBrowQuestionnaire(
      JSON.stringify({
        conditions: [],
        noneApply: true,
        extra: 'x'.repeat(BROW_QUESTIONNAIRE_MAX_LENGTH + 1),
      }),
      true,
    );

    assert.equal(result.ok, false);
  });
});
