
import React, { useState, useEffect, useMemo } from 'react';
import { Client, Vale, AppSettings, DEFAULT_SETTINGS, ServiceType, DailyHistory, ClientType, UserProfile, PlanType } from './types';
import { formatCurrency, formatTime, generateId, formatDate, generateAndDownloadCSV } from './utils';
import { generateReportPDF } from './services/pdfService';
import { StatsCard } from './components/StatsCard';
import { AddClientModal } from './components/AddClientModal';
import { AddValeModal } from './components/AddValeModal';
import { SettingsModal } from './components/SettingsModal';
import { LoginScreen } from './components/LoginScreen';
import { PaywallScreen } from './components/PaywallScreen';
import { MonthlySummary } from './components/MonthlySummary';
import { SubscriptionModal } from './components/SubscriptionModal';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';
import { TourOverlay, TourStep } from './components/TourOverlay';
import { ReportModal } from './components/ReportModal';
import { DashboardCharts } from './components/DashboardCharts';
import { 
  Scissors, 
  Users, 
  DollarSign, 
  Settings, 
  Trash2, 
  Plus, 
  MinusCircle, 
  TrendingUp, 
  Download, 
  Pencil,
  Calendar,
  User,
  LogOut,
  BarChart3,
  Crown,
  Sparkles,
  UsersRound,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileText
} from 'lucide-react';

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCurrentMonthString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const TRIAL_DAYS = 7;

// Códigos
const CODES_PRO = ["MENSAL", "PRO", "LIBERADO"];
const CODES_VIP = ["VIP", "EQUIPE", "TIME", "VIP4"];
const CODES_ADMIN = ["LEANDRO", "ADMIN", "GABRIEL"];

