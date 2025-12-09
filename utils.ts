
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

export const generateAndDownloadCSV = (
  filename: string, 
  clients: any[], 
  vales: any[]
) => {
  // Cabeçalho do CSV
  const headers = ["Data", "Hora", "Tipo Movimento", "Cliente", "Detalhe/Produto", "Profissional", "Serviço", "Valor (R$)"];
  
  const rows: string[] = [];
  rows.push(headers.join(";")); // Usando ponto e vírgula para Excel em PT-BR

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
    ].join(";"));
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
    ].join(";"));
  });

  // Criar o Blob com BOM para suportar acentos no Excel
  const csvContent = "\uFEFF" + rows.join("\n");
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
