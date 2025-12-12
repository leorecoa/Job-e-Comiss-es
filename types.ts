
export enum ServiceType {
  CUT = 'Corte',
  BEARD = 'Barba',
  COMBO = 'Combo', // Cut + Beard
  PRODUCT = 'Produto', // Standalone product sale
  OTHER = 'Outros'
}

export enum ClientType {
  NEW = 'Novidade',
  RETURNING = 'Da Casa'
}

export interface ProductItem {
  id: string;
  name: string;
  price: number;
  // Commission rate removed as requested
}

export interface Client {
  id: string;
  name: string;
  phone?: string;        // Optional Phone
  birthDate?: string;    // Optional Birth Date (YYYY-MM-DD)
  address?: string;      // Optional Address
  barberName: string;
  serviceType: ServiceType;
  clientType: ClientType;
  serviceValue: number;
  extraValue: number; // For additional services
  totalValue: number;
  commissionValue: number; // The exact commission value calculated at time of sale
  timestamp: number; // Date.now()
  description?: string; // Notes
  products: ProductItem[]; // List of products sold with this service
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
  priceBeard: number;
  priceCombo: number;
  priceProduct: number; // Default/Fallback price
  products: ProductItem[]; // List of specific products
  commissionRate: number; // Service Commission Percentage (e.g., 50)
  barbers: string[]; // List of registered barbers
}

export type PlanType = 'trial' | 'pro_monthly' | 'vip_monthly' | 'admin_life';

export interface UserProfile {
  ownerName: string;
  shopName: string;
  email: string;
  startDate: number;
  isPro: boolean;
  planType: PlanType;
}

export const DEFAULT_SETTINGS: AppSettings = {
  shopName: 'Gestão Máxima',
  logoUrl: '',
  priceCut: 50,
  priceBeard: 30,
  priceCombo: 70,
  priceProduct: 0,
  products: [],
  commissionRate: 50,
  barbers: []
};
