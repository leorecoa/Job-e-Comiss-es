import { describe, expect, it, vi } from 'vitest';
import {
  TOUR_STORAGE_KEY,
  TOUR_TARGET_IDS,
  areTourTargetsReady,
  findNextAvailableTourStepIndex,
  getTourTooltipPosition,
  isTourTargetInViewport,
  type TourStep
} from './components/tourUtils';

const steps: TourStep[] = [
  {
    targetId: 'tour-stats',
    title: 'Resumo do dia',
    content: 'Resumo do periodo.',
    position: 'bottom'
  },
  {
    targetId: 'tour-actions',
    title: 'Acoes rapidas',
    content: 'Acoes operacionais.',
    position: 'bottom'
  },
  {
    targetId: 'tour-filters',
    title: 'Relatorios',
    content: 'Relatorios do periodo.',
    position: 'bottom'
  }
];

const makeDocument = (existingIds: string[]) => ({
  getElementById: vi.fn((targetId: string) => (
    existingIds.includes(targetId)
      ? ({ id: targetId } as HTMLElement)
      : null
  ))
});

describe('responsive onboarding tour', () => {
  it('uses the expected dashboard target ids and neutral persistence key', () => {
    expect(TOUR_TARGET_IDS).toEqual(['tour-stats', 'tour-actions', 'tour-filters']);
    expect(TOUR_STORAGE_KEY).toBe('hasSeenTour');
    expect(TOUR_STORAGE_KEY).not.toMatch(/gestao|gestão|maxima|máxima/i);
  });

  it('detects when every tour target is ready in the DOM', () => {
    const doc = makeDocument(['tour-stats', 'tour-actions', 'tour-filters']);

    expect(areTourTargetsReady(TOUR_TARGET_IDS, doc)).toBe(true);
    expect(doc.getElementById).toHaveBeenCalledWith('tour-stats');
    expect(doc.getElementById).toHaveBeenCalledWith('tour-actions');
    expect(doc.getElementById).toHaveBeenCalledWith('tour-filters');
  });

  it('does not consider the tour ready while a target is missing', () => {
    const doc = makeDocument(['tour-stats', 'tour-actions']);

    expect(areTourTargetsReady(TOUR_TARGET_IDS, doc)).toBe(false);
  });

  it('safely skips a missing step target', () => {
    const doc = makeDocument(['tour-filters']);

    expect(findNextAvailableTourStepIndex(steps, 0, doc)).toBe(2);
  });

  it('returns -1 when no step target exists', () => {
    const doc = makeDocument([]);

    expect(findNextAvailableTourStepIndex(steps, 0, doc)).toBe(-1);
  });

  it('keeps the tooltip inside a 320px mobile viewport', () => {
    const position = getTourTooltipPosition({
      targetRect: {
        top: 80,
        left: 8,
        right: 180,
        bottom: 130,
        width: 172,
        height: 50
      },
      tooltipSize: {
        width: 400,
        height: 220
      },
      viewport: {
        width: 320,
        height: 640
      },
      preferredPosition: 'bottom'
    });

    expect(position.left).toBeGreaterThanOrEqual(12);
    expect(position.top).toBeGreaterThanOrEqual(12);
    expect(position.width).toBeLessThanOrEqual(296);
    expect(position.left + position.width).toBeLessThanOrEqual(308);
    expect(position.top + 220).toBeLessThanOrEqual(628);
    expect(position.maxHeight).toBeLessThanOrEqual(616);
  });

  it('keeps the tooltip inside a desktop viewport near the right edge', () => {
    const position = getTourTooltipPosition({
      targetRect: {
        top: 160,
        left: 1120,
        right: 1260,
        bottom: 220,
        width: 140,
        height: 60
      },
      tooltipSize: {
        width: 340,
        height: 220
      },
      viewport: {
        width: 1280,
        height: 720
      },
      preferredPosition: 'right'
    });

    expect(position.left).toBeGreaterThanOrEqual(12);
    expect(position.left + position.width).toBeLessThanOrEqual(1268);
    expect(position.top).toBeGreaterThanOrEqual(12);
  });

  it('identifies targets outside the visible viewport', () => {
    expect(isTourTargetInViewport({
      top: 20,
      left: 20,
      right: 200,
      bottom: 120,
      width: 180,
      height: 100
    }, {
      width: 390,
      height: 720
    })).toBe(true);

    expect(isTourTargetInViewport({
      top: 740,
      left: 20,
      right: 200,
      bottom: 840,
      width: 180,
      height: 100
    }, {
      width: 390,
      height: 720
    })).toBe(false);
  });
});
