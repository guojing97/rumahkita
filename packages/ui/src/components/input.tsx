import * as React from 'react';
import { cn } from '../lib/utils.js';
import { Label } from './label.js';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  leftPrefix?: React.ReactNode;
  rightSuffix?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      label,
      required,
      error,
      helperText,
      leftPrefix,
      rightSuffix,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full">
        {label && (
          <Label htmlFor={inputId} required={required}>
            {label}
          </Label>
        )}
        <div className="relative flex items-center">
          {leftPrefix && (
            <div className="absolute left-3 flex items-center pointer-events-none text-muted font-medium font-body select-none">
              {leftPrefix}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            className={cn(
              'w-full bg-surface text-ink border-neo border-ink rounded-input px-3.5 py-2 text-sm font-body',
              'placeholder:text-muted/60 transition-colors duration-150',
              'focus:outline-none focus:ring-3 focus:ring-secondary focus:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-bg',
              leftPrefix && 'pl-10',
              rightSuffix && 'pr-10',
              error && 'border-danger focus:ring-danger/40',
              className
            )}
            {...props}
          />
          {rightSuffix && (
            <div className="absolute right-3 flex items-center pointer-events-none text-muted">
              {rightSuffix}
            </div>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="mt-1 text-xs font-medium text-danger font-body">
            {error}
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
Input.displayName = 'Input';
