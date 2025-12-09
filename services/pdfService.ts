
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
  const colorDark = "#111827"; // Gray 900
  const colorGold = "#f59e0b"; // Gold 500
  const colorGray = "#6b7280"; // Gray 500
  const colorLightGray = "#f3f4f6";

  // --- HEADER ---
  // Background
  doc.setFillColor(colorDark);
  doc.rect(0, 0, 210, 45, 'F');

  // Logo Icon (Simplified Hexagon)
  doc.setDrawColor(colorGold);
  doc.setLineWidth(1.5);
  doc.line(20, 15, 25, 10);
  doc.line(25, 10, 30, 15);
  doc.line(30, 15, 30, 25);
  doc.line(30, 25, 25, 30);
  doc.line(25, 30, 20, 25);
  doc.line(20, 25, 20, 15);
  
  // Shop Name
  doc.setTextColor(colorGold);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(shopName, 40, 20);

  // Subtitle
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("RELATÓRIO DE GESTÃO", 40, 27);

  // Date/Range Display
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 200);
  let displayDate = dateRangeStr;
  
  // Format ISO date if detected
  if (dateRangeStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
     const [year, month, day] = dateRangeStr.split('-').map(Number);
     displayDate = new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
     }).toUpperCase();
  }
  
  doc.text(displayDate, 200, 20, { align: 'right' });

  let currentY = 55;

  // --- STATS CARDS ---
  doc.setFontSize(12);
  doc.setTextColor(colorDark);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMO DO PERÍODO", 14, currentY);
  
  currentY += 8;

  const cardWidth = 45;
  const cardHeight = 28;
  const gap = 4;
  const startX = 14;

  const drawCard = (x: number, title: string, value: string, isGold = false) => {
    // Card Background
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(isGold ? colorGold : 255, 255, 255);
    doc.roundedRect(x, currentY, cardWidth, cardHeight, 3, 3, 'FD');
    
    // Title
    doc.setFontSize(8);
    doc.setTextColor(isGold ? 255 : 100, 100, 100);
    doc.setFont("helvetica", "bold");
    doc.text(title.toUpperCase(), x + 4, currentY + 10);
    
    // Value
    doc.setFontSize(12);
    doc.setTextColor(isGold ? 255 : 0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(value, x + 4, currentY + 22);
  };

  drawCard(startX, "Atendimentos", stats.totalClients.toString());
  drawCard(startX + cardWidth + gap, "Faturamento", formatCurrency(stats.totalSales));
  drawCard(startX + (cardWidth + gap) * 2, "Vales / Despesas", formatCurrency(stats.totalVales));
  drawCard(startX + (cardWidth + gap) * 3, "Líquido (Comissão)", formatCurrency(stats.netCommission), true);

  currentY += 40;

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
        c.clientType === 'Novidade' ? 'Novo' : 'Casa',
        formatCurrency(c.totalValue)
    ];
  });

  autoTable(doc, {
    startY: currentY + 5,
    head: [['Data/Hora', 'Cliente', 'Serviço', 'Profissional', 'Tipo', 'Valor']],
    body: clientRows,
    theme: 'grid',
    headStyles: { 
        fillColor: [31, 41, 55], 
        textColor: [255, 255, 255], 
        fontStyle: 'bold',
        halign: 'left'
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    styles: { 
        fontSize: 10, // Font size increased for readability
        cellPadding: 4, // More breathing room
        textColor: [55, 65, 81],
        font: "helvetica",
        overflow: 'linebreak'
    },
    columnStyles: {
        0: { cellWidth: 35 }, // Date
        1: { cellWidth: 'auto' }, // Name
        2: { cellWidth: 35 }, // Service
        3: { cellWidth: 30 }, // Barber
        4: { cellWidth: 20, halign: 'center' }, // Type
        5: { cellWidth: 30, fontStyle: 'bold', halign: 'right' } // Value
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
      startY: currentY + 5,
      head: [['Data/Hora', 'Profissional', 'Descrição', 'Valor']],
      body: valeRows,
      theme: 'grid',
      headStyles: { 
          fillColor: [220, 38, 38], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold' 
      },
      alternateRowStyles: { fillColor: [254, 242, 242] },
      styles: { 
          fontSize: 10, 
          cellPadding: 4,
          textColor: [55, 65, 81],
          font: "helvetica"
      },
      columnStyles: {
          0: { cellWidth: 35 },
          3: { fontStyle: 'bold', halign: 'right' }
      }
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(colorGray);
    doc.text("Nenhum vale registrado no período.", 14, currentY + 5);
  }

  // --- FOOTER (Page Numbers) ---
  const pageCount = doc.internal.pages.length - 1; // jsPDF array has one empty element
  const pageHeight = doc.internal.pageSize.height;

  for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Footer Background
      doc.setFillColor(245, 245, 245);
      doc.rect(0, pageHeight - 15, 210, 15, 'F');
      
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("Gerado via Gestão Máxima - Sistema Profissional", 105, pageHeight - 8, { align: 'center' });
      doc.text(`Página ${i} de ${pageCount}`, 195, pageHeight - 8, { align: 'right' });
  }

  // Safe Filename
  const safeName = dateRangeStr.replace(/\//g, '-').replace(/ /g, '_');
  doc.save(`Relatorio_${safeName}.pdf`);
};
