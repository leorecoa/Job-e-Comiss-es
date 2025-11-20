
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

export const generateReportContent = (date: number, clients: any[], vales: any[], stats: any) => {
  const lines: string[] = [];
  lines.push("=================================");
  lines.push(`RELATÓRIO DIÁRIO - BARBEARIA PRO`);
  lines.push(`Data: ${formatDate(date)}`);
  lines.push("=================================");
  lines.push("");
  lines.push("RESUMO FINANCEIRO");
  lines.push(`Total Clientes: ${stats.totalClients}`);
  lines.push(`Total Vendas: ${formatCurrency(stats.totalSales)}`);
  lines.push(`Total Vales: ${formatCurrency(stats.totalVales)}`);
  lines.push(`Comissão Líquida: ${formatCurrency(stats.netCommission)}`);
  lines.push("");
  lines.push("---------------------------------");
  lines.push("CLIENTES ATENDIDOS");
  lines.push("---------------------------------");
  
  if (clients.length === 0) lines.push("Nenhum cliente registrado.");
  
  clients.forEach((c: any) => {
    lines.push(`[${formatTime(c.timestamp)}] ${c.name} (${c.clientType})`);
    lines.push(`   Serviço: ${c.serviceType} | Barbeiro: ${c.barberName}`);
    lines.push(`   Valor: ${formatCurrency(c.totalValue)}`);
    lines.push("- - - - - - - - - - - - - - - - -");
  });

  lines.push("");
  lines.push("---------------------------------");
  lines.push("VALES E RETIRADAS");
  lines.push("---------------------------------");

  if (vales.length === 0) lines.push("Nenhum vale registrado.");

  vales.forEach((v: any) => {
    lines.push(`[${formatTime(v.timestamp)}] ${v.barberName}`);
    lines.push(`   Motivo: ${v.description}`);
    lines.push(`   Valor: ${formatCurrency(v.value)}`);
    lines.push("- - - - - - - - - - - - - - - - -");
  });
  
  return lines.join("\n");
};
