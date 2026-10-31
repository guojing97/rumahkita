'use client';

import * as React from 'react';
import { cn } from '@rumahkita/ui';

export interface IDRInputProps {
  id?: string;
  label?: string;
  value?: number;
  onChange?: (val: number) => void;
  required?: boolean;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  min?: number;
  max?: number;
}

export const IDRInput = React.forwardRef<HTMLInputElement, IDRInputProps>(
  (
    {
      id,
      label,
      value = 0,
      onChange,
      required,
      error,
      helperText,
      disabled,
      placeholder = '0',
      className,
      min = 0,
      max = 999_999_999_999,
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    // Local display state to handle typing smoothly
    const [displayVal, setDisplayVal] = React.useState<string>(() => {
      if (value === undefined || value === null || isNaN(value) || value === 0) return '';
      return new Intl.NumberFormat('id-ID').format(value);
    });

    React.useEffect(() => {
      if (value === undefined || value === null || isNaN(value) || value === 0) {
        setDisplayVal('');
      } else {
        setDisplayVal(new Intl.NumberFormat('id-ID').format(value));
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^0-9]/g, '');
      if (!raw) {
        setDisplayVal('');
        onChange?.(0);
        return;
      }

      let parsed = parseInt(raw, 10);
      if (isNaN(parsed)) parsed = 0;
      if (parsed > max) parsed = max;
      if (parsed < min) parsed = min;

      setDisplayVal(new Intl.NumberFormat('id-ID').format(parsed));
      onChange?.(parsed);
    };

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-semibold text-ink mb-1.5 font-body">
            {label}
            {required && <span className="text-danger ml-1">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          <div className="absolute left-3.5 flex items-center pointer-events-none text-muted font-bold font-body select-none text-sm">
            Rp
          </div>
          <input
            ref={ref}
            id={inputId}
            type="text"
            inputMode="numeric"
            value={displayVal}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            className={cn(
              'w-full bg-surface text-ink border-neo border-ink rounded-input h-11 pl-11 pr-3.5 py-2 text-sm font-body tabular-nums font-semibold',
              'placeholder:text-muted/60 placeholder:font-normal transition-colors duration-150',
              'focus:outline-none focus:ring-3 focus:ring-secondary focus:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-bg',
              error && 'border-danger focus:ring-danger/40',
              className
            )}
          />
        </div>
        {error && (
          <p id={`${inputId}-error`} className="mt-1 text-xs font-semibold text-danger font-body flex items-center gap-1">
            <span>⚠</span>
            <span>{error}</span>
          </p>
        )}
        {!error && helperText && (
          <p id={`${inputId}-helper`} className="mt-1 text-xs text-muted font-body">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

IDRInput.displayName = 'IDRInput';
