import { describe, expect, it } from 'vitest';
import { buildCsvContent, calculateClientCommission, getLocalDayBounds, getOperationalVales, parseLocalDateInput } from '../../utils';
import { Client, ClientType, ServiceType, Vale } from '../../types';

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

describe('vale runtime isolation', () => {
  const vales: Vale[] = [{
    id: 'vale-1',
    barberName: 'Barbeiro',
    value: 20,
    description: 'Adiantamento local',
    timestamp: Date.now()
  }];

  it('excludes ephemeral vales when Supabase is active', () => {
    expect(getOperationalVales(vales, false)).toEqual([]);
  });

  it('preserves vales in local fallback mode', () => {
    expect(getOperationalVales(vales, true)).toBe(vales);
    expect(getOperationalVales(vales, true)).toHaveLength(1);
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

  it.each([
    ['equals', '=SUM(A1:A2)', "'=SUM(A1:A2)"],
    ['plus', '+123', "'+123"],
    ['minus', '-10', "'-10"],
    ['at sign', '@command', "'@command"],
    ['leading space', ' =SUM(A1:A2)', "' =SUM(A1:A2)"],
    ['leading tab', '\t=SUM(A1:A2)', "'\t=SUM(A1:A2)"],
    ['leading carriage return', '\r=SUM(A1:A2)', "'\r=SUM(A1:A2)"],
    ['leading new line', '\n=SUM(A1:A2)', "'\n=SUM(A1:A2)"],
  ])('neutralizes formula text with %s in the final CSV', (_case, input, expected) => {
    const csv = buildCsvContent([makeClient({ name: input })], []);

    expect(csv).toContain(expected);
  });

  it('keeps safe, accented, empty, and already-neutralized text unchanged', () => {
    const csv = buildCsvContent(
      [
        makeClient({ name: "'=SUM(A1:A2)", description: 'Descrição comum' }),
        makeClient({ id: 'client-2', name: '', description: null as unknown as string })
      ],
      []
    );

    expect(csv).toContain("'=SUM(A1:A2)");
    expect(csv).not.toContain("''=SUM(A1:A2)");
    expect(csv).toContain('Descrição comum');
    expect(csv).toContain(';RECEITA;;');
  });

  it('preserves CSV escaping after neutralizing malicious text', () => {
    const csv = buildCsvContent(
      [makeClient({
        name: '=HYPERLINK("https://example.test","Abrir")',
        description: '@linha 1; "detalhe"\nlinha 2'
      })],
      []
    );

    expect(csv).toContain('"\'=HYPERLINK(""https://example.test"",""Abrir"")"');
    expect(csv).toContain('"\'@linha 1; ""detalhe""\nlinha 2"');
  });

  it('keeps commas as content and generated monetary values numeric', () => {
    const csv = buildCsvContent(
      [makeClient({ name: 'Maria, Silva', totalValue: 60 })],
      [{
        id: 'vale-1',
        barberName: 'Barbeiro',
        value: 15,
        description: 'Retirada',
        timestamp: new Date(2026, 5, 4, 11, 0).getTime()
      }]
    );

    expect(csv).toContain(';Maria, Silva;');
    expect(csv).toContain(';60,00');
    expect(csv).toContain(';-15,00');
    expect(csv).not.toContain(";'-15,00");
  });

  it('does not mutate source values while neutralizing names and descriptions', () => {
    const client = makeClient({ name: '=CMD()', description: '+payload' });
    const original = structuredClone(client);

    const csv = buildCsvContent([client], []);

    expect(csv).toContain("'=CMD()");
    expect(csv).toContain("'+payload");
    expect(client).toEqual(original);
  });
});
