import React from 'react';

interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  colorClass?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, subtitle, icon, colorClass = "" }) => {
  return (
    <div className={`${colorClass} ui-owner-metric p-6 rounded-2xl flex flex-col items-center text-center`}>
      <div className="ui-owner-metric-icon p-3 rounded-full mb-4">
        {icon}
      </div>
      <h3 className="text-3xl font-bold font-display mb-1">{value}</h3>
      <p className="ui-owner-help text-sm uppercase tracking-wider font-semibold mb-1">{title}</p>
      {subtitle && <p className="ui-owner-help text-xs">{subtitle}</p>}
    </div>
  );
};
