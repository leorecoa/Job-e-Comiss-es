import React from 'react';

interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  colorClass?: string; // Can be used for specific text colors or accents
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, subtitle, icon, colorClass }) => {
  return (
    <div className={`glass-card rounded-2xl p-5 relative overflow-hidden group transition-all duration-300 hover:translate-y-[-2px] hover:shadow-glow ${colorClass}`}>
      
      {/* Background Gradient Glow */}
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all"></div>
      
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-gray-400 text-xs uppercase font-bold tracking-wider">{title}</h3>
          <div className={`p-2 rounded-lg bg-white/5 border border-white/5 ${colorClass ? '' : 'text-gold-500'}`}>
            {icon}
          </div>
        </div>
        
        <div className="mt-1">
          <p className="text-2xl md:text-3xl font-display font-bold text-white tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1 font-medium">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
};