import { describe, expect, it } from 'vitest';
import { operationalDate, operationalTime } from '../../utils/operationalTime';

describe('operational presentation (not slot reconstruction)', () => {
  it('uses September 30 in Recife at the UTC October boundary', () => {
    expect(operationalDate('2030-10-01T01:00:00Z', 'America/Recife')).toBe('2030-09-30');
  });
  it('formats the tenant calendar instead of the browser calendar', () => {
    const iso = '2030-10-01T01:00:12.123456+00:00';
    expect(operationalDate(iso, 'America/Recife')).toBe('2030-09-30');
    expect(operationalTime(iso, 'America/Recife')).toBe('22:00');
    expect(operationalDate(iso, 'UTC')).toBe('2030-10-01');
    expect(iso).toBe('2030-10-01T01:00:12.123456+00:00');
  });
});
