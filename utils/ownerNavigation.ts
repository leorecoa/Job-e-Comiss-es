export const MANAGEMENT_SECTION_HASHES = [
  '#management-public-presence',
  '#management-readiness',
  '#management-team',
  '#management-catalog'
] as const;

export type ManagementSectionHash = typeof MANAGEMENT_SECTION_HASHES[number];
export type OwnerMainSection = 'appointments' | 'clients' | 'vales' | 'reports' | 'management';

export type OwnerNavigationRoute = {
  mainSection: OwnerMainSection;
  managementSection: ManagementSectionHash;
};

const DEFAULT_MANAGEMENT_SECTION: ManagementSectionHash = '#management-public-presence';
const MAIN_SECTION_HASHES: Partial<Record<OwnerMainSection, string>> = {
  clients: '#clients',
  vales: '#vales',
  reports: '#reports'
};

export const isManagementSectionHash = (hash: string): hash is ManagementSectionHash => (
  MANAGEMENT_SECTION_HASHES.includes(hash as ManagementSectionHash)
);

export const getOwnerNavigationRoute = (hash: string): OwnerNavigationRoute => {
  if (isManagementSectionHash(hash)) {
    return { mainSection: 'management', managementSection: hash };
  }

  const mainSection = Object.entries(MAIN_SECTION_HASHES)
    .find(([, sectionHash]) => sectionHash === hash)?.[0] as OwnerMainSection | undefined;

  return {
    mainSection: mainSection || 'appointments',
    managementSection: DEFAULT_MANAGEMENT_SECTION
  };
};

export const getOwnerNavigationHash = (
  mainSection: OwnerMainSection,
  managementSection: ManagementSectionHash = DEFAULT_MANAGEMENT_SECTION
): string => (
  mainSection === 'management'
    ? managementSection
    : MAIN_SECTION_HASHES[mainSection] || ''
);
