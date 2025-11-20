
export enum ServiceType {
  CUT = 'Corte',
  COMBO = 'Combo', // Cut + Beard
  OTHER = 'Outros'
}

export enum ClientType {
  NEW = 'Novidade',
  RETURNING = 'Da Casa'
}

export interface Client {
  id: string;
  name: string;
  barberName: string;
  serviceType: ServiceType;
  clientType: ClientType;
  serviceValue: number;
  extraValue: number; // For additional services
  totalValue: number;
  timestamp: number; // Date.now()
}

export interface Vale {
  id: string;
  barberName: string;
  value: number;
  description: string;
  timestamp: number;
}

export interface DailyHistory {
  id: string;
  date: number;
  clients: Client[];
  vales: Vale[];
  summary: {
    totalClients: number;
    totalSales: number;
    netCommission: number;
  };
}

export interface AppSettings {
  shopName: string;
  logoUrl: string;
  priceCut: number;
  priceCombo: number;
  commissionRate: number; // Percentage (e.g., 40)
}

export interface UserProfile {
  ownerName: string;
  shopName: string;
  email: string;
  startDate: number; // Timestamp of when they started using the app
  isPro: boolean; // If they have paid
}

export const DEFAULT_SETTINGS: AppSettings = {
  shopName: 'Barbearia Pro',
  logoUrl: '',
  priceCut: 60,
  priceCombo: 90,
  commissionRate: 40,
};
