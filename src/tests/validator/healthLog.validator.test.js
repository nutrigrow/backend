import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createOrUpdateLogSchema } = require('../../validators/healthLog.validator.js');

const validTeenPayload = {
  date: '2026-05-25',
  profile_type: 'teen',
  water_glasses: 8,
  sleep_hours: 7.5,
  took_supplement: true,
  mood: 4,
  is_menstruating: false,
};

describe('createOrUpdateLogSchema', () => {
  it('API-P0-013 accepts a valid teen health log payload', () => {
    const result = createOrUpdateLogSchema.body.safeParse(validTeenPayload);

    expect(result.success).toBe(true);
  });

  it('API-P0-013 rejects teen payload without menstruation status', () => {
    const { is_menstruating: _unused, ...payload } = validTeenPayload;
    const result = createOrUpdateLogSchema.body.safeParse(payload);

    expect(result.success).toBe(false);
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['is_menstruating'],
        }),
      ]),
    );
  });

  it('API-P0-013 rejects invalid date format', () => {
    const result = createOrUpdateLogSchema.body.safeParse({
      ...validTeenPayload,
      date: '25/05/2026',
    });

    expect(result.success).toBe(false);
  });

  it('API-P0-013 leaves future-date rejection to the service layer', () => {
    const result = createOrUpdateLogSchema.body.safeParse({
      ...validTeenPayload,
      date: '2999-01-01',
    });

    expect(result.success).toBe(true);
  });
});
