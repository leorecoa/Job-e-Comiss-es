import { assertOperationalSupabase, shouldUseLocalFallback, supabase } from '../lib/supabase';
import { BarberOption } from '../types';
import { generateId, isUuid } from '../utils';
import { countAppointmentsForBarber } from './appointmentRepository';
import { BARBER_PHOTO_BUCKET, isBarberPhotoPath, validateBarberPhoto } from './barberPhoto';

// This key is for local storage fallback when Supabase is not configured
const SETTINGS_STORAGE_KEY = 'barbearia_settings';

type DatabaseBarberRow = {
  id: string;
  name: string;
  barbershop_id: string | null;
  active: boolean; // Assuming active is always present in DB
  photo_path: string | null;
};

export type ListBarbersOptions = {
  includeInactive?: boolean;
};

export type CreateBarberInput = {
  name: string;
  barbershopId?: string;
  active?: boolean;
};

export type UpdateBarberInput = {
  name?: string;
  active?: boolean;
};

export type RemoveBarberResult = {
  action: 'deleted' | 'deactivated';
  barberId: string;
};

const readLocalSettings = (): { barbers?: Array<string | BarberOption> } => {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

const writeLocalBarbers = (barbers: BarberOption[]) => {
  try {
    const current = readLocalSettings();
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      ...current,
      barbers
    }));
  } catch {
    // Ignore local persistence failures.
  }
};

const isLocalTenantMatch = (itemBarbershopId: string | undefined, barbershopId?: string): boolean => {
  if (!barbershopId) return true;
  if (barbershopId === 'local-barbershop') return !itemBarbershopId || itemBarbershopId === barbershopId;
  return itemBarbershopId === barbershopId;
};

const listLocalBarbers = (barbershopId?: string, options?: ListBarbersOptions): BarberOption[] => {
  try {
    const settings = readLocalSettings();
    // For local storage, barbers might just be strings. Convert to BarberOption.
    const localBarbers = Array.isArray(settings.barbers) && settings.barbers.every((b: any) => typeof b === 'string' || (typeof b === 'object' && 'name' in b && 'id' in b))
      ? settings.barbers.map((b: string | BarberOption) =>
          typeof b === 'string' ? { id: b, name: b, active: true } : { ...b, active: b.active ?? true }
        )
      : [];

    return localBarbers.filter((barber: BarberOption) => (
      isLocalTenantMatch(barber.barbershopId, barbershopId)
      && (options?.includeInactive || barber.active !== false)
    ));
  } catch {
    return [];
  }
};

export const listBarbers = async (barbershopId?: string, options?: ListBarbersOptions): Promise<BarberOption[]> => {
  if (shouldUseLocalFallback) return listLocalBarbers(barbershopId, options);
  assertOperationalSupabase();

  let query = supabase
    .from('barbers')
    .select('id,name,barbershop_id,active,photo_path');
  
  if (barbershopId) {
    query = query.eq('barbershop_id', barbershopId);
  }

  if (!options?.includeInactive) {
    query = query.eq('active', true);
  }

  const { data, error } = await query
    .order('name', { ascending: true })
    .returns<DatabaseBarberRow[]>(); // Explicitly cast to ensure type safety

  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    photoPath: row.photo_path,
    barbershopId: row.barbershop_id || undefined,
    active: row.active
  }));
};

export const createBarber = async ({ name, barbershopId, active = true }: CreateBarberInput): Promise<BarberOption> => {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error('Informe o nome do barbeiro.');
  }

  if (shouldUseLocalFallback) {
    const created: BarberOption = {
      id: generateId(),
      name: trimmedName,
      barbershopId,
      active
    };
    const current = listLocalBarbers(undefined, { includeInactive: true });
    writeLocalBarbers([created, ...current.filter((barber) => barber.id !== created.id)]);
    return created;
  }
  assertOperationalSupabase();

  if (!barbershopId) {
    throw new Error('Barbearia nao encontrada para criar barbeiro.');
  }

  if (!isUuid(barbershopId)) {
    throw new Error('Sua conta nao possui uma barbearia valida para cadastrar barbeiro.');
  }

  const { data, error } = await supabase
    .from('barbers')
    .insert({
      name: trimmedName,
      barbershop_id: barbershopId,
      active
    })
    .select('id,name,barbershop_id,active,photo_path')
    .single()
    .returns<DatabaseBarberRow>(); // Explicitly cast to ensure type safety
  
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    photoPath: data.photo_path,
    barbershopId: data.barbershop_id || undefined,
    active: data.active
  };
};

