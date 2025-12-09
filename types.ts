

export enum ServiceType {
  CUT = 'Corte',
  BEARD = 'Barba',
  COMBO = 'Combo', // Cut + Beard
  PRODUCT = 'Produto',
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
  description?: string; // Name of the product or details
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
  commissionRate: number; // Percentage (e.g., 40)
  barbers: string[]; // Lista de barbeiros cadastrados (VIP)
}

export type PlanType = 'trial' | 'pro_monthly' | 'vip_monthly' | 'admin_life';

export interface UserProfile {
  ownerName: string;
  shopName: string;
  email: string;
  startDate: number; // Timestamp of when they started using the app
  isPro: boolean; // If they have paid (General check)
  planType: PlanType; // Specific plan detail
}

export const DEFAULT_SETTINGS: AppSettings = {
  shopName: 'Gestão Máxima',
  logoUrl: '',
  priceCut: 50,
  priceBeard: 30,
  priceCombo: 70,
  priceProduct: 0,
  products: [],
  commissionRate: 40,
  barbers: []
};