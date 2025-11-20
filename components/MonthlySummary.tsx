import React, { useMemo } from 'react';
import { Client, Vale, AppSettings } from '../types';
import { formatCurrency } from '../utils';
import { StatsCard } from './StatsCard';
import { ArrowLeft, DollarSign, TrendingUp, Calendar, MinusCircle, Crown, Users } from 'lucide-react';

interface MonthlySummaryProps {
  clients: Client[];
  vales: Vale[];
  settings: AppSettings;
  onBack: () => void;
  selectedMonth: string; // YYYY-MM
  onMonthChange: (month: string) => void;
  isPro: boolean;
  onSubscribeClick: () => void;
}

export const MonthlySummary: React.FC<MonthlySummaryProps> = ({
  clients,
  vales,
  settings,
  onBack,
  selectedMonth,
  onMonthChange,
  isPro,
  onSubscribeClick
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

    // Totais Gerais
    const totalSales = filteredClients.reduce((acc, c) => acc + c.totalValue, 0);
    const totalCommission = totalSales * (settings.commissionRate / 100);
    const totalVales = filteredVales.reduce((acc, v) => acc + v.value, 0);
    const netCommission = totalCommission - totalVales;

    // Agrupar por dia
    const daysMap: Record<string, { sales: number; commission: number; vales: number; count: number }> = {};
    // Agrupar por Barbeiro (Para VIP/Equipe)
    const barbersMap: Record<string, { sales: number; commission: number; vales: number; count: number }> = {};

    // Processar Clientes
    filteredClients.forEach(c => {
      // Por dia
      const dayKey = new Date(c.timestamp).toLocaleDateString('pt-BR');
      if (!daysMap[dayKey]) daysMap[dayKey] = { sales: 0, commission: 0, vales: 0, count: 0 };
      daysMap[dayKey].sales += c.totalValue;
      daysMap[dayKey].commission += (c.totalValue * (settings.commissionRate / 100));
      daysMap[dayKey].count += 1;

      // Por Barbeiro
      const barberName = c.barberName || 'Desconhecido';
      if (!barbersMap[barberName]) barbersMap[barberName] = { sales: 0, commission: 0, vales: 0, count: 0 };
      barbersMap[barberName].sales += c.totalValue;
      barbersMap[barberName].commission += (c.totalValue * (settings.commissionRate / 100));
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
      totalSales,
      totalCommission,
      totalVales,
      netCommission,
      totalClients: filteredClients.length,
      dailyBreakdown,
      teamBreakdown
    };
  }, [clients, vales, selectedMonth, settings.commissionRate]);

  return (
    <div className="animate-slide-in space-y-6">
      {/* Header do Relatório */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-800 p-4 rounded-2xl border border-gray-700">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button 
            onClick={onBack}
            className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-display font-bold text-white">Resumo Mensal</h2>
            <p className="text-sm text-gray-400">Acompanhe seu desempenho financeiro</p>
          </div>
        </div>

        <div className="flex gap-3 w-full md:w-auto items-center justify-end">
            {!isPro && (
                <button 
                    onClick={onSubscribeClick}
                    className="flex items-center gap-1 bg-gold-500 hover:bg-gold-600 text-black text-xs font-bold px-3 py-2 rounded-lg transition-colors shadow-lg shadow-gold-500/20 animate-pulse"
                >
                    <Crown size={14} /> ASSINE AGORA
                </button>
            )}

            <div className="relative flex-grow md:flex-grow-0">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <Calendar size={16} />
                </div>
                <input 
                    type="month" 
                    value={selectedMonth}
                    onChange={(e) => onMonthChange(e.target.value)}
                    className="w-full md:w-40 bg-gray-900 border border-gray-700 text-white text-sm rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-transparent block pl-10 p-2.5 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                />
            </div>
        </div>
      </div>

      {/* Cards Totais (Loja Inteira) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard 
          title="Faturamento Total" 
          value={formatCurrency(monthlyData.totalSales)} 
          subtitle={`${monthlyData.totalClients} atendimentos`}
          icon={<DollarSign size={20} />} 
          colorClass="bg-gradient-to-br from-blue-900/40 to-gray-800 border-blue-500/30 text-blue-400"
        />
        <StatsCard 
          title="Vales / Despesas" 
          value={formatCurrency(monthlyData.totalVales)} 
          icon={<MinusCircle size={20} />} 
          colorClass="bg-gradient-to-br from-red-900/40 to-gray-800 border-red-500/30 text-red-400"
        />
        <StatsCard 
          title="Comissões a Pagar" 
          value={formatCurrency(monthlyData.netCommission)} 
          subtitle="Total líquido da equipe"
          icon={<TrendingUp size={20} />} 
          colorClass="bg-gradient-to-br from-gold-500/20 to-gray-800 border-gold-500/50 text-gold-500"
        />
      </div>

      {/* TABELA DE EQUIPE (Somente se houver dados de equipe ou múltiplos nomes) */}
      {monthlyData.teamBreakdown.length > 0 && (
         <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <Users size={18} className="text-blue-400"/>
                    Desempenho da Equipe
                </h3>
                <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-1 rounded border border-gray-700">
                    Taxa Base: {settings.commissionRate}%
                </span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-gray-900/50 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="p-4 font-medium">Barbeiro</th>
                    <th className="p-4 font-medium text-center">Cortes</th>
                    <th className="p-4 font-medium text-right text-blue-400">Vendas</th>
                    <th className="p-4 font-medium text-right text-red-400">Vales</th>
                    <th className="p-4 font-medium text-right text-gold-500">A Receber (Líq)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                    {monthlyData.teamBreakdown.map((barber) => {
                        const net = barber.commission - barber.vales;
                        return (
                            <tr key={barber.name} className="hover:bg-gray-700/30 transition-colors">
                                <td className="p-4 text-white font-bold">{barber.name}</td>
                                <td className="p-4 text-center text-gray-300">{barber.count}</td>
                                <td className="p-4 text-right text-gray-300">{formatCurrency(barber.sales)}</td>
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
      <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-gray-700 bg-gray-900/50">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Calendar size={18} className="text-gray-400"/>
            Histórico Diário (Loja)
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          {monthlyData.dailyBreakdown.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Nenhum registro encontrado neste mês.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-900/50 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="p-4 font-medium">Data</th>
                  <th className="p-4 font-medium text-center">Atend.</th>
                  <th className="p-4 font-medium text-right text-gray-300">Faturamento</th>
                  <th className="p-4 font-medium text-right text-gray-400">Vales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {monthlyData.dailyBreakdown.map((day) => {
                    return (
                        <tr key={day.date} className="hover:bg-gray-700/30 transition-colors">
                            <td className="p-4 text-white font-medium">{day.date}</td>
                            <td className="p-4 text-center text-gray-300">{day.count}</td>
                            <td className="p-4 text-right text-gray-300">{formatCurrency(day.sales)}</td>
                            <td className="p-4 text-right text-gray-400">{day.vales > 0 ? `- ${formatCurrency(day.vales)}` : '-'}</td>
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