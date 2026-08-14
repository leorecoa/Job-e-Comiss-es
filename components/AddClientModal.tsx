
import React, { useState, useEffect } from 'react';
import { ServiceType, AppSettings, ClientType, Client, ClientFormData, ProductItem } from '../types';
import {
  X,
  Check,
  UserPlus,
  UserCheck,
  Clock,
  ChevronDown,
  Tag,
  FileText,
  ShoppingBag,
  Calculator,
  Scissors,
  Plus,
  Phone,
  MapPin,
  Calendar,
  ChevronRight
} from 'lucide-react';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (clientData: ClientFormData) => void;
  initialData?: Client | null;
}

export const AddClientModal: React.FC<AddClientModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  initialData
}) => {
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
  const [serviceValue, setServiceValue] = useState<string>('');
  const [extraValue, setExtraValue] = useState<string>('');
  const [selectedProducts, setSelectedProducts] = useState<ProductItem[]>([]);

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

        if (initialData.phone || initialData.birthDate || initialData.address) {
          setShowDetails(true);
        } else {
          setShowDetails(false);
        }

        const d = new Date(initialData.timestamp);
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        setTime(`${h}:${m}`);

        setServiceValue(initialData.serviceValue?.toString() || initialData.totalValue.toString());
        setExtraValue(initialData.extraValue?.toString() || '');
        setSelectedProducts(initialData.products || []);

        const initialCommissionValue = initialData.commissionValue;
        const fallbackCommission =
          initialData.serviceType === ServiceType.PRODUCT
            ? '0.00'
            : (((initialData.serviceValue || 0) + (initialData.extraValue || 0)) *
                (settings.commissionRate / 100)
              ).toFixed(2);

        setCommissionValue(
          initialCommissionValue !== undefined
            ? initialCommissionValue.toString()
            : fallbackCommission
        );

        setIsCommissionEdited(initialCommissionValue !== undefined);
        setFormError('');
      } else {
        // New Mode
        setName('');
        setPhone('');
        setBirthDate('');
        setAddress('');
        setShowDetails(false);

        setBarber(settings.barbers && settings.barbers.length > 0 ? settings.barbers[0].name : '');
        setServiceType(ServiceType.CUT);
        setClientType(ClientType.RETURNING);
        setDescription('');

        const now = new Date();
        setTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);

        setServiceValue(settings.priceCut.toString());
        setExtraValue('');
        setSelectedProducts([]);

        setCommissionValue('');
        setIsCommissionEdited(false);
        setFormError('');
      }
    }
  }, [isOpen, initialData, settings]);

  // -- Auto-Update Service Price on Type Change --
  const updateBasePrice = (type: ServiceType) => {
    setServiceType(type);
    setIsCommissionEdited(false);

    if (type === ServiceType.CUT) {
      setServiceValue(settings.priceCut.toString());
    } else if (type === ServiceType.BEARD) {
      setServiceValue((settings.priceBeard || 0).toString());
    } else if (type === ServiceType.COMBO) {
      setServiceValue(settings.priceCombo.toString());
    } else if (type === ServiceType.PRODUCT) {
      setServiceValue(settings.products?.length ? '0' : (settings.priceProduct || 0).toString());
    } else {
      setServiceValue('');
    }
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
      if (serviceType === ServiceType.PRODUCT) {
        setCommissionValue('0.00');
        return;
      }

      const baseForCommission = getNumericService() + getNumericExtra();
      const rate = settings.commissionRate / 100;
      const calculated = baseForCommission * rate;

      setCommissionValue(calculated.toFixed(2));
    }
  }, [serviceValue, extraValue, serviceType, settings.commissionRate, isOpen, isCommissionEdited]);

  // -- Handlers --
  const toggleProduct = (product: ProductItem) => {
    setSelectedProducts((prev) => {
      const exists = prev.find((p) => p.id === product.id);

      if (exists) {
        return prev.filter((p) => p.id !== product.id);
      }

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

    let finalDesc = description;

    if (!finalDesc && selectedProducts.length > 0) {
      finalDesc = selectedProducts.map((p) => p.name).join(', ');
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
    <div className="ui-modal-backdrop animate-slide-in">
      <div className="ui-modal flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto">
        {/* Header */}
        <div className="ui-modal-header sticky top-0 z-10 flex items-center justify-between p-5">
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">
              {initialData ? 'Editar Atendimento' : 'Novo Atendimento'}
            </h2>
            <p className="text-xs text-muted-foreground">Preencha os dados do serviço</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ui-modal-close"
          >
            <X size={20} />
          </button>
        </div>

        <form id="add-client-form" onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Section 1: Who & When */}
          <div className="grid grid-cols-2 gap-4">
            {/* Client Type Toggle */}
            <div className="ui-owner-card flex rounded-xl p-1">
              <button
                type="button"
                onClick={() => setClientType(ClientType.NEW)}
                className={`flex-1 flex flex-col items-center justify-center rounded-lg text-[10px] font-bold uppercase py-2 transition-all gap-1 ${
                  clientType === ClientType.NEW
                    ? 'ui-owner-status-success'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <UserPlus size={14} /> Novo
              </button>

              <button
                type="button"
                onClick={() => setClientType(ClientType.RETURNING)}
                className={`flex-1 flex flex-col items-center justify-center rounded-lg text-[10px] font-bold uppercase py-2 transition-all gap-1 ${
                  clientType === ClientType.RETURNING
                    ? 'ui-owner-badge'
                    : 'text-muted-foreground hover:text-foreground'
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
                id="client-time"
                name="time"
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="ui-input h-full w-full pl-10 pr-3 font-mono text-sm"
              />
            </div>
          </div>

          <div className="space-y-3">
            <input
              id="client-name"
              name="name"
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="ui-input w-full"
              placeholder="Nome do Cliente"
              autoComplete="name"
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
              <div className="ui-owner-card grid grid-cols-2 gap-3 animate-slide-in">
                <div className="col-span-2 relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="client-phone"
                    name="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="ui-input w-full pl-9 text-xs"
                    placeholder="Telefone / WhatsApp"
                    autoComplete="tel"
                  />
                </div>

                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="client-birth-date"
                    name="birthDate"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="ui-input w-full pl-9 text-xs"
                    placeholder="Nascimento"
                  />
                </div>

                <div className="col-span-2 relative">
                  <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="client-address"
                    name="address"
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="ui-input w-full pl-9 text-xs"
                    placeholder="Endereço"
                    autoComplete="street-address"
                  />
                </div>
              </div>
            )}

            {settings.barbers && settings.barbers.length > 0 ? (
              <div className="relative">
                <select
                  id="client-barber"
                  name="barberName"
                  required
                  value={barber}
                  onChange={(e) => setBarber(e.target.value)}
                  className="ui-input w-full appearance-none"
                >
                  {settings.barbers.map((barberOption) => (
  <option key={barberOption.id} value={barberOption.name}>
    {barberOption.name}
  </option>
))}
                </select>

                <ChevronDown
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={16}
                />
              </div>
            ) : (
              <input
                id="client-barber-fallback"
                name="barberName"
                required
                type="text"
                value={barber}
                onChange={(e) => setBarber(e.target.value)}
                className="ui-input w-full"
                placeholder="Nome do Barbeiro"
              />
            )}
          </div>

          <hr className="border-border" />

          {/* Section 2: Service Selection */}
          <div>
            <label className="ui-label mb-2 flex items-center gap-1 text-xs uppercase tracking-wider">
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
                      : 'ui-button ui-button-secondary'
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
                    ? 'ui-button ui-button-primary'
                    : 'ui-button ui-button-secondary'
                }`}
              >
                Outros
              </button>

              <button
                type="button"
                onClick={() => updateBasePrice(ServiceType.PRODUCT)}
                className={`col-span-2 py-2.5 px-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  serviceType === ServiceType.PRODUCT
                    ? 'bg-green-500 text-black shadow-lg shadow-green-500/20'
                    : 'ui-button ui-button-secondary'
                }`}
              >
                <ShoppingBag size={14} /> Apenas Produto
              </button>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="ui-label mb-1 block text-[10px] uppercase">
                  Valor Serviço
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    R$
                  </span>
                  <input
                    id="client-service-value"
                    name="serviceValue"
                    type="number"
                    min="0"
                    step="0.01"
                    value={serviceValue}
                    onChange={(e) => {
                      setServiceValue(e.target.value);
                      setIsCommissionEdited(false);
                    }}
                    placeholder="0.00"
                    className="ui-input w-full pl-8 font-mono"
                  />
                </div>
              </div>

              <div className="flex-1">
                <label className="ui-label mb-1 block text-[10px] uppercase">
                  Adicionais
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    +
                  </span>
                  <input
                    id="client-extra-value"
                    name="extraValue"
                    type="number"
                    min="0"
                    step="0.01"
                    value={extraValue}
                    onChange={(e) => {
                      setExtraValue(e.target.value);
                      setIsCommissionEdited(false);
                    }}
                    placeholder="0.00"
                    className="ui-input w-full pl-6 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Products Add-on */}
          {settings.products && settings.products.length > 0 && (
            <div className="ui-owner-card rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Tag size={14} className="text-green-400" />
                  <span className="text-xs font-bold uppercase text-foreground">Produtos</span>
                </div>

                {selectedProducts.length > 0 && (
                  <span className="text-xs font-mono text-green-400 font-bold bg-green-900/30 px-2 py-0.5 rounded">
                    + R${getProductsTotal().toFixed(2)}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto custom-scrollbar">
                {settings.products.map((p) => {
                  const isSelected = selectedProducts.some((sp) => sp.id === p.id);

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProduct(p)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-medium border transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'ui-owner-status-success'
                          : 'ui-button-secondary'
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
              <label className="ui-label mb-1 block text-[10px] uppercase">
                Observações
              </label>
              <div className="relative">
                <input
                  id="client-description"
                  name="description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="ui-input w-full pl-8 text-xs"
                  placeholder="Detalhes..."
                />
                <FileText size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            <div className={serviceType === ServiceType.PRODUCT ? 'opacity-50 pointer-events-none grayscale' : ''}>
              <label className="block text-[10px] text-gold-500 mb-1 font-bold flex justify-between uppercase">
                Comissão ({settings.commissionRate}%)
                {!isCommissionEdited && serviceType !== ServiceType.PRODUCT && (
                  <span className="ui-owner-badge flex rounded px-1 text-[8px] tracking-wider">
                    AUTO
                  </span>
                )}
                {isCommissionEdited && (
                  <span className="text-[8px] bg-gold-900 px-1 rounded text-gold-400 flex items-center tracking-wider border border-gold-500/30">
                    EDITADO
                  </span>
                )}
              </label>

              <div className="relative">
                <input
                  id="client-commission-value"
                  name="commissionValue"
                  type="number"
                  min="0"
                  step="0.01"
                  value={commissionValue}
                  onChange={(e) => {
                    setCommissionValue(e.target.value);
                    setIsCommissionEdited(true);
                  }}
                  className={`ui-input w-full pl-8 pr-2 font-mono font-bold ${
                    isCommissionEdited ? 'text-foreground' : 'text-gold-700'
                  }`}
                />
                <Calculator size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gold-600" />
              </div>
            </div>
          </div>
        </form>

        {/* Footer: Total & Actions */}
        <div className="rounded-b-2xl border-t border-border bg-surface-muted p-5">
          {formError && (
            <p className="text-red-400 text-xs font-medium mb-3 text-center">
              {formError}
            </p>
          )}

          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="mb-0.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Total a Receber
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-sm text-muted-foreground">R$</span>
                <span className="font-display text-3xl font-bold tracking-tight text-foreground">
                  {getTotal().toFixed(2)}
                </span>
              </div>
            </div>

            {serviceType !== ServiceType.PRODUCT && (
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Lucro Casa (Liq)</p>
                <p className="text-sm font-bold text-green-500 font-mono">
                  R$ {(getTotal() - (Number(commissionValue) || 0)).toFixed(2)}
                </p>
              </div>
            )}
          </div>

          <button
            type="submit"
            form="add-client-form"
            className="ui-button ui-button-primary w-full"
          >
            <Check size={20} />
            {initialData ? 'Salvar Alterações' : 'Confirmar Atendimento'}
          </button>
        </div>
      </div>
    </div>
  );
};