const App: React.FC = () => {
  // -- Handle Splash Screen --
  useEffect(() => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
      setTimeout(() => {
        splash.classList.add('splash-hidden');
        setTimeout(() => {
            splash.remove();
        }, 500);
      }, 800);
    }
  }, []);

  // -- Auth & Profile State --
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('barbearia_profile');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // -- Data State --
  const [clients, setClients] = useState<Client[]>(() => {
    try {
      const saved = localStorage.getItem('barbearia_clients');
      const parsed = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.map((c: any) => ({
          ...c,
          clientType: c.clientType || ClientType.RETURNING,
          products: c.products || [], // Ensure backward compatibility
          commissionValue: c.commissionValue || 0
      }));
    } catch (e) {
      console.error("Error loading clients", e);
      return [];
    }
  });

  const [vales, setVales] = useState<Vale[]>(() => {
    try {
      const saved = localStorage.getItem('barbearia_vales');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Error loading vales", e);
      return [];
    }
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('barbearia_settings');
      const parsed = saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
      return { ...DEFAULT_SETTINGS, ...parsed }; 
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  });

  // -- View State --
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const [activeTab, setActiveTab] = useState<'clients' | 'vales'>('clients');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthString());
  const [selectedBarberFilter, setSelectedBarberFilter] = useState<string>('TODOS');
  
  // Modals State
  const [isClientModalOpen, setClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isValeModalOpen, setValeModalOpen] = useState(false);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [isReportModalOpen, setReportModalOpen] = useState(false);

  // Tour State
  const [isTourOpen, setTourOpen] = useState(false);

  // -- Notification State --
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // -- Effects --
  useEffect(() => {
    localStorage.setItem('barbearia_profile', JSON.stringify(userProfile));
  }, [userProfile]);

  useEffect(() => {
    localStorage.setItem('barbearia_clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('barbearia_vales', JSON.stringify(vales));
  }, [vales]);

  useEffect(() => {
    localStorage.setItem('barbearia_settings', JSON.stringify(settings));
  }, [settings]);

  // Check for First Time Tour
  useEffect(() => {
    if (userProfile) {
        const hasSeenTour = localStorage.getItem('hasSeenTour');
        if (!hasSeenTour) {
            setTimeout(() => setTourOpen(true), 1000);
        }
    }
  }, [userProfile]);

  const handleTourComplete = () => {
    setTourOpen(false);
    localStorage.setItem('hasSeenTour', 'true');
  };

  // -- Derived State --
  const trialStatus = useMemo(() => {
    if (!userProfile) return { isExpired: false, daysLeft: 7, daysUsed: 0 };
    if (userProfile.isPro) return { isExpired: false, daysLeft: 999, daysUsed: 0 };
    const now = Date.now();
    const start = userProfile.startDate;
    const diffTime = Math.abs(now - start);
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return {
      isExpired: diffDays > TRIAL_DAYS,
      daysLeft: Math.max(0, Math.ceil(TRIAL_DAYS - diffDays)),
      daysUsed: diffDays
    };
  }, [userProfile]);

  const isAdmin = useMemo(() => userProfile?.planType === 'admin_life', [userProfile]);
  const isVip = useMemo(() => userProfile?.planType === 'vip_monthly' || userProfile?.planType === 'admin_life', [userProfile]);

  // -- Filtering (Only for Daily View) --
  const filteredClients = useMemo(() => {
    const filtered = clients.filter(client => {
      if (!client.timestamp) return false;
      const d = new Date(client.timestamp);
      if (isNaN(d.getTime())) return false;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      if (dateString !== selectedDate) return false;
      if (selectedBarberFilter !== 'TODOS' && client.barberName !== selectedBarberFilter) return false;
      return true;
    });
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }, [clients, selectedDate, selectedBarberFilter]);

  const filteredVales = useMemo(() => {
    const filtered = vales.filter(vale => {
      if (!vale.timestamp) return false;
      const d = new Date(vale.timestamp);
      if (isNaN(d.getTime())) return false;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      if (dateString !== selectedDate) return false;
      if (selectedBarberFilter !== 'TODOS' && vale.barberName !== selectedBarberFilter) return false;
      return true;
    });
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }, [vales, selectedDate, selectedBarberFilter]);

  // -- Calculations --
  const stats = useMemo(() => {
    const totalSales = filteredClients.reduce((acc, curr) => acc + curr.totalValue, 0);
    
    // Calculate Commission using the stored value if available, else fallback
    const grossCommission = filteredClients.reduce((acc, curr) => {
        if (curr.commissionValue !== undefined) {
            return acc + curr.commissionValue;
        }
        // Fallback for old records
        return acc + (curr.totalValue * (settings.commissionRate / 100));
    }, 0);

    const totalVales = filteredVales.reduce((acc, curr) => acc + curr.value, 0);
    const netCommission = grossCommission - totalVales;

    return {
      totalClients: filteredClients.length,
      totalSales,
      grossCommission,
      totalVales,
      netCommission
    };
  }, [filteredClients, filteredVales, settings.commissionRate]);

  // -- Handlers --
  const handleLogin = (profile: UserProfile) => {
    setUserProfile(profile);
    setSettings(prev => ({ ...prev, shopName: profile.shopName }));
    addToast(`Bem-vindo, ${profile.ownerName}!`, 'success');
  };

  const handleSubscribe = (codeInput: string): boolean => {
    const cleanCode = codeInput.trim().toUpperCase();
    if (!userProfile) return false;
    if (CODES_ADMIN.includes(cleanCode)) {
        setUserProfile({ ...userProfile, isPro: true, planType: 'admin_life' });
        addToast('Modo Admin Vitalício Ativado!', 'success');
        return true;
    }
    if (CODES_VIP.includes(cleanCode)) {
        setUserProfile({ ...userProfile, isPro: true, planType: 'vip_monthly' });
        addToast('Assinatura VIP Ativada!', 'success');
        return true;
    }
    if (CODES_PRO.includes(cleanCode)) {
        setUserProfile({ ...userProfile, isPro: true, planType: 'pro_monthly' });
        addToast('Assinatura PRO Ativada!', 'success');
        return true;
    }
    return false;
  };

  const handleSaveClient = (data: any) => {
    const { timeStr, ...clientInfo } = data;
    const [year, month, day] = selectedDate.split('-').map(Number);
    const [hours, minutes] = timeStr ? timeStr.split(':').map(Number) : [new Date().getHours(), new Date().getMinutes()];
    const timestamp = new Date(year, month - 1, day, hours, minutes).getTime();

    if (editingClient) {
      setClients(prev => prev.map(c => c.id === editingClient.id ? { ...clientInfo, id: c.id, timestamp } : c));
      setEditingClient(null);
      addToast('Atendimento atualizado!', 'success');
    } else {
      const newClient: Client = { ...clientInfo, id: generateId(), timestamp };
      setClients(prev => [newClient, ...prev]);
      addToast('Novo atendimento salvo!', 'success');
    }
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setClientModalOpen(true);
  };

  const handleAddVale = (data: Omit<Vale, 'id' | 'timestamp'>) => {
    let timestamp = Date.now();
    const todayStr = getTodayString();
    if (selectedDate !== todayStr) {
        const [year, month, day] = selectedDate.split('-').map(Number);
        const now = new Date();
        const d = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
        timestamp = d.getTime();
    }
    const newVale: Vale = { ...data, id: generateId(), timestamp: timestamp };
    setVales(prev => [newVale, ...prev]);
    addToast('Vale registrado!', 'success');
  };

  const handleDeleteClient = (id: string) => {
    if(window.confirm('Tem certeza que deseja excluir este cliente?')) {
      setClients(prev => prev.filter(c => c.id !== id));
      addToast('Cliente removido.', 'info');
    }
  };

  const handleDeleteVale = (id: string) => {
    if(window.confirm('Tem certeza que deseja excluir este vale?')) {
      setVales(prev => prev.filter(v => v.id !== id));
      addToast('Vale removido.', 'info');
    }
  };

  const handleDownloadRange = (startDate: string, endDate: string, format: 'pdf' | 'csv') => {
    try {
        const start = new Date(startDate);
        start.setHours(0,0,0,0);
        const end = new Date(endDate);
        end.setHours(23,59,59,999);

        const rangeClients = clients.filter(c => c.timestamp >= start.getTime() && c.timestamp <= end.getTime());
        const rangeVales = vales.filter(v => v.timestamp >= start.getTime() && v.timestamp <= end.getTime());
        
        // Safe filename
        const dateLabel = startDate === endDate 
            ? startDate 
            : `De ${startDate} a ${endDate}`;
        const safeName = `Relatorio_${dateLabel.replace(/\//g, '-').replace(/ /g, '_')}`;

        if (format === 'csv') {
            generateAndDownloadCSV(safeName, rangeClients, rangeVales);
            addToast('Planilha Excel (CSV) gerada!', 'success');
            return;
        }

        // PDF Logic (Default)
        const totalSales = rangeClients.reduce((acc, curr) => acc + curr.totalValue, 0);
        
        // Use stored commission value
        const grossCommission = rangeClients.reduce((acc, curr) => {
             return acc + (curr.commissionValue || (curr.totalValue * (settings.commissionRate / 100)));
        }, 0);

        const totalVales = rangeVales.reduce((acc, curr) => acc + curr.value, 0);
        const netCommission = grossCommission - totalVales;

        const rangeStats = {
            totalClients: rangeClients.length,
            totalSales,
            grossCommission,
            totalVales,
            netCommission
        };

        const displayLabel = startDate === endDate 
            ? startDate 
            : `De ${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')}`;

        generateReportPDF(
            settings.shopName,
            displayLabel,
            rangeStats,
            rangeClients,
            rangeVales
        );
        addToast('Relatório PDF gerado!', 'success');
    } catch (e) {
        console.error(e);
        addToast('Erro ao gerar relatório.', 'error');
    }
  };

  const handleDownloadDaily = () => {
    try {
      generateReportPDF(
        settings.shopName,
        selectedDate,
        stats,
        filteredClients,
        filteredVales
      );
      addToast('Relatório do dia baixado!', 'success');
    } catch (e) {
      console.error(e);
      addToast('Erro ao gerar relatório.', 'error');
    }
  };

  const handleOpenAddClient = () => {
    setEditingClient(null);
    setClientModalOpen(true);
  };
  
  const handleLogout = () => {
    if(window.confirm("Deseja sair?")) {
       setUserProfile(null);
    }
  }

  const changeDate = (days: number) => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() + days);
    
    const newYear = d.getFullYear();
    const newMonth = String(d.getMonth() + 1).padStart(2, '0');
    const newDay = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${newYear}-${newMonth}-${newDay}`);
  };

  // TOUR STEPS CONFIG
  const tourSteps: TourStep[] = [
    {
        targetId: 'tour-stats',
        title: 'Resumo do Dia',
        content: 'Aqui você acompanha o total de atendimentos e faturamento.',
        position: 'bottom'
    },
    {
        targetId: 'tour-actions',
        title: 'Ações Rápidas',
        content: 'Lance cortes, vales ou acesse configurações.',
        position: 'bottom'
    },
    {
        targetId: 'tour-filters',
        title: 'Relatórios',
        content: 'Baixe PDFs ou Planilhas personalizadas por dia ou período.',
        position: 'bottom'
    }
  ];

  if (!userProfile) return <><ToastContainer toasts={toasts} removeToast={removeToast} /><LoginScreen onLogin={handleLogin} /></>;
  if (trialStatus.isExpired) return <><ToastContainer toasts={toasts} removeToast={removeToast} /><PaywallScreen onSubscribe={handleSubscribe} daysUsed={trialStatus.daysUsed} /></>;

  return (
    <div className="min-h-screen bg-transparent pb-24 font-sans selection:bg-gold-500/30">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <TourOverlay steps={tourSteps} isOpen={isTourOpen} onComplete={handleTourComplete} />
      <ReportModal isOpen={isReportModalOpen} onClose={() => setReportModalOpen(false)} onDownload={handleDownloadRange} initialDate={selectedDate} />

      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40 backdrop-blur-md bg-gray-900/90">
         <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
                 <div className="bg-gold-500/10 p-2 rounded-lg">
                    {/* Header Logo Hexagonal */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                        <polyline points="7.5 12 10 14.5 16.5 8"></polyline>
                    </svg>
                 </div>
                 <div>
                    <h1 className="text-white font-bold">{settings.shopName}</h1>
                    <span className="text-[10px] text-gold-500 uppercase font-bold">{isVip ? 'VIP' : 'PRO'}</span>
                 </div>
            </div>
            <button onClick={handleLogout} className="text-gray-500 hover:text-red-400"><LogOut size={20}/></button>
         </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-6 relative z-20">
        
        {viewMode === 'daily' && (
          <div className="animate-slide-in">
             <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                <div id="tour-actions" className="flex gap-2 w-full md:w-auto">
                    <button id="tour-new-client-btn" onClick={handleOpenAddClient} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 text-black px-4 py-2.5 rounded-xl font-bold transition-colors shadow-lg shadow-gold-500/20 active:scale-95">
                        <Plus size={18} /> Novo
                    </button>
                    <button onClick={() => setValeModalOpen(true)} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gray-800 border border-gray-700 text-gray-300 px-4 py-2.5 rounded-xl font-medium transition-colors active:scale-95">
                        <MinusCircle size={18} /> Vale
                    </button>
                    <button id="tour-settings-btn" onClick={() => setSettingsModalOpen(true)} className="bg-gray-800 border border-gray-700 text-gray-300 px-3 py-2.5 rounded-xl font-medium transition-colors shrink-0">
                        <Settings size={18} />
                    </button>
                </div>

                <div id="tour-filters" className="flex gap-2 w-full md:w-auto items-center overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                    <button onClick={() => setViewMode('monthly')} className="bg-gray-800 text-blue-400 px-4 py-2.5 rounded-xl border border-gray-700 shrink-0">
                        <BarChart3 size={18} />
                    </button>
                    <div className="flex items-center bg-gray-900 rounded-xl border border-gray-700 p-0.5 flex-1 justify-between md:flex-none min-w-[140px]">
                        <button onClick={() => changeDate(-1)} className="p-2 text-gray-400 hover:text-white"><ChevronLeft size={20}/></button>
                        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent border-none text-white text-sm text-center w-full md:w-32 focus:ring-0" />
                        <button onClick={() => changeDate(1)} className="p-2 text-gray-400 hover:text-white"><ChevronRight size={20}/></button>
                    </div>
                    {/* Botão Baixar Relatório Diário */}
                    <button 
                        onClick={handleDownloadDaily}
                        className="bg-gray-800 text-white px-4 py-2.5 rounded-xl border border-gray-700 hover:bg-gray-700 transition-colors shrink-0"
                        title="Baixar Relatório do Dia (PDF)"
                    >
                        <FileText size={18} />
                    </button>
                    {/* Botão Baixar Relatório por Período */}
                    <button 
                        onClick={() => setReportModalOpen(true)} 
                        className="bg-gray-800 text-white px-4 py-2.5 rounded-xl border border-gray-700 hover:bg-gray-700 transition-colors shrink-0"
                        title="Exportar Dados (PDF/Excel)"
                    >
                        <Download size={18} />
                    </button>
                </div>
             </div>
             
             {/* New Dashboard Charts */}
             <div className="mb-6">
                <DashboardCharts clients={clients} />
             </div>

             <div id="tour-stats" className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <StatsCard title="Atendimentos" value={stats.totalClients.toString()} icon={<Users size={20} />} />
                <StatsCard title="Faturamento" value={formatCurrency(stats.totalSales)} icon={<DollarSign size={20} />} colorClass="bg-gray-800 border-gray-700 text-green-400" />
                <StatsCard title="Líquido" value={formatCurrency(stats.netCommission)} icon={<TrendingUp size={20} />} colorClass="bg-gray-800 border-gold-500/30 text-gold-500" />
             </div>

             {/* Lists */}
             <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
                <div className="flex border-b border-gray-700 bg-gray-900/50">
                    <button onClick={() => setActiveTab('clients')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'clients' ? 'text-white border-b-2 border-gold-500' : 'text-gray-500'}`}>Clientes</button>
                    <button onClick={() => setActiveTab('vales')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'vales' ? 'text-white border-b-2 border-red-500' : 'text-gray-500'}`}>Vales</button>
                </div>
                
                <div className="min-h-[200px] bg-gray-900/30">
                    {activeTab === 'clients' ? (
                        <div className="overflow-x-auto">
                            {filteredClients.length === 0 ? <p className="text-center py-8 text-gray-500">Sem registros.</p> : (
                                <table className="w-full text-left">
                                    <thead className="text-xs text-gray-400 bg-gray-900/50 uppercase">
                                        <tr>
                                            <th className="p-3 md:p-4">Hora</th>
                                            <th className="p-3 md:p-4">Cliente</th>
                                            <th className="p-3 md:p-4">Serviço</th>
                                            <th className="p-3 md:p-4 text-right">Valor</th>
                                            <th className="p-3 md:p-4 w-20"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700/50">
                                        {filteredClients.map(c => (
                                            <tr key={c.id} className="hover:bg-gray-700/30 group">
                                                <td className="p-3 md:p-4 text-gray-400 font-mono text-xs whitespace-nowrap">{formatTime(c.timestamp)}</td>
                                                <td className="p-3 md:p-4 font-medium text-white min-w-[100px]">
                                                    {c.name}
                                                    <span className={`block text-[10px] ${c.clientType === ClientType.NEW ? 'text-green-400' : 'text-gold-500'}`}>{c.clientType}</span>
                                                </td>
                                                <td className="p-3 md:p-4 text-gray-300 text-sm whitespace-nowrap">
                                                    {c.serviceType}
                                                    {/* Show product names if available */}
                                                    {c.products && c.products.length > 0 && (
                                                        <span className="text-green-400 text-xs block">
                                                            + {c.products.length} Prod.
                                                        </span>
                                                    )}
                                                    {c.extraValue > 0 && <span className="text-xs ml-1 text-gray-500">+{c.extraValue}</span>}
                                                </td>
                                                <td className="p-3 md:p-4 text-right font-bold text-white whitespace-nowrap">{formatCurrency(c.totalValue)}</td>
                                                <td className="p-3 md:p-4 flex justify-end gap-2">
                                                    <button onClick={() => handleEditClient(c)} className="text-blue-400 hover:bg-blue-500/10 p-2 rounded"><Pencil size={16}/></button>
                                                    <button onClick={() => handleDeleteClient(c.id)} className="text-red-400 hover:bg-red-500/10 p-2 rounded"><Trash2 size={16}/></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                           {filteredVales.length === 0 ? <p className="text-center py-8 text-gray-500">Sem vales.</p> : (
                                <table className="w-full text-left">
                                    <thead className="text-xs text-gray-400 bg-gray-900/50 uppercase">
                                        <tr>
                                            <th className="p-3 md:p-4">Hora</th>
                                            <th className="p-3 md:p-4">Descrição</th>
                                            <th className="p-3 md:p-4 text-right">Valor</th>
                                            <th className="p-3 md:p-4 w-16"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700/50">
                                        {filteredVales.map(v => (
                                            <tr key={v.id} className="hover:bg-gray-700/30">
                                                <td className="p-3 md:p-4 text-gray-400 font-mono text-xs whitespace-nowrap">{formatTime(v.timestamp)}</td>
                                                <td className="p-3 md:p-4 text-gray-300 min-w-[120px]">{v.description} <span className="text-gray-500 text-xs">({v.barberName})</span></td>
                                                <td className="p-3 md:p-4 text-right font-bold text-red-400 whitespace-nowrap">-{formatCurrency(v.value)}</td>
                                                <td className="p-3 md:p-4 text-right">
                                                    <button onClick={() => handleDeleteVale(v.id)} className="text-red-400 hover:bg-red-500/10 p-2 rounded"><Trash2 size={16}/></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                           )}
                        </div>
                    )}
                </div>
             </div>
          </div>
        )}

        {viewMode === 'monthly' && (
             <MonthlySummary clients={clients} vales={vales} settings={settings} onBack={() => setViewMode('daily')} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} isPro={userProfile.isPro} onSubscribeClick={() => setSubscriptionModalOpen(true)} />
        )}
      </main>

      <AddClientModal isOpen={isClientModalOpen} onClose={() => setClientModalOpen(false)} settings={settings} onSave={handleSaveClient} initialData={editingClient} />
      <AddValeModal isOpen={isValeModalOpen} onClose={() => setValeModalOpen(false)} onAdd={handleAddVale} settings={settings} />
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setSettingsModalOpen(false)} settings={settings} onSave={setSettings} userProfile={userProfile} onSubscribe={() => setSubscriptionModalOpen(true)} />
      <SubscriptionModal isOpen={isSubscriptionModalOpen} onClose={() => setSubscriptionModalOpen(false)} onSubscribe={handleSubscribe} />
    </div>
  );
};

export default App;
