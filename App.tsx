import React, { useState, useEffect, useMemo } from 'react';
import { Client, Vale, AppSettings, DEFAULT_SETTINGS, ServiceType, DailyHistory, ClientType } from './types';
import { formatCurrency, formatTime, generateId, generateReportContent, formatDate } from './utils';
import { StatsCard } from './components/StatsCard';
import { AddClientModal } from './components/AddClientModal';
import { AddValeModal } from './components/AddValeModal';
import { SettingsModal } from './components/SettingsModal';
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
  Calendar
} from 'lucide-react';

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const App: React.FC = () => {
  // -- State --
  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem('barbearia_clients');
    const parsed = saved ? JSON.parse(saved) : [];
    // Backward compatibility migration: ensure clientType exists
    return parsed.map((c: any) => ({
        ...c,
        clientType: c.clientType || ClientType.RETURNING
    }));
  });

  const [vales, setVales] = useState<Vale[]>(() => {
    const saved = localStorage.getItem('barbearia_vales');
    return saved ? JSON.parse(saved) : [];
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('barbearia_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  // History Storage (kept for potential future use)
  const [history, setHistory] = useState<DailyHistory[]>(() => {
    const saved = localStorage.getItem('barbearia_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeTab, setActiveTab] = useState<'clients' | 'vales'>('clients');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  
  // Modals State
  const [isClientModalOpen, setClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isValeModalOpen, setValeModalOpen] = useState(false);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);

  // -- Effects --
  useEffect(() => {
    localStorage.setItem('barbearia_clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('barbearia_vales', JSON.stringify(vales));
  }, [vales]);

  useEffect(() => {
    localStorage.setItem('barbearia_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('barbearia_history', JSON.stringify(history));
  }, [history]);

  // -- Filtering --
  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const d = new Date(client.timestamp);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      return dateString === selectedDate;
    });
  }, [clients, selectedDate]);

  const filteredVales = useMemo(() => {
    return vales.filter(vale => {
      const d = new Date(vale.timestamp);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      return dateString === selectedDate;
    });
  }, [vales, selectedDate]);

  // -- Calculations --
  const stats = useMemo(() => {
    const totalSales = filteredClients.reduce((acc, curr) => acc + curr.totalValue, 0);
    
    // Commission is typically calculated on total sales
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
  const handleSaveClient = (data: Omit<Client, 'id' | 'timestamp'>) => {
    if (editingClient) {
      // Update existing
      setClients(prev => prev.map(c => 
        c.id === editingClient.id 
          ? { ...c, ...data } 
          : c
      ));
      setEditingClient(null);
    } else {
      // Add new (use selected date + current time for timestamp if adding for today, otherwise strictly now)
      // Note: Logic currently assumes adding happens "now". 
      // If user selects a past date, we might want to respect that, but typically you log as you go.
      // For simplicity, we'll stick to Date.now(), but this means if you add a client while viewing yesterday,
      // it will appear in TODAY's list, not yesterday's view.
      // To fix this UX, we can construct the timestamp from selectedDate + current time.
      
      let timestamp = Date.now();
      const todayStr = getTodayString();
      
      if (selectedDate !== todayStr) {
         // Create timestamp for selected date at current time
         const [year, month, day] = selectedDate.split('-').map(Number);
         const now = new Date();
         const d = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
         timestamp = d.getTime();
      }

      const newClient: Client = {
        ...data,
        id: generateId(),
        timestamp: timestamp,
      };
      setClients(prev => [newClient, ...prev]);
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

    const newVale: Vale = {
      ...data,
      id: generateId(),
      timestamp: timestamp,
    };
    setVales(prev => [newVale, ...prev]);
  };

  const handleDeleteClient = (id: string) => {
    if(window.confirm('Tem certeza que deseja excluir este cliente?')) {
      setClients(prev => prev.filter(c => c.id !== id));
    }
  };

  const handleDeleteVale = (id: string) => {
    if(window.confirm('Tem certeza que deseja excluir este vale?')) {
      setVales(prev => prev.filter(v => v.id !== id));
    }
  };

  const handleDownloadReport = () => {
    // Create a timestamp noon of selected date to ensure correct date display in report
    const [year, month, day] = selectedDate.split('-').map(Number);
    const reportDate = new Date(year, month - 1, day, 12, 0, 0).getTime();

    const content = generateReportContent(reportDate, filteredClients, filteredVales, stats);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Relatorio-Barbearia-${selectedDate}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenAddClient = () => {
    setEditingClient(null);
    setClientModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-900 pb-20">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 pt-8 pb-12 px-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold-500 to-transparent opacity-50"></div>
        <div className="max-w-5xl mx-auto text-center relative z-10">
            <div className="flex items-center justify-center mb-4">
                {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="Logo" className="h-16 w-auto object-contain animate-slide-in" />
                ) : (
                    <div className="bg-gold-500 p-3 rounded-full shadow-lg shadow-gold-500/30 animate-slide-in">
                        <Scissors className="text-gray-900 w-8 h-8" />
                    </div>
                )}
            </div>
          <h1 className="text-4xl font-display font-bold text-gold-500 mb-2 tracking-tight animate-slide-in" style={{ animationDelay: '0.1s' }}>
            {settings.shopName}
          </h1>
          <p className="text-gray-400 font-sans font-light animate-slide-in" style={{ animationDelay: '0.2s' }}>Gestão Profissional de Clientes e Comissões</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 -mt-8 relative z-20">
        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animate-slide-in" style={{ animationDelay: '0.3s' }}>
          <StatsCard 
            title="Clientes" 
            value={stats.totalClients.toString()} 
            icon={<Users size={24} />} 
            colorClass="bg-gray-800 border-gray-700"
          />
          <StatsCard 
            title="Total Vendas" 
            value={formatCurrency(stats.totalSales)} 
            icon={<DollarSign size={24} />} 
            colorClass="bg-gray-800 border-gray-700 text-green-400"
          />
          <StatsCard 
            title="Comissão Líquida" 
            value={formatCurrency(stats.netCommission)} 
            subtitle={`(Total - Vales: ${formatCurrency(stats.totalVales)})`}
            icon={<TrendingUp size={24} />} 
            colorClass="bg-gray-800 border-gray-700 text-gold-500"
          />
        </div>

        {/* Actions Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 mb-8 justify-between items-start md:items-center bg-gray-800/50 p-3 rounded-xl border border-gray-700/50 backdrop-blur-sm animate-slide-in" style={{ animationDelay: '0.4s' }}>
          
          <div className="flex gap-3 flex-wrap w-full md:w-auto">
            <button 
              onClick={handleOpenAddClient}
              className="flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-black px-5 py-2.5 rounded-lg font-bold transition-colors shadow-lg shadow-gold-500/20"
            >
              <Plus size={18} /> <span className="hidden sm:inline">Adicionar</span> Cliente
            </button>
            <button 
              onClick={() => setValeModalOpen(true)}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 px-5 py-2.5 rounded-lg font-medium transition-colors"
            >
              <MinusCircle size={18} /> <span className="hidden sm:inline">Vale</span>
            </button>
             <button 
              onClick={() => setSettingsModalOpen(true)}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 px-3 py-2.5 rounded-lg font-medium transition-colors"
              title="Configurações"
            >
              <Settings size={18} />
            </button>
          </div>

          <div className="flex gap-3 flex-wrap w-full md:w-auto justify-end">
             <div className="relative flex items-center">
                <div className="absolute left-3 text-gray-400 pointer-events-none">
                    <Calendar size={16} />
                </div>
                <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-gold-500 focus:border-gold-500 block w-full pl-10 p-2.5 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                />
            </div>
            
            <button 
              onClick={handleDownloadReport}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
              title="Baixar Relatório em Texto"
            >
              <Download size={18} /> <span className="hidden sm:inline">Relatório</span>
            </button>
          </div>
        </div>

        {/* List Section */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-xl animate-slide-in" style={{ animationDelay: '0.5s' }}>
          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab('clients')}
              className={`flex-1 py-4 text-center font-semibold transition-colors relative ${
                activeTab === 'clients' 
                  ? 'text-gold-500 bg-gray-800' 
                  : 'text-gray-500 bg-gray-900 hover:bg-gray-800 hover:text-gray-300'
              }`}
            >
              Clientes Atendidos
              {activeTab === 'clients' && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gold-500"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('vales')}
              className={`flex-1 py-4 text-center font-semibold transition-colors relative ${
                activeTab === 'vales' 
                  ? 'text-red-400 bg-gray-800' 
                  : 'text-gray-500 bg-gray-900 hover:bg-gray-800 hover:text-gray-300'
              }`}
            >
              Vales e Retiradas
              {activeTab === 'vales' && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-500"></div>
              )}
            </button>
          </div>

          {/* Content Area */}
          <div className="min-h-[300px]">
            {activeTab === 'clients' ? (
              <div className="overflow-x-auto">
                {filteredClients.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                    <Users size={48} className="mb-4 opacity-20" />
                    <p>Nenhum atendimento registrado em {selectedDate.split('-').reverse().join('/')}.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-900/50 text-gray-400 text-xs uppercase tracking-wider">
                        <th className="p-4 font-medium">Hora</th>
                        <th className="p-4 font-medium">Cliente</th>
                        <th className="p-4 font-medium">Tipo</th>
                        <th className="p-4 font-medium">Barbeiro</th>
                        <th className="p-4 font-medium">Serviço</th>
                        <th className="p-4 font-medium text-right">Valor</th>
                        <th className="p-4 font-medium w-24"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {filteredClients.map((client, index) => (
                        <tr 
                          key={client.id} 
                          className="hover:bg-gray-700/50 transition-colors group animate-slide-in"
                          style={{ animationDelay: `${index * 0.05}s` }}
                        >
                          <td className="p-4 text-gray-400 font-mono text-sm">{formatTime(client.timestamp)}</td>
                          <td className="p-4 font-medium text-white">{client.name}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border
                                ${client.clientType === ClientType.NEW 
                                    ? 'bg-green-900/20 text-green-400 border-green-500/30' 
                                    : 'bg-gold-500/10 text-gold-500 border-gold-500/20'}
                            `}>
                                {client.clientType}
                            </span>
                          </td>
                          <td className="p-4 text-gray-300">{client.barberName}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                              ${client.serviceType === ServiceType.CUT ? 'bg-blue-900/50 text-blue-400 border border-blue-800' : ''}
                              ${client.serviceType === ServiceType.COMBO ? 'bg-purple-900/50 text-purple-400 border border-purple-800' : ''}
                              ${client.serviceType === ServiceType.OTHER ? 'bg-gray-700 text-gray-300 border border-gray-600' : ''}
                            `}>
                              {client.serviceType}
                            </span>
                            {client.extraValue > 0 && (
                                <span className="ml-2 text-xs text-gray-500">+ R$ {client.extraValue}</span>
                            )}
                          </td>
                          <td className="p-4 text-right font-bold text-white">{formatCurrency(client.totalValue)}</td>
                          <td className="p-4 text-right">
                             <div className="flex gap-1 justify-end">
                                <button 
                                  onClick={() => handleEditClient(client)}
                                  className="p-2 text-gray-400 hover:text-gold-500 hover:bg-gold-500/10 rounded-lg transition-colors"
                                  title="Editar Atendimento"
                                >
                                  <Pencil size={18} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteClient(client.id)}
                                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                  title="Excluir Atendimento"
                                >
                                  <Trash2 size={18} />
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
                    <MinusCircle size={48} className="mb-4 opacity-20" />
                    <p>Nenhum vale registrado em {selectedDate.split('-').reverse().join('/')}.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-900/50 text-gray-400 text-xs uppercase tracking-wider">
                        <th className="p-4 font-medium">Hora</th>
                        <th className="p-4 font-medium">Barbeiro</th>
                        <th className="p-4 font-medium">Descrição</th>
                        <th className="p-4 font-medium text-right">Valor</th>
                        <th className="p-4 font-medium w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {filteredVales.map((vale, index) => (
                        <tr 
                          key={vale.id} 
                          className="hover:bg-gray-700/50 transition-colors group animate-slide-in"
                          style={{ animationDelay: `${index * 0.05}s` }}
                        >
                          <td className="p-4 text-gray-400 font-mono text-sm">{formatTime(vale.timestamp)}</td>
                          <td className="p-4 font-medium text-white">{vale.barberName}</td>
                          <td className="p-4 text-gray-300">{vale.description}</td>
                          <td className="p-4 text-right font-bold text-red-400">- {formatCurrency(vale.value)}</td>
                          <td className="p-4 text-right">
                            <button 
                              onClick={() => handleDeleteVale(vale.id)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Excluir Vale"
                            >
                              <Trash2 size={18} />
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
      </main>

      {/* Footer Credit */}
      <footer className="text-center text-gray-600 text-sm py-8 mt-8">
         <p>Barbearia Pro System &copy; {new Date().getFullYear()}</p>
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
      />

      <SettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        settings={settings}
        onSave={setSettings}
      />
    </div>
  );
};

export default App;