
import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { Client, ClientFormData, Vale, ValeFormData, AppSettings, DEFAULT_SETTINGS, ServiceType, DailyHistory, ClientType, UserProfile, Appointment, AppointmentStatus, BarberOption, Service, Barbershop } from './types';
import { formatCurrency, formatTime, generateId, generateAndDownloadCSV, calculateClientCommission, getLocalDayBounds, parseLocalDateInput, getBarberNameById, resolveOwnerScopedBarbershopId } from './utils';
import { 
  BarbershopBrandingImageType,
  BarbershopBrandingInput,
  createBarbershopForCurrentOwner,
  getBarbershopById,
  getBarbershopBySlug,
  getBarbershopPublicBookingPath,
  updateCurrentBarbershopBranding,
  uploadBarbershopBrandingImage
} from './services/barbershopRepository';
import {
  APPOINTMENT_STORAGE_KEY,
  appointmentToClient,
  completeAppointmentFinancialRecord,
  createAppointmentConflictError,
  getAppointmentDateInput,
  hasAppointmentConflict,
  isAppointmentConflictError,
  PUBLIC_BOOKING_APPOINTMENT_CONFLICT_MESSAGE
} from './scheduling';
import { StatsCard } from './components/StatsCard';
import { PublicBookingPage } from './components/PublicBookingPage';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';
import type { TourStep } from './components/tourUtils';
import { isProductionWithoutSupabase, isSupabaseConfigured, PRODUCTION_SUPABASE_UNAVAILABLE_MESSAGE, shouldUseLocalFallback } from './lib/supabase';
import { createAppointment as createAppointmentRecord, createPublicAppointment, listInternalAppointments, listPublicAppointmentSlots, updateAppointment as updateAppointmentRecord } from './services/appointmentRepository';
import { completeAppointmentWithFinancialRecord, listFinancialRecords, mapFinancialRecordToClient } from './services/financialRecordRepository';
import { createBarber, listBarbers, removeBarber, updateBarber } from './services/barberRepository';
import { linkBarberProfileByEmail } from './services/profileLinkingRepository';
import { createService, listServices, removeService, updateService } from './services/serviceRepository';
import { AppRole, AuthSession, canAccessInternalPanel, getCurrentAuthSession, signInWithPassword, signOut as signOutAuth, signUpWithPassword } from './services/authRepository';
import { 
  Scissors, 
  Users, 
  DollarSign, 
  Settings, 
  Trash2, 
  MinusCircle, 
  TrendingUp, 
  Download, 
  Pencil,
  Calendar,
  User,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileText,
  Clock
} from 'lucide-react';
import { getOperationalErrorMessage, logOperationalError } from './utils/errorHandling';
import { AUTH_CALLBACK_PATH, AuthCallbackScreen } from './components/AuthCallbackScreen';
import { DashboardShell, type DashboardNavigationItem } from './components/DashboardShell';
import { InlineNotice, LoadingState, Surface } from './components/ui';
import { SettingsWorkspace } from './components/SettingsWorkspace';
import {
  getOwnerNavigationHash,
  getOwnerNavigationRoute,
  type ManagementSectionHash,
  type OwnerMainSection
} from './utils/ownerNavigation';

const AddClientModal = React.lazy(() => import('./components/AddClientModal').then((module) => ({ default: module.AddClientModal })));
const AddValeModal = React.lazy(() => import('./components/AddValeModal').then((module) => ({ default: module.AddValeModal })));
const AppointmentModal = React.lazy(() => import('./components/AppointmentModal').then((module) => ({ default: module.AppointmentModal })));
const AuthScreen = React.lazy(() => import('./components/AuthScreen').then((module) => ({ default: module.AuthScreen })));
const BarberDashboard = React.lazy(() => import('./components/BarberDashboard').then((module) => ({ default: module.BarberDashboard })));
const BarbershopBrandingSettings = React.lazy(() => import('./components/BarbershopBrandingSettings').then((module) => ({ default: module.BarbershopBrandingSettings })));
const DailySchedule = React.lazy(() => import('./components/DailySchedule').then((module) => ({ default: module.DailySchedule })));
const DashboardCharts = React.lazy(() => import('./components/DashboardCharts').then((module) => ({ default: module.DashboardCharts })));
const LoginScreen = React.lazy(() => import('./components/LoginScreen').then((module) => ({ default: module.LoginScreen })));
const MonthlySummary = React.lazy(() => import('./components/MonthlySummary').then((module) => ({ default: module.MonthlySummary })));
const OwnerBarberProfileLinking = React.lazy(() => import('./components/OwnerBarberProfileLinking').then((module) => ({ default: module.OwnerBarberProfileLinking })));
const OwnerBarbershopOnboarding = React.lazy(() => import('./components/OwnerBarbershopOnboarding').then((module) => ({ default: module.OwnerBarbershopOnboarding })));
const OwnerCatalogManager = React.lazy(() => import('./components/OwnerCatalogManager').then((module) => ({ default: module.OwnerCatalogManager })));
const OwnerSetupChecklist = React.lazy(() => import('./components/OwnerSetupChecklist').then((module) => ({ default: module.OwnerSetupChecklist })));
const ReportModal = React.lazy(() => import('./components/ReportModal').then((module) => ({ default: module.ReportModal })));
const SettingsModal = React.lazy(() => import('./components/SettingsModal').then((module) => ({ default: module.SettingsModal })));
const TourOverlay = React.lazy(() => import('./components/TourOverlay').then((module) => ({ default: module.TourOverlay })));

const ViewFallback = () => (
  <div className="min-h-screen flex items-center justify-center text-muted-foreground">
    Carregando...
  </div>
);

const SectionFallback = () => (
  <div className="ui-owner-card mb-6 text-sm">
    Carregando...
  </div>
);

