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
    <div className={`${colorClass} p-6 rounded-2xl shadow-lg border border-gray-700 flex flex-col items-center text-center transition-transform hover:scale-[1.02]`}>
      <div className="p-3 rounded-full bg-gray-700/50 mb-4 text-white">
        {icon}
      </div>
      <h3 className="text-3xl font-bold font-display text-white mb-1">{value}</h3>
      <p className="text-sm text-gray-400 uppercase tracking-wider font-semibold mb-1">{title}</p>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
};