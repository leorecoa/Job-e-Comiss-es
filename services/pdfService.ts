import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, formatTime } from "../utils";
import { Client, Vale } from "../types";

export const generateDailyReportPDF = (
  shopName: string,
  dateStr: string, // Format: YYYY-MM-DD
  stats: {
    totalClients: number;
    totalSales: number;
    totalVales: number;
    netCommission: number;
  },
  clients: Client[],
  vales: Vale[]
) => {
  const doc = new jsPDF();
  
  // Cores da Marca
  const colorDark = "#111827"; // Gray 900
  const colorGold = "#f59e0b"; // Gold 500
  const colorGray = "#6b7280"; // Gray 500

  // --- CABEÇALHO ---
  // Fundo Escuro
  doc.setFillColor(colorDark);
  doc.rect(0, 0, 210, 40, 'F');

  // Logo / Ícone (Hexágono Simplificado)
  doc.setDrawColor(colorGold);
  doc.setLineWidth(1);
  doc.line(15, 12, 20, 8);
  doc.line(20, 8, 25, 12);
  doc.line(25, 12, 25, 20);
  doc.line(25, 20, 20, 24);
  doc.line(20, 24, 15, 20);
  doc.line(15, 20, 15, 12);
  
  // Nome da Loja
  doc.setTextColor(colorGold);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(shopName, 32, 18);

  // Subtítulo
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("RELATÓRIO DE GESTÃO DIÁRIA", 32, 25);

  // Data Formatada
  const [year, month, day] = dateStr.split('-').map(Number);
  const formattedDate = new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  
  doc.setFontSize(10);
  doc.text(formattedDate.toUpperCase(), 200, 20, { align: 'right' });

  let currentY = 50;

  // --- RESUMO FINANCEIRO (CARDS) ---
  doc.setFontSize(12);
  doc.setTextColor(colorDark);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMO DO DIA", 14, currentY);
  
  currentY += 5;

  const cardWidth = 45;
  const cardHeight = 25;
  const gap = 4;
  const startX = 14;

  // Helper para desenhar card
  const drawCard = (x: number, title: string, value: string, isGold = false) => {
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(isGold ? colorGold : 250, 250, 250);
    doc.roundedRect(x, currentY, cardWidth, cardHeight, 2, 2, 'FD');
    
    doc.setFontSize(8);
    doc.setTextColor(isGold ? 255 : 100, 100, 100);
    doc.text(title.toUpperCase(), x + 4, currentY + 8);
    
    doc.setFontSize(11);
    doc.setTextColor(isGold ? 255 : 0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(value, x + 4, currentY + 18);
  };

  drawCard(startX, "Atendimentos", stats.totalClients.toString());
  drawCard(startX + cardWidth + gap, "Faturamento", formatCurrency(stats.totalSales));
  drawCard(startX + (cardWidth + gap) * 2, "Vales / Retiradas", formatCurrency(stats.totalVales));
  drawCard(startX + (cardWidth + gap) * 3, "Líquido (Comissão)", formatCurrency(stats.netCommission), true); // Gold Card

  currentY += 35;

  // --- TABELA DE CLIENTES ---
  doc.setFontSize(12);
  doc.setTextColor(colorDark);
  doc.text("DETALHAMENTO DE ATENDIMENTOS", 14, currentY);
  
  const clientRows = clients.map(c => [
    formatTime(c.timestamp),
    c.name,
    c.serviceType + (c.extraValue > 0 ? ' (+Adic)' : ''),
    c.barberName,
    c.clientType,
    formatCurrency(c.totalValue)
  ]);

  autoTable(doc, {
    startY: currentY + 3,
    head: [['Hora', 'Cliente', 'Serviço', 'Profissional', 'Tipo', 'Valor']],
    body: clientRows,
    theme: 'grid',
    headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
        0: { cellWidth: 20 },
        5: { fontStyle: 'bold', halign: 'right' }
    }
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 15;

  // --- TABELA DE VALES ---
  if (vales.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(colorDark);
    doc.text("VALES E RETIRADAS", 14, currentY);

    const valeRows = vales.map(v => [
      formatTime(v.timestamp),
      v.barberName,
      v.description,
      formatCurrency(v.value)
    ]);

    autoTable(doc, {
      startY: currentY + 3,
      head: [['Hora', 'Profissional', 'Descrição', 'Valor']],
      body: valeRows,
      theme: 'grid',
      headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold' }, // Red header for vales
      alternateRowStyles: { fillColor: [254, 242, 242] },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
          0: { cellWidth: 20 },
          3: { fontStyle: 'bold', halign: 'right' }
      }
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(colorGray);
    doc.text("Nenhum vale registrado hoje.", 14, currentY + 5);
  }

  // --- RODAPÉ ---
  const pageHeight = doc.internal.pageSize.height;
  doc.setFillColor(245, 245, 245);
  doc.rect(0, pageHeight - 15, 210, 15, 'F');
  
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Gerado via Gestão Máxima - Sistema Profissional", 105, pageHeight - 6, { align: 'center' });

  // Save
  doc.save(`Relatorio_${dateStr}.pdf`);
};