const normalizeSettings = (settings: Partial<AppSettings> | null | undefined): AppSettings => {
  const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  const services = Array.isArray(settings?.services)
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

const SAFE_PUBLIC_BOOKING_SHOP_NAME = 'Escolha uma barbearia';
const SAFE_INTERNAL_SHOP_NAME = 'Sua barbearia';
const TOUR_STORAGE_KEY = 'hasSeenTour';

export const getOperationalBlockingMessage = (blockInProductionWithoutSupabase: boolean): string | null => (
  blockInProductionWithoutSupabase
    ? PRODUCTION_SUPABASE_UNAVAILABLE_MESSAGE
    : null
);

export const getInitialUserProfile = (
  storage: Pick<Storage, 'getItem'>,
  allowLocalFallback: boolean
): UserProfile | null => {
  if (!allowLocalFallback) {
    return null;
  }

  try {
    const saved = storage.getItem('barbearia_profile');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

export const getInitialAppSettings = (
  storage: Pick<Storage, 'getItem'>,
  allowLocalFallback: boolean
): AppSettings => {
  if (!allowLocalFallback) {
    return normalizeSettings({
      ...DEFAULT_SETTINGS,
      shopName: SAFE_INTERNAL_SHOP_NAME,
      barbers: [],
      services: []
    });
  }

  try {
    const saved = storage.getItem('barbearia_settings');
    const parsed = saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    return normalizeSettings(parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const getResolvedDashboardShopName = ({
  ownerBarbershop,
  userProfile,
  settings,
  supabaseConfigured
}: {
  ownerBarbershop: Barbershop | null;
  userProfile: UserProfile | null;
  settings: AppSettings;
  supabaseConfigured: boolean;
}): string => {
  const ownerBarbershopName = ownerBarbershop?.name?.trim();
  if (ownerBarbershopName) return ownerBarbershopName;

  const profileShopName = userProfile?.shopName?.trim();
  if (profileShopName) return profileShopName;

  const settingsShopName = settings.shopName?.trim();
  if (!supabaseConfigured && settingsShopName) return settingsShopName;

  return supabaseConfigured ? SAFE_INTERNAL_SHOP_NAME : SAFE_PUBLIC_BOOKING_SHOP_NAME;
};

export const scopeOwnerAppointmentToTenant = (
  appointment: Appointment,
  barbershopId: string
): Appointment => ({
  ...appointment,
  barbershopId
});

// Códigos

export const getPublicBookingSlugFromPath = (pathname: string): string | undefined => {
  if (pathname === '/book' || pathname === '/agendar') return undefined;

  if (pathname.startsWith('/book/')) {
    const slug = pathname.replace('/book/', '').split('/')[0]?.trim();
    return slug || undefined;
  }

  return undefined;
};

export const isOwnerOnboardingPath = (pathname: string): boolean => pathname === '/onboarding';

export type InternalAuthView = 'loading' | 'auth' | 'owner-onboarding' | 'owner-dashboard' | 'barber-dashboard';

export const getInternalAuthView = (
  isLoading: boolean,
  authSession: AuthSession | null,
  supabaseConfigured: boolean
): InternalAuthView => {
  if (isLoading) return 'loading';
  if (!supabaseConfigured) return 'owner-dashboard';
  if (!authSession) return 'auth';

  if (authSession.role === 'owner' && !authSession.barbershopId?.trim()) {
    return 'owner-onboarding';
  }

  if (authSession.role === 'barber') return 'barber-dashboard';
  return canAccessInternalPanel(authSession, true) ? 'owner-dashboard' : 'auth';
};

const App: React.FC = () => {
  const pathname = window.location.pathname;
  const publicBookingSlug = getPublicBookingSlugFromPath(pathname);
  const isPublicBookingRoute = pathname === '/book' || pathname === '/agendar' || pathname.startsWith('/book/');
  const isOnboardingRoute = isOwnerOnboardingPath(pathname);
  const isAuthCallbackRoute = pathname === AUTH_CALLBACK_PATH;

  // -- Handle Splash Screen --
  useEffect(() => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
      let hidden = false;
      const hideSplash = () => {
        if (hidden) return;
        hidden = true;
        splash.classList.add('splash-hidden');
        setTimeout(() => {
          splash.remove();
        }, 240);
      };

      const fallbackTimeout = window.setTimeout(hideSplash, 320);
      const firstFrame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(hideSplash);
      });

      return () => {
        window.clearTimeout(fallbackTimeout);
        window.cancelAnimationFrame(firstFrame);
      };
    }
  }, []);

  // -- Auth & Profile State --
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => (
    getInitialUserProfile(localStorage, shouldUseLocalFallback)
  ));

  // -- Data State --
  const [clients, setClients] = useState<Client[]>(() => {
    if (!shouldUseLocalFallback) {
      return [];
    }

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
      logOperationalError('local-storage:load-clients', e);
      return [];
    }
  });

  const [vales, setVales] = useState<Vale[]>(() => {
    if (!shouldUseLocalFallback) {
      return [];
    }

    try {
      const saved = localStorage.getItem('barbearia_vales');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      logOperationalError('local-storage:load-vales', e);
      return [];
    }
  });

  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    if (!shouldUseLocalFallback) {
      return [];
    }

    try {
      const saved = localStorage.getItem(APPOINTMENT_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      logOperationalError('local-storage:load-appointments', e);
      return [];
    }
  });

  const [settings, setSettings] = useState<AppSettings>(() => (
    getInitialAppSettings(localStorage, shouldUseLocalFallback)
  ));

  // -- View State --
  const initialOwnerNavigation = getOwnerNavigationRoute(window.location.hash);
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>(() => (
    initialOwnerNavigation.mainSection === 'reports' ? 'monthly' : 'daily'
  ));
  const [activeTab, setActiveTab] = useState<'appointments' | 'clients' | 'vales' | 'management'>(() => (
    initialOwnerNavigation.mainSection === 'reports' ? 'appointments' : initialOwnerNavigation.mainSection
  ));
  const [activeManagementSection, setActiveManagementSection] = useState<ManagementSectionHash>(
    initialOwnerNavigation.managementSection
  );
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
  const [isReportModalOpen, setReportModalOpen] = useState(false);
  const [isAppointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [isAuthLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [authError, setAuthError] = useState<string | null>(null);
  const [ownerBarbershop, setOwnerBarbershop] = useState<Barbershop | null>(null);
  const [isOwnerBarbershopLoading, setOwnerBarbershopLoading] = useState(false);
  const [ownerBarbershopError, setOwnerBarbershopError] = useState<string | null>(null);
  const [ownerBarbershopSuccess, setOwnerBarbershopSuccess] = useState<string | null>(null);
  const [isSavingOwnerBarbershop, setSavingOwnerBarbershop] = useState(false);
  const [ownerCatalogBarbers, setOwnerCatalogBarbers] = useState<BarberOption[]>([]);
  const [ownerCatalogServices, setOwnerCatalogServices] = useState<Service[]>([]);
  const [isOwnerCatalogLoading, setOwnerCatalogLoading] = useState(false);
  const [ownerCatalogError, setOwnerCatalogError] = useState<string | null>(null);

  // Tour State
  const [isTourOpen, setTourOpen] = useState(false);
  const [isTourReopenRequested, setTourReopenRequested] = useState(false);

  // -- Notification State --
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const syncActiveCatalogIntoSettings = (
    barbers: BarberOption[],
    services: Service[]
  ) => {
    setSettings(prev => normalizeSettings({
      ...prev,
      barbers: barbers.filter((barber) => barber.active !== false),
      services: services.filter((service) => service.active !== false)
    }));
  };

  // -- Effects --
  useEffect(() => {
    const syncOwnerNavigationFromHash = () => {
      const route = getOwnerNavigationRoute(window.location.hash);
      setActiveManagementSection(route.managementSection);
      if (route.mainSection === 'reports') {
        setViewMode('monthly');
        return;
      }
      setViewMode('daily');
      setActiveTab(route.mainSection);
    };

    window.addEventListener('hashchange', syncOwnerNavigationFromHash);
    window.addEventListener('popstate', syncOwnerNavigationFromHash);
    return () => {
      window.removeEventListener('hashchange', syncOwnerNavigationFromHash);
      window.removeEventListener('popstate', syncOwnerNavigationFromHash);
    };
  }, []);

  useEffect(() => {
    if (shouldUseLocalFallback) {
      localStorage.setItem('barbearia_profile', JSON.stringify(userProfile));
    }
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
            shopName: prev?.shopName || '',
            email: session.email,
            startDate: prev?.startDate || Date.now(),
            isPro: true,
            planType: 'trial'
          }));
        }
      } catch (error) {
        if (!active) return;
        logOperationalError('auth:load-session', error);
        setAuthError(getOperationalErrorMessage(
          error,
          'Nao foi possivel validar sua sessao. Entre novamente.',
          {
            authExpiredMessage: 'Sua sessao pode ter expirado. Entre novamente.',
            networkMessage: 'Nao foi possivel conectar ao Supabase para validar sua sessao.'
          }
        ));
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
    if (shouldUseLocalFallback) {
      localStorage.setItem('barbearia_clients', JSON.stringify(clients));
    }
  }, [clients]);

  useEffect(() => {
    if (shouldUseLocalFallback) {
      localStorage.setItem('barbearia_vales', JSON.stringify(vales));
    }
  }, [vales]);

  useEffect(() => {
    if (shouldUseLocalFallback) {
      localStorage.setItem(APPOINTMENT_STORAGE_KEY, JSON.stringify(appointments));
    }
  }, [appointments]);

  useEffect(() => {
    if (shouldUseLocalFallback) {
      localStorage.setItem('barbearia_settings', JSON.stringify(settings));
    }
  }, [settings]);

  useEffect(() => {
    let active = true;

    const loadOwnerBarbershop = async () => {
      if (authSession?.role === 'barber') {
        setOwnerBarbershop(null);
        return;
      }

      const barbershopId = authSession?.barbershopId || (shouldUseLocalFallback ? 'local-barbershop' : undefined);

      if (!barbershopId) {
        setOwnerBarbershop(null);
        return;
      }

      setOwnerBarbershopLoading(true);
      setOwnerBarbershopError(null);

      try {
        const currentBarbershop = await getBarbershopById(barbershopId);
        if (!active) return;
        setOwnerBarbershop(currentBarbershop);
      } catch (error) {
        if (!active) return;
        logOperationalError('owner:load-barbershop', error);
        setOwnerBarbershopError(getOperationalErrorMessage(
          error,
          'Nao foi possivel carregar os dados da sua barbearia. Tente novamente.',
          { networkMessage: 'Nao foi possivel conectar ao Supabase para carregar sua barbearia.' }
        ));
      } finally {
        if (active) setOwnerBarbershopLoading(false);
      }
    };

    loadOwnerBarbershop();

    return () => {
      active = false;
    };
  }, [authSession]);

  useEffect(() => {
    if (!ownerBarbershop?.name?.trim()) return;

    setSettings(prev => normalizeSettings({
      ...prev,
      shopName: ownerBarbershop.name
    }));

    setUserProfile(prev => (
      prev
        ? {
            ...prev,
            shopName: ownerBarbershop.name
          }
        : prev
    ));
  }, [ownerBarbershop]);

  useEffect(() => {
    let active = true;

    const loadOwnerCatalog = async () => {
      if (isPublicBookingRoute) return;
      if (authSession?.role === 'barber') return;
      if (isSupabaseConfigured && (isAuthLoading || !authSession?.barbershopId)) return;

      const catalogBarbershopId = authSession?.barbershopId || (shouldUseLocalFallback ? 'local-barbershop' : undefined);

      if (!catalogBarbershopId) return;

      setOwnerCatalogLoading(true);
      setOwnerCatalogError(null);

      try {
        const [catalogBarbers, catalogServices] = await Promise.all([
          listBarbers(catalogBarbershopId, { includeInactive: true }),
          listServices(catalogBarbershopId, { includeInactive: true })
        ]);

        if (!active) return;
        setOwnerCatalogBarbers(catalogBarbers);
        setOwnerCatalogServices(catalogServices);
        syncActiveCatalogIntoSettings(catalogBarbers, catalogServices);
      } catch (error) {
        if (!active) return;
        logOperationalError('owner:load-catalog', error);
        setOwnerCatalogError(getOperationalErrorMessage(
          error,
          'Nao foi possivel carregar barbeiros e servicos. Tente novamente.',
          { networkMessage: 'Nao foi possivel conectar ao Supabase para carregar o catalogo.' }
        ));
      } finally {
        if (active) setOwnerCatalogLoading(false);
      }
    };

    loadOwnerCatalog();
    return () => {
      active = false;
    };
  }, [authSession, isAuthLoading, isPublicBookingRoute]);

  useEffect(() => {
    if (!isSupabaseConfigured || isAuthLoading || isPublicBookingRoute || isAuthCallbackRoute || !authSession) return;

    if (!authSession.barbershopId && !isOnboardingRoute && authSession.role === 'owner') {
      window.location.replace('/onboarding');
      return;
    }

    if (authSession.barbershopId && isOnboardingRoute) {
      window.location.replace('/');
    }
  }, [authSession, isAuthCallbackRoute, isAuthLoading, isOnboardingRoute, isPublicBookingRoute]);

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
        let currentShopName: string | undefined;
        if (isPublicBookingRoute) {
          if (!publicBookingSlug) {
            if (!active) return;
            setAppointments([]);
            setSettings(prev => normalizeSettings({
              ...prev,
              shopName: SAFE_PUBLIC_BOOKING_SHOP_NAME,
              barbers: [],
              services: []
            }));
            return;
          }

          const publicBarbershop = await getBarbershopBySlug(publicBookingSlug);
          if (!publicBarbershop) {
            if (!active) return;
            setAppointments([]);
            setSettings(prev => normalizeSettings({
              ...prev,
              shopName: SAFE_PUBLIC_BOOKING_SHOP_NAME,
              barbers: [],
              services: []
            }));
            return;
          }
          currentBarbershopId = publicBarbershop?.id;
          currentShopName = publicBarbershop.name;
        } else if (authSession?.barbershopId) { // For internal dashboards
          currentBarbershopId = authSession.barbershopId;
        }

        if (isPublicBookingRoute && !currentBarbershopId) {
          throw new Error('Barbearia nao encontrada ou indisponivel.');
        }

        const [remoteAppointments, remoteBarbers, remoteServices] = await Promise.all([ //
          isPublicBookingRoute ? listPublicAppointmentSlots(publicBookingSlug!, currentBarbershopId) : listInternalAppointments(currentBarbershopId, authSession?.barberId),
          listBarbers(currentBarbershopId),
          listServices(currentBarbershopId)
        ]);

        const remoteFinancialRecords = isPublicBookingRoute
          ? []
          : await listFinancialRecords(currentBarbershopId || '');

        if (!active) return;
        setAppointments(remoteAppointments);
        if (!isPublicBookingRoute) {
          setClients(remoteFinancialRecords.flatMap((record) => {
            const appointment = remoteAppointments.find((item) => item.id === record.appointment_id);
            return appointment ? [mapFinancialRecordToClient(record, appointment)] : [];
          }));
        }
        setSettings(prev => normalizeSettings({
          ...prev,
          ...(isPublicBookingRoute ? { shopName: currentShopName || SAFE_PUBLIC_BOOKING_SHOP_NAME } : {}),
          barbers: remoteBarbers,
          services: remoteServices
        }));
      } catch (error) {
        if (!active) return;
        logOperationalError(isPublicBookingRoute ? 'public-booking:load-data' : 'dashboard:load-appointments', error);
        setAppointmentsError(getOperationalErrorMessage(
          error,
          isPublicBookingRoute
            ? 'Nao foi possivel carregar a disponibilidade da barbearia. Tente novamente.'
            : 'Nao foi possivel carregar os agendamentos. Tente novamente.',
          { networkMessage: 'Nao foi possivel conectar ao Supabase para carregar os agendamentos.' }
        ));
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
    const shouldAutoOpen = Boolean(userProfile && !localStorage.getItem(TOUR_STORAGE_KEY));
    const shouldOpen = Boolean(
      userProfile
      && !isPublicBookingRoute
      && authSession?.role !== 'barber'
      && viewMode === 'daily'
      && !isTourOpen
      && (shouldAutoOpen || isTourReopenRequested)
    );

    if (!shouldOpen) return;

    let cancelled = false;
    let attempts = 0;
    let timeoutId: number | undefined;

    const tryOpenTour = async () => {
      if (cancelled) return;

      const { areTourTargetsReady } = await import('./components/tourUtils');
      if (cancelled) return;

      if (areTourTargetsReady()) {
        setTourOpen(true);
        setTourReopenRequested(false);
        return;
      }

      attempts += 1;
      if (attempts < 30) {
        timeoutId = window.setTimeout(tryOpenTour, 100);
        return;
      }

      setTourReopenRequested(false);
    };

    timeoutId = window.setTimeout(tryOpenTour, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [authSession?.role, isPublicBookingRoute, isTourOpen, isTourReopenRequested, userProfile, viewMode]);

  const handleTourComplete = () => {
    setTourOpen(false);
    setTourReopenRequested(false);
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
  };

  const handleReopenTour = useCallback(() => {
    setViewMode('daily');
    setTourOpen(false);
    setTourReopenRequested(true);
  }, []);

  // -- Derived State --
  const roleBadgeLabel = useMemo(() => {
    if (authSession?.role === 'owner') return 'OWNER';
    if (authSession?.role === 'barber') return 'BARBER';
    return isSupabaseConfigured ? 'OPERACIONAL' : 'LOCAL';
  }, [authSession?.role]);

  const activeShopName = useMemo(() => (
    getResolvedDashboardShopName({
      ownerBarbershop,
      userProfile,
      settings,
      supabaseConfigured: isSupabaseConfigured
    })
  ), [ownerBarbershop, settings, userProfile]);

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
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [settings.barbers, appointments, clients]);

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
      shopName: prev?.shopName || '',
      email: session.email,
      startDate: prev?.startDate || Date.now(), // Preserve existing startDate if available
      isPro: true,
      planType: 'trial',
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
      logOperationalError('auth:sign-in', error);
      setAuthError(getOperationalErrorMessage(
        error,
        'Email ou senha invalidos.',
        {
          authExpiredMessage: 'Sua sessao pode ter expirado. Entre novamente.',
          networkMessage: 'Nao foi possivel conectar ao Supabase para entrar.'
        }
      ));
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
      logOperationalError('auth:sign-up', error);
      setAuthError(getOperationalErrorMessage(
        error,
        'Nao foi possivel criar o acesso. Revise os dados e tente novamente.',
        { networkMessage: 'Nao foi possivel conectar ao Supabase para criar o acesso.' }
      ));
    } finally {
      setAuthLoading(false);
    }
  };
  const handleCreateOwnerBarbershop = async (input: {
    name: string;
    slug: string;
    phone?: string | null;
    address?: string | null;
    whatsapp?: string | null;
    description?: string | null;
  }) => {
    const createdBarbershop = await createBarbershopForCurrentOwner(input).catch((error) => {
      logOperationalError('owner:create-barbershop', error);
      throw error;
    });
    const refreshedSession = await getCurrentAuthSession().catch((error) => {
      logOperationalError('owner:refresh-profile-after-onboarding', error);
      return null;
    });

    setOwnerBarbershop(createdBarbershop);
    setSettings(prev => normalizeSettings({
      ...prev,
      shopName: createdBarbershop.name
    }));

    if (refreshedSession) {
      handleAuthProfile(refreshedSession);
    } else if (authSession) {
      const fallbackSession: AuthSession = {
        ...authSession,
        role: 'owner',
        barbershopId: createdBarbershop.id
      };
      setAuthSession(fallbackSession);
      handleAuthProfile(fallbackSession);
    }

    setUserProfile(prev => ({
      ownerName: refreshedSession?.displayName || authSession?.displayName || prev?.ownerName || createdBarbershop.name,
      shopName: createdBarbershop.name,
      email: refreshedSession?.email || authSession?.email || prev?.email || '',
      startDate: prev?.startDate || Date.now(),
      isPro: true,
      planType: 'trial'
    }));

    addToast(`Barbearia criada. Link público: ${getBarbershopPublicBookingPath(createdBarbershop.slug)}`, 'success');

    return createdBarbershop;
  };

  const handleCompleteOwnerBarbershopOnboarding = () => {
    window.location.assign('/');
  };

  const getOwnerCatalogBarbershopId = (): string | undefined => (
    resolveOwnerScopedBarbershopId({
      authBarbershopId: authSession?.barbershopId,
      fallbackBarbershopId: ownerBarbershop?.id,
      supabaseConfigured: isSupabaseConfigured,
      allowLocalFallback: shouldUseLocalFallback
    })
  );

  const handleOwnerCatalogOperationError = (
    context: string,
    error: unknown,
    fallbackMessage: string
  ) => {
    logOperationalError(context, error);
    const message = getOperationalErrorMessage(error, fallbackMessage, {
      authExpiredMessage: 'Sua sessao pode ter expirado. Entre novamente.',
      networkMessage: 'Nao foi possivel conectar ao Supabase para atualizar o catalogo.'
    });
    setOwnerCatalogError(message);
    addToast(message, 'error');
  };

  const handleCreateOwnerBarber = async (name: string) => {
    const barbershopId = getOwnerCatalogBarbershopId();

    if (!barbershopId) {
      setOwnerCatalogError('Sua conta não possui uma barbearia válida para cadastrar barbeiro.');
      return;
    }

    setOwnerCatalogError(null);
    try {
      const created = await createBarber({ name, barbershopId, active: true });
      const nextBarbers = [...ownerCatalogBarbers.filter((barber) => barber.id !== created.id), created]
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      setOwnerCatalogBarbers(nextBarbers);
      syncActiveCatalogIntoSettings(nextBarbers, ownerCatalogServices);
      addToast('Barbeiro cadastrado!', 'success');
    } catch (error) {
      handleOwnerCatalogOperationError('owner-catalog:create-barber', error, 'Não foi possível cadastrar o barbeiro. Tente novamente.');
    }
  };

  const handleUpdateOwnerBarber = async (
    barberId: string,
    patch: { name?: string; active?: boolean }
  ) => {
    const barbershopId = getOwnerCatalogBarbershopId();

    if (!barbershopId) {
      setOwnerCatalogError('Sua conta não possui uma barbearia válida para atualizar barbeiro.');
      return;
    }

    setOwnerCatalogError(null);
    try {
      const updated = await updateBarber(barberId, patch, barbershopId);
      const nextBarbers = ownerCatalogBarbers
        .map((barber) => (barber.id === barberId ? updated : barber))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      setOwnerCatalogBarbers(nextBarbers);
      syncActiveCatalogIntoSettings(nextBarbers, ownerCatalogServices);
      addToast(updated.active === false ? 'Barbeiro desativado.' : 'Barbeiro atualizado.', 'success');
    } catch (error) {
      handleOwnerCatalogOperationError('owner-catalog:update-barber', error, 'Não foi possível atualizar o barbeiro. Tente novamente.');
    }
  };

  const handleRemoveOwnerBarber = async (barberId: string) => {
    const barbershopId = getOwnerCatalogBarbershopId();

    if (!barbershopId) {
      setOwnerCatalogError('Sua conta não possui uma barbearia válida para remover barbeiro.');
      return;
    }

    setOwnerCatalogError(null);
    try {
      const result = await removeBarber(barberId, barbershopId);
      const nextBarbers = result.action === 'deleted'
        ? ownerCatalogBarbers.filter((barber) => barber.id !== barberId)
        : ownerCatalogBarbers.map((barber) => (
            barber.id === barberId
              ? { ...barber, active: false }
              : barber
          ));

      setOwnerCatalogBarbers(nextBarbers);
      syncActiveCatalogIntoSettings(nextBarbers, ownerCatalogServices);
      addToast(
        result.action === 'deleted'
          ? 'Barbeiro removido.'
          : 'Barbeiro com histórico foi desativado para preservar a agenda.',
        'success'
      );
    } catch (error) {
      handleOwnerCatalogOperationError('owner-catalog:remove-barber', error, 'Não foi possível remover ou desativar o barbeiro. Tente novamente.');
    }
  };

  const handleCreateOwnerService = async (input: {
    name: string;
    price: number;
    durationMinutes: number;
    commissionRate?: number;
  }) => {
    const barbershopId = getOwnerCatalogBarbershopId();

    if (!barbershopId) {
      setOwnerCatalogError('Sua conta não possui uma barbearia válida para cadastrar serviço.');
      return;
    }

    setOwnerCatalogError(null);
    try {
      const created = await createService({
        ...input,
        barbershopId,
        active: true
      });
      const nextServices = [...ownerCatalogServices.filter((service) => service.id !== created.id), created]
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      setOwnerCatalogServices(nextServices);
      syncActiveCatalogIntoSettings(ownerCatalogBarbers, nextServices);
      addToast('Servico cadastrado!', 'success');
    } catch (error) {
      handleOwnerCatalogOperationError('owner-catalog:create-service', error, 'Não foi possível cadastrar o serviço. Tente novamente.');
    }
  };

  const handleUpdateOwnerService = async (
    serviceId: string,
    patch: { name?: string; price?: number; durationMinutes?: number; commissionRate?: number; active?: boolean }
  ) => {
    const barbershopId = getOwnerCatalogBarbershopId();

    if (!barbershopId) {
      setOwnerCatalogError('Sua conta não possui uma barbearia válida para atualizar serviço.');
      return;
    }

    setOwnerCatalogError(null);
    try {
      const updated = await updateService(serviceId, patch, barbershopId);
      const nextServices = ownerCatalogServices
        .map((service) => (service.id === serviceId ? updated : service))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      setOwnerCatalogServices(nextServices);
      syncActiveCatalogIntoSettings(ownerCatalogBarbers, nextServices);
      addToast(updated.active === false ? 'Serviço desativado.' : 'Serviço atualizado.', 'success');
    } catch (error) {
      handleOwnerCatalogOperationError('owner-catalog:update-service', error, 'Não foi possível atualizar o serviço. Tente novamente.');
    }
  };

  const handleRemoveOwnerService = async (serviceId: string) => {
    const barbershopId = getOwnerCatalogBarbershopId();

    if (!barbershopId) {
      setOwnerCatalogError('Sua conta não possui uma barbearia válida para remover serviço.');
      return;
    }

    setOwnerCatalogError(null);
    try {
      const result = await removeService(serviceId, barbershopId);
      const nextServices = result.action === 'deleted'
        ? ownerCatalogServices.filter((service) => service.id !== serviceId)
        : ownerCatalogServices.map((service) => (
            service.id === serviceId
              ? { ...service, active: false }
              : service
          ));

      setOwnerCatalogServices(nextServices);
      syncActiveCatalogIntoSettings(ownerCatalogBarbers, nextServices);
      addToast(
        result.action === 'deleted'
          ? 'Servico removido.'
          : 'Serviço com histórico foi desativado para preservar os agendamentos.',
        'success'
      );
    } catch (error) {
      handleOwnerCatalogOperationError('owner-catalog:remove-service', error, 'Não foi possível remover ou desativar o serviço. Tente novamente.');
    }
  };

  const handleLinkOwnerBarberProfile = async ({
    targetEmail,
    targetBarberId
  }: {
    targetEmail: string;
    targetBarberId: string;
  }) => {
    const barbershopId = getOwnerCatalogBarbershopId();

    return linkBarberProfileByEmail({
      targetEmail,
      targetBarberId,
      ownerBarbers: ownerCatalogBarbers,
      ownerBarbershopId: barbershopId
    });
  };

  const handleSaveOwnerBarbershopBranding = async (input: BarbershopBrandingInput) => {
    if (authSession?.role === 'barber') return;

    const barbershopId = resolveOwnerScopedBarbershopId({
      authBarbershopId: authSession?.barbershopId,
      fallbackBarbershopId: ownerBarbershop?.id,
      supabaseConfigured: isSupabaseConfigured,
      allowLocalFallback: shouldUseLocalFallback
    });

    if (!barbershopId) {
      setOwnerBarbershopError('Barbearia não encontrada para atualizar.');
      return;
    }

    setSavingOwnerBarbershop(true);
    setOwnerBarbershopError(null);
    setOwnerBarbershopSuccess(null);

    try {
      const updatedBarbershop = await updateCurrentBarbershopBranding(barbershopId, input);
      setOwnerBarbershop(updatedBarbershop);
      setSettings(prev => normalizeSettings({
        ...prev,
        shopName: updatedBarbershop.name
      }));
      setOwnerBarbershopSuccess('Aparência pública salva com sucesso.');
      addToast('Aparência pública salva.', 'success');
    } catch (error) {
      logOperationalError('owner:save-barbershop-settings', error);
      setOwnerBarbershopError(getOperationalErrorMessage(
        error,
        'Não foi possível salvar as configurações da barbearia.',
        {
          authExpiredMessage: 'Sua sessão pode ter expirado. Entre novamente antes de salvar.',
          networkMessage: 'Não foi possível conectar ao Supabase para salvar as configurações.'
        }
      ));
    } finally {
      setSavingOwnerBarbershop(false);
    }
  };

  const handleUploadOwnerBarbershopBrandingImage = async (file: File, type: BarbershopBrandingImageType): Promise<string> => {
    if (authSession?.role === 'barber') {
      throw new Error('Barbeiro não pode alterar a identidade da barbearia.');
    }

    const barbershopId = resolveOwnerScopedBarbershopId({
      authBarbershopId: authSession?.barbershopId,
      fallbackBarbershopId: ownerBarbershop?.id,
      supabaseConfigured: isSupabaseConfigured,
      allowLocalFallback: shouldUseLocalFallback
    });

    if (!barbershopId) {
      throw new Error('Barbearia não encontrada para upload.');
    }

    return uploadBarbershopBrandingImage({ barbershopId, file, type });
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
    const barbershopId = getOwnerCatalogBarbershopId();
    if (!barbershopId) {
      addToast('Sua conta não possui uma barbearia válida para agendar.', 'error');
      return;
    }

    const scopedAppointment = scopeOwnerAppointmentToTenant(appointment, barbershopId);
    const editingId = editingAppointment?.id;
    if (hasAppointmentConflict(appointments, scopedAppointment, editingId)) {
      addToast('Horario indisponivel para este barbeiro.', 'error');
      return;
    }

    try {
      const savedAppointment = editingId //
        ? await updateAppointmentRecord(editingId, scopedAppointment)
        : await createAppointmentRecord(scopedAppointment, appointments);

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
      logOperationalError('dashboard:save-appointment', error);
      addToast(getOperationalErrorMessage(
        error,
        'Nao foi possivel salvar o agendamento. Tente novamente.',
        {
          authExpiredMessage: 'Sua sessao pode ter expirado. Entre novamente antes de salvar.',
          networkMessage: 'Nao foi possivel conectar ao Supabase para salvar o agendamento.'
        }
      ), 'error');
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
      logOperationalError('barber-dashboard:create-appointment', error);
      addToast(getOperationalErrorMessage(
        error,
        'Nao foi possivel criar o agendamento. Tente novamente.',
        {
          authExpiredMessage: 'Sua sessao pode ter expirado. Entre novamente antes de criar o agendamento.',
          networkMessage: 'Nao foi possivel conectar ao Supabase para criar o agendamento.'
        }
      ), 'error');
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
      if (!shouldUseLocalFallback) {
        try {
          const completion = await completeAppointmentWithFinancialRecord(id);
          const completedAppointment = {
            ...updatedAppointment,
            status: 'completed' as const,
            financialRecordId: completion.financialRecordId
          };
          setAppointments(prev => prev.map(item => item.id === id ? completedAppointment : item));
          setClients(prev => prev.some(client => client.appointmentId === id)
            ? prev
            : [appointmentToClient(completedAppointment, settings, completion.financialRecordId), ...prev]);
          addToast('Agendamento concluido e financeiro lancado!', 'success');
        } catch (error) {
          logOperationalError('barber-dashboard:complete-appointment', error);
          addToast(getOperationalErrorMessage(error, 'Nao foi possivel concluir o agendamento e salvar o financeiro.'), 'error');
        }
        return;
      }

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
      throw createAppointmentConflictError(PUBLIC_BOOKING_APPOINTMENT_CONFLICT_MESSAGE);
    }

    try {
      const savedAppointment = await createPublicAppointment(appointment, appointments); //
      setAppointments(prev => [savedAppointment, ...prev]);
    } catch (error) {
      logOperationalError('public-booking:create-appointment', error);
      if (isAppointmentConflictError(error)) {
        addToast(PUBLIC_BOOKING_APPOINTMENT_CONFLICT_MESSAGE, 'error');
      } else {
        addToast(getOperationalErrorMessage(
          error,
          'Nao foi possivel confirmar este horario. Tente novamente.',
          { networkMessage: 'Nao foi possivel conectar ao Supabase para confirmar o agendamento.' }
        ), 'error');
      }
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

    if (status === 'completed' && !shouldUseLocalFallback) {
      try {
        const completion = await completeAppointmentWithFinancialRecord(appointment.id);
        const completedAppointment = {
          ...updatedAppointment,
          status: 'completed' as const,
          financialRecordId: completion.financialRecordId
        };
        setAppointments(prev => prev.map(item => item.id === appointment.id ? completedAppointment : item));
        setClients(prev => prev.some(client => client.appointmentId === appointment.id)
          ? prev
          : [appointmentToClient(completedAppointment, settings, completion.financialRecordId), ...prev]);
        addToast(appointment.financialRecordId
          ? 'Agendamento concluido sem duplicar financeiro.'
          : 'Agendamento concluido e financeiro lancado!', 'success');
      } catch (error) {
        logOperationalError('dashboard:complete-appointment', error);
        addToast(getOperationalErrorMessage(
          error,
          'Nao foi possivel concluir o agendamento e salvar o financeiro.',
          {
            authExpiredMessage: 'Sua sessao pode ter expirado. Entre novamente antes de concluir.',
            networkMessage: 'Nao foi possivel conectar ao Supabase para concluir o agendamento.'
          }
        ), 'error');
      }
      return;
    }

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
      logOperationalError('dashboard:update-appointment-status', error);
      addToast(getOperationalErrorMessage(
        error,
        'Nao foi possivel atualizar o status do agendamento.',
        {
          authExpiredMessage: 'Sua sessao pode ter expirado. Entre novamente antes de atualizar.',
          networkMessage: 'Nao foi possivel conectar ao Supabase para atualizar o agendamento.'
        }
      ), 'error');
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
            activeShopName,
            displayLabel,
            rangeStats,
            rangeClients,
            rangeVales
        );
        addToast('Relatório PDF gerado!', 'success');
    } catch (e) {
        logOperationalError('reports:download-range', e);
        addToast('Nao foi possivel gerar o relatorio do periodo. Tente novamente.', 'error');
    }
  };

  const handleDownloadDaily = async () => {
    try {
      const { generateReportPDF } = await import('./services/pdfService');
      generateReportPDF(
        activeShopName,
        selectedDate,
        stats,
        filteredClients,
        filteredVales
      );
      addToast('Relatório do dia baixado!', 'success');
    } catch (e) {
      logOperationalError('reports:download-daily', e);
      addToast('Nao foi possivel gerar o relatorio do dia. Tente novamente.', 'error');
    }
  };

  const handleOpenAddClient = () => {
    setEditingClient(null);
    setClientModalOpen(true);
  };
  
  const handleLogout = async (confirmLogout = true) => {
    if (confirmLogout && !window.confirm('Deseja sair?')) return;

    if (isSupabaseConfigured) {
      try {
        await signOutAuth();
      } catch (error) {
        logOperationalError('auth:sign-out', error);
        throw error;
      }
    }

    setAuthSession(null);
    setUserProfile(null);
  };

  const ownerNavigationItems: DashboardNavigationItem[] = [
    { id: 'appointments', label: 'Agenda', description: 'Acompanhe horarios e operacao do dia.', icon: <Calendar size={18} /> },
    { id: 'clients', label: 'Clientes', description: 'Consulte os atendimentos registrados.', icon: <Users size={18} /> },
    { id: 'vales', label: 'Vales', description: 'Acompanhe os descontos registrados.', icon: <MinusCircle size={18} /> },
    { id: 'reports', label: 'Relatórios', description: 'Analise resultados e períodos anteriores.', icon: <BarChart3 size={18} /> },
    { id: 'management', label: 'Gestão', description: 'Configure presença pública, equipe e catálogo.', icon: <Settings size={18} /> }
  ];
  const activeOwnerSection = viewMode === 'monthly' ? 'reports' : activeTab;
  const applyOwnerNavigation = (
    section: OwnerMainSection,
    managementSection: ManagementSectionHash = activeManagementSection
  ) => {
    const nextHash = getOwnerNavigationHash(section, managementSection);
    setActiveManagementSection(managementSection);
    if (section === 'reports') {
      setViewMode('monthly');
    } else {
      setViewMode('daily');
      setActiveTab(section);
    }

    if (window.location.hash === nextHash) return;
    if (nextHash) {
      window.location.hash = nextHash;
    } else {
      window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  };
  const handleOwnerNavigation = (sectionId: string) => {
    applyOwnerNavigation(sectionId as OwnerMainSection);
  };
  const handleManagementNavigation = (section: ManagementSectionHash) => {
    applyOwnerNavigation('management', section);
  };

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
        title: 'Resumo do dia',
        content: 'Aqui aparecem os principais numeros e atendimentos do periodo selecionado.',
        position: 'bottom'
    },
    {
        targetId: 'tour-actions',
        title: 'Acoes rapidas',
        content: 'Use esta area para agendar, registrar vales e abrir funcoes operacionais.',
        position: 'bottom'
    },
    {
        targetId: 'tour-filters',
        title: 'Relatorios',
        content: 'Aqui voce consulta resultados e gera relatorios do periodo.',
        position: 'bottom'
    }
  ];

  // Public Booking Route
  const operationalBlockingMessage = getOperationalBlockingMessage(isProductionWithoutSupabase);

  if (operationalBlockingMessage) {
    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <div className="min-h-screen flex items-center justify-center px-4 text-foreground">
          <div className="ui-surface max-w-xl p-8 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-red-300">Configuracao indisponivel</p>
            <h1 className="mb-3 text-2xl font-bold text-foreground">Supabase obrigatorio em producao</h1>
            <p className="text-sm text-muted-foreground">{operationalBlockingMessage}</p>
          </div>
        </div>
      </>
    );
  }

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

  if (isAuthCallbackRoute) {
    return <AuthCallbackScreen loading={isAuthLoading} session={authSession} />;
  }

  const internalAuthView = getInternalAuthView(isAuthLoading, authSession, isSupabaseConfigured);

  if (internalAuthView === 'loading') {
    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <div className="min-h-screen flex items-center justify-center text-muted-foreground">
          Validando sessao...
        </div>
      </>
    );
  }

  if (internalAuthView === 'auth') {
    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <React.Suspense fallback={<ViewFallback />}>
          <AuthScreen
            onSignIn={handleAuthSignIn}
            onSignUp={handleAuthSignUp}
            loading={isAuthLoading}
            error={authError}
          />
        </React.Suspense>
      </>
    );
  }

  if (internalAuthView === 'owner-onboarding' && authSession?.role === 'owner') {
    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <React.Suspense fallback={<ViewFallback />}>
          <OwnerBarbershopOnboarding
            authSession={authSession}
            onCreate={handleCreateOwnerBarbershop}
            onComplete={handleCompleteOwnerBarbershopOnboarding}
          />
        </React.Suspense>
      </>
    );
  }

  if (internalAuthView === 'barber-dashboard' && authSession?.role === 'barber') {
    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <React.Suspense fallback={<ViewFallback />}>
          <BarberDashboard
            authSession={authSession}
            appointments={appointments}
            settings={settings}
            onCreateAppointment={handleCreateBarberAppointment}
            addToast={addToast}
            onSignOut={handleLogout}
          />
        </React.Suspense>
      </>
    );
  }

  // If not authenticated (local storage mode), show the local setup screen.
  if (!userProfile) return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <React.Suspense fallback={<ViewFallback />}>
        <LoginScreen onLogin={handleLogin} />
      </React.Suspense>
    </>
  );

  return (
    <div className="font-sans selection:bg-gold-500/30">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {isTourOpen && (
        <React.Suspense fallback={null}>
          <TourOverlay steps={tourSteps} isOpen={isTourOpen} onComplete={handleTourComplete} />
        </React.Suspense>
      )}
      {isReportModalOpen && (
        <React.Suspense fallback={null}>
          <ReportModal isOpen={isReportModalOpen} onClose={() => setReportModalOpen(false)} onDownload={handleDownloadRange} initialDate={selectedDate} />
        </React.Suspense>
      )}

      <DashboardShell
        barbershopName={activeShopName}
        userName={userProfile.ownerName}
        roleLabel={roleBadgeLabel}
        activeItemId={activeOwnerSection}
        items={ownerNavigationItems}
        onNavigate={handleOwnerNavigation}
        onLogout={handleLogout}
        headerAction={(
          <button
                type="button"
                onClick={handleReopenTour}
                className="ui-dashboard-help"
              >
                Ajuda
              </button>
        )}
      >
        
        <div hidden={activeOwnerSection !== 'management'}>
          <React.Suspense fallback={<SectionFallback />}>
            <SettingsWorkspace
              publicPresence={(
                <BarbershopBrandingSettings
                  barbershop={ownerBarbershop}
                  role={authSession?.role || 'owner'}
                  loading={isOwnerBarbershopLoading}
                  saving={isSavingOwnerBarbershop}
                  error={ownerBarbershopError}
                  success={ownerBarbershopSuccess}
                  onSave={handleSaveOwnerBarbershopBranding}
                  onUploadImage={handleUploadOwnerBarbershopBrandingImage}
                />
              )}
              readiness={(
                <OwnerSetupChecklist
                  role={authSession?.role || 'owner'}
                  authSession={authSession}
                  barbershop={ownerBarbershop}
                  barbers={ownerCatalogBarbers}
                  services={ownerCatalogServices}
                />
              )}
              team={(
                <OwnerBarberProfileLinking
                  role={authSession?.role || 'owner'}
                  barbers={ownerCatalogBarbers}
                  onLinkProfile={handleLinkOwnerBarberProfile}
                />
              )}
              catalog={(
                <OwnerCatalogManager
                  barbers={ownerCatalogBarbers}
                  services={ownerCatalogServices}
                  loading={isOwnerCatalogLoading}
                  error={ownerCatalogError}
                  onCreateBarber={handleCreateOwnerBarber}
                  onUpdateBarber={handleUpdateOwnerBarber}
                  onRemoveBarber={handleRemoveOwnerBarber}
                  onCreateService={handleCreateOwnerService}
                  onUpdateService={handleUpdateOwnerService}
                  onRemoveService={handleRemoveOwnerService}
                />
              )}
              activeSection={activeManagementSection}
              onNavigate={handleManagementNavigation}
            />
          </React.Suspense>
        </div>

        {viewMode === 'daily' && activeTab !== 'management' && (
          <div className="animate-slide-in">
             <div className="ui-owner-toolbar flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                 <div id="tour-actions" className="flex gap-2 w-full md:w-auto">
                    <button onClick={handleOpenAppointment} className="ui-button ui-button-secondary flex-1 md:flex-none">
                        <Calendar size={18} /> Agendar
                    </button>
                    <button onClick={() => setValeModalOpen(true)} className="ui-button ui-button-secondary flex-1 md:flex-none">
                        <MinusCircle size={18} /> Vale
                    </button>
                    <button id="tour-settings-btn" onClick={() => setSettingsModalOpen(true)} className="ui-button ui-button-secondary shrink-0">
                        <Settings size={18} />
                    </button>
                </div>

                <div id="tour-filters" className="flex gap-2 w-full md:w-auto items-center overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                    <button onClick={() => handleOwnerNavigation('reports')} className="ui-owner-toolbar-button px-4 py-2.5 rounded-xl shrink-0">
                        <BarChart3 size={18} />
                    </button>
                    <div className="ui-owner-date-control flex items-center rounded-xl p-0.5 flex-1 justify-between md:flex-none min-w-[140px]" id="tour-date-picker">
                        <button type="button" aria-label="Dia anterior" onClick={() => changeDate(-1)} className="p-2"><ChevronLeft size={20} aria-hidden="true" /></button>
                        <input aria-label="Data operacional" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="ui-owner-date-input text-sm text-center w-full md:w-32" />
                        <button type="button" aria-label="Proximo dia" onClick={() => changeDate(1)} className="p-2"><ChevronRight size={20} aria-hidden="true" /></button>
                    </div>
                    {barberFilterOptions.length > 1 && (
                        <div className="relative shrink-0">
                            <Filter size={16} className="ui-owner-filter-icon absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <select
                                value={selectedBarberFilter}
                                onChange={(e) => setSelectedBarberFilter(e.target.value)}
                                className="ui-owner-filter text-sm rounded-xl pl-9 pr-3 py-2.5 appearance-none min-w-[180px]"
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
                        className="ui-button ui-button-secondary shrink-0"
                        title="Baixar Relatório do Dia (PDF)"
                    >
                        <FileText size={18} />
                    </button>
                    {/* Botão Baixar Relatório por Período */}
                    <button 
                        onClick={() => setReportModalOpen(true)} 
                        className="ui-button ui-button-secondary shrink-0"
                        title="Exportar Dados (PDF/Excel)"
                    >
                        <Download size={18} />
                    </button>
                </div>
             </div>
             
             {/* New Dashboard Charts */}
             <div className="mb-6">
                <React.Suspense fallback={<SectionFallback />}>
                  <DashboardCharts clients={chartClients} />
                </React.Suspense>
             </div>

             <div id="tour-stats" className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <StatsCard title="Atendimentos" value={stats.totalClients.toString()} icon={<Users size={20} />} />
                <StatsCard title="Faturamento bruto" value={formatCurrency(stats.totalSales)} icon={<DollarSign size={20} />} colorClass="ui-owner-metric" />
                <StatsCard title="Saldo estimado de comissao" value={formatCurrency(stats.netCommission)} subtitle="Comissao calculada menos vales" icon={<TrendingUp size={20} />} colorClass="ui-owner-metric" />
             </div>

              <div className="mb-6 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-100">
                Os valores de comissao sao calculados a partir dos atendimentos registrados. Este painel nao confirma pagamento de repasse.
              </div>

              {/* Lists */}
              {activeTab === 'appointments' && isAppointmentsLoading && (
                <Surface className="ui-schedule-loading">
                  <LoadingState title="Carregando agenda online" description="Aguarde enquanto atualizamos os horarios." />
                </Surface>
              )}
              {activeTab === 'appointments' && appointmentsError && (
                <InlineNotice tone="error" className="mb-4">{appointmentsError}</InlineNotice>
              )}
              <div className={activeTab === 'appointments' ? 'ui-schedule-host' : 'ui-owner-list overflow-hidden'}>
                 <div className="min-h-[200px]">
                    {activeTab === 'appointments' ? (
                      <React.Suspense fallback={<SectionFallback />}>
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
                      </React.Suspense>
                    ) : activeTab === 'clients' ? (
                        <>
                           {filteredClients.length === 0 ? (
                            <div className="ui-owner-empty m-4 text-center">
                              <p className="font-bold text-foreground">
                                {selectedBarberFilter === 'TODOS' ? 'Nenhum atendimento registrado ainda.' : `Nenhum atendimento para ${selectedBarberFilter}.`}
                              </p>
                              <p className="mx-auto mt-2 max-w-md text-sm">
                                Quando voce registrar um atendimento manual ou concluir agendamentos, o historico de clientes aparecera aqui.
                              </p>
                              <p className="mt-3 text-xs font-bold uppercase tracking-widest text-gold-300">Use o botao Agendar para criar o primeiro agendamento.</p>
                            </div>
                           ) : (
                                <>
                                    {/* Mobile View: Cards */}
                                    <div className="md:hidden p-4 space-y-3">
                                        {filteredClients.map(c => (
                                            <div key={c.id} className={`ui-owner-record-card relative transition-colors ${c.clientType === ClientType.NEW ? 'border-l-4 border-l-green-600' : 'border-l-4 border-l-gold-700'}`}>
                                                
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="ui-owner-badge flex items-center gap-1 rounded px-2 py-1 font-mono text-xs">
                                                            <Clock size={12}/> {formatTime(c.timestamp)}
                                                        </span>
                                                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${c.clientType === ClientType.NEW ? 'bg-green-900/30 text-green-400' : 'bg-gold-500/10 text-gold-500'}`}>
                                                            {c.clientType === ClientType.NEW ? 'NOVO' : 'CASA'}
                                                        </span>
                                                    </div>
                                                    <span className="text-lg font-bold text-foreground">
                                                        {formatCurrency(c.totalValue)}
                                                    </span>
                                                </div>

                                                <div className="mb-4">
                                                    <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
                                                        {c.name}
                                                    </h3>
                                                    <p className="mt-1 flex items-center gap-1 text-sm text-foreground">
                                                        <Scissors size={14} className="text-muted-foreground"/>
                                                        {c.serviceType}
                                                        {c.extraValue > 0 && <span className="ml-1 text-xs text-muted-foreground">(+Adic)</span>}
                                                    </p>
                                                    {c.products && c.products.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {c.products.map(p => (
                                                                <span key={p.id} className="ui-owner-badge rounded px-2 py-0.5 text-[10px]">
                                                                    + {p.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                                                        <User size={12}/> Barbeiro: {c.barberName}
                                                    </p>
                                                </div>

                                                <div className="flex gap-3 border-t border-border pt-3">
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
                                            <thead className="ui-owner-table-head text-xs uppercase">
                                                <tr>
                                                    <th className="p-4">Hora</th>
                                                    <th className="p-4">Cliente</th>
                                                    <th className="p-4">Servico</th>
                                                    <th className="p-4 text-right">Valor</th>
                                                    <th className="p-4 w-20"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredClients.map(c => (
                                                    <tr key={c.id} className="ui-owner-table-row group">
                                                        <td className="p-4 font-mono text-xs whitespace-nowrap text-muted-foreground">{formatTime(c.timestamp)}</td>
                                                        <td className="min-w-[100px] p-4 font-medium text-foreground">
                                                            {c.name}
                                                            <span className={`block text-[10px] ${c.clientType === ClientType.NEW ? 'text-green-400' : 'text-gold-500'}`}>{c.clientType}</span>
                                                        </td>
                                                        <td className="p-4 text-sm whitespace-nowrap text-foreground">
                                                            {c.serviceType}
                                                            {c.products && c.products.length > 0 && (
                                                                <span className="text-green-400 text-xs block">
                                                                    + {c.products.length} Prod.
                                                                </span>
                                                            )}
                                                            {c.extraValue > 0 && <span className="ml-1 text-xs text-muted-foreground">+{c.extraValue}</span>}
                                                        </td>
                                                        <td className="p-4 text-right font-bold text-foreground whitespace-nowrap">{formatCurrency(c.totalValue)}</td>
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
                           {filteredVales.length === 0 ? (
                            <div className="ui-owner-empty m-4 text-center">
                              <p className="font-bold text-foreground">
                                {selectedBarberFilter === 'TODOS' ? 'Nenhum vale registrado ainda.' : `Nenhum vale para ${selectedBarberFilter}.`}
                              </p>
                              <p className="mx-auto mt-2 max-w-md text-sm">
                                Vales lancados para barbeiros aparecem aqui e entram no resumo financeiro do periodo.
                              </p>
                              <p className="mt-3 text-xs font-bold uppercase tracking-widest text-gold-300">Use o botao Vale quando precisar registrar o primeiro desconto.</p>
                            </div>
                           ) : (
                                <>
                                    {/* Mobile View: Cards for Vales */}
                                    <div className="md:hidden p-4 space-y-3">
                                        {filteredVales.map(v => (
                                            <div key={v.id} className="ui-owner-record-card relative border-l-4 border-l-red-600 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                     <div className="flex items-center gap-2">
                                                        <span className="ui-owner-badge flex items-center gap-1 rounded px-2 py-1 font-mono text-xs">
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
                                                    <h3 className="text-lg font-bold text-foreground">{v.barberName}</h3>
                                                    <p className="mt-1 text-sm italic text-muted-foreground">"{v.description}"</p>
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
                                            <thead className="ui-owner-table-head text-xs uppercase">
                                                <tr>
                                                    <th className="p-4">Hora</th>
                                                    <th className="p-4">Descricao</th>
                                                    <th className="p-4 text-right">Valor</th>
                                                    <th className="p-4 w-16"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredVales.map(v => (
                                                    <tr key={v.id} className="ui-owner-table-row">
                                                        <td className="p-4 font-mono text-xs whitespace-nowrap text-muted-foreground">{formatTime(v.timestamp)}</td>
                                                        <td className="min-w-[120px] p-4 text-foreground">{v.description} <span className="text-xs text-muted-foreground">({v.barberName})</span></td>
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
          <React.Suspense fallback={<SectionFallback />}>
             <MonthlySummary clients={clients} vales={vales} settings={settings} onBack={() => handleOwnerNavigation('appointments')} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
          </React.Suspense>
        )}
      </DashboardShell>

      <React.Suspense fallback={null}>
        {isClientModalOpen && (
          <AddClientModal isOpen={isClientModalOpen} onClose={() => setClientModalOpen(false)} settings={settings} onSave={handleSaveClient} initialData={editingClient} />
        )}
        {isValeModalOpen && (
          <AddValeModal isOpen={isValeModalOpen} onClose={() => setValeModalOpen(false)} onAdd={handleAddVale} settings={settings} />
        )}
        {isSettingsModalOpen && (
          <SettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setSettingsModalOpen(false)}
            settings={settings}
            onSave={(nextSettings) => setSettings(normalizeSettings(
              isSupabaseConfigured
                ? { ...nextSettings, barbers: settings.barbers, services: settings.services }
                : nextSettings
            ))}
            userProfile={userProfile}
            clients={clients}
            vales={vales}
            appointments={appointments}
            manageCatalogRemotely={isSupabaseConfigured}
          />
        )}
        {isAppointmentModalOpen && (
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
        )}
      </React.Suspense>
    </div>
  );
};

export default App;
