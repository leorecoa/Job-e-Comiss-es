import React, { useState } from 'react';
import { Scissors } from 'lucide-react';
import { BarberOption } from '../types';
import { getBarberPhotoUrl } from '../services/barberPhoto';

export const BarberPhoto: React.FC<{ barber: BarberOption; size?: 'compact' | 'booking' }> = ({ barber, size = 'compact' }) => {
  const url = getBarberPhotoUrl(barber);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <span className={`flex ${size === 'booking' ? 'h-20 w-20 sm:h-24 sm:w-24' : 'h-11 w-11'} shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-muted text-gold-700`}>
      {url && failedUrl !== url
        ? <img src={url} alt={`Foto de ${barber.name}`} className="h-full w-full object-cover" onError={() => setFailedUrl(url)} />
        : <Scissors size={20} aria-label={`Foto indisponível: ${barber.name}`} />}
    </span>
  );
};
