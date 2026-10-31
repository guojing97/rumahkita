'use client';

import * as React from 'react';
import { cn } from '@rumahkita/ui';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, required, id, children, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id || generatedId;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-semibold text-ink mb-1.5 font-body">
            {label}
            {required && <span className="text-danger ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
            className={cn(
              'w-full bg-surface text-ink border-neo border-ink rounded-input h-11 px-3.5 py-2 text-sm font-body appearance-none cursor-pointer',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-3 focus:ring-secondary focus:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-bg',
              error && 'border-danger focus:ring-danger/40',
              className
            )}
            {...props}
          >
            {children}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-ink">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </div>
        </div>
        {error && (
          <p id={`${selectId}-error`} className="mt-1 text-xs font-semibold text-danger font-body flex items-center gap-1">
            <span>⚠</span>
            <span>{error}</span>
          </p>
        )}
        {!error && helperText && (
          <p id={`${selectId}-helper`} className="mt-1 text-xs text-muted font-body">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
