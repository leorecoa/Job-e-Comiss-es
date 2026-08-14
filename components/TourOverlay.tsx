import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronRight, ChevronLeft, X, Check } from 'lucide-react';
import {
  findNextAvailableTourStepIndex,
  getTourTooltipPosition,
  isTourTargetInViewport,
  type TourRect,
  type TourStep,
  type TourTooltipPosition
} from './tourUtils';

interface TourOverlayProps {
  steps: TourStep[];
  isOpen: boolean;
  onComplete: () => void;
}

const TOUR_TOOLTIP_FALLBACK_WIDTH = 340;

export const TourOverlay: React.FC<TourOverlayProps> = ({ steps, isOpen, onComplete }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TourRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TourTooltipPosition | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const completeRef = useRef(onComplete);

  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement;
    setCurrentStepIndex((index) => {
      const nextIndex = findNextAvailableTourStepIndex(steps, index);
      return nextIndex === -1 ? 0 : nextIndex;
    });

    return () => {
      const previousFocus = previousFocusRef.current;
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [isOpen, steps]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        completeRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;

    let disposed = false;
    let timeoutId: number | undefined;
    let rafId: number | undefined;

    const scheduleMeasure = () => {
      window.clearTimeout(timeoutId);
      window.cancelAnimationFrame(rafId || 0);
      rafId = window.requestAnimationFrame(updatePosition);
    };

    const updatePosition = () => {
      if (disposed) return;

      const nextAvailableIndex = findNextAvailableTourStepIndex(steps, currentStepIndex);
      if (nextAvailableIndex === -1) {
        completeRef.current();
        return;
      }

      if (nextAvailableIndex !== currentStepIndex) {
        setCurrentStepIndex(nextAvailableIndex);
        return;
      }

      const currentStep = steps[currentStepIndex];
      const element = document.getElementById(currentStep.targetId);
      if (!element) {
        setTargetRect(null);
        setTooltipPosition(null);
        return;
      }

      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };
      const rect = element.getBoundingClientRect();

      if (!isTourTargetInViewport(rect, viewport)) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        timeoutId = window.setTimeout(updatePosition, 180);
        return;
      }

      const tooltipBox = tooltipRef.current?.getBoundingClientRect();
      const tooltipSize = {
        width: tooltipBox?.width || TOUR_TOOLTIP_FALLBACK_WIDTH,
        height: tooltipBox?.height || 220
      };
      const nextPosition = getTourTooltipPosition({
        targetRect: rect,
        tooltipSize,
        viewport,
        preferredPosition: currentStep.position
      });

      setTargetRect(rect);
      setTooltipPosition(nextPosition);
    };

    updatePosition();
    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('scroll', scheduleMeasure, true);

    return () => {
      disposed = true;
      window.clearTimeout(timeoutId);
      window.cancelAnimationFrame(rafId || 0);
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('scroll', scheduleMeasure, true);
    };
  }, [currentStepIndex, isOpen, steps]);

  useEffect(() => {
    if (isOpen && tooltipPosition) {
      tooltipRef.current?.focus({ preventScroll: true });
    }
  }, [isOpen, tooltipPosition, currentStepIndex]);

  if (!isOpen || steps.length === 0) return null;
  if (!targetRect || !tooltipPosition) return null;

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const titleId = `tour-title-${currentStepIndex}`;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
      return;
    }

    const nextIndex = findNextAvailableTourStepIndex(steps, currentStepIndex + 1);
    if (nextIndex === -1 || nextIndex <= currentStepIndex) {
      onComplete();
      return;
    }

    setCurrentStepIndex(nextIndex);
  };

  const handlePrev = () => {
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      <div
        className="absolute rounded-xl border-2 border-gold-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.85)] transition-all duration-200 ease-out pointer-events-none"
        style={{
          top: targetRect.top - 4,
          left: targetRect.left - 4,
          width: targetRect.width + 8,
          height: targetRect.height + 8
        }}
      />

      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="ui-surface absolute flex max-w-[calc(100vw-24px)] flex-col gap-3 overflow-y-auto p-4 text-foreground outline-none transition-all duration-200 md:p-5"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          width: tooltipPosition.width,
          maxHeight: tooltipPosition.maxHeight
        }}
      >
        <div className="flex justify-between gap-4">
          <h3 id={titleId} className="font-display text-lg font-bold text-gold-500">
            {currentStep.title}
          </h3>
          <button
            type="button"
            onClick={onComplete}
            aria-label="Pular guia"
            className="ui-button ui-button-ghost"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          {currentStep.content}
        </p>

        <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-3">
          <span className="font-mono text-xs text-muted-foreground">
            {currentStepIndex + 1} / {steps.length}
          </span>
          <div className="flex gap-2">
            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Passo anterior"
                className="ui-button ui-button-secondary"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-2 rounded-lg bg-gold-500 px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-gold-600 focus:outline-none focus:ring-2 focus:ring-gold-500"
            >
              {isLastStep ? 'Concluir' : 'Proximo'}
              {isLastStep ? <Check size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
