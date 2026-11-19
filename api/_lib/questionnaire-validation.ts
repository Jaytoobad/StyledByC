import {
  BROW_QUESTIONNAIRE_ITEMS,
  BROW_QUESTIONNAIRE_MAX_LENGTH,
} from '../../src/config/booking.js';

type Questionnaire = {
  conditions: string[];
  noneApply: boolean;
  extra: string;
};

type QuestionnaireResult = { ok: true; value: Questionnaire | null } | { ok: false; error: string };

export function validateBrowQuestionnaire(input: unknown, required: boolean): QuestionnaireResult {
  if (input === undefined || input === null || input === '') {
    return required
      ? { ok: false, error: 'Please complete the brow health questionnaire.' }
      : { ok: true, value: null };
  }

  let parsed: unknown;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch {
      return { ok: false, error: 'Invalid questionnaire.' };
    }
  } else if (typeof input === 'object' && !Array.isArray(input)) {
    parsed = input;
  } else {
    return { ok: false, error: 'Invalid questionnaire.' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Invalid questionnaire.' };
  }

  const questionnaire = parsed as Record<string, unknown>;
  if (
    !Array.isArray(questionnaire.conditions) ||
    questionnaire.conditions.some(
      (condition) =>
        typeof condition !== 'string' ||
        !BROW_QUESTIONNAIRE_ITEMS.includes(condition as (typeof BROW_QUESTIONNAIRE_ITEMS)[number]),
    ) ||
    typeof questionnaire.noneApply !== 'boolean' ||
    typeof questionnaire.extra !== 'string' ||
    questionnaire.extra.length > BROW_QUESTIONNAIRE_MAX_LENGTH
  ) {
    return { ok: false, error: 'Invalid questionnaire.' };
  }

  const conditions = questionnaire.conditions as string[];
  if (
    new Set(conditions).size !== conditions.length ||
    (questionnaire.noneApply ? conditions.length > 0 : conditions.length === 0) ||
    (conditions.length > 0 && !questionnaire.extra.trim())
  ) {
    return {
      ok: false,
      error:
        conditions.length > 0 && !questionnaire.extra.trim()
          ? 'Please add details about the conditions you selected.'
          : 'Please select any conditions that apply or confirm that none apply.',
    };
  }

  return {
    ok: true,
    value: {
      conditions,
      noneApply: questionnaire.noneApply,
      extra: questionnaire.extra.trim(),
    },
  };
}
