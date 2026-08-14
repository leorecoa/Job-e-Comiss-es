
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
      <div className="ui-owner-card-solid flex flex-col p-5">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {period === 'monthly' ? 'Faturamento bruto do mes por dia' : 'Faturamento bruto dos ultimos 7 dias'}
        </h3>
        
        {/* Scroll container for monthly view if needed */}
        <div className={`flex-1 flex items-end justify-between gap-1 ${period === 'monthly' ? 'overflow-x-auto pb-2 custom-scrollbar' : ''}`}>
            {barData.map((d, i) => (
                <div key={i} className={`flex flex-col items-center group ${period === 'monthly' ? 'min-w-[12px] flex-1' : 'flex-1'}`}>
                    <div className="relative w-full flex justify-center h-32 items-end">
                        {/* Tooltip */}
                        <div className="ui-chart-tooltip pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded px-2 py-1 text-[10px] opacity-0 transition-opacity group-hover:opacity-100">
                            <span className="font-bold block">{d.day}</span>
                            {formatCurrency(d.value)}
                        </div>
                        {/* Bar */}
                        <div 
                            className={`ui-chart-bar w-full ${period === 'monthly' ? 'max-w-[8px] rounded-sm' : 'max-w-[24px] rounded-t-sm'} transition-opacity opacity-90 hover:opacity-100`}
                            style={{ height: `${(d.value / maxBarValue) * 100}%`, minHeight: d.value > 0 ? '4px' : '0' }}
                        ></div>
                    </div>
                    {/* Labels: Show all for weekly, but skip some for monthly to avoid clutter if screen is small */}
                    <span className="mt-2 w-full truncate text-center font-mono text-[9px] text-muted-foreground">
                        {period === 'monthly' ? (i % 2 === 0 ? d.day : '') : d.day}
                    </span>
                </div>
            ))}
        </div>
      </div>

      {/* Services Chart */}
      <div className="ui-owner-card-solid p-5">
         <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Mix de servicos por atendimento</h3>
         <div className="space-y-4 max-h-[160px] overflow-y-auto custom-scrollbar pr-2">
            {pieData.length === 0 ? (
              <>
                <div className="pt-4 text-center text-sm text-muted-foreground">
                    <p className="font-bold text-foreground">Ainda sem mix de servicos.</p>
                    <p className="mt-1">O grafico aparece depois que houver atendimentos registrados no periodo.</p>
                </div>
                <p className="py-4 text-center text-sm text-muted-foreground">Sem dados no período.</p>
              </>
            ) : (
                pieData.map((d) => (
                    <div key={d.name} className="group">
                        <div className="mb-1.5 flex justify-between text-xs font-medium text-foreground">
                            <span className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${
                                    d.name === ServiceType.CUT ? 'bg-blue-500' : 
                                    d.name === ServiceType.BEARD ? 'bg-orange-500' : 
                                    d.name === ServiceType.COMBO ? 'bg-purple-500' : 
                                    d.name === ServiceType.PRODUCT ? 'bg-green-600' : 'ui-chart-legend-mark'
                                }`}></span>
                                {d.name}
                            </span>
                            <span>{Math.round(d.percent)}%</span>
                        </div>
                        <div className="ui-chart-track h-2.5 w-full overflow-hidden rounded-full">
                            <div 
                                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                    d.name === ServiceType.CUT ? 'bg-blue-500' : 
                                    d.name === ServiceType.BEARD ? 'bg-orange-500' : 
                                    d.name === ServiceType.COMBO ? 'bg-purple-500' : 
                                    d.name === ServiceType.PRODUCT ? 'bg-green-600' : 'ui-chart-segment'
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
