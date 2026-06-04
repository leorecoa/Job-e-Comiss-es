
import React, { useState, useEffect } from 'react';
import { ServiceType, AppSettings, ClientType, Client, ClientFormData, ProductItem } from '../types';
import { X, Check, UserPlus, UserCheck, Clock, ChevronDown, Tag, FileText, ShoppingBag, Calculator, Scissors, Plus, Phone, MapPin, Calendar, ChevronRight } from 'lucide-react';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (clientData: ClientFormData) => void;
  initialData?: Client | null;
}

export const AddClientModal: React.FC<AddClientModalProps> = ({ isOpen, onClose, settings, onSave, initialData }) => {
  // -- Form State --
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [address, setAddress] = useState('');
  
  const [barber, setBarber] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>(ServiceType.CUT);
  const [clientType, setClientType] = useState<ClientType>(ClientType.RETURNING);
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');
  
  const [showDetails, setShowDetails] = useState(false);

  // -- Financial State --
  const [serviceValue, setServiceValue] = useState<string>(''); // Valor do Serviço Base
  const [extraValue, setExtraValue] = useState<string>(''); // Adicionais (Sobrancelha etc)
  const [selectedProducts, setSelectedProducts] = useState<ProductItem[]>([]); // Produtos selecionados
  
  // -- Commission State --
  const [commissionValue, setCommissionValue] = useState<string>('');
  const [isCommissionEdited, setIsCommissionEdited] = useState(false);
  const [formError, setFormError] = useState('');

  // -- Initialization Effect --
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Edit Mode
        setName(initialData.name);
        setPhone(initialData.phone || '');
        setBirthDate(initialData.birthDate || '');
        setAddress(initialData.address || '');
        setBarber(initialData.barberName);
        setServiceType(initialData.serviceType);
        setClientType(initialData.clientType || ClientType.RETURNING);
        setDescription(initialData.description || '');
        
        // Check if we should show details by default
        if (initialData.phone || initialData.birthDate || initialData.address) {
            setShowDetails(true);
        } else {
            setShowDetails(false);
        }
        
        // Time Formatting
        const d = new Date(initialData.timestamp);
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        setTime(`${h}:${m}`);

        // Financials
        setServiceValue(initialData.serviceValue?.toString() || initialData.totalValue.toString());
        setExtraValue(initialData.extraValue?.toString() || '');
        setSelectedProducts(initialData.products || []);
        
        // Commission
        const initialCommissionValue = initialData.commissionValue;
        const fallbackCommission = initialData.serviceType === ServiceType.PRODUCT
          ? '0.00'
          : (((initialData.serviceValue || 0) + (initialData.extraValue || 0)) * (settings.commissionRate / 100)).toFixed(2);
        setCommissionValue(initialCommissionValue !== undefined ? initialCommissionValue.toString() : fallbackCommission);
        setIsCommissionEdited(initialCommissionValue !== undefined);
        setFormError('');
      } else {
        // New Mode
        setName('');
        setPhone('');
        setBirthDate('');
        setAddress('');
        setShowDetails(false);
        
        setBarber(settings.barbers && settings.barbers.length > 0 ? settings.barbers[0] : '');
        setServiceType(ServiceType.CUT);
        setClientType(ClientType.RETURNING);
        setDescription('');
        
        // Default Time (Now)
        const now = new Date();
        setTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);

        // Default Financials based on settings
        setServiceValue(settings.priceCut.toString());
        setExtraValue('');
        setSelectedProducts([]);
        
        // Reset Commission Logic
        setCommissionValue('');
        setIsCommissionEdited(false);
        setFormError('');
      }
    }
  }, [isOpen, initialData, settings]);

  // -- Auto-Update Service Price on Type Change --
  const updateBasePrice = (type: ServiceType) => {
    setServiceType(type);
    setIsCommissionEdited(false); // Reset commission to auto-calc when type changes
    
    if (type === ServiceType.CUT) setServiceValue(settings.priceCut.toString());
    else if (type === ServiceType.BEARD) setServiceValue((settings.priceBeard || 0).toString());
    else if (type === ServiceType.COMBO) setServiceValue(settings.priceCombo.toString());
    else if (type === ServiceType.PRODUCT) setServiceValue(settings.products?.length ? '0' : (settings.priceProduct || 0).toString());
    else setServiceValue(''); // Other/Custom
  };

  // -- Calculations --
  const getNumericService = () => Number(serviceValue) || 0;
  const getNumericExtra = () => Number(extraValue) || 0;
  const getProductsTotal = () => selectedProducts.reduce((acc, p) => acc + p.price, 0);
  
  const getTotal = () => {
    return getNumericService() + getNumericExtra() + getProductsTotal();
  };

  // -- Commission Auto-Calc Effect --
  useEffect(() => {
    if (isOpen && !isCommissionEdited) {
      // REGRA: Produtos (seja via ServiceType ou lista) NÃO geram comissão.
      if (serviceType === ServiceType.PRODUCT) {
        setCommissionValue('0.00');
        return;
      }

      // REGRA: Comissão incide apenas sobre Serviço + Extras
      const baseForCommission = getNumericService() + getNumericExtra();
      const rate = settings.commissionRate / 100;
      const calculated = baseForCommission * rate;
      
      setCommissionValue(calculated.toFixed(2));
    }
  }, [serviceValue, extraValue, serviceType, settings.commissionRate, isOpen, isCommissionEdited]);


  // -- Handlers --
  const toggleProduct = (product: ProductItem) => {
    setSelectedProducts(prev => {
      const exists = prev.find(p => p.id === product.id);
      if (exists) return prev.filter(p => p.id !== product.id);
      return [...prev, product];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const numericService = getNumericService();
    const numericExtra = getNumericExtra();
    const numericCommission = Number(commissionValue);

    if (numericService < 0 || numericExtra < 0) {
      setFormError('Valores de servico e adicionais nao podem ser negativos.');
      return;
    }

    if (!Number.isFinite(numericCommission) || numericCommission < 0) {
      setFormError('Informe uma comissao valida, maior ou igual a zero.');
      return;
    }

    if (getTotal() <= 0) {
      setFormError('O total do atendimento precisa ser maior que zero.');
      return;
    }

    // Montar descrição inteligente se estiver vazia
    let finalDesc = description;
    if (!finalDesc && selectedProducts.length > 0) {
        finalDesc = selectedProducts.map(p => p.name).join(', ');
    }

    onSave({
      name,
      phone,
      birthDate,
      address,
      barberName: barber,
      serviceType,
      clientType,
      serviceValue: numericService,
      extraValue: numericExtra,
      totalValue: getTotal(),
      commissionValue: numericCommission,
      timeStr: time,
      description: finalDesc,
      products: selectedProducts
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-slide-in">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 max-h-[90vh] overflow-y-auto flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-700 bg-gray-900/50 sticky top-0 z-10 backdrop-blur-md">
          <div>
            <h2 className="text-xl font-bold text-white font-display">
                {initialData ? 'Editar Atendimento' : 'Novo Atendimento'}
            </h2>
            <p className="text-xs text-gray-400">Preencha os dados do serviço</p>
          </div>
          <button onClick={onClose} className="bg-gray-800 p-2 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form id="add-client-form" onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 overflow-y-auto">
          
          {/* Section 1: Who & When */}
          <div className="grid grid-cols-2 gap-4">
             {/* Client Type Toggle */}
             <div className="bg-gray-900 p-1 rounded-xl flex border border-gray-700">
                <button
                  type="button"
                  onClick={() => setClientType(ClientType.NEW)}
                  className={`flex-1 flex flex-col items-center justify-center rounded-lg text-[10px] font-bold uppercase py-2 transition-all gap-1 ${
                    clientType === ClientType.NEW
                      ? 'bg-green-900/40 text-green-400 shadow-sm border border-green-500/30'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <UserPlus size={14} /> Novo
                </button>
                <button
                  type="button"
                  onClick={() => setClientType(ClientType.RETURNING)}
                  className={`flex-1 flex flex-col items-center justify-center rounded-lg text-[10px] font-bold uppercase py-2 transition-all gap-1 ${
                    clientType === ClientType.RETURNING
                      ? 'bg-gold-500/20 text-gold-500 shadow-sm border border-gold-500/30'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <UserCheck size={14} /> Casa
                </button>
             </div>

             {/* Time Input */}
             <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-500 pointer-events-none">
                  <Clock size={16} />
                </div>
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full h-full bg-gray-900 border border-gray-700 rounded-xl pl-10 pr-3 text-white focus:ring-2 focus:ring-gold-500 outline-none font-mono text-sm"
                />
             </div>
          </div>

          <div className="space-y-3">
             <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gold-500 outline-none placeholder-gray-500"
              placeholder="Nome do Cliente"
             />

             {/* Client Details Toggle */}
             <button 
                type="button" 
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-gold-500 font-bold flex items-center gap-1 hover:underline"
             >
                {showDetails ? 'Ocultar detalhes' : 'Adicionar telefone, endereço...'}
                <ChevronRight size={12} className={`transition-transform ${showDetails ? 'rotate-90' : ''}`} />
             </button>

             {/* Expanded Client Details */}
             {showDetails && (
                 <div className="grid grid-cols-2 gap-3 bg-gray-900/50 p-3 rounded-xl border border-gray-700/50 animate-slide-in">
                    <div className="col-span-2 relative">
                        <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-white text-xs focus:ring-1 focus:ring-gold-500 outline-none"
                            placeholder="Telefone / WhatsApp"
                        />
                    </div>
                    <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="date"
                            value={birthDate}
                            onChange={(e) => setBirthDate(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-white text-xs focus:ring-1 focus:ring-gold-500 outline-none"
                            placeholder="Nascimento"
                        />
                    </div>
                    <div className="col-span-2 relative">
                        <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-white text-xs focus:ring-1 focus:ring-gold-500 outline-none"
                            placeholder="Endereço"
                        />
                    </div>
                 </div>
             )}

             {settings.barbers && settings.barbers.length > 0 ? (
                 <div className="relative">
                    <select
                        required
                        value={barber}
                        onChange={(e) => setBarber(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gold-500 outline-none appearance-none"
                    >
                        {settings.barbers.map(b => (
                            <option key={b} value={b}>{b}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                 </div>
            ) : (
                <input
                required
                type="text"
                value={barber}
                onChange={(e) => setBarber(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gold-500 outline-none placeholder-gray-500"
                placeholder="Nome do Barbeiro"
                />
            )}
          </div>

          <hr className="border-gray-700/50" />

          {/* Section 2: Service Selection */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block flex items-center gap-1">
                <Scissors size={12} /> Tipo de Serviço
            </label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[ServiceType.CUT, ServiceType.BEARD, ServiceType.COMBO].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => updateBasePrice(type)}
                  className={`py-2.5 px-1 rounded-xl text-xs font-bold transition-all ${
                    serviceType === type
                      ? 'bg-gold-500 text-black shadow-lg shadow-gold-500/20 scale-[1.02]'
                      : 'bg-gray-900 text-gray-400 border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {type}
                </button>
              ))}
              <button
                 type="button"
                 onClick={() => updateBasePrice(ServiceType.OTHER)}
                 className={`py-2.5 px-1 rounded-xl text-xs font-bold transition-all ${
                    serviceType === ServiceType.OTHER
                      ? 'bg-gray-200 text-black'
                      : 'bg-gray-900 text-gray-400 border border-gray-700 hover:border-gray-600'
                  }`}
               >
                 Outros
               </button>
               
               {/* Product Type Button */}
               <button
                 type="button"
                 onClick={() => updateBasePrice(ServiceType.PRODUCT)}
                 className={`col-span-2 py-2.5 px-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    serviceType === ServiceType.PRODUCT
                      ? 'bg-green-500 text-black shadow-lg shadow-green-500/20'
                      : 'bg-gray-900 text-green-500 border border-green-500/30 hover:bg-green-500/10'
                  }`}
               >
                 <ShoppingBag size={14}/> Apenas Produto
               </button>
            </div>
            
            <div className="flex gap-3">
                <div className="flex-1">
                    <label className="block text-[10px] text-gray-500 mb-1 uppercase font-bold">Valor Serviço</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">R$</span>
                        <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={serviceValue}
                        onChange={(e) => {
                          setServiceValue(e.target.value);
                          setIsCommissionEdited(false);
                        }}
                        placeholder="0.00"
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-8 pr-3 py-2 text-white focus:ring-2 focus:ring-gold-500 outline-none font-mono"
                        />
                    </div>
                </div>
                <div className="flex-1">
                    <label className="block text-[10px] text-gray-500 mb-1 uppercase font-bold">Adicionais</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">+</span>
                        <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={extraValue}
                        onChange={(e) => {
                          setExtraValue(e.target.value);
                          setIsCommissionEdited(false);
                        }}
                        placeholder="0.00"
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-6 pr-3 py-2 text-white focus:ring-2 focus:ring-gold-500 outline-none font-mono"
                        />
                    </div>
                </div>
            </div>
          </div>

          {/* Section 3: Products Add-on */}
          {settings.products && settings.products.length > 0 && (
             <div className="bg-gray-900/50 rounded-xl p-3 border border-gray-700/50">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <Tag size={14} className="text-green-400"/>
                        <span className="text-xs font-bold text-gray-300 uppercase">Produtos</span>
                    </div>
                    {selectedProducts.length > 0 && (
                        <span className="text-xs font-mono text-green-400 font-bold bg-green-900/30 px-2 py-0.5 rounded">
                            + R${getProductsTotal().toFixed(2)}
                        </span>
                    )}
                </div>
                
                <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto custom-scrollbar">
                     {settings.products.map(p => {
                         const isSelected = selectedProducts.some(sp => sp.id === p.id);
                         return (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => toggleProduct(p)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-medium border transition-all flex items-center gap-1.5 ${
                                    isSelected 
                                        ? 'bg-green-600 text-white border-green-500 shadow-md' 
                                        : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500'
                                }`}
                            >
                                {p.name} <span className="opacity-70">R${p.price}</span>
                                {isSelected ? <Check size={10} /> : <Plus size={10} />}
                            </button>
                         );
                     })}
                </div>
             </div>
          )}

          {/* Section 4: Commission & Notes */}
          <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-[10px] text-gray-500 mb-1 uppercase font-bold">Observações</label>
                  <div className="relative">
                     <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-8 pr-2 py-2 text-white text-xs focus:ring-2 focus:ring-gold-500 outline-none"
                        placeholder="Detalhes..."
                     />
                     <FileText size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500"/>
                  </div>
               </div>

               <div className={serviceType === ServiceType.PRODUCT ? 'opacity-50 pointer-events-none grayscale' : ''}>
                  <label className="block text-[10px] text-gold-500 mb-1 font-bold flex justify-between uppercase">
                     Comissão ({settings.commissionRate}%)
                     {!isCommissionEdited && serviceType !== ServiceType.PRODUCT && (
                        <span className="text-[8px] bg-gray-700 px-1 rounded text-gray-300 flex items-center tracking-wider">AUTO</span>
                     )}
                     {isCommissionEdited && (
                        <span className="text-[8px] bg-gold-900 px-1 rounded text-gold-400 flex items-center tracking-wider border border-gold-500/30">EDITADO</span>
                     )}
                  </label>
                  <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={commissionValue}
                        onChange={(e) => {
                            setCommissionValue(e.target.value);
                            setIsCommissionEdited(true);
                        }}
                        className={`w-full bg-gray-900 border rounded-xl pl-8 pr-2 py-2 font-bold focus:ring-2 focus:ring-gold-500 outline-none font-mono ${isCommissionEdited ? 'text-white border-gray-500' : 'text-gold-500 border-gold-500/30'}`}
                      />
                      <Calculator size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gold-600" />
                  </div>
               </div>
          </div>
        </form>

        {/* Footer: Total & Actions */}
        <div className="p-5 bg-gray-900 border-t border-gray-800 rounded-b-2xl">
            {formError && (
                <p className="text-red-400 text-xs font-medium mb-3 text-center">
                    {formError}
                </p>
            )}
            <div className="flex justify-between items-end mb-4">
                <div>
                    <p className="text-gray-400 text-xs mb-0.5 uppercase tracking-wider font-bold">Total a Receber</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-sm text-gray-500">R$</span>
                        <span className="text-3xl font-display font-bold text-white tracking-tight">
                            {getTotal().toFixed(2)}
                        </span>
                    </div>
                </div>
                {serviceType !== ServiceType.PRODUCT && (
                    <div className="text-right">
                        <p className="text-gray-500 text-[10px] uppercase font-bold">Lucro Casa (Liq)</p>
                        <p className="text-sm font-bold text-green-500 font-mono">
                             R$ {(getTotal() - (Number(commissionValue) || 0)).toFixed(2)}
                        </p>
                    </div>
                )}
            </div>
            
            <button
              type="submit"
              form="add-client-form"
              className="w-full bg-white hover:bg-gray-100 text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg shadow-white/10"
            >
              <Check size={20} />
              {initialData ? 'Salvar Alterações' : 'Confirmar Atendimento'}
            </button>
        </div>

      </div>
    </div>
  );
};
