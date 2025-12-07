
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, formatTime } from "../utils";
import { Client, Vale } from "../types";

export const generateReportPDF = (
  shopName: string,
  dateRangeStr: string,
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
  
  // Brand Colors
  const colorDark = "#111827"; 
  const colorGold = "#f59e0b"; 
  const colorGray = "#6b7280"; 

  // --- HEADER ---
  doc.setFillColor(colorDark);
  doc.rect(0, 0, 210, 40, 'F');

  // Logo Icon
  doc.setDrawColor(colorGold);
  doc.setLineWidth(1);
  doc.line(15, 12, 20, 8);
  doc.line(20, 8, 25, 12);
  doc.line(25, 12, 25, 20);
  doc.line(25, 20, 20, 24);
  doc.line(20, 24, 15, 20);
  doc.line(15, 20, 15, 12);
  
  // Shop Name
  doc.setTextColor(colorGold);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(shopName, 32, 18);

  // Subtitle
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("RELATÓRIO DE GESTÃO", 32, 25);

  // Date/Range Display
  doc.setFontSize(10);
  let displayDate = dateRangeStr;
  
  // Check if it looks like YYYY-MM-DD
  if (dateRangeStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
     const [year, month, day] = dateRangeStr.split('-').map(Number);
     displayDate = new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
     }).toUpperCase();
  }
  
  doc.text(displayDate, 200, 20, { align: 'right' });

  let currentY = 50;

  // --- STATS CARDS ---
  doc.setFontSize(12);
  doc.setTextColor(colorDark);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMO DO PERÍODO", 14, currentY);
  
  currentY += 5;

  const cardWidth = 45;
  const cardHeight = 25;
  const gap = 4;
  const startX = 14;

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
  drawCard(startX + (cardWidth + gap) * 3, "Líquido (Comissão)", formatCurrency(stats.netCommission), true);

  currentY += 35;

  // --- CLIENT TABLE ---
  doc.setFontSize(12);
  doc.setTextColor(colorDark);
  doc.text("DETALHAMENTO DE ATENDIMENTOS", 14, currentY);
  
  const sortedClients = [...clients].sort((a, b) => b.timestamp - a.timestamp);

  const clientRows = sortedClients.map(c => {
    const datePart = new Date(c.timestamp).toLocaleDateString('pt-BR');
    return [
        `${datePart} ${formatTime(c.timestamp)}`,
        c.name,
        c.serviceType + (c.extraValue > 0 ? ' (+Adic)' : ''),
        c.barberName,
        c.clientType,
        formatCurrency(c.totalValue)
    ];
  });

  autoTable(doc, {
    startY: currentY + 3,
    head: [['Data/Hora', 'Cliente', 'Serviço', 'Profissional', 'Tipo', 'Valor']],
    body: clientRows,
    theme: 'grid',
    headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
        0: { cellWidth: 30 },
        5: { fontStyle: 'bold', halign: 'right' }
    }
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 15;

  // --- VALE TABLE ---
  if (vales.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(colorDark);
    doc.text("VALES E RETIRADAS", 14, currentY);

    const sortedVales = [...vales].sort((a, b) => b.timestamp - a.timestamp);

    const valeRows = sortedVales.map(v => {
        const datePart = new Date(v.timestamp).toLocaleDateString('pt-BR');
        return [
            `${datePart} ${formatTime(v.timestamp)}`,
            v.barberName,
            v.description,
            formatCurrency(v.value)
        ];
    });

    autoTable(doc, {
      startY: currentY + 3,
      head: [['Data/Hora', 'Profissional', 'Descrição', 'Valor']],
      body: valeRows,
      theme: 'grid',
      headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [254, 242, 242] },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
          0: { cellWidth: 30 },
          3: { fontStyle: 'bold', halign: 'right' }
      }
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(colorGray);
    doc.text("Nenhum vale registrado no período.", 14, currentY + 5);
  }

  // --- FOOTER ---
  const pageHeight = doc.internal.pageSize.height;
  doc.setFillColor(245, 245, 245);
  doc.rect(0, pageHeight - 15, 210, 15, 'F');
  
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Gerado via Gestão Máxima - Sistema Profissional", 105, pageHeight - 6, { align: 'center' });

  // Safe Filename
  const safeName = dateRangeStr.replace(/\//g, '-').replace(/ /g, '_');
  doc.save(`Relatorio_${safeName}.pdf`);
};
