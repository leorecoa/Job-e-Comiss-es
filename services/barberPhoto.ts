import { shouldUseLocalFallback, supabase } from '../lib/supabase';
import { isUuid } from '../utils';

export const BARBER_PHOTO_BUCKET = 'barbershop-branding';
export const BARBER_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const extensions = new Map([
  ['image/png', 'png'], ['image/jpeg', 'jpg'], ['image/webp', 'webp']
]);

export const validateBarberPhoto = (file: File): string => {
  const extension = extensions.get(file.type);
  if (!extension) throw new Error('Use uma imagem PNG, JPEG ou WebP.');
  if (!file.size || file.size > BARBER_PHOTO_MAX_BYTES) {
    throw new Error('A foto deve ter conteúdo e no máximo 5 MB.');
  }
  return extension;
};

export const isBarberPhotoPath = (path: string, tenant: string, barber: string): boolean => (
  isUuid(tenant) && isUuid(barber)
  && path.startsWith(`${tenant}/barbers/${barber}/`)
  && /^[0-9a-f-]{36}\/barbers\/[0-9a-f-]{36}\/[A-Za-z0-9_-]+\.(png|jpg|webp)$/.test(path)
);

export const getBarberPhotoUrl = (barber: { id: string; barbershopId?: string; photoPath?: string | null }): string | null => {
  if (shouldUseLocalFallback || !supabase || !barber.photoPath || !barber.barbershopId
    || !isBarberPhotoPath(barber.photoPath, barber.barbershopId, barber.id)) return null;
  return supabase.storage.from(BARBER_PHOTO_BUCKET).getPublicUrl(barber.photoPath).data.publicUrl;
};
