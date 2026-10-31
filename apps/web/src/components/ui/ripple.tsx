'use client';

import React, { useEffect, useRef } from 'react';
import { cn } from '@rumahkita/ui';
import {
  useRipple,
  computeRippleGeometry,
  resolveRippleColor,
  RIPPLE_COLORS,
} from './use-ripple';
import type {
  RippleVariant,
  RippleItem,
  UseRippleOptions,
  RippleProps,
} from './use-ripple';

export {
  useRipple,
  computeRippleGeometry,
  resolveRippleColor,
  RIPPLE_COLORS,
};
export type {
  RippleVariant,
  RippleItem,
  UseRippleOptions,
  RippleProps,
};

/**
 * Reusable Neobrutalism Ripple Primitive
 * - Renders inside a relative container.
 * - Captures pointer down without e.preventDefault() / e.stopPropagation().
 * - Cleans up completed wave nodes automatically upon animation end.
 * - Respects prefers-reduced-motion.
 */
export function Ripple({
  color = 'neutral',
  duration = 500,
  disabled = false,
  className,
}: RippleProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const { ripples, createRipple, removeRipple } = useRipple({
    color,
    duration,
    disabled,
  });

  const createRippleRef = useRef(createRipple);
  createRippleRef.current = createRipple;

  useEffect(() => {
    if (disabled) return;
    const parent = containerRef.current?.parentElement;
    if (!parent) return;

    const handlePointerDown = (e: PointerEvent) => {
      // Only respond to primary button (touch or left mouse button)
      if (e.button !== 0 && e.pointerType === 'mouse') return;

      const clientX = e.clientX ?? 0;
      const clientY = e.clientY ?? 0;
      createRippleRef.current(parent, clientX, clientY);
    };

    parent.addEventListener('pointerdown', handlePointerDown, { passive: true });
    return () => {
      parent.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [disabled]);

  return (
    <span
      ref={containerRef}
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] select-none',
        className
      )}
      aria-hidden="true"
    >
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="animate-ripple absolute rounded-full pointer-events-none"
          style={{
            left: `${ripple.left}px`,
            top: `${ripple.top}px`,
            width: `${ripple.size}px`,
            height: `${ripple.size}px`,
            backgroundColor: ripple.color,
            animationDuration: `${ripple.duration}ms`,
            willChange: 'transform, opacity',
          }}
          onAnimationEnd={() => removeRipple(ripple.id)}
        />
      ))}
    </span>
  );
}
