
import { Client, ServiceType } from './types';
import { BarberOption } from './types';

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatDate = (timestamp: number): string => {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(timestamp));
};

export const formatTime = (timestamp: number): string => {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
};

export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

export const parseLocalDateInput = (dateInput: string): Date => {
  const [year, month, day] = dateInput.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid date input: ${dateInput}`);
  }

  return new Date(year, month - 1, day);
};

export const getLocalDayBounds = (dateInput: string): { start: number; end: number } => {
  const start = parseLocalDateInput(dateInput);
  start.setHours(0, 0, 0, 0);

  const end = parseLocalDateInput(dateInput);
  end.setHours(23, 59, 59, 999);

  return {
    start: start.getTime(),
    end: end.getTime()
  };
};

// Lógica Centralizada de Comissão
export const calculateClientCommission = (client: Client, currentRate: number): number => {
  // 1. Produtos nunca geram comissão
  if (client.serviceType === ServiceType.PRODUCT) {
    return 0;
  }

  // 2. Prioridade: Valor salvo explicitamente (se > 0)
  // Isso garante que comissões antigas (com taxas antigas) sejam preservadas
  if (client.commissionValue !== undefined) {
    return client.commissionValue;
  }

  // 3. Fallback: Recálculo usando a taxa atual
  let baseValue = 0;
  if (client.serviceValue !== undefined) {
    // Registro Moderno: Serviço + Extra (exclui produtos da base de cálculo)
    baseValue = client.serviceValue + (client.extraValue || 0);
  } else {
    // Registro Legado: Total (assume que era apenas serviço)
    baseValue = client.totalValue;
  }

  return baseValue * (currentRate / 100);
};

const escapeCsvCell = (value: unknown): string => {
  const text = String(value ?? '');
  if (/[;"\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
};

export const buildCsvContent = (
  clients: any[], 
  vales: any[]
): string => {
  // Cabeçalho do CSV
  const headers = ["Data", "Hora", "Tipo Movimento", "Cliente", "Detalhe/Produto", "Profissional", "Serviço", "Valor (R$)"];
  
  const rows: string[] = [];
  rows.push(headers.map(escapeCsvCell).join(";")); // Usando ponto e vírgula para Excel em PT-BR

  // Adicionar Clientes (Entradas)
  clients.forEach(c => {
    const date = new Date(c.timestamp);
    const dateStr = date.toLocaleDateString('pt-BR');
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const valueStr = c.totalValue.toFixed(2).replace('.', ','); // Formato Excel PT-BR
    
    // Improved description logic for CSV
    let detail = '';
    
    // Check for products array first
    if (c.products && c.products.length > 0) {
        detail = c.products.map((p: any) => p.name).join(' + ');
        if (c.description && c.description !== detail) {
             detail += ` (${c.description})`;
        }
    } else if (c.description) {
        detail = c.description;
    } else if (c.extraValue > 0) {
        detail = `+ Adicional R$${c.extraValue}`;
    }

    rows.push([
      dateStr,
      timeStr,
      "RECEITA",
      c.name,
      detail,
      c.barberName,
      c.serviceType,
      valueStr
    ].map(escapeCsvCell).join(";"));
  });

  // Adicionar Vales (Saídas)
  vales.forEach(v => {
    const date = new Date(v.timestamp);
    const dateStr = date.toLocaleDateString('pt-BR');
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const valueStr = `-${v.value.toFixed(2).replace('.', ',')}`; // Valor negativo

    rows.push([
      dateStr,
      timeStr,
      "DESPESA",
      "Vale/Retirada",
      v.description,
      v.barberName,
      "Vale",
      valueStr
    ].map(escapeCsvCell).join(";"));
  });

  // Criar o conteudo com BOM para suportar acentos no Excel
  return "\uFEFF" + rows.join("\n");
};

export const generateAndDownloadCSV = (
  filename: string, 
  clients: any[], 
  vales: any[]
) => {
  const csvContent = buildCsvContent(clients, vales);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  // Link de Download
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const getBarberNameById = (
  barbers: BarberOption[],
  barberId?: string
): string => {
  if (!barberId) return '';

  return barbers.find((barber) => barber.id === barberId)?.name || '';
};