export const updateBarber = async (
  barberId: string,
  patch: UpdateBarberInput,
  barbershopId?: string
): Promise<BarberOption> => {
  if (!barberId.trim()) {
    throw new Error('Barbeiro nao encontrado.');
  }

  const normalizedName = typeof patch.name === 'string' ? patch.name.trim() : undefined;

  if (normalizedName !== undefined && !normalizedName) {
    throw new Error('Informe o nome do barbeiro.');
  }

  if (shouldUseLocalFallback) {
    const current = listLocalBarbers(undefined, { includeInactive: true });
    const next = current.map((barber) => (
      barber.id === barberId
        ? {
            ...barber,
            name: normalizedName ?? barber.name,
            active: patch.active ?? barber.active ?? true
          }
        : barber
    ));
    writeLocalBarbers(next);
    const updated = next.find((barber) => barber.id === barberId);
    if (!updated) throw new Error('Barbeiro nao encontrado.');
    return updated;
  }
  assertOperationalSupabase();

  if (barbershopId && !isUuid(barbershopId)) {
    throw new Error('Sua conta nao possui uma barbearia valida para atualizar barbeiro.');
  }

  let query = supabase
    .from('barbers')
    .update({
      ...(normalizedName !== undefined ? { name: normalizedName } : {}),
      ...(typeof patch.active === 'boolean' ? { active: patch.active } : {})
    })
    .eq('id', barberId);

  if (barbershopId) {
    query = query.eq('barbershop_id', barbershopId);
  }

  const { data, error } = await query
    .select('id,name,barbershop_id,active,photo_path')
    .single<DatabaseBarberRow>();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    photoPath: data.photo_path,
    barbershopId: data.barbershop_id || undefined,
    active: data.active
  };
};

export const uploadBarberPhoto = async (barberId: string, barbershopId: string, file: File): Promise<BarberOption> => {
  if (shouldUseLocalFallback || !supabase) throw new Error('Fotos estão disponíveis somente no modo conectado.');
  assertOperationalSupabase();
  if (!isUuid(barberId) || !isUuid(barbershopId)) throw new Error('Barbeiro ou barbearia inválidos.');
  const extension = validateBarberPhoto(file);
  const readCurrent = () => supabase.from('barbers').select('photo_path')
    .eq('id', barberId).eq('barbershop_id', barbershopId).single<{ photo_path: string | null }>();
  const previous = await readCurrent();
  if (previous.error || !previous.data) throw new Error('Não foi possível carregar a foto atual.');
  const oldPath = previous.data.photo_path;
  const path = `${barbershopId}/barbers/${barberId}/${crypto.randomUUID()}.${extension}`;
  const bucket = supabase.storage.from(BARBER_PHOTO_BUCKET);
  const cleanup = async (candidate: string) => {
    if (!isBarberPhotoPath(candidate, barbershopId, barberId)) return;
    try {
      // A lost response is not proof of rollback. Never delete a current photo.
      const current = await readCurrent();
      if (!current.error && current.data && current.data.photo_path !== candidate) await bucket.remove([candidate]);
    } catch { /* Best effort: an orphan is safer than deleting a live photo. */ }
  };
  try {
    const uploaded = await bucket.upload(path, file, { upsert: false, contentType: file.type, cacheControl: '3600' });
    if (uploaded.error) throw uploaded.error;
    let update = supabase.from('barbers').update({ photo_path: path })
      .eq('id', barberId).eq('barbershop_id', barbershopId);
    // Do not overwrite a photo changed by another owner tab during the upload.
    update = oldPath === null ? update.is('photo_path', null) : update.eq('photo_path', oldPath);
    const saved = await update.select('id,name,barbershop_id,active,photo_path').single<DatabaseBarberRow>();
    if (saved.error || !saved.data) throw new Error('Photo update failed');
    if (oldPath) await cleanup(oldPath);
    return { id: saved.data.id, name: saved.data.name, active: saved.data.active,
      barbershopId: saved.data.barbershop_id || undefined, photoPath: saved.data.photo_path };
  } catch {
    await cleanup(path);
    throw new Error('Não foi possível salvar a foto. Atualize a página e tente novamente.');
  }
};

export const removeBarber = async (
  barberId: string,
  barbershopId?: string
): Promise<RemoveBarberResult> => {
  if (!barberId.trim()) {
    throw new Error('Barbeiro nao encontrado.');
  }

  if (shouldUseLocalFallback) {
    const appointmentsCount = await countAppointmentsForBarber(barberId, barbershopId);
    const current = listLocalBarbers(undefined, { includeInactive: true });

    if (appointmentsCount > 0) {
      const next = current.map((barber) => (
        barber.id === barberId
          ? { ...barber, active: false }
          : barber
      ));
      writeLocalBarbers(next);
      return {
        action: 'deactivated',
        barberId
      };
    }

    writeLocalBarbers(current.filter((barber) => barber.id !== barberId));
    return {
      action: 'deleted',
      barberId
    };
  }
  assertOperationalSupabase();

  if (!barbershopId) {
    throw new Error('Barbearia nao encontrada para remover barbeiro.');
  }

  if (!isUuid(barbershopId)) {
    throw new Error('Sua conta nao possui uma barbearia valida para remover barbeiro.');
  }

  const appointmentsCount = await countAppointmentsForBarber(barberId, barbershopId);

  if (appointmentsCount > 0) {
    await updateBarber(barberId, { active: false }, barbershopId);
    return {
      action: 'deactivated',
      barberId
    };
  }

  const { error } = await supabase
    .from('barbers')
    .delete()
    .eq('id', barberId)
    .eq('barbershop_id', barbershopId);

  if (error) throw error;

  return {
    action: 'deleted',
    barberId
  };
};
