import React from 'react';

interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  colorClass?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, subtitle, icon, colorClass = "bg-gray-800" }) => {
  return (
    <div className={`${colorClass} glass-card p-6 rounded-2xl shadow-lg border border-gray-700 flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-1`}>
      <div className="p-3 rounded-full bg-white/10 mb-4 text-white border border-white/10 shadow-inner shadow-white/10">
        {icon}
      </div>
      <h3 className="text-3xl font-bold font-display text-white mb-1">{value}</h3>
      <p className="text-sm text-gray-400 uppercase tracking-wider font-semibold mb-1">{title}</p>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
};
