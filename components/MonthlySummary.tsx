
import React, { useMemo } from 'react';
import { Client, Vale, AppSettings, ServiceType } from '../types';
import { formatCurrency, calculateClientCommission } from '../utils';
import { StatsCard } from './StatsCard';
import { DashboardCharts } from './DashboardCharts';
import { ArrowLeft, DollarSign, TrendingUp, Calendar, MinusCircle, Users } from 'lucide-react';

interface MonthlySummaryProps {
  clients: Client[];
  vales: Vale[];
  settings: AppSettings;
  onBack: () => void;
  selectedMonth: string; // YYYY-MM
  onMonthChange: (month: string) => void;
}

export const MonthlySummary: React.FC<MonthlySummaryProps> = ({
  clients,
  vales,
  settings,
  onBack,
  selectedMonth,
  onMonthChange
}) => {
  
  // Filtra e calcula dados baseados no mês selecionado
  const monthlyData = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr) - 1; // JS months are 0-11

    // Filtrar itens do mês
    const filteredClients = clients.filter(c => {
      const d = new Date(c.timestamp);
      return d.getFullYear() === year && d.getMonth() === month;
    });

    const filteredVales = vales.filter(v => {
      const d = new Date(v.timestamp);
      return d.getFullYear() === year && d.getMonth() === month;
    });

    // Função auxiliar usando a lógica centralizada
    const getCommission = (c: Client) => {
        return calculateClientCommission(c, settings.commissionRate);
    };

    // Totais Gerais
    const totalSales = filteredClients.reduce((acc, c) => acc + c.totalValue, 0);
    const totalCommission = filteredClients.reduce((acc, c) => acc + getCommission(c), 0);
    const totalVales = filteredVales.reduce((acc, v) => acc + v.value, 0);
    const netCommission = totalCommission - totalVales;
    const estimatedShopNet = totalSales - totalCommission;
    const averageTicket = filteredClients.length > 0 ? totalSales / filteredClients.length : 0;

    // Agrupar por dia
    const daysMap: Record<string, { sales: number; commission: number; vales: number; count: number }> = {};
    // Agrupar por barbeiro.
    const barbersMap: Record<string, { sales: number; commission: number; vales: number; count: number }> = {};

    // Processar Clientes
    filteredClients.forEach(c => {
      const comm = getCommission(c);
      
      // Por dia
      const dayKey = new Date(c.timestamp).toLocaleDateString('pt-BR');
      if (!daysMap[dayKey]) daysMap[dayKey] = { sales: 0, commission: 0, vales: 0, count: 0 };
      daysMap[dayKey].sales += c.totalValue;
      daysMap[dayKey].commission += comm;
      daysMap[dayKey].count += 1;

      // Por Barbeiro
      const barberName = c.barberName || 'Desconhecido';
      if (!barbersMap[barberName]) barbersMap[barberName] = { sales: 0, commission: 0, vales: 0, count: 0 };
      barbersMap[barberName].sales += c.totalValue;
      barbersMap[barberName].commission += comm;
      barbersMap[barberName].count += 1;
    });

    // Processar Vales
    filteredVales.forEach(v => {
      // Por dia
      const dayKey = new Date(v.timestamp).toLocaleDateString('pt-BR');
      if (!daysMap[dayKey]) daysMap[dayKey] = { sales: 0, commission: 0, vales: 0, count: 0 };
      daysMap[dayKey].vales += v.value;

      // Por Barbeiro
      const barberName = v.barberName || 'Desconhecido';
      if (!barbersMap[barberName]) barbersMap[barberName] = { sales: 0, commission: 0, vales: 0, count: 0 };
      barbersMap[barberName].vales += v.value;
    });

    // Converter para array e ordenar (Dias)
    const dailyBreakdown = Object.entries(daysMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => {
        const [da, ma, ya] = a.date.split('/').map(Number);
        const [db, mb, yb] = b.date.split('/').map(Number);
        return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime(); 
      });

    // Converter para array (Barbeiros)
    const teamBreakdown = Object.entries(barbersMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.sales - a.sales); // Quem vendeu mais primeiro

    return {
      filteredClients, // Exposing filtered list for Charts
      totalSales,
      totalCommission,
      totalVales,
      netCommission,
      estimatedShopNet,
      averageTicket,
      totalClients: filteredClients.length,
      dailyBreakdown,
      teamBreakdown
    };
  }, [clients, vales, selectedMonth, settings.commissionRate]);

  const selectedMonthLabel = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);

    if (!year || !month) return selectedMonth;

    return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric'
    });
  }, [selectedMonth]);

  return (
    <div className="animate-slide-in space-y-6 pb-12">
      {/* Header do Relatório */}
      <div className="ui-owner-card-solid sticky top-[72px] z-30 flex flex-col items-center justify-between gap-4 p-4 md:flex-row">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button 
            onClick={onBack}
            className="ui-button ui-button-secondary"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">Resumo financeiro mensal</h2>
            <p className="text-sm text-muted-foreground">Periodo analisado: {selectedMonthLabel}</p>
          </div>
        </div>

        <div className="flex gap-3 w-full md:w-auto items-center justify-end">
            <div className="relative flex-grow md:flex-grow-0">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Calendar size={16} />
                </div>
                <input 
                    type="month" 
                    value={selectedMonth}
                    onChange={(e) => onMonthChange(e.target.value)}
                    className="ui-input block w-full cursor-pointer pl-10 md:w-40"
                />
            </div>
        </div>
      </div>

      {/* Cards Totais (Loja Inteira) */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatsCard 
          title="Faturamento bruto" 
          value={formatCurrency(monthlyData.totalSales)} 
          subtitle={`${monthlyData.totalClients} atendimentos`}
          icon={<DollarSign size={20} />} 
          colorClass="ui-owner-metric"
        />
        <StatsCard
          title="Comissao calculada"
          value={formatCurrency(monthlyData.totalCommission)}
          subtitle="Baseada nos atendimentos"
          icon={<TrendingUp size={20} />}
          colorClass="ui-owner-metric"
        />
        <StatsCard
          title="Liquido estimado da barbearia"
          value={formatCurrency(monthlyData.estimatedShopNet)}
          subtitle="Bruto menos comissao calculada"
          icon={<DollarSign size={20} />}
          colorClass="ui-owner-metric"
        />
        <StatsCard 
          title="Vales / Despesas" 
          value={formatCurrency(monthlyData.totalVales)}
          subtitle="Lancamentos do periodo"
          icon={<MinusCircle size={20} />} 
          colorClass="ui-owner-metric"
        />
        <StatsCard 
          title="Saldo estimado da equipe" 
          value={formatCurrency(monthlyData.netCommission)} 
          subtitle="Comissao calculada menos vales"
          icon={<TrendingUp size={20} />} 
          colorClass="ui-owner-metric"
        />
      </div>

      <div className="ui-owner-info rounded-2xl p-4 text-sm">
        <p className="font-bold text-foreground">Nota sobre comissoes</p>
        <p className="mt-1">
          Os valores de comissao representam o calculo com base nos atendimentos registrados. Este painel nao controla pagamento de repasse.
          {monthlyData.totalClients > 0 ? ` Ticket medio do periodo: ${formatCurrency(monthlyData.averageTicket)}.` : ''}
        </p>
      </div>

      {/* Gráficos Mensais */}
      <div className="mt-6">
         <DashboardCharts 
            clients={monthlyData.filteredClients} 
            period="monthly" 
            selectedDate={selectedMonth} 
         />
      </div>

      {/* TABELA DE EQUIPE (Somente se houver dados de equipe ou múltiplos nomes) */}
      {monthlyData.teamBreakdown.length > 0 && (
         <div className="ui-owner-list overflow-hidden">
            <div className="ui-owner-table-head flex items-center justify-between p-4">
                <h3 className="flex items-center gap-2 font-bold text-foreground">
                    <Users size={18} className="text-blue-400"/>
                    Producao por barbeiro
                </h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="ui-owner-table-head text-xs uppercase tracking-wider">
                    <th className="p-4 font-medium">Barbeiro</th>
                    <th className="p-4 font-medium text-center">Atend.</th>
                    <th className="p-4 font-medium text-right text-blue-400">Producao bruta</th>
                    <th className="p-4 font-medium text-right text-gold-500">Comissao calculada</th>
                    <th className="p-4 font-medium text-right text-red-400">Vales</th>
                    <th className="p-4 font-medium text-right text-gold-500">Saldo estimado</th>
                    </tr>
                </thead>
                <tbody>
                    {monthlyData.teamBreakdown.map((barber) => {
                        const net = barber.commission - barber.vales;
                        return (
                            <tr key={barber.name} className="ui-owner-table-row transition-colors">
                                <td className="p-4 font-bold text-foreground">{barber.name}</td>
                                <td className="p-4 text-center text-foreground">{barber.count}</td>
                                <td className="p-4 text-right text-foreground">{formatCurrency(barber.sales)}</td>
                                <td className="p-4 text-right text-gold-300">{formatCurrency(barber.commission)}</td>
                                <td className="p-4 text-right text-red-300">{barber.vales > 0 ? `- ${formatCurrency(barber.vales)}` : '-'}</td>
                                <td className="p-4 text-right font-bold text-gold-500 text-lg">{formatCurrency(net)}</td>
                            </tr>
                        );
                    })}
                </tbody>
                </table>
            </div>
         </div>
      )}

      {/* Tabela Detalhada por Dia */}
      <div className="ui-owner-list overflow-hidden">
        <div className="ui-owner-table-head p-4">
          <h3 className="flex items-center gap-2 font-bold text-foreground">
            <Calendar size={18} className="text-muted-foreground"/>
            Historico diario da barbearia
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          {monthlyData.dailyBreakdown.length === 0 ? (
            <div className="ui-owner-empty m-4 text-center">
              <p className="font-bold text-foreground">Nenhum registro encontrado neste mes.</p>
              <p className="mx-auto mt-2 max-w-md text-sm">
                Atendimentos concluidos, vendas e vales lancados no periodo aparecerao neste historico.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="ui-owner-table-head text-xs uppercase tracking-wider">
                  <th className="p-4 font-medium">Data</th>
                  <th className="p-4 font-medium text-center">Atend.</th>
                  <th className="p-4 text-right font-medium text-foreground">Faturamento bruto</th>
                  <th className="p-4 font-medium text-right text-gold-500">Comissao calculada</th>
                  <th className="p-4 text-right font-medium text-muted-foreground">Vales</th>
                  <th className="p-4 font-medium text-right text-gold-500">Saldo estimado</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.dailyBreakdown.map((day) => {
                    return (
                        <tr key={day.date} className="ui-owner-table-row transition-colors">
                            <td className="p-4 font-medium text-foreground">{day.date}</td>
                            <td className="p-4 text-center text-foreground">{day.count}</td>
                            <td className="p-4 text-right text-foreground">{formatCurrency(day.sales)}</td>
                            <td className="p-4 text-right text-gold-300">{formatCurrency(day.commission)}</td>
                            <td className="p-4 text-right text-muted-foreground">{day.vales > 0 ? `- ${formatCurrency(day.vales)}` : '-'}</td>
                            <td className="p-4 text-right text-gold-500 font-bold">{formatCurrency(day.commission - day.vales)}</td>
                        </tr>
                    );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
