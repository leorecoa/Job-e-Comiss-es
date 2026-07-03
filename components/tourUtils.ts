export interface TourStep {
  targetId: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const TOUR_STORAGE_KEY = 'hasSeenTour';
export const TOUR_TARGET_IDS = ['tour-stats', 'tour-actions', 'tour-filters'] as const;

export type TourRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type TourSize = {
  width: number;
  height: number;
};

export type TourViewport = {
  width: number;
  height: number;
};

export type TourTooltipPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const TOUR_EDGE_MARGIN = 12;
const TOUR_TARGET_GAP = 14;
const TOUR_DESKTOP_WIDTH = 340;
const TOUR_MOBILE_BREAKPOINT = 768;

const clamp = (value: number, min: number, max: number): number => (
  Math.min(Math.max(value, min), max)
);

export const areTourTargetsReady = (
  targetIds: readonly string[] = TOUR_TARGET_IDS,
  doc: Pick<Document, 'getElementById'> = document
): boolean => targetIds.every((targetId) => Boolean(doc.getElementById(targetId)));

export const isTourTargetInViewport = (
  rect: TourRect,
  viewport: TourViewport,
  margin = TOUR_EDGE_MARGIN
): boolean => (
  rect.top >= margin
  && rect.left >= margin
  && rect.bottom <= viewport.height - margin
  && rect.right <= viewport.width - margin
);

export const findNextAvailableTourStepIndex = (
  steps: TourStep[],
  startIndex: number,
  doc: Pick<Document, 'getElementById'> = document
): number => {
  if (steps.length === 0) return -1;

  for (let offset = 0; offset < steps.length; offset += 1) {
    const index = (startIndex + offset) % steps.length;
    if (doc.getElementById(steps[index].targetId)) {
      return index;
    }
  }

  return -1;
};

export const getTourTooltipPosition = ({
  targetRect,
  tooltipSize,
  viewport,
  preferredPosition = 'bottom',
  edgeMargin = TOUR_EDGE_MARGIN,
  gap = TOUR_TARGET_GAP
}: {
  targetRect: TourRect;
  tooltipSize: TourSize;
  viewport: TourViewport;
  preferredPosition?: TourStep['position'];
  edgeMargin?: number;
  gap?: number;
}): TourTooltipPosition => {
  const isMobile = viewport.width < TOUR_MOBILE_BREAKPOINT;
  const width = Math.min(
    isMobile ? viewport.width - edgeMargin * 2 : TOUR_DESKTOP_WIDTH,
    viewport.width - edgeMargin * 2
  );
  const height = Math.min(tooltipSize.height || 220, viewport.height - edgeMargin * 2);
  const horizontalCenter = targetRect.left + targetRect.width / 2 - width / 2;
  const verticalCenter = targetRect.top + targetRect.height / 2 - height / 2;
  let top = targetRect.bottom + gap;
  let left = horizontalCenter;

  const hasSpaceBelow = targetRect.bottom + gap + height <= viewport.height - edgeMargin;
  const hasSpaceAbove = targetRect.top - gap - height >= edgeMargin;

  if (isMobile) {
    top = hasSpaceBelow || !hasSpaceAbove
      ? targetRect.bottom + gap
      : targetRect.top - gap - height;
    left = horizontalCenter;
  } else {
    switch (preferredPosition) {
      case 'top':
        top = hasSpaceAbove ? targetRect.top - gap - height : targetRect.bottom + gap;
        left = horizontalCenter;
        break;
      case 'left':
        top = verticalCenter;
        left = targetRect.left - gap - width;
        if (left < edgeMargin) {
          left = targetRect.right + gap;
        }
        break;
      case 'right':
        top = verticalCenter;
        left = targetRect.right + gap;
        if (left + width > viewport.width - edgeMargin) {
          left = targetRect.left - gap - width;
        }
        break;
      case 'bottom':
      default:
        top = hasSpaceBelow || !hasSpaceAbove
          ? targetRect.bottom + gap
          : targetRect.top - gap - height;
        left = horizontalCenter;
        break;
    }
  }

  return {
    top: clamp(top, edgeMargin, Math.max(edgeMargin, viewport.height - height - edgeMargin)),
    left: clamp(left, edgeMargin, Math.max(edgeMargin, viewport.width - width - edgeMargin)),
    width,
    maxHeight: viewport.height - edgeMargin * 2
  };
};
