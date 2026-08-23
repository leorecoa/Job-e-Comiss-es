import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MonthlySummary } from './components/MonthlySummary';
import { BarberDashboard } from './components/BarberDashboard';
import { AppSettings, Client, ClientType, ServiceType, Vale } from './types';

const { jsPdfMock, autoTableMock, docMock } = vi.hoisted(() => {
  const doc = {
    setFillColor: vi.fn(),
    rect: vi.fn(),
    setDrawColor: vi.fn(),
    setLineWidth: vi.fn(),
    line: vi.fn(),
    setTextColor: vi.fn(),
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    text: vi.fn(),
    roundedRect: vi.fn(),
    save: vi.fn(),
    setPage: vi.fn(),
    internal: {
      pages: [null, {}],
      pageSize: {
        height: 297
      }
    },
    lastAutoTable: {
      finalY: 150
    }
  };

  return {
    docMock: doc,
    jsPdfMock: vi.fn(function () {
      return doc;
    }),
    autoTableMock: vi.fn(() => {
      doc.lastAutoTable = { finalY: 150 };
    })
  };
});

vi.mock('jspdf', () => ({
  jsPDF: jsPdfMock
}));

vi.mock('jspdf-autotable', () => ({
  default: autoTableMock
}));

const settings: AppSettings = {
  shopName: 'Barbearia Teste',
  logoUrl: '',
  priceCut: 50,
  priceBeard: 30,
  priceCombo: 70,
  priceProduct: 0,
  products: [],
  commissionRate: 50,
  barbers: [
    {
      id: 'barber-1',
      name: 'Leo',
      barbershopId: 'shop-1',
      active: true
    }
  ],
  services: [
    {
      id: 'service-1',
      name: 'Corte',
      price: 100,
      durationMinutes: 30,
      commissionRate: 50,
      active: true
    }
  ]
};

const clients: Client[] = [
  {
    id: 'client-1',
    name: 'Cliente Um',
    barberName: 'Leo',
    serviceType: ServiceType.CUT,
    clientType: ClientType.NEW,
    serviceValue: 100,
    extraValue: 0,
    totalValue: 100,
    commissionValue: 50,
    timestamp: new Date(2026, 0, 15, 10, 0).getTime(),
    products: []
  }
];

const vales: Vale[] = [
  {
    id: 'vale-1',
    barberName: 'Leo',
    value: 10,
    description: 'Vale teste',
    timestamp: new Date(2026, 0, 16, 10, 0).getTime()
  }
];

describe('financial reporting clarity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('labels owner monthly summary as gross revenue, calculated commission, and estimated balances', () => {
    const html = renderToStaticMarkup(
      <MonthlySummary
        clients={clients}
        vales={vales}
        settings={settings}
        selectedMonth="2026-01"
        onMonthChange={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(html).toContain('Resumo financeiro mensal');
    expect(html).toContain('Periodo analisado:');
    expect(html).toContain('Faturamento bruto');
    expect(html).toContain('Comissao calculada');
    expect(html).toContain('Liquido estimado da barbearia');
    expect(html).toContain('Saldo estimado da equipe');
    expect(html).toContain('Este painel nao controla pagamento de repasse.');
    expect(html).not.toContain('Comissoes a Pagar');
    expect(html).not.toContain('A Receber');
  });

  it('does not expose financial metrics in the barber dashboard', () => {
    const html = renderToStaticMarkup(
      <BarberDashboard
        authSession={{
          userId: 'barber-user',
          email: 'barber@example.com',
          role: 'barber',
          displayName: 'Leo',
          barbershopId: 'shop-1',
          barberId: 'barber-1'
        }}
        appointments={[]}
        settings={settings}
        onCreateAppointment={vi.fn()}
        addToast={vi.fn()}
        onSignOut={vi.fn()}
      />
    );

    expect(html).not.toContain('Comissao calculada do dia');
    expect(html).not.toContain('Comissao calculada do mes');
    expect(html).not.toContain('pagamento de repasse');
  });

  it('uses neutral commission labels in the PDF report', async () => {
    const { generateReportPDF } = await import('./services/pdfService');

    generateReportPDF(
      'Barbearia Teste',
      '2026-01-15',
      {
        totalClients: 1,
        totalSales: 100,
        totalVales: 10,
        netCommission: 40
      },
      clients,
      vales
    );

    const textCalls = docMock.text.mock.calls.map((call) => String(call[0]));

    expect(textCalls).toContain('FATURAMENTO BRUTO');
    expect(textCalls).toContain('SALDO ESTIMADO');
    expect(textCalls).toContain('Comissoes sao valores calculados com base nos atendimentos registrados; este relatorio nao confirma pagamento de repasse.');
    expect(textCalls.join(' ')).not.toMatch(/L.quido \(Comiss.o\)/);
  });
});
