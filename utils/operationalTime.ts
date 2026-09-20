// Presentation only: never reconstruct a backend slot from these labels.
export const operationalDate = (iso: string, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find(value => value.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};

export const operationalTime = (iso: string, timeZone: string): string => (
  new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
);
