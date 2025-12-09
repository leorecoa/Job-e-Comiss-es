
import React, { useState, useEffect } from 'react';
import { ServiceType, AppSettings, ClientType, Client, ProductItem } from '../types';
import { X, Check, UserPlus, UserCheck, Clock, ChevronDown, Tag, FileText, ShoppingBag } from 'lucide-react';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (clientData: any) => void;
  initialData?: Client | null;
}

export const AddClientModal: React.FC<AddClientModalProps> = ({ isOpen, onClose, settings, onSave, initialData }) => {
  const [name, setName] = useState('');
  const [barber, setBarber] = useState('');
  const [service, setService] = useState<ServiceType>(ServiceType.CUT);
  const [clientType, setClientType] = useState<ClientType>(ClientType.RETURNING);
  const [extraValue, setExtraValue] = useState<string>('0');
  const [customPrice, setCustomPrice] = useState<string>('');
  const [description, setDescription] = useState<string>(''); 
  const [time, setTime] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<ProductItem[]>([]);

  // Reset or populate form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setBarber(initialData.barberName);
        setService(initialData.serviceType);
        setClientType(initialData.clientType || ClientType.RETURNING);
        setExtraValue(initialData.extraValue.toString());
        setDescription(initialData.description || '');
        setSelectedProducts(initialData.products || []);
        
        if (initialData.serviceType === ServiceType.OTHER || initialData.serviceType === ServiceType.PRODUCT) {
           setCustomPrice(initialData.serviceValue.toString());
        } else {
           setCustomPrice('');
        }

        const d = new Date(initialData.timestamp);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        setTime(`${hours}:${minutes}`);

      } else {
        setName('');
        setBarber(settings.barbers && settings.barbers.length > 0 ? settings.barbers[0] : '');
        setService(ServiceType.CUT);
        setClientType(ClientType.RETURNING);
        setExtraValue('0');
        setCustomPrice('');
        setDescription('');
        setSelectedProducts([]);
        
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        setTime(`${hours}:${minutes}`);
      }
    }
  }, [isOpen, initialData, settings.barbers]);

  if (!isOpen) return null;

  const getServicePrice = () => {
    if (service === ServiceType.CUT) return settings.priceCut;
    if (service === ServiceType.BEARD) return settings.priceBeard || 0;
    if (service === ServiceType.COMBO) return settings.priceCombo;
    // If it's pure Product type (legacy) or Other
    if (service === ServiceType.PRODUCT) return Number(customPrice) || settings.priceProduct || 0;
    return Number(customPrice) || 0;
  };

  const getProductsTotal = () => {
    return selectedProducts.reduce((acc, p) => acc + p.price, 0);
  };

  const getTotal = () => {
    return getServicePrice() + getProductsTotal() + (Number(extraValue) || 0);
  };

  const toggleProduct = (product: ProductItem) => {
    setSelectedProducts(prev => {
        const exists = prev.find(p => p.id === product.id);
        if (exists) {
            return prev.filter(p => p.id !== product.id);
        } else {
            return [...prev, product];
        }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const serviceVal = getServicePrice();
    const productsVal = getProductsTotal();
    
    // Calculate Commission
    // Service Commission
    const serviceCommission = serviceVal * (settings.commissionRate / 100);
    
    // Product Commission (Individual or Default)
    const productsCommission = selectedProducts.reduce((acc, p) => {
        const rate = p.commissionRate !== undefined ? p.commissionRate : (settings.productCommissionRate || 10);
        return acc + (p.price * (rate / 100));
    }, 0);

    const totalCommission = serviceCommission + productsCommission;

    // Create description string if products are selected but description is empty
    let finalDescription = description;
    if (!finalDescription && selectedProducts.length > 0) {
        finalDescription = selectedProducts.map(p => p.name).join(', ');
    }

    onSave({
      name,
      barberName: barber,
      serviceType: service,
      clientType: clientType,
      serviceValue: serviceVal,
      extraValue: Number(extraValue),
      totalValue: getTotal(),
      commissionValue: totalCommission,
      timeStr: time,
      description: finalDescription,
      products: selectedProducts
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-slide-in">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white font-display">
            {initialData ? 'Editar Atendimento' : 'Novo Atendimento'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Top Row: Client Type & Time */}
          <div className="grid grid-cols-2 gap-3 mb-2">
             <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
                <button
                  type="button"
                  onClick={() => setClientType(ClientType.NEW)}
                  className={`flex-1 flex items-center justify-center rounded-md text-xs font-medium transition-all py-2 ${
                    clientType === ClientType.NEW
                      ? 'bg-green-900/50 text-green-400 shadow-sm'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <UserPlus size={14} className="mr-1" /> Novo
                </button>
                <button
                  type="button"
                  onClick={() => setClientType(ClientType.RETURNING)}
                  className={`flex-1 flex items-center justify-center rounded-md text-xs font-medium transition-all py-2 ${
                    clientType === ClientType.RETURNING
                      ? 'bg-gold-500/20 text-gold-500 shadow-sm'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <UserCheck size={14} className="mr-1" /> Casa
                </button>
             </div>

             <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <Clock size={16} />
                </div>
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-3 py-2.5 text-white focus:ring-2 focus:ring-gold-500 outline-none [color-scheme:dark]"
                />
             </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Nome do Cliente</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-gold-500 outline-none"
              placeholder="Ex: João Silva"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Barbeiro</label>
            {settings.barbers && settings.barbers.length > 0 ? (
                 <div className="relative">
                    <select
                        required
                        value={barber}
                        onChange={(e) => setBarber(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-gold-500 outline-none appearance-none"
                    >
                        {settings.barbers.map(b => (
                            <option key={b} value={b}>{b}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                 </div>
            ) : (
                <input
                required
                type="text"
                value={barber}
                onChange={(e) => setBarber(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-gold-500 outline-none"
                placeholder="Quem atendeu?"
                />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Serviço Principal</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.values(ServiceType)
               .filter(t => t !== ServiceType.PRODUCT) // Hide generic product type if we have specific products list
               .map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setService(type)}
                  className={`py-2 px-1 rounded-lg text-xs font-medium transition-all ${
                    service === type
                      ? 'bg-gold-500 text-black shadow-lg shadow-gold-500/20'
                      : 'bg-gray-900 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {type}
                </button>
              ))}
              {/* Optional: Generic Product Button if list is empty or strictly needed */}
              {(!settings.products || settings.products.length === 0) && (
                   <button
                   type="button"
                   onClick={() => setService(ServiceType.PRODUCT)}
                   className={`py-2 px-1 rounded-lg text-xs font-medium transition-all ${
                     service === ServiceType.PRODUCT
                       ? 'bg-green-500 text-black shadow-lg shadow-green-500/20'
                       : 'bg-gray-900 text-gray-400 hover:bg-gray-700'
                   }`}
                 >
                   Produto
                 </button>
              )}
            </div>
          </div>
          
          {/* Products Multi-Selection */}
          {settings.products && settings.products.length > 0 && (
             <div className="p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
                 <div className="flex items-center gap-2 mb-2">
                    <ShoppingBag size={14} className="text-green-400"/>
                    <p className="text-xs text-gray-400 font-bold uppercase">Adicionar Produtos:</p>
                 </div>
                 <div className="flex flex-wrap gap-2">
                     {settings.products.map(p => {
                         const isSelected = selectedProducts.some(sp => sp.id === p.id);
                         return (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => toggleProduct(p)}
                                className={`px-3 py-1.5 rounded-full text-xs border transition-colors flex items-center gap-1 ${
                                    isSelected 
                                        ? 'bg-green-600 text-white border-green-500' 
                                        : 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700'
                                }`}
                            >
                                {isSelected && <Check size={12} />}
                                {p.name} <span className="opacity-70 font-mono">R${p.price}</span>
                            </button>
                         );
                     })}
                 </div>
             </div>
          )}
          
          {/* Custom Price - Only for Other */}
          {(service === ServiceType.OTHER || (service === ServiceType.PRODUCT && selectedProducts.length === 0)) && (
             <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                   Valor do Serviço/Produto (R$)
                </label>
                <input
                  type="number"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-gold-500 outline-none"
                />
              </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
               Observações
            </label>
            <div className="relative">
                <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex: Disfarçado baixo, detalhes..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 pl-10 text-white focus:ring-2 focus:ring-gold-500 outline-none"
                />
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Adicionais (R$)</label>
            <input
              type="number"
              value={extraValue}
              onChange={(e) => setExtraValue(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-gold-500 outline-none"
              placeholder="0.00"
            />
            <p className="text-xs text-gray-500 mt-1">Sobrancelha, Pezinho, etc.</p>
          </div>

          <div className="pt-4 border-t border-gray-700 flex justify-between items-center">
            <div className="text-white">
              <p className="text-sm text-gray-400">Total Final</p>
              <p className="text-2xl font-bold text-gold-500">R$ {getTotal().toFixed(2)}</p>
            </div>
            <button
              type="submit"
              className="bg-white hover:bg-gray-100 text-black font-bold py-3 px-6 rounded-xl transition-colors flex items-center gap-2"
            >
              <Check size={20} />
              {initialData ? 'Salvar' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
