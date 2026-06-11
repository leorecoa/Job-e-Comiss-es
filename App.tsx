
import React, { useState, useEffect, useMemo } from 'react';
import { Client, ClientFormData, Vale, ValeFormData, AppSettings, DEFAULT_SETTINGS, ServiceType, DailyHistory, ClientType, UserProfile, PlanType, Appointment, AppointmentStatus, BarberOption, Service } from './types';
import { formatCurrency, formatTime, generateId, generateAndDownloadCSV, calculateClientCommission, getLocalDayBounds, parseLocalDateInput, getBarberNameById } from './utils';
import { getBarbershopBySlug } from './services/barbershopRepository';
import { APPOINTMENT_STORAGE_KEY, completeAppointmentFinancialRecord, getAppointmentDateInput, hasAppointmentConflict } from './scheduling';
import { StatsCard } from './components/StatsCard';
import { AddClientModal } from './components/AddClientModal';
import { AddValeModal } from './components/AddValeModal';
import { SettingsModal } from './components/SettingsModal';
import { AppointmentModal } from './components/AppointmentModal';
import { DailySchedule } from './components/DailySchedule';
import { PublicBookingPage } from './components/PublicBookingPage';
import { AuthScreen } from './components/AuthScreen';
import { LoginScreen } from './components/LoginScreen';
import { PaywallScreen } from './components/PaywallScreen';
import { MonthlySummary } from './components/MonthlySummary';
import { SubscriptionModal } from './components/SubscriptionModal';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';
import { TourOverlay, TourStep } from './components/TourOverlay';
import { ReportModal } from './components/ReportModal';
import { DashboardCharts } from './components/DashboardCharts';
import { isSupabaseConfigured } from './lib/supabase';
import { BarberDashboard } from './components/BarberDashboard';
import { createAppointment as createAppointmentRecord, listInternalAppointments, listPublicAppointmentSlots, updateAppointment as updateAppointmentRecord } from './services/appointmentRepository';
import { listBarbers } from './services/barberRepository';
import { listServices } from './services/serviceRepository';
import { AppRole, AuthSession, canAccessInternalPanel, getCurrentAuthSession, signInWithPassword, signOut as signOutAuth, signUpWithPassword } from './services/authRepository';
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
  FileText,
  Clock,
  Tag
} from 'lucide-react';

const normalizeSettings = (settings: Partial<AppSettings> | null | undefined): AppSettings => {
  const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  const services = Array.isArray(settings?.services) && settings.services.length > 0
    ? settings.services.map((service: Service) => ({ ...service, price: Number(service.price) || 0, durationMinutes: Number(service.durationMinutes) || 30 }))
    : DEFAULT_SETTINGS.services;

  return {
    ...merged,
    services: services.map((service: Service) => ({ // Explicitly type service here
      ...service,
      durationMinutes: Math.max(1, Number(service.durationMinutes) || 30),
      price: Math.max(0, Number(service.price) || 0)
    }))
  };
};

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
const DEFAULT_PUBLIC_BARBERSHOP_SLUG = 'gestao-maxima';

export const getPublicBookingSlugFromPath = (pathname: string): string | undefined => {
  if (pathname === '/book' || pathname === '/agendar') return undefined;

  if (pathname.startsWith('/book/')) {
    const slug = pathname.replace('/book/', '').split('/')[0]?.trim();
    return slug || undefined;
  }

  return undefined;
};

const CODES_PRO = ["MENSAL", "PRO", "LIBERADO"];
const CODES_VIP = ["VIP", "EQUIPE", "TIME", "VIP4"];
const CODES_ADMIN: string[] = [];

