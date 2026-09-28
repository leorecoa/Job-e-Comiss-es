export const isBasicEmailValid = (email?: string): boolean => {
  const normalizedEmail = email?.trim().toLowerCase() || '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
};
