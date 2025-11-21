
import React, { useState, useEffect, useMemo } from 'react';
import { Client, Vale, AppSettings, DEFAULT_SETTINGS, ServiceType, DailyHistory, ClientType, UserProfile, PlanType } from './types';
import { formatCurrency, formatTime, generateId, generateReportContent, formatDate } from './utils';
import { StatsCard } from './components/StatsCard';
import { AddClientModal } from './components/AddClientModal';
import { AddValeModal } from './components/AddValeModal';
import { SettingsModal } from './components/SettingsModal';
import { LoginScreen } from './components/LoginScreen';
import { PaywallScreen } from './components/PaywallScreen';
import { MonthlySummary } from './components/MonthlySummary';
import { SubscriptionModal } from './components/SubscriptionModal';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';
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
  Filter
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
const CODES_ADMIN = ["LEANDRO", "ADMIN"];

const App: React.FC = () => {
  // -- Handle Splash Screen --
  useEffect(() => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
      // Small delay to ensure smooth visual transition
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
          clientType: c.clientType || ClientType.RETURNING
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
      return { ...DEFAULT_SETTINGS, ...parsed }; // Ensure new fields like barbers exist
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

  // -- Derived State (Trial Logic) --
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

  // Helper para verificar se é o ADMIN ou VIP
  const isAdmin = useMemo(() => userProfile?.planType === 'admin_life', [userProfile]);
  const isVip = useMemo(() => userProfile?.planType === 'vip_monthly' || userProfile?.planType === 'admin_life', [userProfile]);

  // -- Filtering (Only for Daily View) --
  const filteredClients = useMemo(() => {
    const filtered = clients.filter(client => {
      // Date Filter
      if (!client.timestamp) return false;
      const d = new Date(client.timestamp);
      if (isNaN(d.getTime())) return false;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      if (dateString !== selectedDate) return false;

      // Barber Filter
      if (selectedBarberFilter !== 'TODOS' && client.barberName !== selectedBarberFilter) return false;

      return true;
    });
    // Sort by timestamp descending (Newest/Latest first)
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }, [clients, selectedDate, selectedBarberFilter]);

  const filteredVales = useMemo(() => {
    const filtered = vales.filter(vale => {
      // Date Filter
      if (!vale.timestamp) return false;
      const d = new Date(vale.timestamp);
      if (isNaN(d.getTime())) return false;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      if (dateString !== selectedDate) return false;

      // Barber Filter
      if (selectedBarberFilter !== 'TODOS' && vale.barberName !== selectedBarberFilter) return false;

      return true;
    });
    // Sort by timestamp descending
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }, [vales, selectedDate, selectedBarberFilter]);

  // -- Calculations --
  const stats = useMemo(() => {
    const totalSales = filteredClients.reduce((acc, curr) => acc + curr.totalValue, 0);
    const grossCommission = totalSales * (settings.commissionRate / 100);
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

    // Combine selectedDate (YYYY-MM-DD) with timeStr (HH:mm) to get timestamp
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

  const handleDownloadReport = () => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const reportDate = new Date(year, month - 1, day, 12, 0, 0).getTime();
    const content = generateReportContent(reportDate, filteredClients, filteredVales, stats);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Relatorio-Financeiro-${selectedDate}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Relatório baixado!', 'success');
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

  // -- Render Logic --

  if (!userProfile) {
    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <LoginScreen onLogin={handleLogin} />
      </>
    );
  }

  if (trialStatus.isExpired) {
    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <PaywallScreen onSubscribe={handleSubscribe} daysUsed={trialStatus.daysUsed} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pb-24 font-sans selection:bg-gold-500/30">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Modern Horizontal Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40 backdrop-blur-md bg-gray-900/90">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            
            {/* Left: Logo & Brand */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
              <div className="flex items-center gap-3">
                {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="Logo" className="h-10 w-auto object-contain" />
                ) : (
                    <div className="bg-gradient-to-br from-gold-400 to-gold-600 p-2 rounded-lg shadow-lg shadow-gold-500/20">
                         {/* Header Logo Hexagonal */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                            <polyline points="7.5 12 10 14.5 16.5 8"></polyline>
                        </svg>
                    </div>
                )}
                <div>
                    <h1 className="text-xl font-display font-bold text-white leading-tight">
                    {settings.shopName}
                    </h1>
                    {userProfile.isPro ? (
                        <span className="flex items-center gap-1 text-[10px] text-gold-500 font-bold uppercase tracking-wider">
                            {isVip ? <UsersRound size={10} fill="currentColor" /> : <Crown size={10} fill="currentColor" />}
                            {userProfile.planType === 'admin_life' ? 'Admin Vitalício' : (isVip ? 'VIP Multi-Profissional' : 'Assinatura PRO')}
                        </span>
                    ) : (
                        <span className="text-[10px] bg-gray-800 text-gold-500 px-1.5 py-0.5 rounded border border-gold-500/30">
                        Teste: {trialStatus.daysLeft} dias
                        </span>
                    )}
                </div>
              </div>
              
              {/* Mobile CTA (Small) */}
               {!userProfile.isPro && (
                 <button 
                   onClick={() => setSubscriptionModalOpen(true)}
                   className="md:hidden bg-gold-500 text-black text-[10px] font-bold px-2 py-1.5 rounded-lg flex items-center gap-1 animate-pulse"
                 >
                    <Crown size={12} /> ASSINAR
                 </button>
               )}
            </div>

            {/* Right: User Profile & Date */}
            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
              
              {/* Desktop CTA */}
              {!userProfile.isPro && (
                 <button 
                   onClick={() => setSubscriptionModalOpen(true)}
                   className="hidden md:flex items-center gap-2 bg-gradient-to-r from-gold-400 to-gold-600 hover:from-gold-500 hover:to-gold-700 text-black px-4 py-2 rounded-xl font-bold shadow-lg shadow-gold-500/20 transition-all transform hover:scale-105"
                 >
                    <Crown size={18} /> Assinar Agora
                 </button>
              )}

              <div className="flex items-center gap-3 bg-gray-800/50 px-3 py-1.5 rounded-xl border border-gray-700/50">
                <div className="bg-gray-700 rounded-full p-1.5">
                  <User size={16} className="text-gray-300" />
                </div>
                <div className="text-right hidden sm:block">
                   <p className="text-xs text-gray-400">Olá,</p>
                   <p className="text-sm font-semibold text-white leading-none">{userProfile.ownerName}</p>
                </div>
                <button onClick={handleLogout} className="ml-2 text-gray-500 hover:text-red-400 transition-colors">
                    <LogOut size={16} />
                </button>
              </div>
            </div>

          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-6 relative z-20">
        
        {/* Toolbar (Conditional based on View Mode) */}
        {viewMode === 'daily' && (
          <div className="flex flex-col gap-4 mb-6 animate-slide-in">
            
            {/* Top Row Controls */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex gap-2 flex-wrap w-full lg:w-auto">
                    <button 
                        onClick={handleOpenAddClient}
                        className="hidden md:flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-black px-4 py-2.5 rounded-xl font-bold transition-colors shadow-lg shadow-gold-500/20 active:scale-95"
                    >
                        <Plus size={18} /> <span className="hidden sm:inline">Novo</span> Atendimento
                    </button>
                    <button 
                        onClick={() => setValeModalOpen(true)}
                        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-750 border border-gray-700 text-gray-300 px-4 py-2.5 rounded-xl font-medium transition-colors active:scale-95"
                    >
                        <MinusCircle size={18} /> <span className="hidden xs:inline">Vale</span>
                    </button>
                    <button 
                        onClick={() => setSettingsModalOpen(true)}
                        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-750 border border-gray-700 text-gray-300 px-3 py-2.5 rounded-xl font-medium transition-colors"
                        title="Configurações"
                    >
                        <Settings size={18} />
                    </button>

                    {/* Barber Filter (VIP Only) */}
                    {(isVip && settings.barbers && settings.barbers.length > 0) && (
                        <div className="flex items-center bg-gray-800 rounded-xl border border-gray-700 px-3 relative">
                            <Filter size={16} className="text-gray-400 mr-2" />
                            <select
                                value={selectedBarberFilter}
                                onChange={(e) => setSelectedBarberFilter(e.target.value)}
                                className="bg-transparent text-white text-sm py-2.5 outline-none appearance-none pr-6"
                            >
                                <option value="TODOS">Todos da Equipe</option>
                                {settings.barbers.map(b => (
                                    <option key={b} value={b}>{b}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-3 w-full lg:w-auto lg:justify-end items-center">
                    <button 
                        onClick={() => setViewMode('monthly')}
                        className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-750 border border-gray-700 text-blue-400 px-4 py-2.5 rounded-xl font-medium transition-colors"
                        title="Ver Resumo Mensal"
                    >
                        <BarChart3 size={18} /> <span className="hidden sm:inline">Mensal</span>
                    </button>

                    {/* Date Navigation */}
                    <div className="flex items-center bg-gray-900 rounded-xl border border-gray-700 p-0.5">
                        <button 
                            onClick={() => changeDate(-1)}
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <input 
                            type="date" 
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent border-none text-white text-sm font-medium focus:ring-0 text-center w-32 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                        />
                        <button 
                            onClick={() => changeDate(1)}
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                    
                    <button 
                        onClick={handleDownloadReport}
                        className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-750 text-white px-4 py-2.5 rounded-xl border border-gray-700 font-medium transition-colors"
                        title="Baixar Relatório do Dia"
                    >
                        <Download size={18} />
                    </button>
                </div>
            </div>
          </div>
        )}

        {viewMode === 'monthly' ? (
          <MonthlySummary 
            clients={clients}
            vales={vales}
            settings={settings}
            onBack={() => setViewMode('daily')}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            isPro={userProfile.isPro}
            onSubscribeClick={() => setSubscriptionModalOpen(true)}
          />
        ) : (
          /* Standard Daily View */
          <div className="animate-slide-in space-y-6">
            {/* Dashboard Stats - Modern Layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatsCard 
                title={selectedBarberFilter === 'TODOS' ? "Atendimentos (Total)" : `Atendimentos (${selectedBarberFilter})`}
                value={stats.totalClients.toString()} 
                icon={<Users size={20} />} 
                colorClass="bg-gradient-to-br from-gray-800 to-gray-800/50 border-gray-700"
              />
              <StatsCard 
                title={selectedBarberFilter === 'TODOS' ? "Faturamento Loja" : `Vendas de ${selectedBarberFilter}`}
                value={formatCurrency(stats.totalSales)} 
                icon={<DollarSign size={20} />} 
                colorClass="bg-gradient-to-br from-gray-800 to-gray-800/50 border-gray-700 text-green-400"
              />
              <StatsCard 
                title={selectedBarberFilter === 'TODOS' ? "Comissão Total" : `A Pagar para ${selectedBarberFilter}`}
                value={formatCurrency(stats.netCommission)} 
                subtitle={`- ${formatCurrency(stats.totalVales)} em vales`}
                icon={<TrendingUp size={20} />} 
                colorClass="bg-gradient-to-br from-gray-800 to-gray-800/50 border-gold-500/30 text-gold-500 relative overflow-hidden"
              />
            </div>

            {/* List Section */}
            <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-xl">
              {/* Tabs */}
              <div className="flex border-b border-gray-700 bg-gray-900/50">
                <button
                  onClick={() => setActiveTab('clients')}
                  className={`flex-1 py-4 text-sm md:text-base font-semibold transition-all relative ${
                    activeTab === 'clients' 
                      ? 'text-white' 
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Clientes
                  {activeTab === 'clients' && (
                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gold-500 shadow-[0_-2px_10px_rgba(245,158,11,0.5)]"></div>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('vales')}
                  className={`flex-1 py-4 text-sm md:text-base font-semibold transition-all relative ${
                    activeTab === 'vales' 
                      ? 'text-white' 
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Vales
                  {activeTab === 'vales' && (
                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-500 shadow-[0_-2px_10px_rgba(239,68,68,0.5)]"></div>
                  )}
                </button>
              </div>

              {/* Content Area */}
              <div className="min-h-[300px] bg-gray-900/30">
                {activeTab === 'clients' ? (
                  <div className="overflow-x-auto">
                    {filteredClients.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <div className="bg-gray-800/50 p-6 rounded-full mb-4 border border-gray-700">
                             <Scissors size={48} className="text-gray-600" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-400">Nenhum atendimento encontrado</h3>
                        <p className="text-sm text-gray-600">
                            {selectedBarberFilter !== 'TODOS' ? `Nenhum registro para ${selectedBarberFilter}` : 'Clique no botão + para iniciar'}
                        </p>
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-900/50 text-gray-400 text-xs uppercase tracking-wider">
                            <th className="p-4 font-medium rounded-tl-lg">Hora</th>
                            <th className="p-4 font-medium">Cliente</th>
                            <th className="p-4 font-medium hidden md:table-cell">Tipo</th>
                            <th className="p-4 font-medium hidden md:table-cell">Profissional</th>
                            <th className="p-4 font-medium">Serviço</th>
                            <th className="p-4 font-medium text-right">Valor</th>
                            <th className="p-4 font-medium w-24 rounded-tr-lg"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                          {filteredClients.map((client) => (
                            <tr 
                              key={client.id} 
                              className="hover:bg-gray-700/30 transition-colors group"
                            >
                              <td className="p-4 text-gray-400 font-mono text-sm">{formatTime(client.timestamp)}</td>
                              <td className="p-4 font-medium text-white">
                                {client.name}
                                {/* Mobile only Type */}
                                <div className="md:hidden mt-1">
                                  <span className={`text-[10px] font-bold uppercase tracking-wide
                                        ${client.clientType === ClientType.NEW ? 'text-green-400' : 'text-gold-500'}
                                    `}>
                                        {client.clientType === ClientType.NEW ? 'Novo' : 'Casa'}
                                    </span>
                                </div>
                              </td>
                              <td className="p-4 hidden md:table-cell">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border
                                    ${client.clientType === ClientType.NEW 
                                        ? 'bg-green-900/20 text-green-400 border-green-500/30' 
                                        : 'bg-gold-500/10 text-gold-500 border-gold-500/20'}
                                `}>
                                    {client.clientType}
                                </span>
                              </td>
                              <td className="p-4 text-gray-300 hidden md:table-cell">{client.barberName}</td>
                              <td className="p-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                                  ${client.serviceType === ServiceType.CUT ? 'bg-blue-900/20 text-blue-400 border-blue-800/50' : ''}
                                  ${client.serviceType === ServiceType.COMBO ? 'bg-purple-900/20 text-purple-400 border-purple-800/50' : ''}
                                  ${client.serviceType === ServiceType.OTHER ? 'bg-gray-700/50 text-gray-300 border-gray-600/50' : ''}
                                `}>
                                  {client.serviceType}
                                </span>
                                {client.extraValue > 0 && (
                                    <span className="ml-2 text-xs text-gray-500 block sm:inline mt-1 sm:mt-0">+ R$ {client.extraValue}</span>
                                )}
                              </td>
                              <td className="p-4 text-right font-bold text-white">{formatCurrency(client.totalValue)}</td>
                              <td className="p-4 text-right">
                                <div className="flex gap-1 justify-end opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                      onClick={() => handleEditClient(client)}
                                      className="p-2 text-gray-400 hover:text-gold-500 hover:bg-gold-500/10 rounded-lg transition-colors"
                                    >
                                      <Pencil size={16} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteClient(client.id)}
                                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ) : (
                  // Vales Tab
                  <div className="overflow-x-auto">
                    {filteredVales.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <div className="bg-gray-800/50 p-6 rounded-full mb-4 border border-gray-700">
                            <MinusCircle size={48} className="text-gray-600" />
                        </div>
                        <p className="text-sm">Nenhum vale encontrado.</p>
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-900/50 text-gray-400 text-xs uppercase tracking-wider">
                            <th className="p-4 font-medium rounded-tl-lg">Hora</th>
                            <th className="p-4 font-medium">Profissional</th>
                            <th className="p-4 font-medium">Descrição</th>
                            <th className="p-4 font-medium text-right">Valor</th>
                            <th className="p-4 font-medium w-16 rounded-tr-lg"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                          {filteredVales.map((vale) => (
                            <tr 
                              key={vale.id} 
                              className="hover:bg-gray-700/30 transition-colors group"
                            >
                              <td className="p-4 text-gray-400 font-mono text-sm">{formatTime(vale.timestamp)}</td>
                              <td className="p-4 font-medium text-white">{vale.barberName}</td>
                              <td className="p-4 text-gray-300">{vale.description}</td>
                              <td className="p-4 text-right font-bold text-red-400">- {formatCurrency(vale.value)}</td>
                              <td className="p-4 text-right">
                                <button 
                                  onClick={() => handleDeleteVale(vale.id)}
                                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100"
                                >
                                  <Trash2 size={16} />
                                </button>
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

        {/* Floating Action Button (FAB) - Mobile Only */}
        {viewMode === 'daily' && (
            <button
                onClick={handleOpenAddClient}
                className="md:hidden fixed bottom-6 right-6 z-50 bg-gold-500 hover:bg-gold-600 text-black p-4 rounded-full shadow-2xl shadow-gold-500/40 transition-transform hover:scale-110 active:scale-95 flex items-center justify-center"
                title="Novo Atendimento"
            >
                <Plus size={28} strokeWidth={2.5} />
            </button>
        )}

      </main>

      {/* Footer Credit */}
      <footer className="text-center text-gray-600 text-xs py-8 mt-8">
         <p>Gestão Máxima &copy; {new Date().getFullYear()}</p>
         {userProfile.isPro && (
           <span className="text-gold-500/50 text-[10px] mt-1 block">
             {isAdmin ? 'Licença ADMIN' : (isVip ? 'Assinatura VIP Multi' : 'Assinatura PRO Standard')}
           </span>
         )}
      </footer>

      {/* Modals */}
      <AddClientModal 
        isOpen={isClientModalOpen} 
        onClose={() => setClientModalOpen(false)} 
        settings={settings}
        onSave={handleSaveClient}
        initialData={editingClient}
      />

      <AddValeModal 
        isOpen={isValeModalOpen}
        onClose={() => setValeModalOpen(false)}
        onAdd={handleAddVale}
        settings={settings}
      />

      <SettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        settings={settings}
        onSave={setSettings}
        userProfile={userProfile}
        onSubscribe={() => setSubscriptionModalOpen(true)}
      />

      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        onSubscribe={handleSubscribe}
      />
    </div>
  );
};

export default App;