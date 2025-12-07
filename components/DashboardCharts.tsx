
import React from 'react';
import { formatCurrency } from '../utils';
import { ServiceType } from '../types';

interface DashboardChartsProps {
  clients: any[]; 
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({ clients }) => {
  // 1. Bar Chart Data (Last 7 Days)
  const getLast7DaysData = () => {
    const data = [];
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
    return data;
  };

  const barData = getLast7DaysData();
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
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 shadow-lg">
        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-4">Faturamento (7 Dias)</h3>
        <div className="flex items-end justify-between h-32 gap-2">
            {barData.map((d, i) => (
                <div key={i} className="flex flex-col items-center flex-1 group">
                    <div className="relative w-full flex justify-center h-full items-end">
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 border border-gray-600 text-white text-[10px] py-1 px-2 rounded pointer-events-none whitespace-nowrap z-10 shadow-xl">
                            {formatCurrency(d.value)}
                        </div>
                        {/* Bar */}
                        <div 
                            className="w-full max-w-[24px] bg-gradient-to-t from-gold-600 to-gold-400 rounded-t-sm hover:from-gold-500 hover:to-gold-300 transition-all opacity-80 hover:opacity-100"
                            style={{ height: `${(d.value / maxBarValue) * 100}%`, minHeight: d.value > 0 ? '4px' : '0' }}
                        ></div>
                    </div>
                    <span className="text-[10px] text-gray-500 mt-2 font-mono">{d.day}</span>
                </div>
            ))}
        </div>
      </div>

      {/* Services Chart */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 shadow-lg">
         <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-4">Serviços Populares</h3>
         <div className="space-y-4">
            {pieData.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">Sem dados ainda.</p>
            ) : (
                pieData.map((d) => (
                    <div key={d.name} className="group">
                        <div className="flex justify-between text-xs text-gray-300 mb-1.5 font-medium">
                            <span className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${
                                    d.name === ServiceType.CUT ? 'bg-blue-500' : 
                                    d.name === ServiceType.BEARD ? 'bg-orange-500' : 
                                    d.name === ServiceType.COMBO ? 'bg-purple-500' : 'bg-gray-500'
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
                                    d.name === ServiceType.COMBO ? 'bg-purple-500' : 'bg-gray-500'
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
