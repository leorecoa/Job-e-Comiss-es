import { describe, expect, it } from 'vitest';
import { buildCsvContent, calculateClientCommission, getLocalDayBounds, parseLocalDateInput } from './utils';
import { Client, ClientType, ServiceType } from './types';

const makeClient = (overrides: Partial<Client> = {}): Client => ({
  id: 'client-1',
  name: 'Cliente',
  barberName: 'Barbeiro',
  serviceType: ServiceType.CUT,
  clientType: ClientType.RETURNING,
  serviceValue: 50,
  extraValue: 10,
  totalValue: 60,
  commissionValue: undefined as unknown as number,
  timestamp: new Date(2026, 5, 4, 10, 30).getTime(),
  products: [],
  ...overrides
});

describe('calculateClientCommission', () => {
  it('preserves a manually saved zero commission', () => {
    const client = makeClient({ commissionValue: 0 });

    expect(calculateClientCommission(client, 50)).toBe(0);
  });

  it('does not pay commission for product-only sales', () => {
    const client = makeClient({
      serviceType: ServiceType.PRODUCT,
      totalValue: 80,
      commissionValue: 40
    });

    expect(calculateClientCommission(client, 50)).toBe(0);
  });

  it('falls back to service plus extra when commission was not saved', () => {
    const client = makeClient({ commissionValue: undefined as unknown as number });

    expect(calculateClientCommission(client, 50)).toBe(30);
  });
});

describe('local date helpers', () => {
  it('parses date inputs as local calendar dates', () => {
    const parsed = parseLocalDateInput('2026-06-04');

    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(5);
    expect(parsed.getDate()).toBe(4);
  });

  it('returns local start and end bounds for a day', () => {
    const bounds = getLocalDayBounds('2026-06-04');
    const start = new Date(bounds.start);
    const end = new Date(bounds.end);

    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });
});

describe('buildCsvContent', () => {
  it('escapes separators, quotes, and new lines in text fields', () => {
    const csv = buildCsvContent(
      [
        makeClient({
          name: 'Joao; "Vip"',
          description: 'Linha 1\nLinha 2',
          totalValue: 60
        })
      ],
      [
        {
          id: 'vale-1',
          barberName: 'Barbeiro',
          value: 15,
          description: 'Cafe; agua',
          timestamp: new Date(2026, 5, 4, 11, 0).getTime()
        }
      ]
    );

    expect(csv).toContain('"Joao; ""Vip"""');
    expect(csv).toContain('"Linha 1\nLinha 2"');
    expect(csv).toContain('"Cafe; agua"');
  });
});
