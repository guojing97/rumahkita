'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export type RippleVariant = 'neutral' | 'primary';

export const RIPPLE_COLORS: Record<RippleVariant, string> = {
  neutral: 'rgba(23, 23, 23, 0.12)',
  primary: 'rgba(23, 23, 23, 0.20)',
};

export function resolveRippleColor(color?: RippleVariant | string): string {
  if (!color || color === 'neutral') {
    return RIPPLE_COLORS.neutral;
  }
  if (color === 'primary') {
    return RIPPLE_COLORS.primary;
  }
  return color;
}

export interface RippleItem {
  id: string;
  left: number;
  top: number;
  size: number;
  color: string;
  duration: number;
}

/**
 * Computes exact ripple circle geometry such that a circle starting at (clientX, clientY)
 * will expand to fully cover all four corners of the container rectangle with no layout shift.
 */
export function computeRippleGeometry(
  rect: { width: number; height: number; left: number; top: number },
  clientX: number,
  clientY: number
) {
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  // Maximum distance to container edges
  const maxX = Math.max(x, rect.width - x);
  const maxY = Math.max(y, rect.height - y);

  // Exact radius to furthest corner
  const radius = Math.ceil(Math.hypot(maxX, maxY));
  const size = radius * 2;
  const left = x - radius;
  const top = y - radius;

  return { x, y, radius, size, left, top };
}

export interface UseRippleOptions {
  color?: RippleVariant | string;
  duration?: number;
  disabled?: boolean;
}

export function useRipple({
  color = 'neutral',
  duration = 500,
  disabled = false,
}: UseRippleOptions = {}) {
  const [ripples, setRipples] = useState<RippleItem[]>([]);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const activeTimers = timersRef.current;
    return () => {
      activeTimers.forEach((timer) => clearTimeout(timer));
      activeTimers.clear();
    };
  }, []);

  const removeRipple = useCallback((id: string) => {
    setRipples((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const createRipple = useCallback(
    (target: HTMLElement, clientX: number, clientY: number) => {
      if (disabled) return;
      if (
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      ) {
        return;
      }

      const rect = target.getBoundingClientRect();
      const geom = computeRippleGeometry(rect, clientX, clientY);
      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const resolvedColor = resolveRippleColor(color);

      setRipples((prev) => [
        ...prev,
        {
          id,
          left: geom.left,
          top: geom.top,
          size: geom.size,
          color: resolvedColor,
          duration,
        },
      ]);

      // Fallback cleanup timer in case onAnimationEnd doesn't fire
      const timer = setTimeout(() => {
        timersRef.current.delete(timer);
        removeRipple(id);
      }, duration + 100);
      timersRef.current.add(timer);
    },
    [color, disabled, duration, removeRipple]
  );

  return {
    ripples,
    createRipple,
    removeRipple,
  };
}

export interface RippleProps {
  color?: RippleVariant | string;
  duration?: number;
  disabled?: boolean;
  className?: string;
}
