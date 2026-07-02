
import React from 'react';
import { formatCurrency } from '../utils';
import { Client, ServiceType } from '../types';

interface DashboardChartsProps {
  clients: Client[];
  period?: 'weekly' | 'monthly';
  selectedDate?: string; // YYYY-MM format for monthly view
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({ 
    clients, 
    period = 'weekly',
    selectedDate
}) => {
  
  // 1. Bar Chart Data Generator
  const getChartData = () => {
    const data = [];

    if (period === 'monthly' && selectedDate) {
        // Monthly Logic: 1 to 31 (or end of month)
        const [year, month] = selectedDate.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        
        for (let i = 1; i <= daysInMonth; i++) {
            const currentDayDate = new Date(year, month - 1, i);
            const dayStr = String(i).padStart(2, '0');
            
            const startOfDay = currentDayDate.setHours(0,0,0,0);
            const endOfDay = currentDayDate.setHours(23,59,59,999);

            const dayTotal = clients
                .filter(c => c.timestamp >= startOfDay && c.timestamp <= endOfDay)
                .reduce((acc, c) => acc + c.totalValue, 0);

            data.push({ day: dayStr, value: dayTotal, fullDate: currentDayDate });
        }
    } else {
        // Weekly Logic: Last 7 Days
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dayStr = `${d.getDate()}/${d.getMonth() + 1}`;
            
            const startOfDay = new Date(d.setHours(0,0,0,0)).getTime();
            const endOfDay = new Date(d.setHours(23,59,59,999)).getTime();
            
            const dayTotal = clients
                .filter(c => c.timestamp >= startOfDay && c.timestamp <= endOfDay)
                .reduce((acc, c) => acc + c.totalValue, 0);

            data.push({ day: dayStr, value: dayTotal });
        }
    }
    return data;
  };

  const barData = getChartData();
  const maxBarValue = Math.max(...barData.map(d => d.value), 100);

  // 2. Pie Chart Data (Service Types)
  const getServiceDistribution = () => {
    const counts: Record<string, number> = {};
    clients.forEach(c => {
        const type = c.serviceType;
        counts[type] = (counts[type] || 0) + 1;
    });
    
    const total = clients.length || 1;
    return Object.entries(counts).map(([name, value]) => ({
        name,
        value,
        percent: (value / total) * 100
    })).sort((a, b) => b.value - a.value);
  };

  const pieData = getServiceDistribution();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      
      {/* Revenue Chart */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 shadow-lg flex flex-col">
        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-4">
            {period === 'monthly' ? 'Faturamento bruto do mes por dia' : 'Faturamento bruto dos ultimos 7 dias'}
        </h3>
        
        {/* Scroll container for monthly view if needed */}
        <div className={`flex-1 flex items-end justify-between gap-1 ${period === 'monthly' ? 'overflow-x-auto pb-2 custom-scrollbar' : ''}`}>
            {barData.map((d, i) => (
                <div key={i} className={`flex flex-col items-center group ${period === 'monthly' ? 'min-w-[12px] flex-1' : 'flex-1'}`}>
                    <div className="relative w-full flex justify-center h-32 items-end">
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 border border-gray-600 text-white text-[10px] py-1 px-2 rounded pointer-events-none whitespace-nowrap z-10 shadow-xl">
                            <span className="font-bold block">{d.day}</span>
                            {formatCurrency(d.value)}
                        </div>
                        {/* Bar */}
                        <div 
                            className={`w-full ${period === 'monthly' ? 'max-w-[8px] rounded-sm' : 'max-w-[24px] rounded-t-sm'} bg-gradient-to-t from-gold-600 to-gold-400 hover:from-gold-500 hover:to-gold-300 transition-all opacity-80 hover:opacity-100`}
                            style={{ height: `${(d.value / maxBarValue) * 100}%`, minHeight: d.value > 0 ? '4px' : '0' }}
                        ></div>
                    </div>
                    {/* Labels: Show all for weekly, but skip some for monthly to avoid clutter if screen is small */}
                    <span className="text-[9px] text-gray-500 mt-2 font-mono truncate w-full text-center">
                        {period === 'monthly' ? (i % 2 === 0 ? d.day : '') : d.day}
                    </span>
                </div>
            ))}
        </div>
      </div>

      {/* Services Chart */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 shadow-lg">
         <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-4">Mix de servicos por atendimento</h3>
         <div className="space-y-4 max-h-[160px] overflow-y-auto custom-scrollbar pr-2">
            {pieData.length === 0 ? (
              <>
                <div className="pt-4 text-center text-sm text-gray-500">
                    <p className="font-bold text-white">Ainda sem mix de servicos.</p>
                    <p className="mt-1">O grafico aparece depois que houver atendimentos registrados no periodo.</p>
                </div>
                <p className="text-gray-500 text-sm text-center py-4">Sem dados no período.</p>
              </>
            ) : (
                pieData.map((d) => (
                    <div key={d.name} className="group">
                        <div className="flex justify-between text-xs text-gray-300 mb-1.5 font-medium">
                            <span className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${
                                    d.name === ServiceType.CUT ? 'bg-blue-500' : 
                                    d.name === ServiceType.BEARD ? 'bg-orange-500' : 
                                    d.name === ServiceType.COMBO ? 'bg-purple-500' : 
                                    d.name === ServiceType.PRODUCT ? 'bg-green-500' : 'bg-gray-500'
                                }`}></span>
                                {d.name}
                            </span>
                            <span>{Math.round(d.percent)}%</span>
                        </div>
                        <div className="w-full bg-gray-900 rounded-full h-2.5 overflow-hidden border border-gray-700/50">
                            <div 
                                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                    d.name === ServiceType.CUT ? 'bg-blue-500' : 
                                    d.name === ServiceType.BEARD ? 'bg-orange-500' : 
                                    d.name === ServiceType.COMBO ? 'bg-purple-500' : 
                                    d.name === ServiceType.PRODUCT ? 'bg-green-500' : 'bg-gray-500'
                                }`}
                                style={{ width: `${d.percent}%` }}
                            ></div>
                        </div>
                    </div>
                ))
            )}
         </div>
      </div>

    </div>
  );
};
