import { describe, expect, it } from 'vitest';
import {
  getOwnerNavigationHash,
  getOwnerNavigationRoute,
  isManagementSectionHash,
  MANAGEMENT_SECTION_HASHES
} from '../../utils/ownerNavigation';

describe('owner URL navigation', () => {
  it('opens the agenda for an empty or unknown hash', () => {
    expect(getOwnerNavigationRoute('').mainSection).toBe('appointments');
    expect(getOwnerNavigationRoute('#unknown').mainSection).toBe('appointments');
  });

  it.each(MANAGEMENT_SECTION_HASHES)('restores management section %s', (hash) => {
    expect(isManagementSectionHash(hash)).toBe(true);
    expect(getOwnerNavigationRoute(hash)).toEqual({
      mainSection: 'management',
      managementSection: hash
    });
  });

  it('maps every main owner section to a shareable hash', () => {
    expect(getOwnerNavigationHash('appointments')).toBe('');
    expect(getOwnerNavigationHash('clients')).toBe('#clients');
    expect(getOwnerNavigationHash('vales')).toBe('#vales');
    expect(getOwnerNavigationHash('reports')).toBe('#reports');
    expect(getOwnerNavigationHash('management', '#management-team')).toBe('#management-team');
  });
});