const App: React.FC = () => {
  const publicBookingSlug = getPublicBookingSlugFromPath(window.location.pathname);
  const isPublicBookingRoute = window.location.pathname === '/book' || window.location.pathname === '/agendar' || window.location.pathname.startsWith('/book/');

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
          commissionValue: c.commissionValue // Keep existing or undefined
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

  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    try {
      const saved = localStorage.getItem(APPOINTMENT_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Error loading appointments", e);
      return [];
    }
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('barbearia_settings');
      const parsed = saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
      return normalizeSettings(parsed); 
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  });

  // -- View State --
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const [activeTab, setActiveTab] = useState<'appointments' | 'clients' | 'vales'>('appointments');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthString());
  const [selectedBarberFilter, setSelectedBarberFilter] = useState<string>('TODOS');
  const [selectedScheduleBarber, setSelectedScheduleBarber] = useState<string>('');
  
  // Modals State
  const [isClientModalOpen, setClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isValeModalOpen, setValeModalOpen] = useState(false);
  const [isAppointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [isReportModalOpen, setReportModalOpen] = useState(false);
  const [isAppointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [isAuthLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [authError, setAuthError] = useState<string | null>(null);

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
    let active = true;

    const loadAuthSession = async () => {
      if (!isSupabaseConfigured) {
        setAuthLoading(false);
        return;
      }

      setAuthLoading(true);
      try {
        const session = await getCurrentAuthSession();
        if (!active) return;
        setAuthSession(session);
        if (session) {
          setUserProfile(prev => ({
            ownerName: session.displayName,
            shopName: prev?.shopName || settings.shopName || 'Gestao Maxima',
            email: session.email,
            startDate: prev?.startDate || Date.now(),
            isPro: true,
            planType: session.role === 'owner' ? 'admin_life' : 'vip_monthly'
          }));
        }
      } catch (error) {
        if (!active) return;
        console.error(error);
        setAuthError('Nao foi possivel validar sua sessao.');
      } finally {
        if (active) setAuthLoading(false);
      }
    };

    loadAuthSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('barbearia_clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('barbearia_vales', JSON.stringify(vales));
  }, [vales]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      localStorage.setItem(APPOINTMENT_STORAGE_KEY, JSON.stringify(appointments));
    }
  }, [appointments]);

  useEffect(() => {
    localStorage.setItem('barbearia_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    let active = true;

    const loadRemoteData = async () => {
      if (!isSupabaseConfigured) return;
      if (!isPublicBookingRoute && (isAuthLoading || !canAccessInternalPanel(authSession, true))) return;

      setAppointmentsLoading(true);
      setAppointmentsError(null);
      try {
        // Determine barbershopId for filtering remote data
        let currentBarbershopId: string | undefined;
        if (isPublicBookingRoute) {
          const publicBarbershop = await getBarbershopBySlug(publicBookingSlug ?? DEFAULT_PUBLIC_BARBERSHOP_SLUG);
          if (!publicBarbershop) {
            if (!active) return;
            setAppointments([]);
            setSettings(prev => normalizeSettings({
              ...prev,
              barbers: [],
              services: []
            }));
            return;
          }
          currentBarbershopId = publicBarbershop?.id;
        } else if (authSession?.barbershopId) { // For internal dashboards
          currentBarbershopId = authSession.barbershopId;
        }

        const [remoteAppointments, remoteBarbers, remoteServices] = await Promise.all([ //
          isPublicBookingRoute ? listPublicAppointmentSlots(currentBarbershopId) : listInternalAppointments(currentBarbershopId, authSession?.barberId),
          listBarbers(currentBarbershopId),
          listServices(currentBarbershopId)
        ]);

        if (!active) return;
        setAppointments(remoteAppointments);
        setSettings(prev => normalizeSettings({
          ...prev,
          barbers: remoteBarbers.length > 0 ? remoteBarbers : prev.barbers,
          services: remoteServices.length > 0 ? remoteServices : prev.services
        }));
      } catch (error) {
        if (!active) return;
        console.error(error);
        setAppointmentsError('Erro ao carregar dados online. Verifique o Supabase.');
      } finally {
        if (active) setAppointmentsLoading(false);
      }
    };

    loadRemoteData();
    return () => {
      active = false;
    };
  }, [authSession, isAuthLoading, isPublicBookingRoute, publicBookingSlug]);

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
    if (!userProfile) return { isExpired: false, daysLeft: 7, daysUsed: 0, expirationDate: Date.now() + (7 * 24 * 60 * 60 * 1000) };
    if (userProfile.isPro) return { isExpired: false, daysLeft: 999, daysUsed: 0, expirationDate: Date.now() + (3650 * 24 * 60 * 60 * 1000) }; // 10 years

    const now = Date.now();
    const start = userProfile.startDate;
    const diffTime = now - start;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    // Calculate exact expiration date
    const expirationDate = start + (TRIAL_DAYS * 24 * 60 * 60 * 1000);

    return {
      isExpired: diffDays > TRIAL_DAYS || diffDays < 0,
      daysLeft: Math.max(0, Math.ceil(TRIAL_DAYS - diffDays)),
      // Ensure daysUsed is not negative if startDate is in the future (e.g., due to clock sync issues)
      daysUsed: Math.max(0, Math.floor(diffDays)),

      expirationDate
    };
  }, [userProfile]);

  const isAdmin = useMemo(() => userProfile?.planType === 'admin_life', [userProfile]);
  const isVip = useMemo(() => userProfile?.planType === 'vip_monthly' || userProfile?.planType === 'admin_life', [userProfile]);
  const planBadgeLabel = useMemo(() => {
    if (isAdmin) return 'ADMIN';
    if (isVip) return 'VIP';
    if (userProfile?.isPro) return 'PRO';
    return 'TRIAL ' + trialStatus.daysLeft + 'D';
  }, [isAdmin, isVip, userProfile, trialStatus.daysLeft]);

  const barberFilterOptions = useMemo(() => {
    const names = new Set<string>();
    (settings.barbers || []).forEach(barber => { // settings.barbers is now BarberOption[]
      if (barber.name?.trim()) names.add(barber.name.trim());
    });

    clients.forEach(client => {
      if (client.barberName?.trim()) names.add(client.barberName.trim());
    });
    vales.forEach(vale => {
      if (vale.barberName?.trim()) names.add(vale.barberName.trim());
    });
    return ['TODOS', ...Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  }, [settings.barbers, clients, vales]);

  const scheduleBarberOptions = useMemo(() => {
    const names = new Set<string>();
    // Extract names from BarberOption[]
    (settings.barbers || []).forEach(barber => {
      if (barber.name?.trim()) names.add(barber.name.trim());
    });
    appointments.forEach(appointment => {
      if (appointment.barberName?.trim()) names.add(appointment.barberName.trim());
    });
    clients.forEach(client => {
      if (client.barberName?.trim()) names.add(client.barberName.trim());
    });
    if (userProfile?.ownerName?.trim()) names.add(userProfile.ownerName.trim()); // Add owner name if it's not already there
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [settings.barbers, appointments, clients, userProfile?.ownerName]);

  const chartClients = useMemo(() => {
    if (selectedBarberFilter === 'TODOS') return clients;
    return clients.filter(client => client.barberName === selectedBarberFilter);
  }, [clients, selectedBarberFilter]);

  useEffect(() => {
    if (selectedBarberFilter !== 'TODOS' && !barberFilterOptions.includes(selectedBarberFilter)) {
      setSelectedBarberFilter('TODOS');
    }
  }, [selectedBarberFilter, barberFilterOptions]);

  useEffect(() => {
    if (scheduleBarberOptions.length === 0) return;
    if (!selectedScheduleBarber || !scheduleBarberOptions.includes(selectedScheduleBarber)) {
      setSelectedScheduleBarber(scheduleBarberOptions[0]); // Set to the first barber name
    }
  }, [selectedScheduleBarber, scheduleBarberOptions]);

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

  const filteredAppointments = useMemo(() => {
    return appointments.filter(appointment => {
      if (!selectedScheduleBarber || appointment.barberName !== selectedScheduleBarber) return false;
      return getAppointmentDateInput(appointment) === selectedDate;
    });
  }, [appointments, selectedDate, selectedScheduleBarber]);

  // -- Calculations --
  const stats = useMemo(() => {
    const totalSales = filteredClients.reduce((acc, curr) => acc + curr.totalValue, 0);
    
    // Calculate Commission strictly using centralized logic
    const grossCommission = filteredClients.reduce((acc, curr) => {
        return acc + calculateClientCommission(curr, settings.commissionRate);
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
    setUserProfile(prev => ({
      ...prev,
      ...profile
    }));
    setSettings(prev => ({ ...prev, shopName: profile.shopName }));
    addToast(`Bem-vindo, ${profile.ownerName}!`, 'success');
  };

  const handleAuthProfile = (session: AuthSession) => {
    setAuthSession(session);
    setUserProfile(prev => ({
      ownerName: session.displayName,
      shopName: prev?.shopName || settings.shopName || 'Gestao Maxima',
      email: session.email,
      startDate: prev?.startDate || Date.now(), // Preserve existing startDate if available
      isPro: true,
      planType: session.role === 'owner' ? 'admin_life' : 'vip_monthly',
      barberId: session.barberId, // Propagate barberId from AuthSession to UserProfile
    }));
  };

  const handleAuthSignIn = async (email: string, password: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const session = await signInWithPassword(email, password);
      handleAuthProfile(session);
      addToast(`Bem-vindo, ${session.displayName}!`, 'success');
    } catch (error) {
      console.error(error);
      setAuthError('Email ou senha invalidos.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuthSignUp = async (email: string, password: string, displayName: string, role: AppRole) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const session = await signUpWithPassword(email, password, displayName, role);
      if (session) {
        handleAuthProfile(session); // This will update userProfile and settings
        addToast(`Bem-vindo, ${session.displayName}!`, 'success');
      } else {
        setAuthError('Cadastro criado. Confirme seu email antes de entrar.');
      }
    } catch (error) {
      console.error(error);
      setAuthError('Nao foi possivel criar o acesso.');
    } finally {
      setAuthLoading(false);
    }
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

  const handleSaveClient = (data: ClientFormData) => {
    const { timeStr, ...clientInfo } = data;
    const [year, month, day] = selectedDate.split('-').map(Number);
    const [hours, minutes] = timeStr ? timeStr.split(':').map(Number) : [new Date().getHours(), new Date().getMinutes()];
    const timestamp = new Date(year, month - 1, day, hours, minutes).getTime();

    // Force commission to 0 if it is a PRODUCT type, regardless of what the form sent
    const sanitizedCommission = clientInfo.serviceType === ServiceType.PRODUCT ? 0 : clientInfo.commissionValue;

    const sanitizedClient = { 
        ...clientInfo, 
        commissionValue: sanitizedCommission 
    };

    if (editingClient) {
      setClients(prev => prev.map(c => c.id === editingClient.id ? { ...sanitizedClient, id: c.id, timestamp } : c));
      setEditingClient(null);
      addToast('Atendimento atualizado!', 'success');
    } else {
      const newClient: Client = { ...sanitizedClient, id: generateId(), timestamp };
      setClients(prev => [newClient, ...prev]);
      addToast('Novo atendimento salvo!', 'success');
    }
  };

  const handleOpenAppointment = () => {
    if (scheduleBarberOptions.length === 0) {
      addToast('Cadastre um barbeiro antes de agendar.', 'error');
      setSettingsModalOpen(true);
      return;
    }
    setEditingAppointment(null);
    setAppointmentModalOpen(true);
  };

  const handleSaveAppointment = async (appointment: Appointment) => {
    const editingId = editingAppointment?.id;
    if (hasAppointmentConflict(appointments, appointment, editingId)) {
      addToast('Horario indisponivel para este barbeiro.', 'error');
      return;
    }

    try {
      const savedAppointment = editingId //
        ? await updateAppointmentRecord(editingId, appointment)
        : await createAppointmentRecord(appointment, appointments);

      setAppointments(prev => {
        if (editingId) {
          return prev.map(item => item.id === editingId ? savedAppointment : item);
        }
        return [savedAppointment, ...prev];
      });

      setSelectedDate(getAppointmentDateInput(savedAppointment));
      setSelectedScheduleBarber(savedAppointment.barberName);
      setAppointmentModalOpen(false);
      setEditingAppointment(null);
      addToast(editingId ? 'Agendamento atualizado!' : 'Agendamento criado!', 'success');
    } catch (error) {
      console.error(error);
      addToast('Erro ao salvar agendamento.', 'error');
    }
  };

  // Function for barber to create appointments
  const handleCreateBarberAppointment = async (appointment: Appointment) => {
    if (hasAppointmentConflict(appointments, appointment)) {
      addToast('Horario indisponivel para este barbeiro.', 'error');
      return;
    }

    try {
      const savedAppointment = await createAppointmentRecord(appointment, appointments);

      setAppointments(prev => [savedAppointment, ...prev]);
      setSelectedDate(getAppointmentDateInput(savedAppointment));
      setSelectedScheduleBarber(savedAppointment.barberName);

      addToast('Agendamento criado!', 'success');
    } catch (error) {
      console.error(error);
      addToast('Erro ao salvar agendamento.', 'error');
    }
  };

  // Function for barber to update appointments with a patch
  const handleUpdateAppointmentPatch = async (
    id: string,
    patch: Partial<Appointment>
  ) => {
    const currentAppointment = appointments.find((appointment) => appointment.id === id);

    if (!currentAppointment) {
      addToast('Agendamento nao encontrado.', 'error');
      return;
    }

    const updatedAppointment: Appointment = {
      ...currentAppointment,
      ...patch,
      updatedAt: patch.updatedAt || new Date().toISOString()
    };

    let persistencePatch: Partial<Appointment> = {
      ...patch,
      updatedAt: updatedAppointment.updatedAt
    };

    let createdFinancialRecord = false;

    if (updatedAppointment.status === 'completed' && !currentAppointment.financialRecordId) {
      const result = completeAppointmentFinancialRecord(updatedAppointment, clients, settings, generateId);
      createdFinancialRecord = result.created;
      setClients(result.clients);

      if (createdFinancialRecord) {
        persistencePatch = { ...persistencePatch, financialRecordId: result.clients[0]?.id };
      }
    }

    await updateAppointmentRecord(id, persistencePatch);
    setAppointments(prev => prev.map(item => item.id === id ? updatedAppointment : item));
    addToast('Agendamento atualizado!', 'success');
  };

  const handleCreatePublicAppointment = async (appointment: Appointment) => {
    if (hasAppointmentConflict(appointments, appointment)) {
      addToast('Horario indisponivel para este barbeiro.', 'error');
      throw new Error('Horario indisponivel para este barbeiro.');
    }

    try {
      const savedAppointment = await createAppointmentRecord(appointment, appointments); //
      setAppointments(prev => [savedAppointment, ...prev]);
    } catch (error) {
      console.error(error);
      addToast('Erro ao confirmar agendamento.', 'error');
      throw error;
    }
  };

  const handleEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setAppointmentModalOpen(true);
  };

  const handleAppointmentStatusChange = async (appointment: Appointment, status: AppointmentStatus) => {
    const updatedAppointment: Appointment = {
      ...appointment,
      status,
      updatedAt: new Date().toISOString()
    };

    let patch: Partial<Appointment> = updatedAppointment;
    let createdFinancialRecord = false;
    if (status === 'completed' && !appointment.financialRecordId) {
      setClients(prev => {
        const result = completeAppointmentFinancialRecord(updatedAppointment, prev, settings, generateId);
        createdFinancialRecord = result.created;
        if (createdFinancialRecord) {
          patch = {
            ...patch,
            financialRecordId: result.clients[0]?.id
          };
        }
        return result.clients;
      });
    }

    try {
      const savedAppointment = await updateAppointmentRecord(appointment.id, patch); //
      setAppointments(prev => prev.map(item => item.id === appointment.id ? savedAppointment : item));

      if (status === 'completed') {
        addToast(createdFinancialRecord ? 'Agendamento concluido e financeiro lancado!' : 'Agendamento concluido sem duplicar financeiro.', 'success');
        return;
      }

      addToast('Status do agendamento atualizado.', 'success');
    } catch (error) {
      console.error(error);
      addToast('Erro ao atualizar agendamento.', 'error');
    }
  };

  const handleCancelAppointment = (appointment: Appointment) => {
    if (!window.confirm('Cancelar este agendamento?')) return;
    handleAppointmentStatusChange(appointment, 'cancelled');
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setClientModalOpen(true);
  };

  const handleAddVale = (data: ValeFormData) => {
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

  const handleDownloadRange = async (startDate: string, endDate: string, format: 'pdf' | 'csv') => {
    try {
        const start = getLocalDayBounds(startDate);
        const end = getLocalDayBounds(endDate);

        if (start.start > end.end) {
            addToast('A data inicial deve ser anterior ou igual à data final.', 'error');
            return;
        }

        const rangeClients = clients.filter(c => c.timestamp >= start.start && c.timestamp <= end.end);
        const rangeVales = vales.filter(v => v.timestamp >= start.start && v.timestamp <= end.end);
        
        // Safe filename
        const dateLabel = startDate === endDate 
            ? startDate 
            : `De ${startDate} a ${endDate}`; // This is fine, just a string for filename
        const safeName = `Relatorio_${dateLabel.replace(/\//g, '-').replace(/ /g, '_')}`;

        if (format === 'csv') {
            generateAndDownloadCSV(safeName, rangeClients, rangeVales);
            addToast('Planilha Excel (CSV) gerada!', 'success');
            return;
        }

        // PDF Logic (Strict Service Commission Only)
        const totalSales = rangeClients.reduce((acc, curr) => acc + curr.totalValue, 0);
        
        // Use centralized commission logic
        const grossCommission = rangeClients.reduce((acc, curr) => {
             return acc + calculateClientCommission(curr, settings.commissionRate);
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
            ? startDate // This is fine, just a string for display
            : `De ${parseLocalDateInput(startDate).toLocaleDateString('pt-BR')} a ${parseLocalDateInput(endDate).toLocaleDateString('pt-BR')}`;

        const { generateReportPDF } = await import('./services/pdfService');
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

  const handleDownloadDaily = async () => {
    try {
      const { generateReportPDF } = await import('./services/pdfService');
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
  
  const handleLogout = async () => {
    if(window.confirm("Deseja sair?")) {
       if (isSupabaseConfigured) {
         try {
           await signOutAuth();
         } catch (error) {
           console.error(error);
         }
       }
       setAuthSession(null);
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

  // Public Booking Route
  if (isPublicBookingRoute) {
    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <PublicBookingPage //
          settings={settings}
          appointments={appointments}
          barbershopSlug={publicBookingSlug}
          userProfile={userProfile}
          onCreateAppointment={handleCreatePublicAppointment}
        />
      </>
    );
  }

  // If authenticated and role is barber, show BarberDashboard
  if (isAuthLoading) {
    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <div className="min-h-screen flex items-center justify-center bg-transparent text-gray-300">
          Validando sessao...
        </div>
      </>
    );
  }

  if (isSupabaseConfigured && !canAccessInternalPanel(authSession, true)) {
    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <AuthScreen
          onSignIn={handleAuthSignIn}
          onSignUp={handleAuthSignUp}
          loading={isAuthLoading}
          error={authError}
        />
      </>
    );
  }

  if (authSession?.role === 'barber') {
    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <BarberDashboard
          authSession={authSession}
          appointments={appointments}
          settings={settings}
          onCreateAppointment={handleCreateBarberAppointment}
          onUpdateAppointment={handleUpdateAppointmentPatch}
          onCancelAppointment={handleCancelAppointment}
          addToast={addToast}
          onLogout={handleLogout}
        />
      </>
    );
  }

  // If not authenticated (local storage mode) or trial expired, show respective screens
  if (!userProfile) return <><ToastContainer toasts={toasts} removeToast={removeToast} /><LoginScreen onLogin={handleLogin} /></>;
  if (trialStatus.isExpired) return <><ToastContainer toasts={toasts} removeToast={removeToast} /><PaywallScreen onSubscribe={handleSubscribe} daysUsed={trialStatus.daysUsed} expirationDate={trialStatus.expirationDate} /></>;

  return (
    <div className="min-h-screen bg-transparent pb-24 font-sans selection:bg-gold-500/30">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <TourOverlay steps={tourSteps} isOpen={isTourOpen} onComplete={handleTourComplete} />
      <ReportModal isOpen={isReportModalOpen} onClose={() => setReportModalOpen(false)} onDownload={handleDownloadRange} initialDate={selectedDate} />

      {/* Header */}
      <header className="border-b border-gray-800 sticky top-0 z-40 backdrop-blur-md bg-gray-900/90">
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
                    <span className={`text-[10px] uppercase font-bold ${
                      isAdmin ? 'text-red-400' :
                      isVip ? 'text-gold-500' :
                      userProfile.isPro ? 'text-blue-400' : 'text-gray-400'
                    }`}>{planBadgeLabel}</span>
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
                    <button onClick={handleOpenAppointment} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gray-800 border border-gold-500/30 text-gold-400 px-4 py-2.5 rounded-xl font-bold transition-colors active:scale-95">
                        <Calendar size={18} /> Agendar
                    </button>
                     <button id="tour-new-client-btn" onClick={handleOpenAddClient} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 text-black px-4 py-2.5 rounded-xl font-bold transition-colors shadow-lg shadow-gold-500/20 active:scale-95">
                        <Plus size={18} /> Atendimento
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
                    <div className="flex items-center bg-gray-900 rounded-xl border border-gray-700 p-0.5 flex-1 justify-between md:flex-none min-w-[140px]" id="tour-date-picker">
                        <button onClick={() => changeDate(-1)} className="p-2 text-gray-400 hover:text-white"><ChevronLeft size={20}/></button>
                        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent border-none text-white text-sm text-center w-full md:w-32 focus:ring-0" />
                        <button onClick={() => changeDate(1)} className="p-2 text-gray-400 hover:text-white"><ChevronRight size={20}/></button>
                    </div>
                    {barberFilterOptions.length > 1 && (
                        <div className="relative shrink-0">
                            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                            <select
                                value={selectedBarberFilter}
                                onChange={(e) => setSelectedBarberFilter(e.target.value)}
                                className="bg-gray-900 border border-gray-700 text-white text-sm rounded-xl pl-9 pr-3 py-2.5 appearance-none min-w-[180px] focus:ring-2 focus:ring-gold-500 outline-none"
                            > {/* This filter still uses names, which is fine for display */}
                                {barberFilterOptions.map((barber) => (
                                    <option key={barber} value={barber}>
                                        {barber === 'TODOS' ? 'Todos os barbeiros' : barber}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
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
                <DashboardCharts clients={chartClients} />
             </div>

             <div id="tour-stats" className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <StatsCard title="Atendimentos" value={stats.totalClients.toString()} icon={<Users size={20} />} />
                <StatsCard title="Faturamento" value={formatCurrency(stats.totalSales)} icon={<DollarSign size={20} />} colorClass="bg-gray-800 border-gray-700 text-green-400" />
                <StatsCard title="Líquido" value={formatCurrency(stats.netCommission)} icon={<TrendingUp size={20} />} colorClass="bg-gray-800 border-gold-500/30 text-gold-500" />
             </div>

              {/* Lists */}
              {isAppointmentsLoading && (
                <div className="mb-4 bg-blue-500/10 border border-blue-500/20 text-blue-200 text-sm rounded-xl p-3">
                  Carregando agenda online...
                </div>
              )}
              {appointmentsError && (
                <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-200 text-sm rounded-xl p-3">
                  {appointmentsError}
                </div>
              )}
              <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
                 <div className="flex border-b border-gray-700 bg-gray-900/50">
                    <button onClick={() => setActiveTab('appointments')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'appointments' ? 'text-white border-b-2 border-blue-400' : 'text-gray-500'}`}>Agenda</button>
                     <button onClick={() => setActiveTab('clients')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'clients' ? 'text-white border-b-2 border-gold-500' : 'text-gray-500'}`}>Clientes</button>
                     <button onClick={() => setActiveTab('vales')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'vales' ? 'text-white border-b-2 border-red-500' : 'text-gray-500'}`}>Vales</button>
                 </div>
                 
                 <div className="min-h-[200px] bg-gray-900/30">
                    {activeTab === 'appointments' ? (
                        <DailySchedule
                          appointments={filteredAppointments}
                          selectedDate={selectedDate}
                          selectedBarber={selectedScheduleBarber}
                          barberOptions={scheduleBarberOptions}
                          onDateChange={setSelectedDate}
                          onBarberChange={setSelectedScheduleBarber}
                          onNew={handleOpenAppointment}
                          onEdit={handleEditAppointment}
                          onStatusChange={handleAppointmentStatusChange}
                          onCancel={handleCancelAppointment}
                        />
                    ) : activeTab === 'clients' ? (
                        <>
                           {filteredClients.length === 0 ? <p className="text-center py-8 text-gray-500">{selectedBarberFilter === 'TODOS' ? 'Sem registros.' : `Sem registros para ${selectedBarberFilter}.`}</p> : (
                                <>
                                    {/* Mobile View: Cards */}
                                    <div className="md:hidden p-4 space-y-3">
                                        {filteredClients.map(c => (
                                            <div key={c.id} className={`bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-sm relative transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 hover:border-gray-600 ${c.clientType === ClientType.NEW ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-gold-500'}`}>
                                                
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="bg-gray-900 text-gray-400 text-xs font-mono px-2 py-1 rounded flex items-center gap-1">
                                                            <Clock size={12}/> {formatTime(c.timestamp)}
                                                        </span>
                                                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${c.clientType === ClientType.NEW ? 'bg-green-900/30 text-green-400' : 'bg-gold-500/10 text-gold-500'}`}>
                                                            {c.clientType === ClientType.NEW ? 'NOVO' : 'CASA'}
                                                        </span>
                                                    </div>
                                                    <span className="text-white font-bold text-lg">
                                                        {formatCurrency(c.totalValue)}
                                                    </span>
                                                </div>

                                                <div className="mb-4">
                                                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                                        {c.name}
                                                    </h3>
                                                    <p className="text-gray-300 text-sm mt-1 flex items-center gap-1">
                                                        <Scissors size={14} className="text-gray-500"/>
                                                        {c.serviceType}
                                                        {c.extraValue > 0 && <span className="text-gray-500 text-xs ml-1">(+Adic)</span>}
                                                    </p>
                                                    {c.products && c.products.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {c.products.map(p => (
                                                                <span key={p.id} className="text-[10px] bg-gray-900 text-gray-400 px-2 py-0.5 rounded border border-gray-700">
                                                                    + {p.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <p className="text-gray-500 text-xs mt-2 flex items-center gap-1">
                                                        <User size={12}/> Barbeiro: {c.barberName}
                                                    </p>
                                                </div>

                                                <div className="flex gap-3 pt-3 border-t border-gray-700/50">
                                                    <button 
                                                        onClick={() => handleEditClient(c)} 
                                                        className="flex-1 flex items-center justify-center gap-2 bg-blue-500/10 text-blue-400 py-2.5 rounded-lg text-sm font-bold active:bg-blue-500/20 transition-colors"
                                                    >
                                                        <Pencil size={16}/> Editar
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteClient(c.id)} 
                                                        className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 text-red-400 py-2.5 rounded-lg text-sm font-bold active:bg-red-500/20 transition-colors"
                                                    >
                                                        <Trash2 size={16}/> Excluir
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Desktop View: Table */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="text-xs text-gray-400 bg-gray-900/50 uppercase">
                                                <tr>
                                                    <th className="p-4">Hora</th>
                                                    <th className="p-4">Cliente</th>
                                                    <th className="p-4">Servico</th>
                                                    <th className="p-4 text-right">Valor</th>
                                                    <th className="p-4 w-20"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-700/50">
                                                {filteredClients.map(c => (
                                                    <tr key={c.id} className="hover:bg-gray-700/30 group">
                                                        <td className="p-4 text-gray-400 font-mono text-xs whitespace-nowrap">{formatTime(c.timestamp)}</td>
                                                        <td className="p-4 font-medium text-white min-w-[100px]">
                                                            {c.name}
                                                            <span className={`block text-[10px] ${c.clientType === ClientType.NEW ? 'text-green-400' : 'text-gold-500'}`}>{c.clientType}</span>
                                                        </td>
                                                        <td className="p-4 text-gray-300 text-sm whitespace-nowrap">
                                                            {c.serviceType}
                                                            {c.products && c.products.length > 0 && (
                                                                <span className="text-green-400 text-xs block">
                                                                    + {c.products.length} Prod.
                                                                </span>
                                                            )}
                                                            {c.extraValue > 0 && <span className="text-xs ml-1 text-gray-500">+{c.extraValue}</span>}
                                                        </td>
                                                        <td className="p-4 text-right font-bold text-white whitespace-nowrap">{formatCurrency(c.totalValue)}</td>
                                                        <td className="p-4 flex justify-end gap-2">
                                                            <button onClick={() => handleEditClient(c)} className="text-blue-400 hover:bg-blue-500/10 p-2 rounded"><Pencil size={16}/></button>
                                                            <button onClick={() => handleDeleteClient(c.id)} className="text-red-400 hover:bg-red-500/10 p-2 rounded"><Trash2 size={16}/></button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                           )}
                        </>
                    ) : (
                        <>
                           {filteredVales.length === 0 ? <p className="text-center py-8 text-gray-500">{selectedBarberFilter === 'TODOS' ? 'Sem vales.' : `Sem vales para ${selectedBarberFilter}.`}</p> : (
                                <>
                                    {/* Mobile View: Cards for Vales */}
                                    <div className="md:hidden p-4 space-y-3">
                                        {filteredVales.map(v => (
                                            <div key={v.id} className="bg-gray-800 p-4 rounded-xl border border-gray-700 border-l-4 border-l-red-500 shadow-sm relative transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 hover:border-gray-600">
                                                <div className="flex justify-between items-start mb-2">
                                                     <div className="flex items-center gap-2">
                                                        <span className="bg-gray-900 text-gray-400 text-xs font-mono px-2 py-1 rounded flex items-center gap-1">
                                                            <Clock size={12}/> {formatTime(v.timestamp)}
                                                        </span>
                                                        <span className="text-[10px] font-bold px-2 py-1 rounded bg-red-900/30 text-red-400">
                                                            VALE
                                                        </span>
                                                    </div>
                                                    <span className="text-red-400 font-bold text-lg">
                                                        -{formatCurrency(v.value)}
                                                    </span>
                                                </div>

                                                <div className="mb-4">
                                                    <h3 className="text-white font-bold text-lg">{v.barberName}</h3>
                                                    <p className="text-gray-400 text-sm mt-1 italic">"{v.description}"</p>
                                                </div>

                                                <button 
                                                    onClick={() => handleDeleteVale(v.id)} 
                                                    className="w-full flex items-center justify-center gap-2 bg-red-500/10 text-red-400 py-2.5 rounded-lg text-sm font-bold active:bg-red-500/20 transition-colors border border-red-500/20"
                                                >
                                                    <Trash2 size={16}/> Remover Vale
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Desktop View: Table for Vales */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="text-xs text-gray-400 bg-gray-900/50 uppercase">
                                                <tr>
                                                    <th className="p-4">Hora</th>
                                                    <th className="p-4">Descricao</th>
                                                    <th className="p-4 text-right">Valor</th>
                                                    <th className="p-4 w-16"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-700/50">
                                                {filteredVales.map(v => (
                                                    <tr key={v.id} className="hover:bg-gray-700/30">
                                                        <td className="p-4 text-gray-400 font-mono text-xs whitespace-nowrap">{formatTime(v.timestamp)}</td>
                                                        <td className="p-4 text-gray-300 min-w-[120px]">{v.description} <span className="text-gray-500 text-xs">({v.barberName})</span></td>
                                                        <td className="p-4 text-right font-bold text-red-400 whitespace-nowrap">-{formatCurrency(v.value)}</td>
                                                        <td className="p-4 text-right">
                                                            <button onClick={() => handleDeleteVale(v.id)} className="text-red-400 hover:bg-red-500/10 p-2 rounded"><Trash2 size={16}/></button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                           )}
                        </>
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
      <SettingsModal 
        isOpen={isSettingsModalOpen} 
        onClose={() => setSettingsModalOpen(false)} 
        settings={settings} 
        onSave={(nextSettings) => setSettings(normalizeSettings(nextSettings))} 
        userProfile={userProfile} 
        onSubscribe={() => setSubscriptionModalOpen(true)} 
        clients={clients}
        vales={vales}
        appointments={appointments}
      />
      <AppointmentModal
        isOpen={isAppointmentModalOpen}
        onClose={() => { setAppointmentModalOpen(false); setEditingAppointment(null); }}
        onSave={handleSaveAppointment}
        settings={settings}
        selectedDate={selectedDate}
        selectedBarber={selectedScheduleBarber}
        initialData={editingAppointment}
        createId={generateId}
      />
      <SubscriptionModal isOpen={isSubscriptionModalOpen} onClose={() => setSubscriptionModalOpen(false)} onSubscribe={handleSubscribe} />
    </div>
  );
};

export default App;
